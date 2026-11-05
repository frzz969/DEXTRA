import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { summarizeExecutions } from '../src/repository.ts';
import type { ActionResult } from '../../contracts/src/index.ts';

/*
 * A row with no `usage` at all: records written before telemetry existed.
 * These must still count toward `total` — they are real executions — but must
 * never contribute to latency, tokens, or cost.
 */
function legacyRow(result: ActionResult['result']): ActionResult {
  return {
    execution_id: `exec_${Math.random().toString(36).slice(2, 10)}` as ActionResult['execution_id'],
    mandate_id: 'mandate_test' as ActionResult['mandate_id'],
    action_id: 'act_test' as ActionResult['action_id'],
    execution_key: 'ek_test',
    result,
    reason_code: null,
    executed_at: '2026-11-03T00:00:00.000Z',
    evidence: {},
  };
}

function measuredRow(
  result: ActionResult['result'],
  latency_ms: number,
  tokens: { in: number; out: number; cost: number } | null,
): ActionResult {
  return {
    ...legacyRow(result),
    usage: {
      provider: tokens ? 'openai' : 'mock',
      model: tokens ? 'gpt-4o-mini' : null,
      tokens_in: tokens ? tokens.in : null,
      tokens_out: tokens ? tokens.out : null,
      cost_usd: tokens ? tokens.cost : null,
      latency_ms,
    },
  };
}

describe('summarizeExecutions', () => {
  test('tanpa data: tidak ada angka yang dikarang', () => {
    const s = summarizeExecutions([]);
    assert.equal(s.total, 0);
    assert.equal(s.dispatch_rate, null, 'pembagian nol tidak boleh jadi 0%');
    assert.equal(s.latency.measured, 0);
    assert.equal(s.latency.p50_ms, null);
    assert.equal(s.latency.p95_ms, null);
    assert.equal(s.latency.max_ms, null);
    assert.equal(s.tokens.measured, 0);
    assert.equal(s.tokens.total, 0);
    assert.equal(s.cost_usd.measured, 0);
    assert.equal(s.cost_usd.total, 0);
  });

  test('adapter mock: latensi terukur, token dan biaya TIDAK', () => {
    const s = summarizeExecutions([measuredRow('sent', 12, null), measuredRow('sent', 30, null)]);

    assert.equal(s.total, 2);
    assert.equal(s.dispatch_rate, 1);
    assert.equal(s.latency.measured, 2);
    assert.equal(s.latency.p50_ms, 12);
    assert.equal(s.latency.max_ms, 30);

    /*
     * The important assertion: the mock adapter calls no model, so there is no
     * token count. If this ever returns 0 with measured > 0, someone has started
     * inventing a measurement.
     */
    assert.equal(s.tokens.measured, 0);
    assert.equal(s.tokens.total, 0);
    assert.equal(s.cost_usd.measured, 0);
    assert.equal(s.cost_usd.total, 0);
  });

  test('baris lama tanpa usage tetap dihitung sebagai eksekusi nyata', () => {
    const s = summarizeExecutions([legacyRow('sent'), legacyRow('failed'), measuredRow('sent', 50, null)]);

    assert.equal(s.total, 3);
    assert.equal(s.by_result.sent, 2);
    assert.equal(s.by_result.failed, 1);
    assert.equal(s.latency.measured, 1, 'hanya baris ber-usage yang punya latensi');
    assert.equal(s.latency.p50_ms, 50);
  });

  test('provider nyata: token dan biaya dijumlahkan apa adanya', () => {
    const s = summarizeExecutions([
      measuredRow('sent', 100, { in: 1000, out: 500, cost: 0.02 }),
      measuredRow('sent', 200, { in: 2000, out: 100, cost: 0.04 }),
      measuredRow('sent', 300, null),
    ]);

    assert.equal(s.tokens.measured, 2, 'baris mock tidak boleh menambah penyebut');
    assert.equal(s.tokens.input, 3000);
    assert.equal(s.tokens.output, 600);
    assert.equal(s.tokens.total, 3600);
    assert.equal(s.cost_usd.measured, 2);
    assert.ok(Math.abs(s.cost_usd.total - 0.06) < 1e-9);
  });

  test('persentil memakai nearest-rank pada data terurut', () => {
    const rows = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((ms) => measuredRow('sent', ms, null));
    const s = summarizeExecutions(rows);

    assert.equal(s.latency.p50_ms, 50);
    assert.equal(s.latency.p95_ms, 100);
    assert.equal(s.latency.max_ms, 100);
  });

  test('token setengah terukur tidak dijumlahkan diam-diam', () => {
    const half = measuredRow('sent', 10, null);
    half.usage = { provider: 'openai', model: 'm', tokens_in: 900, tokens_out: null, cost_usd: null, latency_ms: 10 };

    const s = summarizeExecutions([half]);
    assert.equal(s.tokens.measured, 0, 'pasangan token tidak lengkap bukan pengukuran');
    assert.equal(s.tokens.total, 0);
    assert.equal(s.latency.measured, 1, 'latensinya tetap sah');
  });

  test('dispatch_rate menghitung penerimaan adapter apa adanya', () => {
    const s = summarizeExecutions([legacyRow('sent'), legacyRow('blocked'), legacyRow('failed'), legacyRow('queued')]);
    assert.equal(s.total, 4);
    assert.equal(s.by_result.sent, 1);
    assert.equal(s.by_result.blocked, 1);
    assert.equal(s.by_result.failed, 1);
    assert.equal(s.by_result.queued, 1);
    assert.equal(s.dispatch_rate, 0.25);
  });
});
