import { z } from 'zod';
import { ActionIdSchema, ApprovalIdSchema, MandateIdSchema, PlanIdSchema } from './ids.ts';
import { ActionTypeSchema } from './plan.ts';
import { RiskLevelSchema } from './risk.ts';

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const PlanHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const MandateStatusSchema = z.enum(['active', 'expired', 'revoked', 'consumed']);
export type MandateStatus = z.infer<typeof MandateStatusSchema>;

export const MandateSchema = z
  .object({
    mandate_id: MandateIdSchema,
    plan_id: PlanIdSchema,
    plan_hash: PlanHashSchema,
    approval_id: ApprovalIdSchema,
    issued_at: IsoDateTimeSchema,
    expires_at: IsoDateTimeSchema,
    nonce: z.string().min(16),
    allowed_action_ids: z.array(ActionIdSchema).min(1),
    allowed_action_types: z.array(ActionTypeSchema).min(1),
    max_risk: RiskLevelSchema,
    status: MandateStatusSchema,
    issued_by: z.string().min(1),
    signature: z.string().min(1),
  })
  .strict()
  .superRefine((mandate, ctx) => {
    const issuedAt = Date.parse(mandate.issued_at);
    const expiresAt = Date.parse(mandate.expires_at);
    if (expiresAt <= issuedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expires_at'],
        message: 'expires_at must be later than issued_at',
      });
    }
  });
export type Mandate = z.infer<typeof MandateSchema>;
