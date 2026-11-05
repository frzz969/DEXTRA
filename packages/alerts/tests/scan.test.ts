import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ActionResultSchema,
  type ActionResult,
  type AuditEvent,
} from '../../contracts/src/index.ts';
import { listAlertDeliveries, listAudit } from '../../store/src/index.ts';
import { FakeTransport } from '../src/transport.ts';
import { scanAndDispatch } from '../src/scan.ts';

let dataDir = '';

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'dextra-scan-'));
  process.env.DEXTRA_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.DEXTRA_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

const NOW = new Date('2026-11-03T12:00:00.000Z');

function failedExecution(id: string): ActionResult {
  return ActionResultSchema.parse({
    execution_id: id,
    mandate_id: 'mandate_1',
    action_id: 'action_send_email',
    execution_key: `key-${id}`,
    result: 'failed',
    reason_code: 'EXECUTOR_FAILURE',
    executed_at: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
    evidence: {},
  });
}

const empty = { executions: [], mandates: [], approvals: [], audit: [] } as const;

describe('pemindaian dan pengiriman', () => {
  test('tanpa masalah: nol terdeteksi, tidak ada yang dikirim', async () => {
    const transport = new FakeTransport();
    const result = await scanAndDispatch({
      transport,
      chatId: '1',
      now: NOW,
      load: async () => ({ ...empty }),
      audit: async () => {},
      sleep: async () => {},
    });

    assert.equal(result.detected, 0);
    assert.equal(result.accepted, 0);
    assert.equal(transport.sent.length, 0);
  });

  test('satu kegagalan: satu alert terkirim dan tercatat di audit', async () => {
    const transport = new FakeTransport();
    const events: AuditEvent[] = [];

    const result = await scanAndDispatch({
      transport,
      chatId: '1',
      now: NOW,
      load: async () => ({ ...empty, executions: [failedExecution('exec_1')] }),
      audit: async (event) => {
        events.push(event);
      },
      sleep: async () => {},
    });

    assert.equal(result.detected, 1);
    assert.equal(result.accepted, 1);
    assert.equal(transport.sent.length, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, 'alert_dispatched');
    assert.ok(transport.sent[0]!.text.includes('execution_failed'));
  });

  test('pemindaian kedua atas data yang sama tidak mengirim ulang', async () => {
    const load = async () => ({ ...empty, executions: [failedExecution('exec_1')] });
    const audit = async () => {};

    const first = await scanAndDispatch({ transport: new FakeTransport(), chatId: '1', now: NOW, load, audit, sleep: async () => {} });
    const second = await scanAndDispatch({ transport: new FakeTransport(), chatId: '1', now: NOW, load, audit, sleep: async () => {} });

    assert.equal(first.accepted, 1);
    assert.equal(second.detected, 1, 'fakta yang sama masih terdeteksi');
    assert.equal(second.suppressed, 1, 'tetapi tidak dikirim ulang');
    assert.equal(second.accepted, 0);
  });

  test('satu alert yang gagal tidak menghentikan alert berikutnya', async () => {
    const transport = new FakeTransport([
      { ok: false, status: 401, error: 'unauthorized' },
      { ok: true, status: 200 },
    ]);

    const result = await scanAndDispatch({
      transport,
      chatId: '1',
      now: NOW,
      load: async () => ({
        ...empty,
        executions: [failedExecution('exec_1')],
        /* Jenis berbeda supaya kunci dedupe-nya berbeda: yang diuji di sini
           adalah kegagalan satu pengiriman, bukan penyatuan alert. */
        audit: [
          {
            event_id: 'evt_block' as AuditEvent['event_id'],
            at: new Date(NOW.getTime() - 60 * 1000).toISOString(),
            type: 'action_blocked',
            actor: 'executor',
            detail: { reason: 'mandate_rejected' },
          },
        ],
      }),
      audit: async () => {},
      sleep: async () => {},
    });

    assert.equal(result.detected, 2);
    assert.equal(result.failed, 1);
    assert.equal(result.accepted, 1);
    assert.equal(transport.sent.length, 2, 'alert kedua tetap dicoba');
  });

  test('hasil pemindaian melaporkan provider apa adanya', async () => {
    const fake = await scanAndDispatch({
      transport: new FakeTransport(),
      chatId: '1',
      now: NOW,
      load: async () => ({ ...empty }),
      audit: async () => {},
      sleep: async () => {},
    });
    assert.equal(fake.provider, 'fake', 'transport palsu tidak boleh tampak seperti telegram');
  });

  test('pemindaian produksi membaca store sungguhan dan menulis ke audit', async () => {
    /* Tanpa `load` dan tanpa `audit` yang disuntik: jalur produksi penuh. */
    const result = await scanAndDispatch({
      transport: new FakeTransport(),
      chatId: '1',
      now: NOW,
      sleep: async () => {},
    });

    assert.equal(result.detected, 0, 'store kosong: tidak ada yang perlu diberitahukan');

    const deliveries = await listAlertDeliveries();
    assert.equal(deliveries.deliveries.length, 0);
    const audit = await listAudit();
    assert.equal(audit.length, 0, 'tidak ada alert, tidak ada event audit alert');
  });
});
