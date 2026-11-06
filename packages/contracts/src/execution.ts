import { z } from 'zod';
import { ERROR_CODES } from './errors.ts';
import { ActionIdSchema, ExecutionIdSchema, MandateIdSchema } from './ids.ts';

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const ResultStatusSchema = z.enum(['queued', 'sent', 'blocked', 'failed']);
export type ResultStatus = z.infer<typeof ResultStatusSchema>;

export const ActionEvidenceSchema = z
  .object({
    mock_message_id: z.string().optional(),
    mock_event_id: z.string().optional(),
    mock_task_id: z.string().optional(),
    message_id: z.string().optional(),
    event_id: z.string().optional(),
    task_id: z.string().optional(),
    outbox_path: z.string().optional(),
    ics_path: z.string().optional(),
    task_path: z.string().optional(),
    provider: z.string().optional(),
    result_id: z.string().optional(),
    note: z.string().optional(),
  })
  .strict();
export type ActionEvidence = z.infer<typeof ActionEvidenceSchema>;

/**
 * What an execution actually cost, measured or absent.
 *
 * `latency_ms` is always real: any execution takes time and the executor can
 * measure it. The token and cost fields are `nullable` on purpose. The current
 * adapters are file-producing (outbox) — they call no model — so they report
 * `provider: 'outbox'` with `null` tokens and `null` cost. Writing `0` there
 * would be a measurement
 * that never happened, and any analytics screen built on it would report a
 * saving that is really an absence of data.
 *
 * When a real provider adapter lands, it fills these in. Until then `null`
 * survives all the way to the UI, which must render "tidak diukur" rather than
 * a number.
 */
export const ExecutionUsageSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().nullable(),
    tokens_in: z.number().int().nonnegative().nullable(),
    tokens_out: z.number().int().nonnegative().nullable(),
    cost_usd: z.number().nonnegative().nullable(),
    /**
     * Where `cost_usd` came from. Not every provider returns a price, and a
     * number derived from a rate card is a different kind of fact than one the
     * provider reported. Keeping the origin means a later audit can ask "was
     * this billed or estimated?" without guessing.
     */
    cost_source: z.enum(['provider_reported', 'rate_card']).nullable().optional(),
    /** Which rate card produced `cost_usd`, e.g. a model/price version. */
    rate_card_version: z.string().nullable().optional(),
    latency_ms: z.number().nonnegative(),
  })
  .strict();
export type ExecutionUsage = z.infer<typeof ExecutionUsageSchema>;

/**
 * Result of an execution attempt for one action under one mandate.
 *
 * `execution_key` is an attempt id used for correlation and audit only. It is
 * NOT the deduplication key: the canonical dedup key is the pair
 * `(mandate_id, action_id)`, and enforcing uniqueness on that pair is the
 * responsibility of the execution store, not of this schema.
 */
export const ActionResultSchema = z
  .object({
    execution_id: ExecutionIdSchema,
    mandate_id: MandateIdSchema,
    action_id: ActionIdSchema,
    /**
     * Attempt id for correlation and audit only, NOT a deduplication key.
     * Deduplication uses `(mandate_id, action_id)` and is owned by the store.
     */
    execution_key: z.string().min(1),
    result: ResultStatusSchema,
    reason_code: ERROR_CODES.nullable(),
    executed_at: IsoDateTimeSchema,
    evidence: ActionEvidenceSchema,
    /** Optional so records written before telemetry existed still validate. */
    usage: ExecutionUsageSchema.optional(),
  })
  .strict();
export type ActionResult = z.infer<typeof ActionResultSchema>;
