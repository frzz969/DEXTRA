import type { Org, Plan, PlanAction, Finding } from '../../contracts/src/index.ts';
import { computePlanHash } from '../../contracts/src/hash.ts';
import { createPlan, validatePlan as runValidate } from '../../plan/src/index.ts';
import { summarize } from '../../policy-engine/src/index.ts';

import { answerValue } from './clarify.ts';
import type { RecipientResolution, ResolvedContact } from './clarify.ts';
import {
  addMinutesKeepingOffset,
  parseDateHint,
  parseWeekdayHint,
  resolveCalendarDate,
  resolveNextWeekday,
  wallClockToIso,
  zonedParts,
} from './dates.ts';
import { checkOfficePolicy, type CalendarEventView, type PolicyActionView } from './policy.ts';
import type {
  ClarificationSession,
  Decomposition,
  ExtractedActionItem,
  NormalizedDocument,
  OfficePolicyFinding,
  OfficeRequest,
  ResolvedAction,
} from './types.ts';

export interface BuildInput {
  request: OfficeRequest;
  document: NormalizedDocument | null;
  decomposition: Decomposition;
  recipients: RecipientResolution[];
  session: ClarificationSession | null;
  org: Org;
  calendar: ReadonlyArray<CalendarEventView> | null;
  knownContactIds: Iterable<string>;
  assumptions: { time_of_day?: string; duration_minutes?: number; timezone?: string };
  timeZone: string;
  now: Date;
}

export interface BuildResult {
  resolved: ResolvedAction[];
  policy_findings: OfficePolicyFinding[];
  plan: Plan | null;
  blocked_reason: string | null;
}

const CHANNEL_BY_TYPE = {
  send_email: 'email',
  send_message: 'chat',
  create_calendar_event: 'calendar',
  create_task: 'task',
} as const;

function contactFor(resolution: RecipientResolution | undefined): ResolvedContact | null {
  if (resolution === undefined || resolution.status !== 'resolved') return null;
  return resolution.contact;
}

interface ScheduleResolution {
  start_at: string;
  end_at: string | null;
  timezone: string;
}

/**
 * Mengubah petunjuk waktu menjadi jadwal konkret.
 *
 * Null berarti "belum bisa" — bukan "pakai saja jam default". Pemanggil
 * memperlakukannya sebagai klarifikasi yang belum dijawab, bukan sebagai izin
 * mengarang.
 */
function resolveSchedule(
  item: ExtractedActionItem,
  input: BuildInput,
): ScheduleResolution | null {
  const hint = item.schedule_hint;
  const timezone = hint.timezone_hint ?? input.assumptions.timezone ?? input.timeZone;
  /* Urutannya penting: jam yang TERTULIS di dokumen mengalahkan asumsi
   * default. Membalik urutan ini membuat "rapat Jumat pukul 12.00" menjadi
   * rapat pukul 09.00 — plan yang tampak sah tetapi bukan yang diminta. */
  const time =
    answerValue(input.session, `clq_${item.item_id}_time`) ?? hint.time ?? input.assumptions.time_of_day ?? null;
  if (time === null) return null;
  const [hour, minute] = time.split(':').map(Number);

  const dateHint = parseDateHint(item.description);
  const weekday = hint.weekday ?? parseWeekdayHint(item.description);

  let date: { year: number; month: number; day: number };
  if (dateHint !== null) {
    date = resolveCalendarDate(dateHint, input.now, timezone);
  } else if (weekday !== null) {
    date = resolveNextWeekday(weekday, input.now, timezone, time);
  } else {
    const today = zonedParts(input.now, timezone);
    date = { year: today.year, month: today.month, day: today.day };
  }

  const start_at = wallClockToIso(date.year, date.month, date.day, hour ?? 9, minute ?? 0, timezone);

  let end_at: string | null = null;
  if (item.action_type === 'create_calendar_event') {
    const answered = answerValue(input.session, `clq_${item.item_id}_duration`);
    const minutes = answered !== null ? Number(answered) : input.assumptions.duration_minutes;
    if (minutes === undefined || !Number.isFinite(minutes) || minutes <= 0) return null;
    end_at = addMinutesKeepingOffset(start_at, minutes);
  }

  return { start_at, end_at, timezone };
}

export function buildOfficePlan(input: BuildInput): BuildResult {
  const recipientByItem = new Map(input.recipients.map((entry) => [entry.item_id, entry]));
  const resolved: ResolvedAction[] = [];
  const policyFindings: OfficePolicyFinding[] = [];
  const drafts: Array<{
    item: ExtractedActionItem;
    contact: ResolvedContact;
    schedule: ScheduleResolution;
  }> = [];

  for (const item of input.decomposition.action_items) {
    const contact = contactFor(recipientByItem.get(item.item_id));
    if (contact === null) {
      return {
        resolved,
        policy_findings: policyFindings,
        plan: null,
        blocked_reason: `Penerima untuk "${item.description}" belum pasti.`,
      };
    }
    const schedule = resolveSchedule(item, input);
    if (schedule === null) {
      return {
        resolved,
        policy_findings: policyFindings,
        plan: null,
        blocked_reason: `Jadwal untuk "${item.description}" belum lengkap.`,
      };
    }
    drafts.push({ item, contact, schedule });
  }

  for (const draft of drafts) {
    const view: PolicyActionView = {
      item_id: draft.item.item_id,
      action_type: draft.item.action_type,
      schedule: draft.schedule,
    };
    const findings = checkOfficePolicy({ action: view, org: input.org, calendar: input.calendar, now: input.now });
    policyFindings.push(...findings);
    resolved.push({
      item_id: draft.item.item_id,
      source: draft.item.source,
      action_type: draft.item.action_type,
      contact: draft.contact,
      schedule: { ...draft.schedule, all_day: false },
      content: draft.item.content_draft,
      assumptions: [],
    });
  }

  const plan = createPlan({
    org_id: input.org.org_id,
    request_id: input.request.request_id as never,
    intent: input.decomposition.goal,
    created_at: input.now.toISOString(),
    actions: drafts.map((draft) => ({
      action_type: draft.item.action_type,
      target: {
        contact_id: draft.contact.contact_id as never,
        display_name: draft.contact.display_name,
        channel: CHANNEL_BY_TYPE[draft.item.action_type],
        masked_address: draft.contact.masked_address,
      },
      schedule: {
        start_at: draft.schedule.start_at,
        ...(draft.schedule.end_at === null ? {} : { end_at: draft.schedule.end_at }),
        timezone: draft.schedule.timezone,
        all_day: false,
      },
      content: {
        ...(draft.item.content_draft.subject === null ? {} : { subject: draft.item.content_draft.subject }),
        body: draft.item.content_draft.body,
        locale: 'id-ID',
      },
    })),
    requester_id: input.request.requester_principal_id,
    assignee_id: input.request.requester_principal_id,
  });

  const validated = runValidate(plan, input.org, input.knownContactIds);

  /* Temuan office digabung ke temuan engine, dedup per (code, action_id).
   * Duplikat tidak dihilangkan karena "salah", tetapi karena satu temuan yang
   * sama dua kali membuat plan tampak lebih buruk daripada kenyataannya. */
  const actionIdByItem = new Map<string, string>();
  drafts.forEach((draft, index) => {
    actionIdByItem.set(draft.item.item_id, `action_${String(index + 1).padStart(3, '0')}`);
  });

  const merged: Finding[] = [...validated.findings];
  for (const entry of policyFindings) {
    const actionId = entry.item_id === null ? undefined : actionIdByItem.get(entry.item_id);
    const finding: Finding = {
      code: entry.code,
      severity: entry.severity,
      ...(actionId === undefined ? {} : { action_id: actionId as never }),
      message: entry.message,
    };
    const duplicate = merged.some((existing) => existing.code === finding.code && existing.action_id === finding.action_id);
    if (!duplicate) merged.push(finding);
  }

  const status = summarize(validated, merged);
  const withFindings: Plan = { ...validated, actions: validated.actions as PlanAction[], findings: merged, status };
  const finalPlan: Plan = { ...withFindings, plan_hash: computePlanHash(withFindings) } as Plan;

  return { resolved, policy_findings: policyFindings, plan: finalPlan, blocked_reason: null };
}
