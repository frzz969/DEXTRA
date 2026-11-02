import type { ActionId, Finding, Plan, PlanAction, Org } from '../../contracts/src/index.ts';
import { toZoned, isWithinOfficeHours, isFridayPrayer, isHoliday } from './time.ts';

function mk(code: string, severity: Finding['severity'], action_id?: ActionId, message = code): Finding {
  return { code, severity, ...(action_id ? { action_id } : {}), message };
}

export function checkOfficeHours(action: PlanAction, org: Org): Finding | null {
  const z = toZoned(new Date(action.schedule.start_at), action.schedule.timezone);
  if (!isWithinOfficeHours(z, org)) return mk('OUTSIDE_OFFICE_HOURS', 'warning', action.action_id);
  return null;
}

export function checkFridayPrayer(action: PlanAction, org: Org): Finding | null {
  const z = toZoned(new Date(action.schedule.start_at), action.schedule.timezone);
  if (isFridayPrayer(z, org)) return mk('FRIDAY_PRAYER_CONFLICT', 'warning', action.action_id);
  return null;
}

export function checkHoliday(action: PlanAction, org: Org): Finding | null {
  if (isHoliday(new Date(action.schedule.start_at), org, action.schedule.timezone)) return mk('HOLIDAY_CONFLICT', 'warning', action.action_id);
  return null;
}

export function checkTimezone(action: PlanAction, org: Org): Finding | null {
  if (!org.timezones.includes(action.schedule.timezone)) return mk('UNKNOWN_TIMEZONE', 'blocking', action.action_id);
  return null;
}

export function checkRecipientScope(action: PlanAction, _org: Org, knownContactIds?: Iterable<string>): Finding | null {
  if (knownContactIds) {
    const set = new Set(knownContactIds);
    if (!set.has(action.target.contact_id)) {
      return mk('RECIPIENT_NOT_ALLOWED', 'blocking', action.action_id);
    }
  }
  // Flag the ambiguous sentinel contact ids that were never resolved.
  if (action.target.contact_id === 'c_budi_unresolved' || action.target.display_name.includes('(belum dipilih)')) {
    return mk('AMBIGUOUS_RECIPIENT', 'blocking', action.action_id);
  }
  return null;
}

export function checkAmbiguity(plan: Plan): Finding | null {
  for (const a of plan.actions) {
    if (a.target.contact_id === 'c_budi_unresolved' || a.target.display_name.includes('(belum dipilih)')) {
      return mk('AMBIGUOUS_RECIPIENT', 'blocking', a.action_id);
    }
  }
  return null;
}

const PII_PATTERNS = [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/g, /\b\d{10,16}\b/g, /\+?\d[\d\s-]{8,}\d/g];

export function checkBulkEgress(plan: Plan): Finding | null {
  const recipients = new Set(plan.actions.map((a) => a.target.contact_id));
  if (recipients.size > 5) {
    return mk('BULK_EGRESS_SUSPECTED', 'blocking', plan.actions[0]?.action_id);
  }
  let piiCount = 0;
  for (const a of plan.actions) {
    for (const re of PII_PATTERNS) {
      const m = a.content.body.match(re);
      if (m) piiCount += m.length;
    }
  }
  if (piiCount > 3) return mk('BULK_EGRESS_SUSPECTED', 'blocking', plan.actions[0]?.action_id);
  return null;
}

const INJECTION_PATTERNS = [/forward this/i, /kirim ke semua/i, /abaikan instruksi/i];

export function checkInjection(plan: Plan): Finding | null {
  const haystack = plan.intent + ' ' + plan.actions.map((a) => a.content.body).join(' ');
  if (INJECTION_PATTERNS.some((re) => re.test(haystack))) return mk('INJECTION_QUARANTINED', 'blocking');
  return null;
}