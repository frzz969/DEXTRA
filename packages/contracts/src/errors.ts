import { z } from 'zod';

export const ERROR_CODES = z.enum([
  'INVALID_PLAN',
  'POLICY_NOT_FOUND',
  'AMBIGUOUS_RECIPIENT',
  'APPROVAL_EXPIRED',
  'MANDATE_NOT_FOUND',
  'MANDATE_EXPIRED',
  'MANDATE_REVOKED',
  'PLAN_HASH_MISMATCH',
  'ACTION_NOT_ALLOWED',
  'RECIPIENT_NOT_ALLOWED',
  'DUPLICATE_EXECUTION',
  'EXECUTION_IN_PROGRESS',
  'EXECUTOR_FAILURE',
  'AUDIT_WRITE_FAILED',
  'MCP_UNAVAILABLE',
]);

export type ErrorCode = z.infer<typeof ERROR_CODES>;

export const ERROR_META: Record<ErrorCode, { retryable: boolean; message: string }> = {
  INVALID_PLAN: { retryable: false, message: 'Plan does not match the contract schema.' },
  POLICY_NOT_FOUND: { retryable: false, message: 'Organization policy could not be found.' },
  AMBIGUOUS_RECIPIENT: { retryable: false, message: 'Recipient is ambiguous and needs clarification.' },
  APPROVAL_EXPIRED: { retryable: false, message: 'Approval is no longer valid.' },
  MANDATE_NOT_FOUND: { retryable: false, message: 'Mandate does not exist.' },
  MANDATE_EXPIRED: { retryable: false, message: 'Mandate is no longer valid.' },
  MANDATE_REVOKED: { retryable: false, message: 'Mandate has been revoked.' },
  PLAN_HASH_MISMATCH: { retryable: false, message: 'Plan changed after approval.' },
  ACTION_NOT_ALLOWED: { retryable: false, message: 'Action is outside the mandate.' },
  RECIPIENT_NOT_ALLOWED: { retryable: false, message: 'Recipient is outside the mandate.' },
  DUPLICATE_EXECUTION: { retryable: true, message: 'Action was already executed; the first result is returned.' },
  EXECUTION_IN_PROGRESS: {
    retryable: true,
    message: 'A previous execution for this mandate and action is still in progress.',
  },
  EXECUTOR_FAILURE: { retryable: false, message: 'Executor failed internally and must be escalated.' },
  AUDIT_WRITE_FAILED: { retryable: false, message: 'Audit event could not be written.' },
  MCP_UNAVAILABLE: { retryable: true, message: 'MCP service is unavailable; retry after recovery.' },
};
