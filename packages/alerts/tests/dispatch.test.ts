import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AuditEvent } from '../../contracts/src/index.ts';
import { getAlertDelivery, listAudit } from '../../store/src/index.ts';
import { FakeTransport } from '../src/transport.ts';
import { createAlert } from '../src/policy.ts';
import { dispatchAlert, type DispatchDeps } from '../src/dispatch.ts';

let dataDir = '';

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'dextra-alerts-'));
  process.env.DEXTRA_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.DEXTRA_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

const T0 = new Date('2026-11-03T10:00:00.000Z');

function makeAlert(at: Date = T0, kind: 'execution_failed' | 'security_rejection' = 'execution_failed') {
  return createAlert({
    kind,
    subject: { plan_id: 'plan_abc', action_id: 'action_send_email' },
    at,
    payload: { pesan: 'eksekusi gagal' },
  });
}

function deps(
  transport: FakeTransport,
  overrides: Partial<DispatchDeps> = {},
): Omit<DispatchDeps, 'transport'> & { transport: FakeTransport; sleeps: number[]; events: AuditEvent[] } {
  const sleeps: number[] = [];
  const events: AuditEvent[] = [];
  /* `transport` is excluded from the overrides spread on purpose: the caller's
     FakeTransport must stay visible as a FakeTransport so tests can read
     `sent`. A generic `AlertTransport` would typecheck and then fail at the
     assertion. */
  const { transport: _transportOverride, ...rest } = overrides;
  void _transportOverride;
  return {
    transport,
    chatId: '12345',
    now: () => new Date(T0),
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    /* Fixed jitter makes backoff exactly the base value, so a test can assert
       the schedule instead of a range. */
    jitter: () => 0.5,
    audit: async (event: AuditEvent) => {
      events.push(event);
    },
    sleeps,
    events,
    ...rest,
  };
}

describe('pengiriman alert', () => {
  test('kirim sukses: accepted_by_provider, satu percobaan', async () => {
    const transport = new FakeTransport();
    const d = deps(transport);

    const outcome = await dispatchAlert(makeAlert(), d);

    assert.equal(outcome.status, 'accepted_by_provider');
    assert.equal(outcome.attempts, 1);
    assert.equal(transport.sent.length, 1);
    assert.equal(d.sleeps.length, 0);
    assert.equal(outcome.delivery.attempts[0]!.status, 'accepted_by_provider');
  });

  test('500 lalu 200: sukses pada percobaan kedua', async () => {
    const transport = new FakeTransport([
      { ok: false, status: 500, error: 'internal' },
      { ok: true, status: 200 },
    ]);
    const d = deps(transport);

    const outcome = await dispatchAlert(makeAlert(), d);

    assert.equal(outcome.status, 'accepted_by_provider');
    assert.equal(outcome.attempts, 2);
    assert.deepEqual(outcome.delivery.attempts.map((a) => a.status), ['retryable_failure', 'accepted_by_provider']);
    assert.equal(d.sleeps.length, 1, 'satu jeda antara dua percobaan');
    assert.equal(d.sleeps[0], 2_000, 'jeda percobaan pertama adalah 2s');
  });

  test('429 dengan retry_after 3: menunggu 3 detik, bukan backoff default', async () => {
    const transport = new FakeTransport([
      { ok: false, status: 429, retry_after: 3, error: 'too many requests' },
      { ok: true, status: 200 },
    ]);
    const d = deps(transport);

    await dispatchAlert(makeAlert(), d);

    assert.deepEqual(d.sleeps, [3_000]);
  });

  test('401: permanent_failure dan tidak diulang', async () => {
    const transport = new FakeTransport([{ ok: false, status: 401, error: 'unauthorized' }]);
    const d = deps(transport);

    const outcome = await dispatchAlert(makeAlert(), d);

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.attempts, 1);
    assert.equal(transport.sent.length, 1, 'tidak ada percobaan kedua');
    assert.equal(d.sleeps.length, 0);
    assert.equal(outcome.delivery.attempts[0]!.status, 'permanent_failure');
  });

  test('timeout tiga kali lalu sukses: sukses pada percobaan keempat', async () => {
    const transport = new FakeTransport([
      { ok: false, error: 'timeout' },
      { ok: false, error: 'timeout' },
      { ok: false, error: 'timeout' },
      { ok: true, status: 200 },
    ]);
    const d = deps(transport);

    const outcome = await dispatchAlert(makeAlert(), d);

    assert.equal(outcome.status, 'accepted_by_provider');
    assert.equal(outcome.attempts, 4);
    assert.deepEqual(d.sleeps, [2_000, 8_000, 30_000], 'backoff eksponensial');
  });

  test('gagal lima kali: failed, tidak ada percobaan keenam', async () => {
    const transport = new FakeTransport([
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: false, status: 500 },
    ]);
    const d = deps(transport);

    const outcome = await dispatchAlert(makeAlert(), d);

    assert.equal(outcome.status, 'failed');
    assert.equal(outcome.attempts, 5);
    assert.equal(transport.sent.length, 5, 'percobaan keenam tidak pernah dikirim');
    assert.equal(d.sleeps.length, 4, 'jeda hanya di antara percobaan, bukan sesudah yang terakhir');
  });

  test('alert sama dua kali dalam jendela: yang kedua suppressed_duplicate', async () => {
    const alert = makeAlert();
    const first = deps(new FakeTransport());
    const second = deps(new FakeTransport());

    const a = await dispatchAlert(alert, first);
    const b = await dispatchAlert(alert, second);

    assert.equal(a.status, 'accepted_by_provider');
    assert.equal(b.status, 'suppressed_duplicate');
    assert.equal(second.transport.sent.length, 0, 'tidak ada pesan kedua');
    assert.equal(b.delivery.suppressed_count, 1);
    assert.equal(b.delivery.status, 'accepted_by_provider', 'status asli tidak ditimpa');

    const stored = await getAlertDelivery(alert.alert_id);
    assert.equal(stored?.suppressed_count, 1, 'hitungan duplikat tersimpan');
  });

  test('alert sama setelah jendela lewat: dikirim lagi', async () => {
    const alert1 = makeAlert(T0);
    const alert2 = makeAlert(new Date(T0.getTime() + 16 * 60 * 1000));

    assert.notEqual(alert1.alert_id, alert2.alert_id, 'bucket baru menghasilkan alert baru');

    const a = await dispatchAlert(alert1, deps(new FakeTransport()));
    const b = await dispatchAlert(alert2, deps(new FakeTransport()));

    assert.equal(a.status, 'accepted_by_provider');
    assert.equal(b.status, 'accepted_by_provider', 'kegagalan berulang harus memberi tahu lagi');
  });

  test('setiap percobaan menghasilkan tepat satu event audit', async () => {
    const transport = new FakeTransport([
      { ok: false, status: 500 },
      { ok: false, status: 500 },
      { ok: true, status: 200 },
    ]);
    const d = deps(transport);

    await dispatchAlert(makeAlert(), d);

    assert.equal(d.events.length, 3);
    assert.deepEqual(d.events.map((e) => e.type), ['alert_failed', 'alert_failed', 'alert_dispatched']);
    assert.deepEqual(d.events.map((e) => e.detail.attempt), ['1', '2', '3']);
    for (const event of d.events) {
      assert.equal(event.actor, 'service');
      assert.equal(event.detail.alert_id, makeAlert().alert_id);
    }
  });

  test('event audit alert benar-benar lolos kontrak dan masuk rantai', async () => {
    /* Tanpa `audit` yang disuntik: jalur produksi, termasuk enum baru di
       AuditEventTypeSchema dan appendAudit. */
    const transport = new FakeTransport();
    const d = deps(transport, { audit: undefined });

    await dispatchAlert(makeAlert(), d);

    const events = await listAudit();
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, 'alert_dispatched');
    assert.ok(events[0]!.hash, 'event alert ikut masuk rantai hash');
  });
});
