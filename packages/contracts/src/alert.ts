import { z } from 'zod';

const IsoDateTimeSchema = z.string().datetime({ offset: true });

/**
 * Alert kinds. Each one is a fact the server already knows from its own store —
 * never a guess. `repeated_failure` is derived by counting, not inferred.
 */
export const AlertKindSchema = z.enum([
  'execution_failed',
  'repeated_failure',
  'mandate_expiring',
  'mandate_expired',
  'approval_pending',
  'security_rejection',
]);
export type AlertKind = z.infer<typeof AlertKindSchema>;

export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;

/**
 * Severity is a property of the kind, not a per-call choice. A caller that can
 * pick the severity can quietly downgrade a security rejection to `info`, and
 * then the number of critical alerts stops meaning anything.
 */
export const ALERT_SEVERITY: Record<AlertKind, AlertSeverity> = {
  execution_failed: 'warning',
  repeated_failure: 'critical',
  mandate_expiring: 'warning',
  mandate_expired: 'critical',
  approval_pending: 'info',
  security_rejection: 'critical',
};

export const AlertSubjectSchema = z
  .object({
    plan_id: z.string().min(1).optional(),
    mandate_id: z.string().min(1).optional(),
    execution_id: z.string().min(1).optional(),
    action_id: z.string().min(1).optional(),
  })
  .strict();
export type AlertSubject = z.infer<typeof AlertSubjectSchema>;

const ALERT_ID_PATTERN = /^alrt_[a-f0-9]{16}$/;
const DEDUPE_KEY_PATTERN = /^[a-f0-9]{64}$/;

export const AlertSchema = z
  .object({
    /** Deterministic: same kind + subject + time bucket yields the same id. */
    alert_id: z.string().regex(ALERT_ID_PATTERN),
    kind: AlertKindSchema,
    severity: AlertSeveritySchema,
    subject: AlertSubjectSchema,
    dedupe_key: z.string().regex(DEDUPE_KEY_PATTERN),
    created_at: IsoDateTimeSchema,
    /**
     * Message body fields, already redacted. `Record<string,string>` on purpose:
     * an alert that can carry nested structures ends up carrying a whole plan,
     * and then the transport payload becomes a second copy of the store.
     */
    payload: z.record(z.string(), z.string()),
  })
  .strict();
export type Alert = z.infer<typeof AlertSchema>;

/**
 * Outcome of one send attempt.
 *
 * There is no `delivered`. The Telegram Bot API returns `ok:true` when its
 * servers accept the message; it never reports that a human read it. Claiming
 * `delivered` would assert something unobservable — the same mistake that
 * `success_rate` made before it was renamed to `dispatch_rate`.
 */
export const AlertAttemptStatusSchema = z.enum([
  'accepted_by_provider',
  'retryable_failure',
  'permanent_failure',
]);
export type AlertAttemptStatus = z.infer<typeof AlertAttemptStatusSchema>;

export const AlertAttemptSchema = z
  .object({
    alert_id: z.string().regex(ALERT_ID_PATTERN),
    attempt: z.number().int().min(1),
    at: IsoDateTimeSchema,
    status: AlertAttemptStatusSchema,
    /** HTTP status from the provider, when there was a response at all. */
    provider_status: z.number().int().min(100).max(599).optional(),
    /** Redacted. Never contains the bot token or the chat id. */
    error: z.string().optional(),
  })
  .strict();
export type AlertAttempt = z.infer<typeof AlertAttemptSchema>;

/**
 * Persisted delivery lifecycle — what actually happened to the message.
 *
 * `suppressed_duplicate` is deliberately NOT here. Suppression is a decision
 * not to send, so it must not overwrite the record of a message that was
 * already accepted: the record would then claim the alert was never sent while
 * the human is looking at it in Telegram. Suppression is counted instead
 * (`suppressed_count`) and reported as an outcome (`DispatchOutcomeStatus`).
 */
export const AlertDeliveryStatusSchema = z.enum([
  'queued',
  'dispatching',
  'accepted_by_provider',
  'failed',
]);
export type AlertDeliveryStatus = z.infer<typeof AlertDeliveryStatusSchema>;

/**
 * What a single `dispatchAlert` call reports. Extends the persisted status with
 * the one result that leaves no trace in the store, because nothing was sent.
 */
export const DispatchOutcomeStatusSchema = z.enum([
  'queued',
  'dispatching',
  'accepted_by_provider',
  'failed',
  'suppressed_duplicate',
]);
export type DispatchOutcomeStatus = z.infer<typeof DispatchOutcomeStatusSchema>;

export const AlertProviderSchema = z.enum(['telegram', 'fake']);
export type AlertProvider = z.infer<typeof AlertProviderSchema>;

export const AlertDeliverySchema = z
  .object({
    alert: AlertSchema,
    status: AlertDeliveryStatusSchema,
    /**
     * `fake` means the alert never left this process. It is recorded explicitly
     * so a demo without credentials cannot be mistaken for a working channel.
     */
    provider: AlertProviderSchema,
    attempts: z.array(AlertAttemptSchema),
    /** How many dispatches were refused because this alert was already handled. */
    suppressed_count: z.number().int().nonnegative(),
    first_at: IsoDateTimeSchema,
    last_at: IsoDateTimeSchema,
  })
  .strict();
export type AlertDelivery = z.infer<typeof AlertDeliverySchema>;

/**
 * Aggregate over deliveries, computed server-side over the whole set.
 *
 * `accepted_by_provider` is the highest claim this number can make. There is no
 * field for "seen" because the system has no way to observe it.
 */
export const AlertSummarySchema = z
  .object({
    total: z.number().int().nonnegative(),
    by_status: z.record(z.string(), z.number().int().nonnegative()),
    by_kind: z.record(z.string(), z.number().int().nonnegative()),
    by_provider: z.record(z.string(), z.number().int().nonnegative()),
    attempts: z.number().int().nonnegative(),
    /** Attempts that failed but were retried, i.e. not the final outcome. */
    retried_attempts: z.number().int().nonnegative(),
    /** Dispatches refused as duplicates. Never counted as deliveries. */
    suppressed_total: z.number().int().nonnegative(),
  })
  .strict();
export type AlertSummary = z.infer<typeof AlertSummarySchema>;

