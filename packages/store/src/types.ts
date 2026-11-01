import type {
  ActionId,
  ActionResult,
  Approval,
  ApprovalId,
  AuditEvent,
  ContactId,
  ErrorCode,
  Mandate,
  MandateId,
  Org as OrgContract,
  Plan,
  PlanId,
} from '../../contracts/src/index.ts';
import { ERROR_META } from '../../contracts/src/index.ts';

/**
 * Public projection of a contact. This is the ONLY contact shape that may
 * leave the store. It intentionally has no `email`, `phone`, `nik` or
 * `address` fields: the sensitive data is removed at the type level, not
 * masked at a later layer.
 */
export interface ContactPublic {
  contact_id: ContactId;
  display_name: string;
  department: string;
  masked_address: string;
  tags: string[];
}

/**
 * Raw contact record as stored on disk. Imported only by `repository.ts` and
 * `mask.ts` inside this package; never re-exported from `src/index.ts`.
 */
export interface ContactRecord extends ContactPublic {
  email: string;
  phone: string;
  nik: string;
  address: string;
}

/** Contract-compatible alias for the org rule set (contracts exports `Org`). */
export type Org = OrgContract;

export interface CalendarEvent {
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  attendees: string[];
}

/**
 * Precedent record. Deliberately minimised per PRD P-07: contact id, context,
 * counters and dates only. No message body, no address, no NIK.
 */
export interface PrecedentRecord {
  precedent_id: string;
  contact_id: ContactId;
  subject: string;
  context: string;
  count: number;
  last_used_days_ago: number;
  disputed: boolean;
}

export interface SeedDocument {
  filename: string;
  content: string;
}

/** Typed store error carrying a contract error code. */
export class StoreError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? ERROR_META[code].message);
    this.name = 'StoreError';
    this.code = code;
  }
}

/**
 * Raised when a second execution is saved for an existing
 * `(mandate_id, action_id)` pair. The first record is never overwritten and is
 * exposed so the caller can map the response to `DUPLICATE_EXECUTION` or
 * `EXECUTION_IN_PROGRESS`.
 */
export class DuplicateExecutionError extends StoreError {
  readonly existing: ActionResult;

  constructor(
    existing: ActionResult,
    code: 'DUPLICATE_EXECUTION' | 'EXECUTION_IN_PROGRESS' = 'DUPLICATE_EXECUTION',
  ) {
    super(code, ERROR_META[code].message);
    this.name = 'DuplicateExecutionError';
    this.existing = existing;
  }
}

/** Raised when a file on disk is not valid JSON or fails contract validation. */
export class StoreFileError extends Error {
  readonly file: string;

  constructor(file: string, message: string) {
    super(`Corrupt store file ${file}: ${message}`);
    this.name = 'StoreFileError';
    this.file = file;
  }
}

/** File shapes used by repository.ts. */
export interface StorePaths {
  dataDir: string;
  documentsDir: string;
  contacts: string;
  org: string;
  precedents: string;
  calendar: string;
  plans: string;
  mandates: string;
  approvals: string;
  executions: string;
  audit: string;
}

export type StorePlan = Plan;
export type StoreMandate = Mandate;
export type StoreApproval = Approval;
export type StoreAuditEvent = AuditEvent;

export type {
  ActionId,
  ActionResult,
  ApprovalId,
  AuditEvent,
  ContactId,
  MandateId,
  Plan,
  PlanId,
};
