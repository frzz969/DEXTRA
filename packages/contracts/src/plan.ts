import { z } from 'zod';
import { ActionIdSchema, ContactIdSchema, OrgIdSchema, PlanIdSchema, RequestIdSchema } from './ids.ts';
import { RiskLevelSchema } from './risk.ts';

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const PlanHashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const PlanStatusSchema = z.enum(['DRAFT', 'READY', 'NEEDS_REVIEW', 'BLOCKED']);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const FindingSeveritySchema = z.enum(['info', 'warning', 'blocking']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const ActionTypeSchema = z.enum(['send_email', 'send_message', 'create_calendar_event', 'create_task']);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ChannelSchema = z.enum(['email', 'chat', 'calendar', 'task']);
export type Channel = z.infer<typeof ChannelSchema>;

export const FindingSchema = z
  .object({
    code: z.string().min(1),
    severity: FindingSeveritySchema,
    action_id: ActionIdSchema.optional(),
    message: z.string(),
  })
  .strict();
export type Finding = z.infer<typeof FindingSchema>;

export const TargetSchema = z
  .object({
    contact_id: ContactIdSchema,
    display_name: z.string().min(1),
    channel: ChannelSchema,
    masked_address: z.string().min(1),
  })
  .strict();
export type Target = z.infer<typeof TargetSchema>;

export const ScheduleSchema = z
  .object({
    start_at: IsoDateTimeSchema,
    end_at: IsoDateTimeSchema.optional(),
    timezone: z.string().min(1),
    all_day: z.boolean(),
  })
  .strict();
export type Schedule = z.infer<typeof ScheduleSchema>;

export const ContentSchema = z
  .object({
    subject: z.string().optional(),
    body: z.string(),
    locale: z.string().min(1),
  })
  .strict();
export type Content = z.infer<typeof ContentSchema>;

export const PlanActionSchema = z
  .object({
    action_id: ActionIdSchema,
    action_type: ActionTypeSchema,
    target: TargetSchema,
    schedule: ScheduleSchema,
    content: ContentSchema,
    risk: RiskLevelSchema,
  })
  .strict();
export type PlanAction = z.infer<typeof PlanActionSchema>;

export const PlanSchema = z
  .object({
    plan_id: PlanIdSchema,
    org_id: OrgIdSchema,
    request_id: RequestIdSchema,
    created_at: IsoDateTimeSchema,
    status: PlanStatusSchema,
    intent: z.string(),
    actions: z.array(PlanActionSchema).min(1),
    findings: z.array(FindingSchema),
    plan_hash: PlanHashSchema,
    contract_version: z.string().min(1),
  })
  .strict();
export type Plan = z.infer<typeof PlanSchema>;
