import { getPlan, getMandate, getExecution, listAudit } from '../../store/src/index.ts';
import type { Plan } from '../../contracts/src/index.ts';
import type { DecisionReplay, ReplayStep } from './types.ts';

export async function replayDecision(planId: string): Promise<DecisionReplay> {
  const plan = await getPlan(planId as any);
  if (!plan) throw new Error('plan not found');

  const allEvents = await listAudit(10000);
  const events = allEvents
    .filter((e) => e.plan_id === planId)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const steps: ReplayStep[] = events.map((e) => ({
    at: e.at,
    type: e.type,
    actor: e.actor,
    subject: e.plan_id ?? planId,
    reason_code: e.reason_code,
    detail: e.detail ?? {},
  }));

  // find mandate id from audit events
  let mandateId: string | null = null;
  for (const e of events) {
    if (e.mandate_id) { mandateId = e.mandate_id; break; }
  }
  // also check mandate_issued events detail
  if (!mandateId) {
    for (const e of events) {
      if (e.type === 'mandate_issued' && e.detail?.mandate_id) { mandateId = e.detail.mandate_id; break; }
    }
  }

  let executionId: string | null = null;
  if (mandateId) {
    const mandate = await getMandate(mandateId as any);
    if (mandate) {
      const actionId = mandate.allowed_action_ids[0];
      if (actionId) {
        const ex = await getExecution(mandateId as any, actionId);
        if (ex) executionId = ex.execution_id;
      }
    }
  }

  let outcome: DecisionReplay['outcome'] = 'unknown';
  if (events.some((e) => e.type === 'action_executed')) outcome = 'executed';
  else if (events.some((e) => e.type === 'mandate_revoked')) outcome = 'revoked';
  else if (events.some((e) => e.type === 'action_blocked')) outcome = 'blocked';
  else if (plan.status === 'BLOCKED') outcome = 'blocked';
  else if (plan.status === 'READY' || plan.status === 'NEEDS_REVIEW' || plan.status === 'DRAFT') outcome = 'pending';

  return {
    plan_id: plan.plan_id,
    plan_hash: plan.plan_hash,
    mandate_id: mandateId,
    execution_id: executionId,
    steps,
    outcome,
  };
}
