import {
  type ActionResult,
  type Alert,
  type Approval,
  type AuditEvent,
  type Mandate,
} from '../../contracts/src/index.ts';
import { createAlert } from './policy.ts';

/**
 * Detection: turns store facts into alerts.
 *
 * Pure on purpose. Every rule here is a statement about records that already
 * exist, so it can be tested by constructing those records — no server, no
 * clock, no network. A detector that needs a running system to test is a
 * detector whose thresholds are guesses.
 *
 * Nothing here invents a fact. If there are no failed executions, there is no
 * `execution_failed` alert; the function returns an empty array and the caller
 * must not read that as "all good" — it means "no evidence of failure in the
 * window I was given".
 */

export interface DetectInput {
  executions: readonly ActionResult[];
  mandates: readonly Mandate[];
  approvals: readonly Approval[];
  audit: readonly AuditEvent[];
  now: Date;
  /** Window for failure-related alerts. Default 1 hour. */
  failureWindowMs?: number;
  /** How close to expiry counts as "expiring". Default 24 hours. */
  expiringWithinMs?: number;
  /** How long an approval may sit pending before it is worth a message. Default 4 hours. */
  approvalPendingMs?: number;
}

export const DEFAULT_FAILURE_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_EXPIRING_WITHIN_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_APPROVAL_PENDING_MS = 4 * 60 * 60 * 1000;
/** Three failures of the same action inside the window is a pattern, not an incident. */
export const REPEATED_FAILURE_THRESHOLD = 3;

function withinWindow(iso: string, now: Date, windowMs: number): boolean {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return false;
  const delta = now.getTime() - at;
  /* A timestamp in the future is not inside a past window. Clocks disagree, but
     treating a future event as "recent" would let a corrupt record raise an
     alert forever. */
  return delta >= 0 && delta <= windowMs;
}

function hoursUntil(iso: string, now: Date): number | null {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return null;
  return (at - now.getTime()) / (60 * 60 * 1000);
}

export function detectAlerts(input: DetectInput): Alert[] {
  const { now } = input;
  const failureWindowMs = input.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS;
  const expiringWithinMs = input.expiringWithinMs ?? DEFAULT_EXPIRING_WITHIN_MS;
  const approvalPendingMs = input.approvalPendingMs ?? DEFAULT_APPROVAL_PENDING_MS;

  const alerts: Alert[] = [];

  /* 1. Satu eksekusi gagal. */
  const recentFailures = input.executions.filter(
    (e) => e.result === 'failed' && withinWindow(e.executed_at, now, failureWindowMs),
  );

  for (const execution of recentFailures) {
    alerts.push(
      createAlert({
        kind: 'execution_failed',
        subject: {
          mandate_id: execution.mandate_id,
          action_id: execution.action_id,
          execution_id: execution.execution_id,
        },
        at: now,
        payload: {
          hasil: execution.result,
          alasan: execution.reason_code ?? 'tidak dilaporkan',
          waktu: execution.executed_at,
        },
      }),
    );
  }

  /* 2. Kegagalan berulang untuk action yang sama. */
  const failuresByAction = new Map<string, ActionResult[]>();
  for (const execution of recentFailures) {
    const list = failuresByAction.get(execution.action_id) ?? [];
    list.push(execution);
    failuresByAction.set(execution.action_id, list);
  }

  for (const [actionId, failures] of failuresByAction) {
    if (failures.length < REPEATED_FAILURE_THRESHOLD) continue;
    alerts.push(
      createAlert({
        kind: 'repeated_failure',
        subject: { action_id: failures[0]!.action_id },
        at: now,
        payload: {
          jumlah: String(failures.length),
          action: actionId,
          jendela_menit: String(Math.round(failureWindowMs / 60000)),
        },
      }),
    );
  }

  /* 3 & 4. Mandat yang hampir habis, dan mandat yang sudah habis tapi masih aktif. */
  for (const mandate of input.mandates) {
    if (mandate.status !== 'active') continue;

    const hours = hoursUntil(mandate.expires_at, now);
    if (hours === null) continue;

    if (hours < 0) {
      alerts.push(
        createAlert({
          kind: 'mandate_expired',
          subject: { mandate_id: mandate.mandate_id, plan_id: mandate.plan_id },
          at: now,
          payload: {
            status: mandate.status,
            kedaluwarsa_pada: mandate.expires_at,
            terlambat_jam: String(Math.round(-hours)),
          },
        }),
      );
      continue;
    }

    if (hours * 60 * 60 * 1000 <= expiringWithinMs) {
      alerts.push(
        createAlert({
          kind: 'mandate_expiring',
          subject: { mandate_id: mandate.mandate_id, plan_id: mandate.plan_id },
          at: now,
          payload: {
            kedaluwarsa_pada: mandate.expires_at,
            sisa_jam: String(Math.round(hours)),
          },
        }),
      );
    }
  }

  /* 5. Approval yang menunggu terlalu lama. */
  for (const approval of input.approvals) {
    if (approval.status !== 'pending') continue;
    const waitingMs = now.getTime() - Date.parse(approval.issued_at);
    if (!Number.isFinite(waitingMs) || waitingMs < approvalPendingMs) continue;
    alerts.push(
      createAlert({
        kind: 'approval_pending',
        subject: { plan_id: approval.plan_id },
        at: now,
        payload: {
          approval_id: approval.approval_id,
          menunggu_jam: String(Math.round(waitingMs / (60 * 60 * 1000))),
        },
      }),
    );
  }

  /* 6. Penolakan keamanan dari audit log. */
  for (const event of input.audit) {
    if (event.type !== 'mandate_rejected' && event.type !== 'action_blocked') continue;
    if (!withinWindow(event.at, now, failureWindowMs)) continue;
    alerts.push(
      createAlert({
        kind: 'security_rejection',
        subject: {
          ...(event.plan_id !== undefined ? { plan_id: event.plan_id } : {}),
          ...(event.mandate_id !== undefined ? { mandate_id: event.mandate_id } : {}),
          ...(event.action_id !== undefined ? { action_id: event.action_id } : {}),
        },
        at: now,
        payload: {
          jenis_event: event.type,
          alasan: event.detail.reason ?? event.detail.reason_code ?? 'tidak dilaporkan',
        },
      }),
    );
  }

  /*
   * Satu alert per `alert_id`, bukan satu per kejadian.
   *
   * Tiga eksekusi gagal untuk action yang sama dalam satu bucket menghasilkan
   * tiga alert dengan id yang identik: kuncinya sengaja tidak memuat
   * `execution_id`, karena yang ingin diberitakan adalah "action ini gagal
   * berulang", bukan tiga pesan terpisah. Tanpa penyatuan di sini, `detected`
   * melaporkan 3 untuk satu hal yang akan terkirim sekali, dan pemanggil
   * membaca angka itu sebagai tiga masalah.
   */
  const unique = new Map<string, Alert>();
  for (const alert of alerts) {
    if (!unique.has(alert.alert_id)) unique.set(alert.alert_id, alert);
  }

  /* Urutan stabil supaya dua pemindaian atas data yang sama menghasilkan
     daftar yang sama — dan supaya tes bisa membandingkan tanpa mengurutkan. */
  return [...unique.values()].sort((a, b) => a.alert_id.localeCompare(b.alert_id));
}
