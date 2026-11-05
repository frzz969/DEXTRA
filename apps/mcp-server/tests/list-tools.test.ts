import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

// The store resolves DEXTRA_DATA_DIR lazily on every operation, so setting it
// before the first call is enough — these tests never touch the repo's data/.
const dataDir = await mkdtemp(join(tmpdir(), 'dextra-list-'));
process.env.DEXTRA_DATA_DIR = dataDir;

const { seed } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');

function planArgs(requestId: string, body: string) {
  return {
    org_id: 'org_kenari',
    request_id: requestId,
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
        content: { subject: 'Notulen Rapat', body, locale: 'id-ID' },
      },
    ],
  };
}

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

test('list_plans returns saved plans newest first', async () => {
  await seed();
  const first = await handleTool('create_plan', planArgs('req_list01', 'pertama'), 'ops');
  assert.equal(first.ok, true, 'create_plan should succeed');
  await new Promise((resolve) => setTimeout(resolve, 5));
  const second = await handleTool('create_plan', planArgs('req_list02', 'kedua'), 'ops');
  assert.equal(second.ok, true);

  const res = await handleTool('list_plans', { limit: 200 }, 'ops');
  assert.equal(res.ok, true);
  const plans = res.data.plans;
  assert.equal(plans.length, 2);
  assert.equal(res.data.total, 2);
  assert.equal(plans[0].plan_id, 'plan_list02', 'newest plan comes first');
  for (let i = 1; i < plans.length; i += 1) {
    assert.ok(
      Date.parse(plans[i - 1].created_at) >= Date.parse(plans[i].created_at),
      'plans must be sorted by created_at descending',
    );
  }
});

test('list_plans honours the status filter', async () => {
  const all = await handleTool('list_plans', { limit: 200 }, 'ops');
  const target = all.data.plans[0].status as string;

  const filtered = await handleTool('list_plans', { status: target, limit: 200 }, 'ops');
  assert.equal(filtered.ok, true);
  assert.ok(filtered.data.plans.length > 0);
  assert.ok(filtered.data.plans.every((p: any) => p.status === target));

  const none = await handleTool('list_plans', { status: 'NO_SUCH_STATUS', limit: 200 }, 'ops');
  assert.equal(none.ok, true);
  assert.equal(none.data.plans.length, 0);
  assert.equal(none.data.total, 0);
});

test('list_plans honours the limit', async () => {
  const res = await handleTool('list_plans', { limit: 1 }, 'ops');
  assert.equal(res.ok, true);
  assert.equal(res.data.plans.length, 1);
  assert.equal(res.data.total, 2, 'total reports the full count, not the page');
});

test('list_mandates returns an array and never invents a usage count', async () => {
  const res = await handleTool('list_mandates', { limit: 200 }, 'ops');
  assert.equal(res.ok, true);
  assert.ok(Array.isArray(res.data.mandates));
  for (const mandate of res.data.mandates) {
    assert.ok(typeof mandate.mandate_id === 'string');
    assert.ok(typeof mandate.status === 'string');
    assert.equal('uses' in mandate, false, 'the store does not track consumption');
  }
});
