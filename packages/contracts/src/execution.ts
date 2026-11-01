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
    note: z.string().optional(),
  })
  .strict();
export type ActionEvidence = z.infer<typeof ActionEvidenceSchema>;

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
  })
  .strict();
export type ActionResult = z.infer<typeof ActionResultSchema>;
