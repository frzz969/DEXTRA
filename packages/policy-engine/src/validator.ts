import type { Finding, Plan, PlanAction, Org } from '../../contracts/src/index.ts';
import type { PlanStatus } from '../../contracts/src/index.ts';
import {
  checkOfficeHours, checkFridayPrayer, checkHoliday, checkTimezone,
  checkRecipientScope, checkAmbiguity, checkBulkEgress, checkInjection,
} from './rules.ts';

export function validatePlan(plan: Plan, org: Org, knownContactIds?: Iterable<string>): Finding[] {
  const findings: Finding[] = [];
  for (const a of plan.actions) {
    for (const c of [checkOfficeHours, checkFridayPrayer, checkHoliday, checkTimezone]) {
      const f = c(a, org);
      if (f) findings.push(f);
    }
    const rf = checkRecipientScope(a, org, knownContactIds);
    if (rf) findings.push(rf);
  }
  for (const c of [checkAmbiguity, checkBulkEgress, checkInjection]) {
    const f = c(plan);
    if (f) findings.push(f);
  }
  // dedup by (code, action_id)
  const seen = new Set<string>();
  const deduped: Finding[] = [];
  for (const f of findings) {
    const key = `${f.code}|${f.action_id ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
  }
  const rank = (s: Finding['severity']) => (s === 'blocking' ? 0 : s === 'warning' ? 1 : 2);
  deduped.sort((a, b) => rank(a.severity) - rank(b.severity));
  return deduped;
}

export function summarize(plan: Plan, findings: Finding[]): PlanStatus {
  if (findings.some((f) => f.severity === 'blocking' && f.code !== 'AMBIGUOUS_RECIPIENT')) return 'BLOCKED';
  if (findings.some((f) => f.code === 'AMBIGUOUS_RECIPIENT')) return 'NEEDS_REVIEW';
  if (findings.some((f) => f.severity === 'warning')) return 'NEEDS_REVIEW';
  return 'READY';
}