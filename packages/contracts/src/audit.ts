import { z } from 'zod';
import { ERROR_CODES } from './errors.ts';
import { ActionIdSchema, EventIdSchema, MandateIdSchema, PlanIdSchema } from './ids.ts';

const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const AuditEventTypeSchema = z.enum([
  'plan_created',
  'plan_validated',
  'plan_blocked',
  'approval_requested',
  'approval_granted',
  'approval_rejected',
  'approval_expired',
  'mandate_issued',
  'mandate_validated',
  'mandate_rejected',
  'mandate_revoked',
  'action_executed',
  'action_blocked',
  'injection_quarantined',
  'audit_integrity_checked',
  /*
   * Alert delivery. Two types rather than one with a `kind: 'alert'` detail,
   * because "the AI executed an action" and "the system told a human about it"
   * are different facts in an audit trail and must be separable by query.
   * `alert_failed` covers every failed attempt, not only the final one, so a
   * retry sequence is fully reconstructible from the log.
   */
  'alert_dispatched',
  'alert_failed',
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const AuditActorSchema = z.enum(['agent', 'dashboard', 'executor', 'service']);
export type AuditActor = z.infer<typeof AuditActorSchema>;

export const AuditEventSchema = z
  .object({
    event_id: EventIdSchema,
    at: IsoDateTimeSchema,
    type: AuditEventTypeSchema,
    actor: AuditActorSchema,
    plan_id: PlanIdSchema.optional(),
    mandate_id: MandateIdSchema.optional(),
    action_id: ActionIdSchema.optional(),
    plan_hash: z.string().optional(),
    reason_code: ERROR_CODES.optional(),
    detail: z.record(z.string(), z.string()),
    /*
     * Tamper-evidence. Each event carries the hash of the event before it, and
     * its own hash over (previous hash + this event's content). Editing or
     * deleting a line breaks every hash after it, so "append-only" stops being
     * a promise and becomes something a reader can check.
     *
     * Optional because events written before the chain existed have no hashes.
     * The verifier reports that prefix as `unchained` instead of pretending it
     * is valid — an unhashed event is not a verified event.
     */
    prev_hash: z.string().nullable().optional(),
    hash: z.string().optional(),
  })
  .strict();
export type AuditEvent = z.infer<typeof AuditEventSchema>;
