import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlan } from '../../plan/src/builder.ts';
import { validatePlan } from '../../plan/src/validate.ts';
import { issueMandate } from '../src/issue.ts';
import { validateMandate, isExpired, isConsumed } from '../src/validate.ts';
import { revokeMandate } from '../src/revoke.ts';
import { verifySignature } from '../src/sign.ts';
import { OrgSchema, ApprovalSchema, type Org, type Approval, type Plan } from '../../contracts/src/index.ts';

const ORG: Org = OrgSchema.parse({
  org_id: 'org_kenari',
  timezones: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  office_hours: { start: '08:00', end: '17:00' },
  friday_prayer: { start: '11:30', end: '13:00' },
  holidays: ['2026-11-10'],
  approval_matrix_version: '1.0',
  contract_version: '1.0.0',
});

function makePlan() {
  const plan = createPlan({
    org_id: 'org_kenari' as never,
    request_id: 'req_test' as never,
    intent: 'Kirim notulen rapat ke Pak Budi',
    created_at: '2026-11-01T10:00:00+07:00',
    actions: [
      {
        action_type: 'send_email' as const,
        target: { contact_id: 'c_budi_fin' as never, display_name: 'Budi Santoso', channel: 'email' as const, masked_address: 'b***@kenari.co.id' },
        schedule: { start_at: '2026-11-03T09:00:00+07:00', timezone: 'Asia/Jakarta', all_day: false },
        content: { subject: 'Notulen', body: 'Halo Budi', locale: 'id-ID' },
      },
    ],
  });
  return validatePlan(plan, ORG);
}

function makeApproval(plan: Plan, overrides: Partial<Approval> = {}): Approval {
  return ApprovalSchema.parse({
    approval_id: 'appr_001',
    plan_id: plan.plan_id,
    plan_hash: plan.plan_hash,
    decision: 'approve',
    approver_id: 'user_001',
    approval_token: 'apt_abc123',
    issued_at: '2026-11-01T10:05:00+07:00',
    expires_at: '2026-11-01T10:20:00+07:00',
    status: 'granted',
    ...overrides,
  });
}

describe('mandate engine', () => {
  test('issueMandate with granted approval and READY plan yields valid active mandate', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    assert.equal(mandate.status, 'active');
    assert.equal(verifySignature(mandate), true);
    assert.equal(mandate.plan_id, plan.plan_id);
    assert.equal(mandate.plan_hash, plan.plan_hash);
    assert.ok(mandate.allowed_action_ids.length === 1);
    assert.ok(mandate.allowed_action_types.includes('send_email'));
  });

  test('issueMandate rejects non-approve decision', () => {
    const plan = makePlan();
    const approval = makeApproval(plan, { decision: 'reject' });
    assert.throws(() => issueMandate({ plan, approval, approver_id: 'user_001' }), /approval not granted/);
  });

  test('issueMandate rejects BLOCKED plan', () => {
    const plan = makePlan();
    const blocked = { ...plan, status: 'BLOCKED' as const };
    const approval = makeApproval(blocked);
    assert.throws(() => issueMandate({ plan: blocked, approval, approver_id: 'user_001' }), /plan not ready/);
  });

  test('issueMandate rejects plan hash mismatch in approval', () => {
    const plan = makePlan();
    const approval = makeApproval(plan, { plan_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000' });
    assert.throws(() => issueMandate({ plan, approval, approver_id: 'user_001' }), /plan mismatch/);
  });

  test('validateMandate: null mandate -> MANDATE_NOT_FOUND', () => {
    const plan = makePlan();
    const r = validateMandate({ mandate: null, plan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'MANDATE_NOT_FOUND');
  });

  test('validateMandate: tampered signature -> MANDATE_NOT_FOUND', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const tampered = { ...mandate, allowed_action_ids: [...mandate.allowed_action_ids, 'action_999' as never] };
    const r = validateMandate({ mandate: tampered, plan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'MANDATE_NOT_FOUND');
  });

  test('validateMandate: revoked -> MANDATE_REVOKED', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const revoked = revokeMandate(mandate, '2026-11-01T10:06:00+07:00');
    const r = validateMandate({ mandate: revoked, plan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'MANDATE_REVOKED');
  });

  test('validateMandate: expired -> MANDATE_EXPIRED', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', ttl_seconds: 1, now: '2026-11-01T10:05:00+07:00' });
    const r = validateMandate({ mandate, plan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T11:00:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'MANDATE_EXPIRED');
  });

  test('validateMandate: plan hash mismatch -> PLAN_HASH_MISMATCH', async () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const tamperedPlan = { ...plan, intent: 'berubah' };
    // recompute hash so plan_hash differs from mandate
    const { computePlanHash } = await import('../../contracts/src/hash.ts');
    tamperedPlan.plan_hash = computePlanHash(tamperedPlan);
    const r = validateMandate({ mandate, plan: tamperedPlan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'PLAN_HASH_MISMATCH');
  });

  test('validateMandate: action_id not allowed -> ACTION_NOT_ALLOWED', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const r = validateMandate({ mandate, plan, action_id: 'action_999' as never, action_type: 'send_email', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'ACTION_NOT_ALLOWED');
  });

  test('validateMandate: action_type not allowed (confused deputy) -> ACTION_NOT_ALLOWED', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const r = validateMandate({ mandate, plan, action_id: plan.actions[0]!.action_id, action_type: 'create_task', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'ACTION_NOT_ALLOWED');
  });

  test('validateMandate: clock manipulation (now < issued_at) -> MANDATE_EXPIRED', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const r = validateMandate({ mandate, plan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T09:00:00+07:00' });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason_code, 'MANDATE_EXPIRED');
  });

  test('validateMandate: all valid -> ok', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const r = validateMandate({ mandate, plan, action_id: plan.actions[0]!.action_id, action_type: 'send_email', now: '2026-11-01T10:06:00+07:00' });
    assert.equal(r.ok, true);
  });

  test('revokeMandate on active -> revoked and signature still valid', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const revoked = revokeMandate(mandate, '2026-11-01T10:06:00+07:00');
    assert.equal(revoked.status, 'revoked');
    assert.equal(verifySignature(revoked), true);
  });

  test('revokeMandate on expired -> stays expired', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', ttl_seconds: 1, now: '2026-11-01T10:05:00+07:00' });
    const revoked = revokeMandate(mandate, '2026-11-01T11:00:00+07:00');
    assert.equal(revoked.status, 'expired');
  });

  test('revokeMandate is idempotent', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', now: '2026-11-01T10:05:00+07:00' });
    const once = revokeMandate(mandate, '2026-11-01T10:06:00+07:00');
    const twice = revokeMandate(once, '2026-11-01T10:07:00+07:00');
    assert.equal(twice.status, 'revoked');
  });

  test('isExpired and isConsumed helpers', () => {
    const plan = makePlan();
    const approval = makeApproval(plan);
    const mandate = issueMandate({ plan, approval, approver_id: 'user_001', ttl_seconds: 1, now: '2026-11-01T10:05:00+07:00' });
    assert.equal(isExpired(mandate, '2026-11-01T11:00:00+07:00'), true);
    assert.equal(isConsumed(mandate), false);
  });
});
