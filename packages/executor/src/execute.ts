import { createHash, randomUUID } from 'node:crypto';
import type { ActionId, ActionType, MandateId, ExecutionId, ErrorCode } from '../../contracts/src/index.ts';
import type { ActionResult, Mandate, Plan, AuditEvent, ExecutionUsage } from '../../contracts/src/index.ts';
import { validateMandate } from '../../mandate-engine/src/index.ts';
import { verifyPlanHash } from '../../plan/src/index.ts';
import { getMandate, getPlan, getExecution, saveExecution, appendAudit, DuplicateExecutionError } from '../../store/src/index.ts';
import { getAdapter } from './adapters/index.ts';

export interface ExecuteInput {
  mandate_id: MandateId;
  action_id: ActionId;
  execution_key: string;
  now?: string;
}

function makeExecutionId(): ExecutionId {
  return `exec_${createHash('sha256').update(randomUUID()).digest('hex').slice(0, 8)}` as ExecutionId;
}

function makeBlockedResult(mandate_id: MandateId, action_id: ActionId, execution_key: string, reason_code: ErrorCode, now: string): ActionResult {
  return {
    execution_id: makeExecutionId(),
    mandate_id,
    action_id,
    execution_key,
    result: 'blocked',
    reason_code,
    executed_at: now,
    evidence: {},
  };
}

function audit(event: Omit<AuditEvent, 'event_id'> & { event_id?: string }): AuditEvent {
  return {
    event_id: event.event_id ?? `evt_${createHash('sha256').update(randomUUID()).digest('hex').slice(0, 8)}`,
    ...event,
  } as AuditEvent;
}

export async function executeAction(input: ExecuteInput): Promise<ActionResult> {
  const now = input.now ?? new Date().toISOString();

  const mandate = await getMandate(input.mandate_id);
  if (!mandate) {
    const blocked = makeBlockedResult(input.mandate_id, input.action_id, input.execution_key, 'MANDATE_NOT_FOUND', now);
    await appendAudit(audit({
      at: now,
      type: 'action_blocked',
      actor: 'executor',
      mandate_id: input.mandate_id,
      action_id: input.action_id,
      reason_code: 'MANDATE_NOT_FOUND',
      detail: { action_id: input.action_id, reason_code: 'MANDATE_NOT_FOUND' },
    }));
    return blocked;
  }
  const plan: Plan | null = await getPlan(mandate.plan_id);

  let actionType: ActionType | null = null;
  let planAction: any = null;
  if (plan) {
    planAction = plan.actions.find((a: any) => a.action_id === input.action_id);
    if (planAction) actionType = planAction.action_type;
  }

  if (actionType === null) {
    const blocked = makeBlockedResult(input.mandate_id, input.action_id, input.execution_key, 'ACTION_NOT_ALLOWED', now);
    await appendAudit(audit({
      at: now,
      type: 'action_blocked',
      actor: 'executor',
      plan_id: plan?.plan_id,
      mandate_id: input.mandate_id,
      action_id: input.action_id,
      reason_code: 'ACTION_NOT_ALLOWED',
      detail: { action_id: input.action_id, reason_code: 'ACTION_NOT_ALLOWED' },
    }));
    return blocked;
  }

  const validation = validateMandate({ mandate, plan, action_id: input.action_id, action_type: actionType, now });
  if (!validation.ok) {
    const blocked = makeBlockedResult(input.mandate_id, input.action_id, input.execution_key, validation.reason_code, now);
    await appendAudit(audit({
      at: now,
      type: 'action_blocked',
      actor: 'executor',
      plan_id: plan?.plan_id,
      mandate_id: input.mandate_id,
      action_id: input.action_id,
      reason_code: validation.reason_code,
      detail: { action_id: input.action_id, reason_code: validation.reason_code },
    }));
    return blocked;
  }

  const existing = await getExecution(input.mandate_id, input.action_id);
  if (existing) {
    return existing;
  }

  const queued: ActionResult = {
    execution_id: makeExecutionId(),
    mandate_id: input.mandate_id,
    action_id: input.action_id,
    execution_key: input.execution_key,
    result: 'queued',
    reason_code: null,
    executed_at: now,
    evidence: {},
  };
  try {
    await saveExecution(queued);
  } catch (e: any) {
    if (e instanceof DuplicateExecutionError) {
      const ex = await getExecution(input.mandate_id, input.action_id);
      if (ex) return ex;
    }
    throw e;
  }

  const action = plan!.actions.find((a: any) => a.action_id === input.action_id);
  if (!action) {
    const blocked = makeBlockedResult(input.mandate_id, input.action_id, input.execution_key, 'ACTION_NOT_ALLOWED', now);
    const res = { ...blocked, execution_id: queued.execution_id };
    await saveExecution(res);
    await appendAudit(audit({
      at: now,
      type: 'action_blocked',
      actor: 'executor',
      plan_id: plan?.plan_id,
      mandate_id: input.mandate_id,
      action_id: input.action_id,
      reason_code: 'ACTION_NOT_ALLOWED',
      detail: { action_id: input.action_id, reason_code: 'ACTION_NOT_ALLOWED' },
    }));
    return res;
  }

  let evidence: Record<string, string> = {};
  let failed = false;
  let failureReason: ErrorCode = 'EXECUTOR_FAILURE';
  let resultId = '';
  let adapterName = '';
  const startedAt = Date.now();
  let usage: ExecutionUsage = {
    provider: 'outbox',
    model: null,
    tokens_in: null,
    tokens_out: null,
    cost_usd: null,
    latency_ms: 0,
  };

  const adapter = getAdapter(action.action_type);
  if (!adapter) {
    failed = true;
    failureReason = 'EXECUTOR_FAILURE';
  } else {
    adapterName = adapter.name;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, [50, 100, 200][attempt - 1]));
      }
      try {
        const r = await adapter.run(action, plan);
        evidence = r.evidence;
        usage = r.usage;
        const idKey = Object.keys(evidence).find(k => k.endsWith('_id'));
        resultId = idKey ? (evidence[idKey] ?? '') : '';
        failed = false;
        break;
      } catch {
        failed = true;
      }
    }
    if (failed) failureReason = 'EXECUTOR_FAILURE';
  }
  const latencyMs = Date.now() - startedAt;
  usage = { ...usage, latency_ms: (usage.latency_ms as number) || latencyMs, provider: usage.provider || adapterName || 'outbox' } as ExecutionUsage;

  if (failed) {
    const failedRes: ActionResult = {
      execution_id: queued.execution_id,
      mandate_id: input.mandate_id,
      action_id: input.action_id,
      execution_key: input.execution_key,
      result: 'failed',
      reason_code: failureReason,
      executed_at: now,
      evidence: {},
      usage,
    };
    await saveExecution(failedRes);
    await appendAudit(audit({
      at: now,
      type: 'action_blocked',
      actor: 'executor',
      plan_id: plan?.plan_id,
      mandate_id: input.mandate_id,
      action_id: input.action_id,
      reason_code: failureReason,
      detail: { action_id: input.action_id, reason_code: failureReason },
    }));
    return failedRes;
  }

  const sent: ActionResult = {
    execution_id: queued.execution_id,
    mandate_id: input.mandate_id,
    action_id: input.action_id,
    execution_key: input.execution_key,
    result: 'sent',
    reason_code: null,
    executed_at: now,
    evidence,
    usage,
  };
  await saveExecution(sent);
  await appendAudit(audit({
    at: now,
    type: 'action_executed',
    actor: 'executor',
    plan_id: plan?.plan_id,
    mandate_id: input.mandate_id,
    action_id: input.action_id,
    detail: { action_id: input.action_id, result: 'sent', provider: adapterName, result_id: resultId },
  }));
  return sent;
}