import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ActionResultSchema,
  ApprovalSchema,
  MandateSchema,
  type ActionResult,
  type Approval,
  type AuditEvent,
  type Mandate,
} from '../../contracts/src/index.ts';
import { detectAlerts, REPEATED_FAILURE_THRESHOLD } from '../src/detect.ts';

const NOW = new Date('2026-11-03T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60 * 1000).toISOString();
}

function minutesFromNow(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60 * 1000).toISOString();
}

function execution(overrides: Partial<ActionResult> = {}): ActionResult {
  return ActionResultSchema.parse({
    execution_id: 'exec_1',
    mandate_id: 'mandate_1',
    action_id: 'action_send_email',
    execution_key: 'key-1',
    result: 'sent',
    reason_code: null,
    executed_at: minutesAgo(5),
    evidence: {},
    ...overrides,
  });
}

function mandate(overrides: Partial<Mandate> = {}): Mandate {
  return MandateSchema.parse({
    mandate_id: 'mandate_1',
    plan_id: 'plan_1',
    plan_hash: `sha256:${'a'.repeat(64)}`,
    approval_id: 'appr_1',
    issued_at: minutesAgo(60),
    expires_at: minutesFromNow(60 * 72),
    nonce: 'nonce-abcdefghijklmnop',
    allowed_action_ids: ['action_send_email'],
    allowed_action_types: ['send_email'],
    max_risk: 'low',
    status: 'active',
    issued_by: 'nadia',
    signature: 'sig',
    ...overrides,
  });
}

function approval(overrides: Partial<Approval> = {}): Approval {
  return ApprovalSchema.parse({
    approval_id: 'appr_1',
    plan_id: 'plan_1',
    plan_hash: `sha256:${'a'.repeat(64)}`,
    decision: 'approve',
    approver_id: 'nadia',
    approval_token: 'apc_0123456789abcdef.000000',
    issued_at: minutesAgo(10),
    expires_at: minutesFromNow(60),
    status: 'pending',
    ...overrides,
  });
}

function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    event_id: 'evt_1' as AuditEvent['event_id'],
    at: minutesAgo(5),
    type: 'mandate_rejected',
    actor: 'executor',
    detail: { reason: 'not_owner' },
    ...overrides,
  };
}

describe('deteksi alert', () => {
  test('tidak ada masalah: tidak ada alert, dan itu bukan klaim "semua baik"', () => {
    const alerts = detectAlerts({
      executions: [execution({ result: 'sent' })],
      mandates: [mandate()],
      approvals: [],
      audit: [],
      now: NOW,
    });
    assert.equal(alerts.length, 0);
  });

  test('eksekusi gagal menghasilkan satu alert execution_failed', () => {
    const alerts = detectAlerts({
      executions: [execution({ result: 'failed', reason_code: 'EXECUTOR_FAILURE' })],
      mandates: [],
      approvals: [],
      audit: [],
      now: NOW,
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, 'execution_failed');
    assert.equal(alerts[0]!.severity, 'warning');
    assert.equal(alerts[0]!.payload.alasan, 'EXECUTOR_FAILURE');
  });

  test('kegagalan di luar jendela tidak menghasilkan alert', () => {
    const alerts = detectAlerts({
      executions: [execution({ result: 'failed', executed_at: minutesAgo(120) })],
      mandates: [],
      approvals: [],
      audit: [],
      now: NOW,
    });
    assert.equal(alerts.length, 0, 'jendela default satu jam');
  });

  test('tiga kegagalan action yang sama memicu repeated_failure', () => {
    const failures = Array.from({ length: REPEATED_FAILURE_THRESHOLD }, (_, i) =>
      execution({ execution_id: `exec_${i}` as ActionResult['execution_id'], result: 'failed' }),
    );

    const alerts = detectAlerts({ executions: failures, mandates: [], approvals: [], audit: [], now: NOW });
    const repeated = alerts.filter((a) => a.kind === 'repeated_failure');

    assert.equal(repeated.length, 1);
    assert.equal(repeated[0]!.payload.jumlah, '3');
    assert.equal(repeated[0]!.severity, 'critical');
  });

  test('dua kegagalan belum dianggap pola', () => {
    const failures = Array.from({ length: 2 }, (_, i) =>
      execution({ execution_id: `exec_${i}` as ActionResult['execution_id'], result: 'failed' }),
    );
    const alerts = detectAlerts({ executions: failures, mandates: [], approvals: [], audit: [], now: NOW });
    assert.equal(alerts.filter((a) => a.kind === 'repeated_failure').length, 0);
  });

  test('mandat yang kedaluwarsa tapi masih aktif memicu mandate_expired', () => {
    const alerts = detectAlerts({
      executions: [],
      mandates: [mandate({ expires_at: minutesAgo(30) })],
      approvals: [],
      audit: [],
      now: NOW,
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, 'mandate_expired');
    assert.equal(alerts[0]!.severity, 'critical');
    assert.equal(alerts[0]!.payload.terlambat_jam, '1');
  });

  test('mandat yang akan habis dalam 24 jam memicu mandate_expiring', () => {
    const alerts = detectAlerts({
      executions: [],
      mandates: [mandate({ expires_at: minutesFromNow(90) })],
      approvals: [],
      audit: [],
      now: NOW,
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, 'mandate_expiring');
    assert.equal(alerts[0]!.payload.sisa_jam, '2');
  });

  test('mandat yang sudah ditandai expired tidak diberitakan lagi', () => {
    const alerts = detectAlerts({
      executions: [],
      mandates: [mandate({ status: 'expired', expires_at: minutesAgo(30) })],
      approvals: [],
      audit: [],
      now: NOW,
    });
    assert.equal(alerts.length, 0, 'status sudah benar: tidak ada yang perlu diberitahukan');
  });

  test('approval yang menunggu lebih dari empat jam memicu approval_pending', () => {
    const alerts = detectAlerts({
      executions: [],
      mandates: [],
      approvals: [approval({ issued_at: minutesAgo(5 * 60) })],
      audit: [],
      now: NOW,
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, 'approval_pending');
    assert.equal(alerts[0]!.severity, 'info');
    assert.equal(alerts[0]!.payload.menunggu_jam, '5');
  });

  test('approval yang baru sepuluh menit belum diberitakan', () => {
    const alerts = detectAlerts({
      executions: [],
      mandates: [],
      approvals: [approval({ issued_at: minutesAgo(10) })],
      audit: [],
      now: NOW,
    });
    assert.equal(alerts.length, 0);
  });

  test('penolakan keamanan diambil dari audit, dengan severity critical', () => {
    const alerts = detectAlerts({
      executions: [],
      mandates: [],
      approvals: [],
      audit: [auditEvent({ type: 'action_blocked', detail: { reason: 'mandate_rejected' } })],
      now: NOW,
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0]!.kind, 'security_rejection');
    assert.equal(alerts[0]!.severity, 'critical');
    assert.equal(alerts[0]!.payload.alasan, 'mandate_rejected');
  });

  test('timestamp di masa depan tidak dianggap "baru saja terjadi"', () => {
    const alerts = detectAlerts({
      executions: [execution({ result: 'failed', executed_at: minutesFromNow(30) })],
      mandates: [],
      approvals: [],
      audit: [],
      now: NOW,
    });
    assert.equal(alerts.length, 0, 'jam yang tidak sinkron tidak boleh memicu alert selamanya');
  });

  test('dua eksekusi gagal untuk action yang sama menjadi satu alert, bukan dua', () => {
    const alerts = detectAlerts({
      executions: [
        execution({ execution_id: 'exec_1' as ActionResult['execution_id'], result: 'failed' }),
        execution({ execution_id: 'exec_2' as ActionResult['execution_id'], result: 'failed' }),
      ],
      mandates: [],
      approvals: [],
      audit: [],
      now: NOW,
    });

    assert.equal(alerts.length, 1, 'kunci dedupe sengaja tidak memuat execution_id');
  });

  test('hasil deteksi deterministik untuk data yang sama', () => {
    const input = {
      executions: [execution({ result: 'failed' }), execution({ execution_id: 'exec_2' as ActionResult['execution_id'], result: 'failed', action_id: 'action_other' as ActionResult['action_id'] })],
      mandates: [mandate({ expires_at: minutesFromNow(30) })],
      approvals: [],
      audit: [auditEvent()],
      now: NOW,
    };
    const a = detectAlerts(input).map((x) => x.alert_id);
    const b = detectAlerts(input).map((x) => x.alert_id);
    assert.deepEqual(a, b);
  });

  test('payload tidak memuat alamat surel atau nomor telepon', () => {
    const alerts = detectAlerts({
      executions: [execution({ result: 'failed' })],
      mandates: [],
      approvals: [],
      audit: [],
      now: NOW,
    });
    const serialized = JSON.stringify(alerts);
    assert.ok(!/@/.test(serialized), 'tidak boleh ada alamat surel di payload alert');
    assert.ok(!/\b08\d{8,}\b/.test(serialized), 'tidak boleh ada nomor telepon');
  });
});

describe('ambang deteksi', () => {
  test('jendela dan ambang bisa diatur, dan defaultnya terdokumentasi', () => {
    const alerts = detectAlerts({
      executions: [execution({ result: 'failed', executed_at: minutesAgo(120) })],
      mandates: [],
      approvals: [],
      audit: [],
      now: NOW,
      failureWindowMs: 3 * HOUR,
    });
    assert.equal(alerts.length, 1, 'jendela tiga jam mencakup kegagalan dua jam lalu');
  });
});
