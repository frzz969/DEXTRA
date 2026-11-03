import { getOrgRules, getPlan, savePlan, getMandate, saveMandate, getExecution, getApproval, saveApproval, appendAudit, listAudit, findPrecedents, getContactIds, listApprovals, listPlans, listMandates, listExecutions, listSpecialists, getPrincipal } from '../../../packages/store/src/index.ts';
import { createPlan as buildPlan, validatePlan as runValidate } from '../../../packages/plan/src/index.ts';
import { issueMandate } from '../../../packages/mandate-engine/src/issue.ts';
import { revokeMandate } from '../../../packages/mandate-engine/src/revoke.ts';
import { executeAction } from '../../../packages/executor/src/execute.ts';
import { OrgSchema } from '../../../packages/contracts/src/index.ts';
import type { Plan, Approval, Mandate } from '../../../packages/contracts/src/index.ts';
import { isAllowed, callerContext, resolvePrincipal, type Scope } from './auth.ts';

export async function handleTool(name: string, args: any, scope: string): Promise<any> {
  /*
   * Defense in depth. handleRpc already refuses a disallowed tool, but this
   * function is the only place that actually runs an operation, and until now
   * it accepted a `scope` argument it never read. Any future caller that reached
   * the handler directly (an internal job, a new transport, a test) would have
   * bypassed authorization completely. Re-asserting here makes the handler safe
   * on its own rather than safe only when called the expected way.
   */
  if (scope !== 'agent' && scope !== 'ops') {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'No scope resolved for this call.' } };
  }
  if (!isAllowed(scope, name)) {
    return {
      ok: false,
      error: { code: 'ACTION_NOT_ALLOWED', message: `Tool ${name} is not available to scope ${scope}.` },
    };
  }

  switch (name) {
    case 'get_caller_context': {
      return { ok: true, data: await callerContext(scope as Scope) };
    }
    case 'get_org_rules': {
      const org = await getOrgRules();
      return { ok: true, data: org };
    }
    case 'find_precedent': {
      const result = await findPrecedents({ subject: args.subject, context: args.context ?? '' });
      return { ok: true, data: result };
    }
    case 'create_plan': {
      const org = await getOrgRules();
      const contactIds = await getContactIds();
      const principal = await resolvePrincipal(scope as Scope);
      const rawAssignee = typeof args?.assignee_id === 'string' ? String(args.assignee_id).trim() : '';
      let assigneeId: string | undefined;
      if (rawAssignee !== '') {
        if (!principal) {
          return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'assignee_id requires an authenticated principal.' } };
        }
        const known = await getPrincipal(rawAssignee);
        if (!known) {
          return { ok: false, error: { code: 'UNKNOWN_PRINCIPAL', message: `Unknown assignee: ${rawAssignee}` } };
        }
        assigneeId = rawAssignee;
      }
      const plan = buildPlan({
        org_id: org.org_id,
        request_id: args.request_id,
        intent: args.intent,
        created_at: new Date().toISOString(),
        actions: args.actions ?? [],
        requester_id: principal?.principal_id,
        assignee_id: assigneeId ?? principal?.principal_id,
      });
      const validated = runValidate(plan, org, contactIds);
      await savePlan(validated);
      return { ok: true, data: { plan: validated } };
    }
    case 'validate_plan': {
      const org = await getOrgRules();
      const contactIds = await getContactIds();
      const plan = args.plan;
      const validated = runValidate(plan, org, contactIds);
      await savePlan(validated);
      return { ok: true, data: { plan: validated } };
    }
    case 'get_plan': {
      const plan = await getPlan(args.plan_id);
      return { ok: true, data: { plan } };
    }
    case 'list_plans': {
      const all = await listPlans();
      const status = typeof args?.status === 'string' ? args.status : null;
      const requesterId = typeof args?.requester_id === 'string' ? args.requester_id : null;
      const assigneeId = typeof args?.assignee_id === 'string' ? args.assignee_id : null;
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : 100;
      const filtered = (status ? all.filter((plan) => plan.status === status) : all)
        .filter((plan) => !requesterId || plan.requester_id === requesterId)
        .filter((plan) => !assigneeId || plan.assignee_id === assigneeId)
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      return { ok: true, data: { plans: filtered.slice(0, limit), total: filtered.length } };
    }
    case 'submit_approval': {
      const plan = await getPlan(args.plan_id);
      if (!plan) return { ok: false, error: { code: 'INVALID_PLAN', message: 'Plan not found.' } };
      if (plan.plan_hash !== args.plan_hash) {
        return { ok: false, error: { code: 'PLAN_HASH_MISMATCH', message: 'Plan hash mismatch.' } };
      }
      const token = String(args.approval_token ?? '').trim();
      if (token.length < 8) {
        return { ok: false, error: { code: 'INVALID_PLAN', message: 'Approval token missing or too short.' } };
      }
      if (token.toLowerCase() === 'apt_demo') {
        return { ok: false, error: { code: 'INVALID_PLAN', message: 'Weak demo approval token is not accepted.' } };
      }
      // reuse check: same approval_token must not be used twice
      const existingApprovals = await listApprovals();
      if (existingApprovals.some((a) => a.approval_token === token)) {
        return { ok: false, error: { code: 'INVALID_PLAN', message: 'Approval token already used.' } };
      }
      const decision = args.decision;
      const principal = await resolvePrincipal(scope as Scope);
      const approverId = principal?.principal_id ?? args.approver_id;
      const approval: Approval = {
        approval_id: `appr_${Date.now()}` as any,
        plan_id: plan.plan_id,
        plan_hash: plan.plan_hash,
        decision,
        approver_id: approverId,
        approval_token: args.approval_token,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        status: decision === 'approve' ? 'granted' : decision === 'reject' ? 'rejected' : 'revision_requested',
      };
      await saveApproval(approval);

      if (decision === 'approve') {
        const mandate = issueMandate({ plan, approval, approver_id: args.approver_id, now: new Date().toISOString() });
        await saveMandate(mandate);
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'approval_granted',
          actor: 'dashboard',
          plan_id: plan.plan_id,
          mandate_id: mandate.mandate_id,
          plan_hash: plan.plan_hash,
          detail: { approver: args.approver_id },
        } as any);
        return { ok: true, data: { approval_id: approval.approval_id, status: 'granted', mandate_id: mandate.mandate_id } };
      }
      if (decision === 'reject') {
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'approval_rejected',
          actor: 'dashboard',
          plan_id: plan.plan_id,
          plan_hash: plan.plan_hash,
          detail: { approver: args.approver_id },
        } as any);
        return { ok: true, data: { approval_id: approval.approval_id, status: 'rejected' } };
      }
      return { ok: true, data: { approval_id: approval.approval_id, status: 'revision_requested' } };
    }
    case 'get_mandate': {
      const mandate = await getMandate(args.mandate_id);
      return { ok: true, data: { mandate } };
    }
    case 'list_mandates': {
      const all = await listMandates();
      const status = typeof args?.status === 'string' ? args.status : null;
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : 100;
      const filtered = (status ? all.filter((mandate) => mandate.status === status) : all)
        .slice()
        .sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));
      return { ok: true, data: { mandates: filtered.slice(0, limit), total: filtered.length } };
    }
    case 'issue_mandate': {
      const plan = await getPlan(args.plan_id);
      const approval = await getApproval(args.approval_id);
      if (!plan || !approval) return { ok: false, error: { code: 'INVALID_PLAN', message: 'Plan or approval not found.' } };
      const mandate = issueMandate({ plan, approval, approver_id: approval.approver_id, now: new Date().toISOString() });
      await saveMandate(mandate);
      /* Minting authority is a governance event. submit_approval records one on
       * the approve path; this second issuance path must be equally traceable,
       * otherwise a mandate could exist with no audit record of who asked for it. */
      await appendAudit({
        event_id: `evt_${Date.now()}`,
        at: new Date().toISOString(),
        type: 'mandate_issued',
        actor: 'dashboard',
        plan_id: plan.plan_id,
        mandate_id: mandate.mandate_id,
        plan_hash: plan.plan_hash,
        detail: { via: 'issue_mandate', approval_id: approval.approval_id, scope },
      } as any);
      return { ok: true, data: { mandate } };
    }
    case 'execute_action': {
      const result = await executeAction({ mandate_id: args.mandate_id, action_id: args.action_id, execution_key: args.execution_key, now: new Date().toISOString() });
      return { ok: true, data: { result } };
    }
    case 'revoke_mandate': {
      const mandate = await getMandate(args.mandate_id);
      if (!mandate) return { ok: false, error: { code: 'MANDATE_NOT_FOUND', message: 'Mandate not found.' } };
      const revoked = revokeMandate(mandate, new Date().toISOString());
      await saveMandate(revoked);
      await appendAudit({
        event_id: `evt_${Date.now()}`,
        at: new Date().toISOString(),
        type: 'mandate_revoked',
        actor: 'dashboard',
        mandate_id: mandate.mandate_id,
        detail: { by: 'dashboard' },
      } as any);
      return { ok: true, data: { mandate: revoked } };
    }
    case 'list_executions': {
      const all = await listExecutions();
      const mandateId = typeof args?.mandate_id === 'string' ? args.mandate_id : null;
      const limit = typeof args?.limit === 'number' && args.limit > 0 ? Math.floor(args.limit) : 100;
      const filtered = (mandateId ? all.filter((row) => row.mandate_id === mandateId) : all)
        .slice()
        .sort((a, b) => Date.parse(b.executed_at) - Date.parse(a.executed_at));
      return { ok: true, data: { executions: filtered.slice(0, limit), total: filtered.length } };
    }
    case 'get_status': {
      const ex = await getExecution(args.mandate_id, args.action_id);
      return { ok: true, data: { execution: ex } };
    }
    case 'get_audit_log': {
      const limit = typeof args?.limit === 'number' ? args.limit : 50;
      const events = await listAudit(limit);
      return { ok: true, data: { events } };
    }
    case 'list_specialists': {
      /* Read straight from workbuddy/agents/*.md. Nothing is added here: no
       * status, no version, no workload. Those were demo-data fields, and a
       * roster that reports them without a source is a roster that lies. */
      const specialists = await listSpecialists();
      return { ok: true, data: { specialists, total: specialists.length } };
    }
    default:
      return { ok: false, error: { code: 'INVALID_PLAN', message: `Unknown tool: ${name}` } };
  }
}
