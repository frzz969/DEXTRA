import { getOrgRules, getPlan, savePlan, getMandate, saveMandate, getExecution, getApproval, saveApproval, appendAudit, listAudit, findPrecedents, getContactIds, listApprovals, listPlans, listMandates, listExecutions, listSpecialists, getPrincipal, summarizeExecutions, verifyAuditChain } from '../../../packages/store/src/index.ts';
import { createPlan as buildPlan, validatePlan as runValidate } from '../../../packages/plan/src/index.ts';
import { issueMandate } from '../../../packages/mandate-engine/src/issue.ts';
import { revokeMandate } from '../../../packages/mandate-engine/src/revoke.ts';
import { executeAction } from '../../../packages/executor/src/execute.ts';
import { OrgSchema } from '../../../packages/contracts/src/index.ts';
import type { Plan, Approval, Mandate } from '../../../packages/contracts/src/index.ts';
import { isAllowed, callerContext, resolvePrincipal, type Scope } from './auth.ts';

/**
 * Resource scope: a scope grants a *kind* of action, never a *record*.
 *
 * Before this, `execute_action` and `revoke_mandate` looked the mandate up by id
 * and acted on it. Any holder of the `ops` token could therefore execute or
 * revoke every mandate in the workspace — including mandates belonging to a
 * different principal. Authorization answered "may this token execute?" and
 * never "may it execute *this*?".
 *
 * The rule, deliberately narrow:
 *   - no principal bound to the token  -> refused (nothing is anonymous)
 *   - mandate has an owner             -> execute: owner only
 *                                         revoke : owner or issuer
 *   - mandate predates the field       -> issuer only
 *
 * Revocation is wider than execution on purpose: withdrawing authority is the
 * grantor's right, using it is not.
 */
async function mandateAccess(
  mandate: Mandate,
  scope: Scope,
  mode: 'execute' | 'revoke',
): Promise<{ ok: true; principalId: string } | { ok: false; error: { code: string; message: string } }> {
  const principal = await resolvePrincipal(scope);
  if (!principal) {
    return {
      ok: false,
      error: {
        code: 'MANDATE_NOT_OWNED',
        message: 'No principal is bound to this token. A mandate cannot be used anonymously.',
      },
    };
  }

  const owner = mandate.owner_principal_id;
  const isOwner = owner !== undefined && owner === principal.principal_id;
  const isIssuer = mandate.issued_by === principal.principal_id;
  const allowed = owner === undefined ? isIssuer : mode === 'revoke' ? isOwner || isIssuer : isOwner;

  if (!allowed) {
    return {
      ok: false,
      error: {
        code: 'MANDATE_NOT_OWNED',
        message:
          `Mandate ${mandate.mandate_id} belongs to ${owner ?? 'its issuer'}, ` +
          `not to ${principal.principal_id}. Scope "${scope}" does not grant access to another principal's record.`,
      },
    };
  }
  return { ok: true, principalId: principal.principal_id };
}

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
      /*
       * An approval is a human decision. Until now the fallback was
       * `args.approver_id`, which meant the audit trail recorded whatever the
       * client claimed. If the token binds no principal there is nobody to hold
       * responsible, so the approval is refused rather than attributed to a
       * string.
       */
      if (!principal) {
        return {
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'No principal is bound to this token; an approval must be attributable.' },
        };
      }
      const approverId = principal.principal_id;
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
        /* The mandate belongs to the plan's requester: it is authority to act on
           *their* request. `approver_id` is the server-resolved principal, not
           the client's claim — the previous version signed the client value into
           `issued_by` while recording the server value on the approval, so the
           two disagreed. */
        const mandate = issueMandate({
          plan,
          approval,
          approver_id: approverId,
          owner_principal_id: plan.requester_id,
          now: new Date().toISOString(),
        });
        await saveMandate(mandate);
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'approval_granted',
          actor: 'dashboard',
          plan_id: plan.plan_id,
          mandate_id: mandate.mandate_id,
          plan_hash: plan.plan_hash,
          detail: { approver: approverId },
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
      const mandate = await getMandate(args.mandate_id);
      if (!mandate) return { ok: false, error: { code: 'MANDATE_NOT_FOUND', message: 'Mandate not found.' } };

      const access = await mandateAccess(mandate, scope as Scope, 'execute');
      if (!access.ok) {
        /* A refused attempt is a fact about the system, so it is recorded. An
           access denial that leaves no trace is indistinguishable from an
           attempt that never happened. */
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'mandate_rejected',
          actor: 'executor',
          plan_id: mandate.plan_id,
          mandate_id: mandate.mandate_id,
          detail: { reason: 'not_owner', principal: (await resolvePrincipal(scope as Scope))?.principal_id ?? 'unbound' },
        } as any);
        return access;
      }

      const result = await executeAction({ mandate_id: args.mandate_id, action_id: args.action_id, execution_key: args.execution_key, now: new Date().toISOString() });
      return { ok: true, data: { result } };
    }
    case 'revoke_mandate': {
      const mandate = await getMandate(args.mandate_id);
      if (!mandate) return { ok: false, error: { code: 'MANDATE_NOT_FOUND', message: 'Mandate not found.' } };

      const access = await mandateAccess(mandate, scope as Scope, 'revoke');
      if (!access.ok) {
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'mandate_rejected',
          actor: 'dashboard',
          plan_id: mandate.plan_id,
          mandate_id: mandate.mandate_id,
          detail: { reason: 'not_owner_or_issuer', principal: (await resolvePrincipal(scope as Scope))?.principal_id ?? 'unbound' },
        } as any);
        return access;
      }

      const revoked = revokeMandate(mandate, new Date().toISOString());
      await saveMandate(revoked);
      await appendAudit({
        event_id: `evt_${Date.now()}`,
        at: new Date().toISOString(),
        type: 'mandate_revoked',
        actor: 'dashboard',
        mandate_id: mandate.mandate_id,
        detail: { by: access.principalId },
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
      /*
       * `summary` is computed over the whole filtered set, before `limit`.
       * Computing it over the page would make the totals depend on how many rows
       * the caller asked for — the classic dashboard bug where "success rate"
       * silently changes when you resize a table.
       */
      return {
        ok: true,
        data: {
          executions: filtered.slice(0, limit),
          total: filtered.length,
          summary: summarizeExecutions(filtered),
        },
      };
    }
    case 'get_status': {
      const ex = await getExecution(args.mandate_id, args.action_id);
      return { ok: true, data: { execution: ex } };
    }
    case 'get_audit_log': {
      const limit = typeof args?.limit === 'number' ? args.limit : 50;
      const events = await listAudit(limit);
      /*
       * Integrity is computed over the WHOLE log, not the page returned: a chain
       * that verifies only the last 50 events says nothing about the 51st from
       * the end. The caller gets the verdict; the page stays small.
       */
      const all = await listAudit();
      return { ok: true, data: { events, integrity: verifyAuditChain(all) } };
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
