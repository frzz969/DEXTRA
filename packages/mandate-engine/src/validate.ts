import type { Mandate } from '../../contracts/src/index.ts';
import type { Plan } from '../../plan/src/index.ts';
import type { ErrorCode, ActionId, ActionType } from '../../contracts/src/index.ts';
import { verifySignature } from './sign.ts';

export type MandateValidationResult = { ok: true } | { ok: false; reason_code: ErrorCode };

export function isExpired(mandate: Mandate, now?: string): boolean {
  const t = now ?? new Date().toISOString();
  if (mandate.status === 'expired' || mandate.status === 'consumed') return true;
  return Date.parse(t) >= Date.parse(mandate.expires_at);
}

export function isConsumed(mandate: Mandate): boolean {
  return mandate.status === 'consumed';
}

export function validateMandate(input: {
  mandate: Mandate | null;
  plan: Plan | null;
  action_id: ActionId;
  action_type: ActionType;
  now?: string;
}): MandateValidationResult {
  const { mandate, plan, action_id, action_type } = input;
  const now = input.now ?? new Date().toISOString();
  // 1
  if (mandate === null) return { ok: false, reason_code: 'MANDATE_NOT_FOUND' };
  // 2
  if (!verifySignature(mandate)) return { ok: false, reason_code: 'MANDATE_NOT_FOUND' };
  // 3
  if (mandate.status === 'revoked') return { ok: false, reason_code: 'MANDATE_REVOKED' };
  // 4
  if (mandate.status === 'expired' || mandate.status === 'consumed') return { ok: false, reason_code: 'MANDATE_EXPIRED' };
  // 5
  if (Date.parse(now) >= Date.parse(mandate.expires_at)) return { ok: false, reason_code: 'MANDATE_EXPIRED' };
  // 6
  if (plan === null) return { ok: false, reason_code: 'PLAN_HASH_MISMATCH' };
  // 7
  if (plan.plan_hash !== mandate.plan_hash) return { ok: false, reason_code: 'PLAN_HASH_MISMATCH' };
  // 8
  if (!mandate.allowed_action_ids.includes(action_id)) return { ok: false, reason_code: 'ACTION_NOT_ALLOWED' };
  // 9
  if (!mandate.allowed_action_types.includes(action_type)) return { ok: false, reason_code: 'ACTION_NOT_ALLOWED' };
  // 10
  if (Date.parse(now) < Date.parse(mandate.issued_at)) return { ok: false, reason_code: 'MANDATE_EXPIRED' };
  return { ok: true };
}
