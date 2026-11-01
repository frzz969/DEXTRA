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
  })
  .strict();
export type AuditEvent = z.infer<typeof AuditEventSchema>;
