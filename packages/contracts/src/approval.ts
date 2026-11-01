import { z } from 'zod';
import { ApprovalIdSchema, PlanIdSchema } from './ids.ts';

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const PlanHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const DecisionSchema = z.enum(['approve', 'reject', 'revise']);
export type Decision = z.infer<typeof DecisionSchema>;

export const ApprovalStatusSchema = z.enum(['granted', 'rejected', 'revision_requested', 'expired', 'pending']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z
  .object({
    approval_id: ApprovalIdSchema,
    plan_id: PlanIdSchema,
    plan_hash: PlanHashSchema,
    decision: DecisionSchema,
    approver_id: z.string().min(1),
    approval_token: z.string().regex(/^apt_[a-z0-9_]+$/),
    issued_at: IsoDateTimeSchema,
    expires_at: IsoDateTimeSchema,
    status: ApprovalStatusSchema,
  })
  .strict();
export type Approval = z.infer<typeof ApprovalSchema>;
