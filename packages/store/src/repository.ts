import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
  ActionResultSchema,
  ApprovalSchema,
  AuditEventSchema,
  ContactIdSchema,
  MandateSchema,
  OrgSchema,
  PlanSchema,
  PrecedentResultSchema,
  type ActionId,
  type ActionResult,
  type Approval,
  type ApprovalId,
  type AuditEvent,
  type ContactId,
  type Mandate,
  type MandateId,
  type Org,
  type Plan,
  type PlanId,
  type PrecedentResult,
} from '../../contracts/src/index.ts';

import { ensureStoreFiles, appendJsonLine, readJsonFile, readJsonLines, withFileLock, writeJsonAtomic } from './json-file.ts';
import { maskEmail } from './mask.ts';
import { getStorePaths } from './paths.ts';
import {
  DuplicateExecutionError,
  StoreError,
  StoreFileError,
  type CalendarEvent,
  type ContactPublic,
  type ContactRecord,
  type PrecedentRecord,
} from './types.ts';

const ContactRecordSchema = z
  .object({
    contact_id: ContactIdSchema,
    display_name: z.string().min(1),
    department: z.string().min(1),
    masked_address: z.string().min(1),
    tags: z.array(z.string()),
    email: z.string().min(1),
    phone: z.string().min(1),
    nik: z.string().min(1),
    address: z.string().min(1),
  })
  .strict();

const PrecedentRecordSchema = z
  .object({
    precedent_id: z.string().min(1),
    contact_id: ContactIdSchema,
    subject: z.string().min(1),
    context: z.string().min(1),
    count: z.number().int().nonnegative(),
    last_used_days_ago: z.number().int().nonnegative(),
    disputed: z.boolean(),
  })
  .strict();

const CalendarEventSchema = z
  .object({
    event_id: z.string().min(1),
    title: z.string().min(1),
    start_at: z.string().min(1),
    end_at: z.string().min(1),
    timezone: z.string().min(1),
    attendees: z.array(z.string()),
  })
  .strict();

const MIN_HINT_LENGTH = 3;
const MAX_CONTACT_RESULTS = 5;
const SENSITIVE_DETAIL_TOKENS = ['nik', 'phone', 'email', 'address', 'body'] as const;

function paths() {
  return getStorePaths();
}

async function prepare(): Promise<ReturnType<typeof getStorePaths>> {
  await ensureStoreFiles();
  return paths();
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseRecord<T>(file: string, schema: z.ZodType<T>, value: unknown, index: number): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new StoreFileError(file, `entry ${index} failed contract validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

async function readArray<T>(file: string, schema: z.ZodType<T>): Promise<T[]> {
  const raw = await readJsonFile<unknown>(file, []);
  if (!Array.isArray(raw)) {
    throw new StoreFileError(file, 'expected a JSON array');
  }
  return raw.map((entry, index) => parseRecord(file, schema, entry, index));
}

function toPublic(record: ContactRecord): ContactPublic {
  // Explicit whitelist projection: sensitive fields are simply absent.
  return {
    contact_id: record.contact_id,
    display_name: record.display_name,
    department: record.department,
    masked_address: maskEmail(record.email),
    tags: [...record.tags],
  };
}

async function readContacts(): Promise<ContactRecord[]> {
  const store = await prepare();
  return readArray(store.contacts, ContactRecordSchema);
}

export async function getOrgRules(): Promise<Org> {
  const store = await prepare();
  const raw = await readJsonFile<unknown>(store.org, {});
  const parsed = OrgSchema.safeParse(raw);
  if (!parsed.success) {
    throw new StoreFileError(store.org, `failed OrgSchema validation: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * Keyword contact search. Enumeration is structurally impossible: the caller
 * must supply a hint of at least 3 characters, results are capped at 5 and
 * sorted deterministically by `contact_id`.
 */
export async function findContactsByHint(hint: string, limit?: number): Promise<ContactPublic[]> {
  const needle = normalize(hint);
  if (needle.length < MIN_HINT_LENGTH) {
    throw new StoreError(
      'INVALID_PLAN',
      `Contact search requires a keyword of at least ${MIN_HINT_LENGTH} characters (got ${needle.length}).`,
    );
  }

  const requested = limit === undefined ? MAX_CONTACT_RESULTS : Math.trunc(limit);
  const cap = Math.min(Math.max(requested, 1), MAX_CONTACT_RESULTS);

  const contacts = await readContacts();
  return contacts
    .filter((contact) => normalize(contact.display_name).includes(needle) || normalize(contact.department).includes(needle))
    .sort((left, right) => (left.contact_id < right.contact_id ? -1 : left.contact_id > right.contact_id ? 1 : 0))
    .slice(0, cap)
    .map(toPublic);
}

export async function getContactIds(): Promise<string[]> {
  const contacts = await readContacts();
  return contacts.map((c) => c.contact_id);
}

export async function getContactById(id: ContactId): Promise<ContactPublic | null> {
  const parsedId = ContactIdSchema.safeParse(id);
  if (!parsedId.success) {
    return null;
  }
  const contacts = await readContacts();
  const found = contacts.find((contact) => contact.contact_id === parsedId.data);
  return found === undefined ? null : toPublic(found);
}

export async function findPrecedents(input: { subject: string; context: string }): Promise<PrecedentResult> {
  const subject = normalize(input.subject);
  if (subject.length < MIN_HINT_LENGTH) {
    throw new StoreError(
      'INVALID_PLAN',
      `Precedent lookup requires a subject of at least ${MIN_HINT_LENGTH} characters (got ${subject.length}).`,
    );
  }

  const store = await prepare();
  const records = await readArray(store.precedents, PrecedentRecordSchema);
  const context = normalize(input.context);

  interface Aggregate {
    contact_id: ContactId;
    score: number;
    evidence: Set<string>;
    last_used_days_ago: number;
    disputed: boolean;
  }

  const grouped = new Map<string, Aggregate>();

  for (const record of records) {
    const recordSubject = normalize(record.subject);
    if (!recordSubject.includes(subject)) {
      continue;
    }

    const exact = recordSubject === subject;
    const contextMatch = context !== '' && (normalize(record.context).includes(context) || context.includes(normalize(record.context)));

    let score = exact ? 0.4 + 0.4 : 0.4 + 0.2;
    if (contextMatch) {
      score += 0.2;
    }
    if (record.disputed) {
      score *= 0.5;
    }
    score = Math.min(1, Math.max(0, score));

    const key = record.contact_id;
    const existing = grouped.get(key);
    if (existing === undefined) {
      grouped.set(key, {
        contact_id: record.contact_id,
        score,
        evidence: new Set([`riwayat ${record.count}x untuk konteks ${record.context}`]),
        last_used_days_ago: record.last_used_days_ago,
        disputed: record.disputed,
      });
      continue;
    }

    existing.score = Math.max(existing.score, score);
    existing.evidence.add(`riwayat ${record.count}x untuk konteks ${record.context}`);
    existing.last_used_days_ago = Math.min(existing.last_used_days_ago, record.last_used_days_ago);
    existing.disputed = existing.disputed || record.disputed;
  }

  /*
   * Attach the same public projection the contact search uses, so a caller can
   * build an action from a precedent without a second round trip. The address
   * stays masked here — the raw e-mail never leaves the store.
   */
  const contactById = new Map((await readContacts()).map((contact) => [contact.contact_id, toPublic(contact)]));

  const candidates = [...grouped.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.contact_id < right.contact_id ? -1 : left.contact_id > right.contact_id ? 1 : 0;
    })
    .map((entry) => {
      const contact = contactById.get(entry.contact_id);
      return {
        contact_id: entry.contact_id,
        score: entry.score,
        evidence: [...entry.evidence],
        last_used_days_ago: entry.last_used_days_ago,
        disputed: entry.disputed,
        ...(contact === undefined
          ? {}
          : {
              display_name: contact.display_name,
              department: contact.department,
              masked_address: contact.masked_address,
            }),
      };
    });

  let resolution: PrecedentResult['resolution'] = 'none';
  if (candidates.length === 1) {
    resolution = 'unique';
  } else if (candidates.length > 1) {
    const first = candidates[0];
    const second = candidates[1];
    // A tie at the top is ambiguous; never break a tie by recentness or count.
    resolution = first !== undefined && second !== undefined && Math.abs(first.score - second.score) < 1e-9 ? 'ambiguous' : 'unique';
  }

  return PrecedentResultSchema.parse({ candidates, resolution });
}

export async function getPlan(id: PlanId): Promise<Plan | null> {
  const store = await prepare();
  const plans = await readArray(store.plans, PlanSchema);
  return plans.find((plan) => plan.plan_id === id) ?? null;
}

export async function listPlans(): Promise<Plan[]> {
  const store = await prepare();
  return readArray(store.plans, PlanSchema);
}

export async function savePlan(plan: Plan): Promise<void> {
  const parsed = PlanSchema.parse(plan);
  const store = await prepare();
  await withFileLock(store.plans, async () => {
    const plans = await readArray(store.plans, PlanSchema);
    const index = plans.findIndex((entry) => entry.plan_id === parsed.plan_id);
    if (index === -1) {
      plans.push(parsed);
    } else {
      plans[index] = parsed;
    }
    await writeJsonAtomic(store.plans, plans);
  });
}

export async function getMandate(id: MandateId): Promise<Mandate | null> {
  const store = await prepare();
  const mandates = await readArray(store.mandates, MandateSchema);
  return mandates.find((mandate) => mandate.mandate_id === id) ?? null;
}

export async function listMandates(): Promise<Mandate[]> {
  const store = await prepare();
  return readArray(store.mandates, MandateSchema);
}

export async function saveMandate(mandate: Mandate): Promise<void> {
  const parsed = MandateSchema.parse(mandate);
  const store = await prepare();
  await withFileLock(store.mandates, async () => {
    const mandates = await readArray(store.mandates, MandateSchema);
    const index = mandates.findIndex((entry) => entry.mandate_id === parsed.mandate_id);
    if (index === -1) {
      mandates.push(parsed);
    } else {
      mandates[index] = parsed;
    }
    await writeJsonAtomic(store.mandates, mandates);
  });
}

export async function listApprovals(): Promise<Approval[]> {
  const store = await prepare();
  return readArray(store.approvals, ApprovalSchema);
}

export async function getApproval(id: ApprovalId): Promise<Approval | null> {
  const store = await prepare();
  const approvals = await readArray(store.approvals, ApprovalSchema);
  return approvals.find((approval) => approval.approval_id === id) ?? null;
}

export async function saveApproval(approval: Approval): Promise<void> {
  const parsed = ApprovalSchema.parse(approval);
  const store = await prepare();
  await withFileLock(store.approvals, async () => {
    const approvals = await readArray(store.approvals, ApprovalSchema);
    const index = approvals.findIndex((entry) => entry.approval_id === parsed.approval_id);
    if (index === -1) {
      approvals.push(parsed);
    } else {
      approvals[index] = parsed;
    }
    await writeJsonAtomic(store.approvals, approvals);
  });
}

function executionPair(mandateId: MandateId, actionId: ActionId): string {
  return `${mandateId}\u0000${actionId}`;
}

async function readExecutions(): Promise<ActionResult[]> {
  const store = await prepare();
  return readArray(store.executions, ActionResultSchema);
}

export async function listExecutions(): Promise<ActionResult[]> {
  return readExecutions();
}

/**
 * Aggregate execution records into the numbers a dashboard is allowed to show.
 *
 * Two rules keep this honest:
 *
 * 1. Every field says how many records it was computed from (`measured`).
 *    A total of zero over zero measurements is not "0 ms"; it is "not measured",
 *    and the caller must render it that way.
 * 2. Nothing is estimated, extrapolated, or priced from a table. Cost is the sum
 *    of what adapters actually reported. The mock adapters report `null`, so
 *    cost stays `measured: 0` until a real provider adapter fills it in.
 */
export interface ExecutionSummary {
  total: number;
  by_result: Record<'sent' | 'blocked' | 'failed' | 'queued', number>;
  /**
   * Fraction of attempts the adapter accepted. NOT the fraction of jobs that
   * achieved their business outcome.
   *
   * `result: 'sent'` means the adapter took the request and returned an id.
   * With the mock adapters nothing leaves the process at all. Calling this
   * "success rate" would let a dashboard claim work was done when only a
   * dispatch was acknowledged. The rename is the fix: the metric now says what
   * it measures.
   */
  dispatch_rate: number | null;
  latency: {
    /** What the measurement covers. Only the adapter call is timed today. */
    scope: 'adapter_call';
    measured: number;
    p50_ms: number | null;
    p95_ms: number | null;
    max_ms: number | null;
  };
  tokens: { measured: number; input: number; output: number; total: number };
  cost_usd: {
    measured: number;
    total: number;
    /** How many records got their cost from each source. */
    by_source: { provider_reported: number; rate_card: number; unknown: number };
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  // Nearest-rank: the smallest value at or above the p-th percentile position.
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)] ?? null;
}

export function summarizeExecutions(rows: ActionResult[]): ExecutionSummary {
  const by_result = { sent: 0, blocked: 0, failed: 0, queued: 0 };
  const latencies: number[] = [];
  let tokenRows = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let costRows = 0;
  let costTotal = 0;
  const costBySource = { provider_reported: 0, rate_card: 0, unknown: 0 };

  for (const row of rows) {
    if (row.result in by_result) by_result[row.result as keyof typeof by_result] += 1;

    const usage = row.usage;
    if (!usage) continue;
    if (typeof usage.latency_ms === 'number') latencies.push(usage.latency_ms);

    /*
     * Tokens are counted as a pair: a row that reported input but not output is
     * not a complete measurement, and folding half of it into the total would
     * understate cost while looking precise.
     */
    if (usage.tokens_in !== null && usage.tokens_out !== null) {
      tokenRows += 1;
      tokensIn += usage.tokens_in;
      tokensOut += usage.tokens_out;
    }
    if (usage.cost_usd !== null) {
      costRows += 1;
      costTotal += usage.cost_usd;
      const source = usage.cost_source;
      if (source === 'provider_reported' || source === 'rate_card') costBySource[source] += 1;
      else costBySource.unknown += 1;
    }
  }

  const sorted = latencies.slice().sort((a, b) => a - b);
  const total = rows.length;

  return {
    total,
    by_result,
    dispatch_rate: total === 0 ? null : by_result.sent / total,
    latency: {
      scope: 'adapter_call',
      measured: sorted.length,
      p50_ms: percentile(sorted, 50),
      p95_ms: percentile(sorted, 95),
      max_ms: sorted.length ? sorted[sorted.length - 1] ?? null : null,
    },
    tokens: {
      measured: tokenRows,
      input: tokensIn,
      output: tokensOut,
      total: tokensIn + tokensOut,
    },
    cost_usd: { measured: costRows, total: costTotal, by_source: costBySource },
  };
}

/**
 * Dedup lookup keyed strictly on `(mandate_id, action_id)`. `execution_key`
 * is ignored, so a client cannot bypass dedup by changing its attempt id.
 */
export async function getExecution(mandateId: MandateId, actionId: ActionId): Promise<ActionResult | null> {
  const executions = await readExecutions();
  const needle = executionPair(mandateId, actionId);
  for (const execution of executions) {
    if (executionPair(execution.mandate_id, execution.action_id) === needle) {
      return execution;
    }
  }
  return null;
}

/**
 * Saves the first result for a `(mandate_id, action_id)` pair. A second save
 * is rejected and the existing record is left untouched.
 */
export async function saveExecution(result: ActionResult): Promise<void> {
  const parsed = ActionResultSchema.parse(result);
  const store = paths();
  /*
   * The duplicate check and the write must happen inside one critical section.
   * When they did not, two concurrent executions of the same action could both
   * find no existing record, both write, and the second write would overwrite
   * the first — producing two real sends and one surviving record. The
   * invariant this function exists to enforce cannot be enforced by a check
   * that another caller can slip past between the check and the write.
   */
  await withFileLock(store.executions, async () => {
    const executions = await readExecutions();
    const needle = executionPair(parsed.mandate_id, parsed.action_id);

    const existing = executions.find(
      (execution) => executionPair(execution.mandate_id, execution.action_id) === needle,
    );
    if (existing !== undefined) {
      // Allow the queued -> terminal transition; reject any other duplicate.
      if (existing.result === 'queued' && parsed.result !== 'queued') {
        const idx = executions.indexOf(existing);
        executions[idx] = parsed;
        await writeJsonAtomic(store.executions, executions);
        return;
      }
      const code = existing.result === 'queued' ? 'EXECUTION_IN_PROGRESS' : 'DUPLICATE_EXECUTION';
      throw new DuplicateExecutionError(existing, code);
    }

    executions.push(parsed);
    await writeJsonAtomic(store.executions, executions);
  });
}

function assertNoSensitiveDetail(detail: Record<string, string>): void {
  for (const key of Object.keys(detail)) {
    const normalized = key.toLowerCase();
    const hit = SENSITIVE_DETAIL_TOKENS.find((token) => normalized.includes(token));
    if (hit !== undefined) {
      throw new StoreError(
        'AUDIT_WRITE_FAILED',
        `Audit detail key "${key}" is sensitive ("${hit}"); audit must only contain redacted strings.`,
      );
    }
  }
}

/** Appends one contract-validated audit event. Never rewrites the log. */
/**
 * Canonical form of an audit event for hashing.
 *
 * The field list is explicit and ordered. `JSON.stringify(event)` would depend
 * on property insertion order, so the same event rebuilt by a different code
 * path would hash differently and the chain would "break" for no reason.
 */
function canonicalAuditPayload(event: AuditEvent, prevHash: string | null): string {
  return JSON.stringify([
    prevHash,
    event.event_id,
    event.at,
    event.type,
    event.actor,
    event.plan_id ?? null,
    event.mandate_id ?? null,
    event.action_id ?? null,
    event.plan_hash ?? null,
    event.reason_code ?? null,
    Object.keys(event.detail)
      .sort()
      .map((key) => [key, event.detail[key]]),
  ]);
}

export function auditHash(event: AuditEvent, prevHash: string | null): string {
  return createHash('sha256').update(canonicalAuditPayload(event, prevHash)).digest('hex');
}

export interface AuditIntegrity {
  /** Events that carried a hash and matched their predecessor. */
  verified: number;
  /** Events written before the chain existed. Not verified — merely old. */
  unchained: number;
  /** null when the chain is intact. */
  broken_at: string | null;
  broken_index: number | null;
  ok: boolean;
}

/**
 * Recomputes the hash chain over the events as they are stored now.
 *
 * This is the difference between "append-only" as a promise and append-only as
 * a property: editing one line in `data/audit.jsonl` invalidates every hash
 * after it, and the first bad link is reported by event id.
 */
export function verifyAuditChain(events: AuditEvent[]): AuditIntegrity {
  let expectedPrev: string | null = null;
  let verified = 0;
  let unchained = 0;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (!event.hash) {
      unchained += 1;
      expectedPrev = null;
      continue;
    }
    if ((event.prev_hash ?? null) !== expectedPrev) {
      return { verified, unchained, broken_at: event.event_id, broken_index: index, ok: false };
    }
    if (auditHash(event, expectedPrev) !== event.hash) {
      return { verified, unchained, broken_at: event.event_id, broken_index: index, ok: false };
    }
    verified += 1;
    expectedPrev = event.hash;
  }

  return { verified, unchained, broken_at: null, broken_index: null, ok: true };
}

export async function appendAudit(event: AuditEvent): Promise<void> {
  const parsed = AuditEventSchema.parse(event);
  assertNoSensitiveDetail(parsed.detail);
  const store = await prepare();
  /*
   * Read-last-then-append must be one critical section. Two concurrent appends
   * that both read the same predecessor would chain to the same `prev_hash` and
   * fork the chain — producing a "tampered" verdict later for events nobody
   * touched.
   */
  await withFileLock(store.audit, async () => {
    const existing = await readAuditEvents(store.audit);
    const last = existing[existing.length - 1];
    const prevHash = last?.hash ?? null;
    const chained: AuditEvent = { ...parsed, prev_hash: prevHash, hash: auditHash(parsed, prevHash) };
    await appendJsonLine(store.audit, chained);
  });
}

async function readAuditEvents(file: string): Promise<AuditEvent[]> {
  const raw = await readJsonLines<unknown>(file);
  return raw.map((entry, index) => parseRecord(file, AuditEventSchema, entry, index));
}

/** Returns audit events in append order (oldest first), optionally last N. */
export async function listAudit(limit?: number): Promise<AuditEvent[]> {
  const store = await prepare();
  const events = await readAuditEvents(store.audit);
  if (limit !== undefined && limit >= 0) {
    return events.slice(-limit);
  }
  return events;
}

export async function listCalendarEvents(): Promise<CalendarEvent[]> {
  const store = await prepare();
  const raw = await readJsonFile<unknown>(store.calendar, { events: [] });
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new StoreFileError(store.calendar, 'expected an object with an "events" array');
  }
  const events = (raw as { events?: unknown }).events;
  if (!Array.isArray(events)) {
    throw new StoreFileError(store.calendar, 'expected an "events" array');
  }
  return events.map((entry, index) => parseRecord(store.calendar, CalendarEventSchema, entry, index));
}
