import { randomUUID } from 'node:crypto';

import {
  AlertAttemptSchema,
  type Alert,
  type AlertAttempt,
  type AlertAttemptStatus,
  type AlertDelivery,
  type AuditEvent,
  type DispatchOutcomeStatus,
} from '../../contracts/src/index.ts';
import {
  appendAudit,
  claimAlertDelivery,
  recordSuppressedDuplicate,
  saveAlertDelivery,
} from '../../store/src/index.ts';

import { MAX_ATTEMPTS, classifyStatus, nextDelayMs } from './policy.ts';
import type { AlertTransport } from './transport.ts';

/**
 * A `dispatching` record older than this is treated as abandoned.
 *
 * Same reasoning as the audit lock's stale detection: the send path takes
 * seconds, so a record still marked `dispatching` after five minutes belongs to
 * a process that died. Without this, one crash would make that alert
 * permanently un-sendable and permanently un-reported — stuck in a state that
 * looks like work in progress forever.
 */
export const DISPATCH_STALE_MS = 5 * 60 * 1000;

export interface DispatchDeps {
  transport: AlertTransport;
  /** Target chat. Required even for the fake transport, so the shape is honest. */
  chatId: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  jitter?: () => number;
  /** Injected in tests to capture audit events without touching the store. */
  audit?: (event: AuditEvent) => Promise<void>;
}

export interface DispatchOutcome {
  status: DispatchOutcomeStatus;
  delivery: AlertDelivery;
  /** Number of send attempts actually made by this call. */
  attempts: number;
}

/** Plain-text message. No markup: Telegram would reject unescaped user text. */
export function renderAlertText(alert: Alert): string {
  const lines = [`[DEXTRA] ${alert.severity.toUpperCase()} · ${alert.kind}`];
  for (const [key, value] of Object.entries(alert.payload)) {
    lines.push(`${key}: ${value}`);
  }
  const subject = Object.entries(alert.subject)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value}`);
  if (subject.length > 0) {
    lines.push(subject.join(' '));
  }
  lines.push(`alert_id: ${alert.alert_id}`);
  return lines.join('\n');
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isStale(previous: AlertDelivery, now: Date): boolean {
  if (previous.status !== 'dispatching') return false;
  const last = Date.parse(previous.last_at);
  return Number.isFinite(last) && now.getTime() - last > DISPATCH_STALE_MS;
}

/**
 * Sends one alert, retrying per policy, and records one audit event per attempt.
 *
 * The order of writes matters. The attempt is appended to the delivery record
 * before the audit event, so a crash between the two leaves an attempt with no
 * audit line rather than an audit line for an attempt that is not in the
 * history. The audit log is the tamper-evident one; it should never be ahead of
 * the state it describes.
 */
export async function dispatchAlert(alert: Alert, deps: DispatchDeps): Promise<DispatchOutcome> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? defaultSleep;
  const jitter = deps.jitter ?? Math.random;
  const audit = deps.audit ?? appendAudit;

  const startedAt = now();
  const claim = await claimAlertDelivery(alert, deps.transport.name, startedAt.toISOString());

  if (!claim.claimed && !isStale(claim.delivery, startedAt)) {
    const updated = await recordSuppressedDuplicate(alert.alert_id, startedAt.toISOString());
    return {
      status: 'suppressed_duplicate',
      delivery: updated ?? claim.delivery,
      attempts: 0,
    };
  }

  let delivery: AlertDelivery = {
    ...claim.delivery,
    status: 'dispatching',
    last_at: startedAt.toISOString(),
  };
  await saveAlertDelivery(delivery);

  const text = renderAlertText(alert);
  let made = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const at = now();
    const result = await deps.transport.send(deps.chatId, text);
    made += 1;

    const status: AlertAttemptStatus = result.ok ? 'accepted_by_provider' : classifyStatus(result.status);
    const record: AlertAttempt = AlertAttemptSchema.parse({
      alert_id: alert.alert_id,
      attempt,
      at: at.toISOString(),
      status,
      ...(result.status !== undefined ? { provider_status: result.status } : {}),
      ...(result.error !== undefined ? { error: result.error } : {}),
    });

    delivery = {
      ...delivery,
      attempts: [...delivery.attempts, record],
      last_at: at.toISOString(),
    };
    await saveAlertDelivery(delivery);

    await audit({
      event_id: `evt_${randomUUID().replace(/-/g, '').slice(0, 12)}` as AuditEvent['event_id'],
      at: at.toISOString(),
      type: result.ok ? 'alert_dispatched' : 'alert_failed',
      actor: 'service',
      detail: {
        alert_id: alert.alert_id,
        kind: alert.kind,
        severity: alert.severity,
        attempt: String(attempt),
        provider: deps.transport.name,
        status,
        ...(result.status !== undefined ? { provider_status: String(result.status) } : {}),
        ...(result.error !== undefined ? { error: result.error } : {}),
      },
    });

    if (result.ok) {
      delivery = { ...delivery, status: 'accepted_by_provider' };
      await saveAlertDelivery(delivery);
      return { status: 'accepted_by_provider', delivery, attempts: made };
    }

    const exhausted = attempt === MAX_ATTEMPTS;
    if (status === 'permanent_failure' || exhausted) {
      delivery = { ...delivery, status: 'failed' };
      await saveAlertDelivery(delivery);
      return { status: 'failed', delivery, attempts: made };
    }

    await sleep(nextDelayMs(attempt, result.retry_after, jitter));
  }

  /* Unreachable: the loop returns on the last attempt. Kept so the type is
     exhaustive rather than relying on MAX_ATTEMPTS staying above zero. */
  delivery = { ...delivery, status: 'failed' };
  await saveAlertDelivery(delivery);
  return { status: 'failed', delivery, attempts: made };
}
