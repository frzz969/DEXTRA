import type { Mandate } from '../../contracts/src/index.ts';
import { signMandate } from './sign.ts';

export function revokeMandate(mandate: Mandate, now?: string): Mandate {
  if (mandate.status !== 'active') return { ...mandate };
  const t = now ?? new Date().toISOString();
  const nextStatus = Date.parse(t) >= Date.parse(mandate.expires_at) ? 'expired' : 'revoked';
  const base = { ...mandate, status: nextStatus as Mandate['status'] };
  const { signature: _s, ...rest } = base;
  const newSig = signMandate(rest as Omit<Mandate, 'signature'>);
  return { ...base, signature: newSig };
}
