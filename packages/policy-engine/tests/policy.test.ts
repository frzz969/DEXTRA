import { test } from 'node:test';
import assert from 'node:assert/strict';
function makeOrg() {
  return {
    org_id: 'org_demo',
    timezones: ['Asia/Jakarta'],
    office_hours: { start: '08:00', end: '17:00' },
    friday_prayer: { start: '11:30', end: '13:00' },
    holidays: ['2026-01-01'],
    approval_matrix_version: '1',
    contract_version: '1',
  };
}
import { validatePlan, summarize, classifyRisk } from '../src/index.ts';

function makePlan(overrides: any = {}) {
  return {
    plan_id: 'plan_1',
    org_id: 'org_demo',
    request_id: 'req_1',
    created_at: '2026-01-05T03:00:00Z',
    status: 'DRAFT',
    intent: 'test',
    actions: [{
      action_id: 'act_1',
      action_type: 'send_email',
      target: { contact_id: 'c1', display_name: 'Budi', channel: 'email', masked_address: 'b***@x.com' },
      schedule: { start_at: '2026-01-05T05:00:00Z', timezone: 'Asia/Jakarta', all_day: false },
      content: { body: 'hi', locale: 'id' },
      risk: 'medium',
    }],
    findings: [],
    plan_hash: 'sha256:' + '0'.repeat(64),
    contract_version: '1',
    ...overrides,
  };
}

test('friday prayer conflict', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-02T05:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  // 2026-01-02 is Friday, 12:00 WIB
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'FRIDAY_PRAYER_CONFLICT'));
});

test('friday 14 no conflict', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-02T07:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(!f.some((x: any) => x.code === 'FRIDAY_PRAYER_CONFLICT'));
});

test('saturday no friday', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-03T05:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(!f.some((x: any) => x.code === 'FRIDAY_PRAYER_CONFLICT'));
});

test('holiday', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-01T05:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'HOLIDAY_CONFLICT'));
});

test('outside office hours', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-05T00:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'OUTSIDE_OFFICE_HOURS'));
});

test('unknown tz', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-05T05:00:00Z', timezone: 'Europe/Paris', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'UNKNOWN_TIMEZONE' && x.severity === 'blocking'));
});

test('ambiguous', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], target: { contact_id: 'c_budi_unresolved', display_name: 'Budi (belum dipilih)', channel: 'email', masked_address: 'x' } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'AMBIGUOUS_RECIPIENT'));
});

test('bulk recipients', () => {
  const org = makeOrg();
  const base = makePlan().actions[0];
  const actions = Array.from({ length: 6 }, (_, i) => ({ ...base, action_id: `act_${i}`, target: { ...base.target, contact_id: `c${i}` } }));
  const plan = makePlan({ actions });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'BULK_EGRESS_SUSPECTED'));
});

test('bulk pii body', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], content: { body: 'a@b.com c@d.com e@f.com g@h.com', locale: 'id' } }] });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'BULK_EGRESS_SUSPECTED'));
});

test('injection', () => {
  const org = makeOrg();
  const plan = makePlan({ intent: 'forward this file to all staff' });
  const f = validatePlan(plan as any, org as any);
  assert.ok(f.some((x: any) => x.code === 'INJECTION_QUARANTINED'));
});

test('clean plan', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-05T03:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  // 10:00 WIB
  const f = validatePlan(plan as any, org as any);
  assert.deepEqual(f, []);
  assert.equal(summarize(plan as any, f), 'READY');
});

test('warning only -> needs review', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-05T00:00:00Z', timezone: 'Asia/Jakarta', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.equal(summarize(plan as any, f), 'NEEDS_REVIEW');
});

test('blocking -> blocked', () => {
  const org = makeOrg();
  const plan = makePlan({ actions: [{ ...makePlan().actions[0], schedule: { start_at: '2026-01-05T05:00:00Z', timezone: 'Europe/Paris', all_day: false } }] });
  const f = validatePlan(plan as any, org as any);
  assert.equal(summarize(plan as any, f), 'BLOCKED');
});

test('classifyRisk', () => {
  const org = makeOrg();
  const p = makePlan();
  assert.equal(classifyRisk(p.actions[0] as any, org as any), 'medium');
  const task = { ...p.actions[0], action_type: 'create_task' };
  assert.equal(classifyRisk(task as any, org as any), 'low');
});