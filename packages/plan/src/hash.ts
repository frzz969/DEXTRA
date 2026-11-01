export { computePlanHash } from '../../contracts/src/hash.ts';
import { computePlanHash } from '../../contracts/src/hash.ts';
import type { Plan } from '../../contracts/src/index.ts';

export function verifyPlanHash(plan: Plan): boolean {
  return computePlanHash(plan) === plan.plan_hash;
}