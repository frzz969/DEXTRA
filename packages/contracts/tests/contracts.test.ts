import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ActionIdSchema,
  ActionResultSchema,
  CONTRACT_VERSION,
  ERROR_CODES,
  ERROR_META,
  MandateSchema,
  PlanSchema,
  ToolResponseSchema,
  asPlanId,
  canonicalSerialize,
  computePlanHash,
} from '../src/index.ts';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8')) as unknown;
}

function fixtureObject(name: string): Record<string, unknown> {
  return fixture(name) as Record<string, unknown>;
}

test('plan fixtures: valid plans pass PlanSchema with contract version 1.0.0', () => {
  const files = [
    'plan-valid.json',
    'plan-budi-ambiguous.json',
    'plan-friday-conflict.json',
    'plan-injection-quarantined.json',
  ];

  for (const file of files) {
    const result = PlanSchema.safeParse(fixture(file));
    assert.equal(result.success, true, `${file} should pass PlanSchema: ${JSON.stringify(result)}`);
    if (result.success) {
      assert.equal(result.data.contract_version, CONTRACT_VERSION);
      assert.equal(result.data.org_id, 'org_kenari');
    }
  }
});

test('mandate fixtures: active and expired mandates pass MandateSchema', () => {
  for (const file of ['mandate-active.json', 'mandate-expired.json']) {
    const result = MandateSchema.safeParse(fixture(file));
    assert.equal(result.success, true, `${file} should pass MandateSchema: ${JSON.stringify(result)}`);
  }
});

test('PlanSchema rejects a missing required field and an unknown field', () => {
  const plan = fixtureObject('plan-valid.json');

  const missing = { ...plan };
  delete missing.intent;
  assert.equal(PlanSchema.safeParse(missing).success, false);

  assert.equal(PlanSchema.safeParse({ ...plan, unexpected_field: 'nope' }).success, false);
});

test('canonicalSerialize orders object keys by code unit and emits no whitespace', () => {
  assert.equal(canonicalSerialize({ b: 1, a: 2 }), canonicalSerialize({ a: 2, b: 1 }));
  assert.equal(canonicalSerialize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalSerialize({ z: null, a: [true, 'x'] }), '{"a":[true,"x"],"z":null}');
});

test('canonicalSerialize rejects undefined, non-finite numbers, functions, and lone surrogates', () => {
  assert.throws(() => canonicalSerialize({ a: undefined }), TypeError);
  assert.throws(() => canonicalSerialize([undefined]), TypeError);
  assert.throws(() => canonicalSerialize(Number.NaN), TypeError);
  assert.throws(() => canonicalSerialize(Number.POSITIVE_INFINITY), TypeError);
  assert.throws(() => canonicalSerialize(Number.NEGATIVE_INFINITY), TypeError);
  assert.throws(() => canonicalSerialize({ a: () => 1 }), TypeError);
  assert.throws(() => canonicalSerialize('a\uD800b'), TypeError);
  assert.throws(() => canonicalSerialize({ ['a\uDC00b']: 1 }), TypeError);
});

test('canonicalSerialize hashes ordinary and non-ASCII strings without error', () => {
  assert.equal(canonicalSerialize('Budi'), '"Budi"');
  assert.equal(canonicalSerialize('é'), '"é"');

  const plan = fixtureObject('plan-valid.json');
  const accented = { ...plan, intent: 'Kirim laporan ke Budi — é' };
  assert.match(computePlanHash(accented), /^sha256:[a-f0-9]{64}$/);
});

test('computePlanHash ignores key order and any existing top-level plan_hash', () => {
  const plan = fixtureObject('plan-valid.json');
  const reordered = Object.fromEntries(Object.entries(plan).reverse());
  const withoutHash = { ...plan };
  delete withoutHash.plan_hash;

  assert.equal(computePlanHash(plan), computePlanHash(reordered));
  assert.equal(computePlanHash(plan), computePlanHash(withoutHash));
  assert.equal(computePlanHash(plan), plan.plan_hash);
});

test('computePlanHash returns different hashes for plans with different content', () => {
  const plan = fixtureObject('plan-valid.json');
  const changed = JSON.parse(JSON.stringify(plan)) as Record<string, unknown>;
  changed.intent = 'Kirim laporan keuangan kepada seluruh divisi.';

  assert.notEqual(computePlanHash(plan), computePlanHash(changed));
});

test('TC-006: mandate plan_hash matches plan-valid and changes when the plan changes after approval', () => {
  const plan = PlanSchema.parse(fixture('plan-valid.json'));
  const mandate = MandateSchema.parse(fixture('mandate-active.json'));

  assert.equal(mandate.plan_hash, computePlanHash(plan));
  assert.equal(mandate.plan_hash, plan.plan_hash);

  const changedPlan = { ...plan, status: 'BLOCKED' as const };
  assert.notEqual(mandate.plan_hash, computePlanHash(changedPlan));
});

test('branded IDs: asPlanId accepts plan_001 and rejects other ID prefixes', () => {
  assert.equal(asPlanId('plan_001'), 'plan_001');
  assert.throws(() => asPlanId('mandate_001'), /Invalid PlanId/);
  assert.equal(ActionIdSchema.safeParse('action_001').success, true);
  assert.equal(ActionIdSchema.safeParse('plan_001').success, false);
});

test('ToolResponse discriminates on ok and failures require a known ERROR_CODES value', () => {
  const failure = {
    ok: false,
    error: { code: 'MANDATE_EXPIRED', message: 'Mandate is no longer valid.' },
    request_id: 'req_001',
  };

  const parsed = ToolResponseSchema.parse(failure);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(ERROR_CODES.safeParse(parsed.error.code).success, true);
  }

  const unknownCode = { ...failure, error: { code: 'NOT_A_REAL_CODE', message: 'x' } };
  assert.equal(ToolResponseSchema.safeParse(unknownCode).success, false);

  const success = { ok: true, data: { anything: 1 }, request_id: 'req_001' };
  assert.equal(ToolResponseSchema.safeParse(success).success, true);
});

test('MandateSchema rejects expires_at earlier than or equal to issued_at', () => {
  const mandate = fixtureObject('mandate-active.json');

  const equal = { ...mandate, expires_at: mandate.issued_at };
  assert.equal(MandateSchema.safeParse(equal).success, false);

  const earlier = { ...mandate, expires_at: '2026-10-01T00:00:00+07:00' };
  assert.equal(MandateSchema.safeParse(earlier).success, false);
});

test('ERROR_META marks only DUPLICATE_EXECUTION, EXECUTION_IN_PROGRESS, and MCP_UNAVAILABLE as retryable', () => {
  const retryableCodes = new Set(['DUPLICATE_EXECUTION', 'EXECUTION_IN_PROGRESS', 'MCP_UNAVAILABLE']);

  for (const code of ERROR_CODES.options) {
    assert.equal(ERROR_META[code].retryable, retryableCodes.has(code), `${code} retryable mismatch`);
  }
});

test('ActionResultSchema accepts the same mandate+action under different execution_key values (store owns dedup)', () => {
  const base = {
    mandate_id: 'mandate_001',
    action_id: 'action_001',
    result: 'sent',
    reason_code: null,
    executed_at: '2026-11-01T10:06:00+07:00',
    evidence: { mock_message_id: 'msg_001' },
  };

  const firstAttempt = { ...base, execution_id: 'exec_001', execution_key: 'attempt_001' };
  const secondAttempt = { ...base, execution_id: 'exec_002', execution_key: 'attempt_002' };

  assert.equal(ActionResultSchema.safeParse(firstAttempt).success, true);
  assert.equal(ActionResultSchema.safeParse(secondAttempt).success, true);
});
