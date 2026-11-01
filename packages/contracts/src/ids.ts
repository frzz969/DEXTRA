import { z } from 'zod';

type Brand<T, B extends string> = T & { readonly __brand: B };

export type PlanId = Brand<string, 'PlanId'>;
export type ActionId = Brand<string, 'ActionId'>;
export type MandateId = Brand<string, 'MandateId'>;
export type ExecutionId = Brand<string, 'ExecutionId'>;
export type ApprovalId = Brand<string, 'ApprovalId'>;
export type ContactId = Brand<string, 'ContactId'>;
export type OrgId = Brand<string, 'OrgId'>;
export type RequestId = Brand<string, 'RequestId'>;
export type EventId = Brand<string, 'EventId'>;

const PLAN_ID_PATTERN = /^plan_[a-z0-9_]+$/;
const ACTION_ID_PATTERN = /^action_[a-z0-9_]+$/;
const MANDATE_ID_PATTERN = /^mandate_[a-z0-9_]+$/;
const EXECUTION_ID_PATTERN = /^exec_[a-z0-9_]+$/;
const APPROVAL_ID_PATTERN = /^appr_[a-z0-9_]+$/;
const CONTACT_ID_PATTERN = /^c_[a-z0-9_]+$/;
const ORG_ID_PATTERN = /^org_[a-z0-9_]+$/;
const REQUEST_ID_PATTERN = /^req_[a-z0-9_]+$/;
const EVENT_ID_PATTERN = /^evt_[a-z0-9_]+$/;

function brandedIdSchema<B extends string>(pattern: RegExp): z.ZodType<Brand<string, B>> {
  return z.string().regex(pattern) as unknown as z.ZodType<Brand<string, B>>;
}

export const PlanIdSchema = brandedIdSchema<'PlanId'>(PLAN_ID_PATTERN);
export const ActionIdSchema = brandedIdSchema<'ActionId'>(ACTION_ID_PATTERN);
export const MandateIdSchema = brandedIdSchema<'MandateId'>(MANDATE_ID_PATTERN);
export const ExecutionIdSchema = brandedIdSchema<'ExecutionId'>(EXECUTION_ID_PATTERN);
export const ApprovalIdSchema = brandedIdSchema<'ApprovalId'>(APPROVAL_ID_PATTERN);
export const ContactIdSchema = brandedIdSchema<'ContactId'>(CONTACT_ID_PATTERN);
export const OrgIdSchema = brandedIdSchema<'OrgId'>(ORG_ID_PATTERN);
export const RequestIdSchema = brandedIdSchema<'RequestId'>(REQUEST_ID_PATTERN);
export const EventIdSchema = brandedIdSchema<'EventId'>(EVENT_ID_PATTERN);

export function asPlanId(value: string): PlanId {
  const result = PlanIdSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid PlanId: ${value}`);
  }
  return result.data;
}
