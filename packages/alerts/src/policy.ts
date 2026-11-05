import { createHash } from 'node:crypto';

import {
  ALERT_SEVERITY,
  AlertSchema,
  type Alert,
  type AlertKind,
  type AlertSubject,
} from '../../contracts/src/index.ts';

/**
 * Retry and dedupe policy, as pure functions.
 *
 * Nothing here performs I/O. That is deliberate: the retry rules are the part
 * most likely to be wrong, and a rule that can only be tested by waiting two
 * seconds is a rule that never gets tested.
 */

export const MAX_ATTEMPTS = 5;

/**
 * Delay before the next attempt, indexed by the attempt that just failed.
 * 2s, 8s, 30s, 120s, 600s — the fifth entry is unused because attempt 5 is the
 * last, but it is kept so the array and the attempt numbers stay aligned.
 */
export const BACKOFF_MS: readonly number[] = [2_000, 8_000, 30_000, 120_000, 600_000];

/** Dedupe window. A repeat outside it is news again, not noise. */
export const DEDUPE_BUCKET_MS = 15 * 60 * 1000;

const JITTER_RATIO = 0.2;

/**
 * Exponential backoff with ±20% jitter.
 *
 * Jitter matters when many alerts fail at once — a provider outage produces a
 * synchronised retry storm at exactly 2s, 8s, 30s, which is the one moment the
 * provider can least afford it.
 */
export function backoffMs(failedAttempt: number, jitter: () => number = Math.random): number {
  const index = Math.min(Math.max(failedAttempt, 1), BACKOFF_MS.length) - 1;
  const base = BACKOFF_MS[index] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
  /* jitter() in [0,1) → multiplier in [0.8, 1.2) */
  const multiplier = 1 - JITTER_RATIO + jitter() * JITTER_RATIO * 2;
  return Math.round(base * multiplier);
}

/**
 * Whether an HTTP status is worth retrying.
 *
 * Retrying a request that is certain to fail does not improve the outcome; it
 * adds noise to the audit trail and burns the provider's rate limit, which then
 * delays the alerts that could have been delivered.
 */
export function classifyStatus(status: number | undefined): 'retryable_failure' | 'permanent_failure' {
  /* No response at all: timeout, DNS, connection reset. The message may or may
     not have been received, which is exactly why it is retried. */
  if (status === undefined) return 'retryable_failure';
  if (status === 429) return 'retryable_failure';
  if (status === 408) return 'retryable_failure';
  if (status >= 500 && status <= 599) return 'retryable_failure';
  return 'permanent_failure';
}

/**
 * Delay before the next attempt, honouring `retry_after` from a 429.
 *
 * The provider's own instruction wins over our schedule. Ignoring it is how a
 * client gets rate-limited harder.
 */
export function nextDelayMs(failedAttempt: number, retryAfterSeconds: number | undefined, jitter: () => number = Math.random): number {
  if (retryAfterSeconds !== undefined && Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.round(retryAfterSeconds * 1000);
  }
  return backoffMs(failedAttempt, jitter);
}

/** Start of the dedupe bucket containing `at`, as an ISO string. */
export function bucketStart(at: Date, bucketMs: number = DEDUPE_BUCKET_MS): string {
  const ms = Math.floor(at.getTime() / bucketMs) * bucketMs;
  return new Date(ms).toISOString();
}

/**
 * Dedupe key over an explicit, ordered field list.
 *
 * Not `JSON.stringify(input)`: object property order is insertion order, so two
 * callers building the same logical alert with keys in a different order would
 * produce different keys and defeat the dedupe they are supposed to share.
 */
export function dedupeKeyFor(kind: AlertKind, subject: AlertSubject, at: Date, bucketMs: number = DEDUPE_BUCKET_MS): string {
  const parts = [
    'dextra-alert-v1',
    kind,
    subject.plan_id ?? '',
    subject.mandate_id ?? '',
    subject.action_id ?? '',
    bucketStart(at, bucketMs),
  ];
  return createHash('sha256').update(parts.join('\u0000')).digest('hex');
}

/**
 * `alrt_` + 16 hex characters of the dedupe key.
 *
 * The design called for 8. Sixteen costs nothing and the id is the primary key
 * of a stored record, so a collision is not a cosmetic issue — it would merge
 * two different incidents into one delivery.
 */
export function alertIdFor(dedupeKey: string): string {
  return `alrt_${dedupeKey.slice(0, 16)}`;
}

export interface CreateAlertInput {
  kind: AlertKind;
  subject: AlertSubject;
  at: Date;
  payload: Record<string, string>;
  bucketMs?: number;
}

/**
 * Builds a validated alert. Severity comes from the kind, never from the caller
 * — see `ALERT_SEVERITY` for why.
 */
export function createAlert(input: CreateAlertInput): Alert {
  const dedupeKey = dedupeKeyFor(input.kind, input.subject, input.at, input.bucketMs);
  return AlertSchema.parse({
    alert_id: alertIdFor(dedupeKey),
    kind: input.kind,
    severity: ALERT_SEVERITY[input.kind],
    subject: input.subject,
    dedupe_key: dedupeKey,
    created_at: input.at.toISOString(),
    payload: input.payload,
  });
}

/**
 * Removes secrets from any string that could reach a log, an audit event, or
 * the dashboard. Errors from `fetch` frequently embed the request URL, and for
 * the Bot API the URL contains the token.
 */
export function redactSecrets(text: string, secrets: readonly string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      out = out.split(secret).join('[redacted]');
    }
  }
  return out;
}
