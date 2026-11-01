import type { PlanAction, Org, RiskLevel } from '../../contracts/src/index.ts';

export function classifyRisk(action: PlanAction, _org: Org): RiskLevel {
  if (action.action_type === 'create_task') return 'low';
  if (action.action_type === 'create_calendar_event') return 'medium';
  return 'medium';
}