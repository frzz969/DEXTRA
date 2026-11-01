import { validatePlan as peValidate, summarize } from '../../policy-engine/src/index.ts';
import type { Plan, Org } from '../../contracts/src/index.ts';
import { computePlanHash } from '../../contracts/src/hash.ts';

export function validatePlan(plan: Plan, org: Org): Plan {
  const findings = peValidate(plan, org);
  const status = summarize(plan, findings);
  const next = { ...plan, findings, status };
  return { ...next, plan_hash: computePlanHash(next) } as Plan;
}