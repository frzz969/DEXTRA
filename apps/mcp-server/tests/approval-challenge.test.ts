/*
 * D-04 regression: approval tokens are server-issued, bound, expiring, and
 * single-use.
 *
 * The old behaviour accepted any eight-character string, which the dashboard
 * minted itself (`apt_<timestamp>`). These tests fail if that ever comes back:
 * a client-minted token must be refused, and a server-issued one must not be
 * reusable, revivable after expiry, or transplantable to another plan/approver.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const dataDir = await mkdtemp(join(tmpdir(), 'dextra-approval-challenge-'));
process.env.DEXTRA_DATA_DIR = dataDir;
process.env.DEXTRA_OPS_PRINCIPAL = 'usr_nadia';

const { seed, createApprovalChallenge, listApprovalChallenges } = await import(
  '../../../packages/store/src/index.ts'
);
const { handleTool } = await import('../src/handlers.ts');

const previousPrincipal = process.env.DEXTRA_OPS_PRINCIPAL;
after(async () => {
  if (previousPrincipal === undefined) delete process.env.DEXTRA_OPS_PRINCIPAL;
  else process.env.DEXTRA_OPS_PRINCIPAL = previousPrincipal;
  await rm(dataDir, { recursive: true, force: true });
});

let sequence = 0;

async function makePlan(): Promise<{ plan_id: string; plan_hash: string }> {
  sequence += 1;
  const created = await handleTool(
    'create_plan',
    {
      org_id: 'org_kenari',
      request_id: `req_challenge_${sequence}`,
      intent: 'kirim notulen rapat ke Budi',
      actions: [
        {
          action_type: 'send_email',
          target: {
            contact_id: 'c_budi_fin',
            display_name: 'Budi Santoso',
            channel: 'email',
            masked_address: 'b***@kenari.co.id',
          },
          schedule: { start_at: '2026-11-04T09:00:00+07:00', timezone: 'Asia/Jakarta', all_day: false },
          content: { subject: 'Notulen Rapat', body: 'Halo Budi, berikut notulen rapat.', locale: 'id-ID' },
        },
      ],
    },
    'ops',
  );
  assert.equal(created.ok, true, JSON.stringify(created));
  return created.data.plan;
}

function submit(plan: { plan_id: string; plan_hash: string }, approval_token: string) {
  return handleTool(
    'submit_approval',
    { plan_id: plan.plan_id, plan_hash: plan.plan_hash, decision: 'approve', approval_token },
    'ops',
  );
}

test('a client-minted token is refused even when it looks plausible', async () => {
  await seed({ reset: true });
  const plan = await makePlan();
  const res = await submit(plan, `apt_${Date.now()}`);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'APPROVAL_CHALLENGE_MISSING');
});

test('a server-issued challenge approves once and issues a mandate', async () => {
  await seed({ reset: true });
  const plan = await makePlan();
  const challenge = await createApprovalChallenge({
    planId: plan.plan_id,
    planHash: plan.plan_hash,
    approverPrincipalId: 'usr_nadia',
  });
  const res = await submit(plan, challenge.approval_token);
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.data.status, 'granted');
  assert.ok(res.data.mandate_id);

  const stored = (await listApprovalChallenges()).find((c) => c.challenge_id === challenge.challenge_id);
  assert.ok(stored?.consumed_at, 'challenge must be marked consumed');
});

test('the same challenge cannot be used twice', async () => {
  await seed({ reset: true });
  const plan = await makePlan();
  const challenge = await createApprovalChallenge({
    planId: plan.plan_id,
    planHash: plan.plan_hash,
    approverPrincipalId: 'usr_nadia',
  });
  assert.equal((await submit(plan, challenge.approval_token)).ok, true);
  const second = await submit(plan, challenge.approval_token);
  assert.equal(second.ok, false);
  assert.equal(second.error.code, 'APPROVAL_CHALLENGE_CONSUMED');
});

test('an expired challenge is refused', async () => {
  await seed({ reset: true });
  const plan = await makePlan();
  const challenge = await createApprovalChallenge({
    planId: plan.plan_id,
    planHash: plan.plan_hash,
    approverPrincipalId: 'usr_nadia',
    ttlMs: 1000,
    now: new Date(Date.now() - 60_000),
  });
  const res = await submit(plan, challenge.approval_token);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'APPROVAL_CHALLENGE_EXPIRED');
});

test('a challenge for one plan cannot approve another', async () => {
  await seed({ reset: true });
  const first = await makePlan();
  const second = await makePlan();
  const challenge = await createApprovalChallenge({
    planId: first.plan_id,
    planHash: first.plan_hash,
    approverPrincipalId: 'usr_nadia',
  });
  const res = await submit(second, challenge.approval_token);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'APPROVAL_CHALLENGE_MISMATCH');
});

test('a challenge bound to another approver is refused', async () => {
  await seed({ reset: true });
  const plan = await makePlan();
  const challenge = await createApprovalChallenge({
    planId: plan.plan_id,
    planHash: plan.plan_hash,
    approverPrincipalId: 'usr_sari',
  });
  const res = await submit(plan, challenge.approval_token);
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'APPROVAL_CHALLENGE_MISMATCH');
});

test('the request tool returns no code to the caller', async () => {
  await seed({ reset: true });
  const plan = await makePlan();
  const res = await handleTool(
    'request_approval_challenge',
    { plan_id: plan.plan_id, plan_hash: plan.plan_hash },
    'ops',
  );
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.ok(res.data.challenge_id);
  assert.ok(res.data.expires_at);
  // In non-production the token is returned to enable automation; production keeps it terminal-only.
  if (process.env.DEXTRA_ENV === 'production') {
    assert.equal(res.data.approval_token, undefined, 'token must not be returned in production');
    assert.equal(res.data.code, undefined, 'code is terminal-only in production');
  } else {
    assert.ok(res.data.approval_token, 'token is returned in dev/test mode for automation');
  }
});

test('the agent scope cannot request an approval challenge', async () => {
  const res = await handleTool(
    'request_approval_challenge',
    { plan_id: 'plan_x', plan_hash: 'hash_x' },
    'agent',
  );
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'ACTION_NOT_ALLOWED');
});
