import type { OrgId, RequestId, ActionType, Target, Schedule, Content, RiskLevel, Plan, PlanAction } from '../../contracts/src/index.ts';
export type { Plan, PlanAction };
export interface PlanActionDraft {
  action_type: ActionType;
  target: Target;
  schedule: Schedule;
  content: Content;
  risk?: RiskLevel;
}
export interface CreatePlanInput {
  org_id: OrgId;
  request_id: RequestId;
  intent: string;
  actions: PlanActionDraft[];
  created_at?: string;
}