import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

// Isolated data dir — never touches the repo's data/.
const dataDir = await mkdtemp(join(tmpdir(), 'dextra-exec-'));
process.env.DEXTRA_DATA_DIR = dataDir;

const { seed } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');

const PLAN_ARGS = {
  org_id: 'org_kenari',
  request_id: 'req_exec01',
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
};

async function approvedPlan() {
  const created = await handleTool('create_plan', PLAN_ARGS, 'ops');
  assert.equal(created.ok, true);
  const plan = created.data.plan;

  const approved = await handleTool(
    'submit_approval',
    {
      plan_id: plan.plan_id,
      plan_hash: plan.plan_hash,
      decision: 'approve',
      approver_id: 'user_001',
      approval_token: `apt_${Date.now()}`,
    },
    'ops',
  );
  assert.equal(approved.ok, true, JSON.stringify(approved));
  assert.ok(approved.data.mandate_id, 'approval should issue a mandate');
  return { plan, mandateId: approved.data.mandate_id as string };
}

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

test('approve → execute produces a sent result with evidence', async () => {
  await seed();
  const { plan, mandateId } = await approvedPlan();
  const actionId = plan.actions[0].action_id;

  const res = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: actionId, execution_key: `${mandateId}:${actionId}` },
    'ops',
  );
  assert.equal(res.ok, true);
  const result = res.data.result;
  assert.equal(result.result, 'sent');
  assert.equal(result.reason_code, null);
  assert.ok(result.evidence.mock_message_id, 'evidence must carry the adapter id');
  assert.equal(result.mandate_id, mandateId);
  assert.equal(result.action_id, actionId);
});

test('executing the same mandate+action twice is idempotent', async () => {
  const { plan, mandateId } = await approvedPlan();
  const actionId = plan.actions[0].action_id;

  const first = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: actionId, execution_key: `${mandateId}:${actionId}` },
    'ops',
  );
  const second = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: actionId, execution_key: `${mandateId}:${actionId}:retry` },
    'ops',
  );

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(
    second.data.result.execution_id,
    first.data.result.execution_id,
    'a repeat call must return the original execution, not a new one',
  );
});

test('a revoked mandate blocks execution', async () => {
  const { plan, mandateId } = await approvedPlan();
  const actionId = plan.actions[0].action_id;

  const revoked = await handleTool('revoke_mandate', { mandate_id: mandateId }, 'ops');
  assert.equal(revoked.ok, true);
  assert.equal(revoked.data.mandate.status, 'revoked');

  const res = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: actionId, execution_key: `${mandateId}:${actionId}` },
    'ops',
  );
  assert.equal(res.ok, true);
  assert.equal(res.data.result.result, 'blocked');
  assert.equal(res.data.result.reason_code, 'MANDATE_REVOKED');
});

test('an action outside the mandate is blocked', async () => {
  const { mandateId } = await approvedPlan();
  const res = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: 'action_999', execution_key: `${mandateId}:action_999` },
    'ops',
  );
  assert.equal(res.ok, true);
  assert.equal(res.data.result.result, 'blocked');
  assert.equal(res.data.result.reason_code, 'ACTION_NOT_ALLOWED');
});

test('list_executions reflects a real execution, newest first', async () => {
  const { plan, mandateId } = await approvedPlan();
  const actionId = plan.actions[0].action_id;
  await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: actionId, execution_key: `${mandateId}:${actionId}` },
    'ops',
  );

  const all = await handleTool('list_executions', { limit: 200 }, 'ops');
  assert.equal(all.ok, true);
  assert.ok(all.data.executions.length > 0);

  const mine = all.data.executions.filter((e: any) => e.mandate_id === mandateId);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].result, 'sent');
  assert.equal(mine[0].action_id, actionId);

  for (let i = 1; i < all.data.executions.length; i += 1) {
    assert.ok(
      Date.parse(all.data.executions[i - 1].executed_at) >= Date.parse(all.data.executions[i].executed_at),
      'executions must be sorted newest first',
    );
  }

  const scoped = await handleTool('list_executions', { mandate_id: mandateId, limit: 200 }, 'ops');
  assert.equal(scoped.ok, true);
  assert.ok(scoped.data.executions.every((e: any) => e.mandate_id === mandateId));
});

test('a weak approval token cannot issue a mandate', async () => {
  const created = await handleTool('create_plan', PLAN_ARGS, 'ops');
  const plan = created.data.plan;
  const res = await handleTool(
    'submit_approval',
    {
      plan_id: plan.plan_id,
      plan_hash: plan.plan_hash,
      decision: 'approve',
      approver_id: 'user_001',
      approval_token: 'apt_demo',
    },
    'ops',
  );
  assert.equal(res.ok, false);
  assert.match(res.error.message, /demo approval token/i);
});
