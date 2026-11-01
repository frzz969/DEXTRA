import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Mandate } from '../../contracts/src/index.ts';

export const DEFAULT_MANDATE_TTL_SECONDS = 3600;

export function getMandateSecret(): string {
  return process.env.DEXTRA_MANDATE_SECRET ?? 'dextra-dev-secret-change-in-prod';
}

function canonical(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = obj[k];
  return JSON.stringify(out);
}

export function signMandate(mandate: Omit<Mandate, 'signature'>): string {
  const payload = {
    mandate_id: mandate.mandate_id,
    plan_id: mandate.plan_id,
    plan_hash: mandate.plan_hash,
    approval_id: mandate.approval_id,
    issued_at: mandate.issued_at,
    expires_at: mandate.expires_at,
    nonce: mandate.nonce,
    allowed_action_ids: [...mandate.allowed_action_ids].sort(),
    allowed_action_types: [...mandate.allowed_action_types].sort(),
    max_risk: mandate.max_risk,
    status: mandate.status,
  };
  return createHmac('sha256', getMandateSecret()).update(canonical(payload)).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function verifySignature(mandate: Mandate): boolean {
  const { signature, ...rest } = mandate;
  const recomputed = signMandate(rest as Omit<Mandate, 'signature'>);
  return timingSafeEqualHex(recomputed, signature);
}
