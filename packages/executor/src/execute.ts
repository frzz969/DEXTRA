import { createHash, randomUUID } from 'node:crypto';
import type { ActionId, ActionType, MandateId, ExecutionId, ErrorCode } from '../../contracts/src/index.ts';
import type { ActionResult, Mandate, Plan, AuditEvent, ExecutionUsage } from '../../contracts/src/index.ts';
import { validateMandate } from '../../mandate-engine/src/index.ts';
import { verifyPlanHash } from '../../plan/src/index.ts';
import { getMandate, getPlan, getExecution, saveExecution, appendAudit, DuplicateExecutionError } from '../../store/src/index.ts';
import { mockSendEmail, mockCreateCalendarEvent, mockCreateTask } from './mocks.ts';

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

  // action not found in plan -> ACTION_NOT_ALLOWED
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

  // idempotency
  const existing = await getExecution(input.mandate_id, input.action_id);
  if (existing) {
    return existing;
  }

  // write queued
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

  // execute mock
  let evidence: Record<string, string> = {};
  let failed = false;
  let failureReason: ErrorCode = 'EXECUTOR_FAILURE';
  let mockId = '';
  /*
   * Measured around the adapter call, not around the whole function: the
   * interesting number is how long the provider took, not how long the mandate
   * was looked up. `Date.now()` is enough here because the granularity we
   * report is milliseconds and this is a local mock.
   */
  const startedAt = Date.now();
  let latencyMs = 0;
  /* The adapters below are mocks: no model is called, so tokens and cost are
   * reported as null rather than zero. Zero is a measurement; null is the
   * truth. A real provider adapter replaces this object. */
  let usage: ExecutionUsage = {
    provider: 'mock',
    model: null,
    tokens_in: null,
    tokens_out: null,
    cost_usd: null,
    latency_ms: 0,
  };

  try {
    const t = action.action_type;
    if (t === 'send_email' || t === 'send_message') {
      const r = mockSendEmail({ to: action.target.masked_address, subject: action.content.subject ?? '', body: action.content.body, attachments: [] });
      evidence = { mock_message_id: r.mock_message_id };
      mockId = r.mock_message_id;
    } else if (t === 'create_calendar_event') {
      const r = mockCreateCalendarEvent({ title: action.content.subject ?? 'event', start: action.schedule.start_at, end: action.schedule.end_at, tz: action.schedule.timezone, participants: [action.target.display_name] });
      evidence = { mock_event_id: r.mock_event_id };
      mockId = r.mock_event_id;
    } else if (t === 'create_task') {
      const r = mockCreateTask({ title: action.content.subject ?? 'task', assignee: action.target.display_name, due: action.schedule.start_at });
      evidence = { mock_task_id: r.mock_task_id };
      mockId = r.mock_task_id;
    } else {
      failed = true;
      failureReason = 'EXECUTOR_FAILURE';
    }
  } catch {
    failed = true;
    failureReason = 'EXECUTOR_FAILURE';
  }
  latencyMs = Date.now() - startedAt;
  usage = { ...usage, latency_ms: latencyMs };

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
    detail: { action_id: input.action_id, result: 'sent', mock_id: mockId },
  }));
  return sent;
}
