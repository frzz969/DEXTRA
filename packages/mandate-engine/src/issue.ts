import { randomBytes } from 'node:crypto';
import type { Mandate, Approval } from '../../contracts/src/index.ts';
import type { Plan } from '../../plan/src/index.ts';
import { signMandate, DEFAULT_MANDATE_TTL_SECONDS } from './sign.ts';

export interface IssueMandateInput {
  plan: Plan;
  approval: Approval;
  approver_id: string;
  /** Principal who may execute or revoke this mandate. */
  owner_principal_id?: string;
  ttl_seconds?: number;
  now?: string;
}

export function issueMandate(input: IssueMandateInput): Mandate {
  const { plan, approval } = input;
  if (approval.decision !== 'approve' || approval.status !== 'granted') {
    throw new Error('approval not granted');
  }
  if (approval.plan_id !== plan.plan_id || approval.plan_hash !== plan.plan_hash) {
    throw new Error('approval plan mismatch');
  }
  if (plan.status !== 'READY') {
    throw new Error('plan not ready');
  }
  const now = input.now ?? new Date().toISOString();
  const ttl = input.ttl_seconds ?? DEFAULT_MANDATE_TTL_SECONDS;
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.parse(now) + ttl * 1000).toISOString();
  const actionIds = plan.actions.map((a) => a.action_id);
  const actionTypes = [...new Set(plan.actions.map((a) => a.action_type))];
  const riskRank: Record<string, number> = { low: 0, medium: 1, high: 2 };
  const maxRisk = plan.actions.reduce((acc, a) => {
    return (riskRank[a.risk] ?? 0) > (riskRank[acc] ?? 0) ? a.risk : acc;
  }, 'low' as 'low' | 'medium' | 'high');
  const base: Omit<Mandate, 'signature'> = {
    mandate_id: `mandate_${plan.plan_id.replace('plan_', '')}_${nonce.slice(0, 8)}` as any,
    plan_id: plan.plan_id,
    plan_hash: plan.plan_hash,
    approval_id: approval.approval_id,
    issued_at: now,
    expires_at: expiresAt,
    nonce,
    allowed_action_ids: actionIds,
    allowed_action_types: actionTypes,
    max_risk: maxRisk as 'low' | 'medium' | 'high',
    status: 'active',
    issued_by: input.approver_id,
    ...(input.owner_principal_id ? { owner_principal_id: input.owner_principal_id } : {}),
  };
  const signature = signMandate(base);
  return { ...base, signature } as Mandate;
}
