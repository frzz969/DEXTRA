import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALERT_SEVERITY,
  AlertSchema,
} from '../../contracts/src/index.ts';
import {
  BACKOFF_MS,
  DEDUPE_BUCKET_MS,
  alertIdFor,
  backoffMs,
  bucketStart,
  classifyStatus,
  createAlert,
  dedupeKeyFor,
  nextDelayMs,
  redactSecrets,
} from '../src/policy.ts';

describe('kebijakan retry', () => {
  test('hanya kegagalan yang mungkin berhasil diulang yang di-retry', () => {
    assert.equal(classifyStatus(undefined), 'retryable_failure', 'tanpa respons: mungkin terkirim');
    assert.equal(classifyStatus(408), 'retryable_failure');
    assert.equal(classifyStatus(429), 'retryable_failure');
    assert.equal(classifyStatus(500), 'retryable_failure');
    assert.equal(classifyStatus(503), 'retryable_failure');

    assert.equal(classifyStatus(400), 'permanent_failure', 'payload salah tidak akan jadi benar');
    assert.equal(classifyStatus(401), 'permanent_failure');
    assert.equal(classifyStatus(403), 'permanent_failure');
    assert.equal(classifyStatus(404), 'permanent_failure');
  });

  test('backoff mengikuti jadwal dan tetap dalam ±20%', () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const base = BACKOFF_MS[attempt - 1]!;
      assert.equal(backoffMs(attempt, () => 0.5), base, `attempt ${attempt} tanpa jitter`);
      const low = backoffMs(attempt, () => 0);
      const high = backoffMs(attempt, () => 0.999);
      assert.ok(low >= base * 0.8 && low < base, `batas bawah attempt ${attempt}`);
      assert.ok(high <= base * 1.2, `batas atas attempt ${attempt}`);
    }
  });

  test('retry_after dari provider mengalahkan jadwal kita', () => {
    assert.equal(nextDelayMs(1, 7, () => 0.5), 7_000);
    assert.equal(nextDelayMs(1, undefined, () => 0.5), 2_000);
  });
});

describe('deduplikasi', () => {
  const T = new Date('2026-11-03T10:07:31.000Z');

  test('bucket 15 menit memotong waktu ke batas bawah', () => {
    assert.equal(bucketStart(T), '2026-11-03T10:00:00.000Z');
    assert.equal(bucketStart(new Date('2026-11-03T10:14:59.999Z')), '2026-11-03T10:00:00.000Z');
    assert.equal(bucketStart(new Date('2026-11-03T10:15:00.000Z')), '2026-11-03T10:15:00.000Z');
    assert.equal(DEDUPE_BUCKET_MS, 15 * 60 * 1000);
  });

  test('kunci dedupe tidak bergantung pada urutan properti', () => {
    const a = dedupeKeyFor('execution_failed', { plan_id: 'plan_a', action_id: 'action_b' }, T);
    /* Objek yang sama secara logis, dibangun dengan urutan kunci berbeda. */
    const reversed = { action_id: 'action_b', plan_id: 'plan_a' };
    const b = dedupeKeyFor('execution_failed', reversed, T);
    assert.equal(a, b);
  });

  test('jenis berbeda menghasilkan kunci berbeda', () => {
    const subject = { plan_id: 'plan_a' };
    assert.notEqual(dedupeKeyFor('execution_failed', subject, T), dedupeKeyFor('security_rejection', subject, T));
  });

  test('alert_id dibentuk dari kunci dedupe dan lolos pola kontrak', () => {
    const key = dedupeKeyFor('execution_failed', { plan_id: 'plan_a' }, T);
    const id = alertIdFor(key);
    assert.match(id, /^alrt_[a-f0-9]{16}$/);
    assert.equal(alertIdFor(key), id, 'deterministik');
  });
});

describe('createAlert', () => {
  const at = new Date('2026-11-03T10:00:00.000Z');

  test('severity berasal dari jenis, bukan dari pemanggil', () => {
    const alert = createAlert({
      kind: 'security_rejection',
      subject: { mandate_id: 'mandate_x' },
      at,
      payload: { alasan: 'mandate_rejected' },
    });
    assert.equal(alert.severity, ALERT_SEVERITY.security_rejection);
    assert.equal(alert.severity, 'critical', 'penolakan keamanan tidak bisa diturunkan jadi info');
    assert.doesNotThrow(() => AlertSchema.parse(alert));
  });

  test('payload hanya boleh berisi string', () => {
    assert.throws(() =>
      createAlert({
        kind: 'execution_failed',
        subject: {},
        at,
        /* @ts-expect-error sengaja salah tipe untuk membuktikan validasi jalan */
        payload: { jumlah: 3 },
      }),
    );
  });
});

describe('redaksi', () => {
  test('token dan chat id hilang dari pesan galat', () => {
    const token = '123456:AAH-secret-token-value';
    const message = `request to https://api.telegram.org/bot${token}/sendMessage failed for chat 998877`;
    const out = redactSecrets(message, [token, '998877']);
    assert.ok(!out.includes(token), 'token tidak boleh tersisa');
    assert.ok(!out.includes('998877'), 'chat id tidak boleh tersisa');
    assert.ok(out.includes('[redacted]'));
  });
});
