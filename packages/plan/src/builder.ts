import { CONTRACT_VERSION } from '../../contracts/src/constants.ts';
import type { Plan, PlanAction, Finding, ActionId, PlanId, OrgId, RequestId } from '../../contracts/src/index.ts';
import { computePlanHash } from '../../contracts/src/hash.ts';
import { classifyRisk } from '../../policy-engine/src/index.ts';
import type { CreatePlanInput, PlanActionDraft } from './types.ts';

function draftToAction(draft: PlanActionDraft, i: number): PlanAction {
  const risk = draft.risk ?? classifyRisk(
    { action_type: draft.action_type } as PlanAction,
    {} as never,
  );
  return {
    action_id: `action_${String(i + 1).padStart(3, '0')}` as ActionId,
    action_type: draft.action_type,
    target: draft.target,
    schedule: draft.schedule,
    content: draft.content,
    risk,
  };
}

export function createPlan(input: CreatePlanInput): Plan {
  const planId = `plan_${input.request_id.replace(/^req_/, '')}` as PlanId;
  const actions = input.actions.map((d, i) => draftToAction(d, i));
  const base = {
    plan_id: planId,
    org_id: input.org_id as OrgId,
    request_id: input.request_id as RequestId,
    intent: input.intent,
    status: 'DRAFT' as const,
    actions,
    findings: [] as Finding[],
    created_at: input.created_at ?? new Date().toISOString(),
    contract_version: CONTRACT_VERSION,
    ...(input.requester_id ? { requester_id: input.requester_id } : {}),
    ...(input.assignee_id ? { assignee_id: input.assignee_id } : {}),
  };
  const plan = { ...base, plan_hash: computePlanHash(base) } as unknown as Plan;
  return plan;
}

export function addFinding(plan: Plan, finding: Finding): Plan {
  const exists = plan.findings.some((f) => f.code === finding.code && f.action_id === finding.action_id);
  const findings = exists ? plan.findings : [...plan.findings, finding];
  const next = { ...plan, findings };
  return { ...next, plan_hash: computePlanHash(next) } as unknown as Plan;
}

export function withActions(plan: Plan, actions: PlanAction[]): Plan {
  const next = { ...plan, actions, status: 'DRAFT' as const };
  return { ...next, plan_hash: computePlanHash(next) } as unknown as Plan;
}
