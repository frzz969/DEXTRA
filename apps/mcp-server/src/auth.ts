import { timingSafeEqual } from 'node:crypto';

export type Scope = 'agent' | 'ops';

export interface AuthContext {
  scope: Scope;
  token: string;
}

const AGENT_TOKEN = process.env.DEXTRA_AGENT_TOKEN ?? 'agent-dev-token';
const OPS_TOKEN = process.env.DEXTRA_OPS_TOKEN ?? 'ops-dev-token';

// Fail-closed assertion: ops token must never be configured in the agent-facing config.
// (Checked at startup by the caller; here we only expose the constants.)

export function resolveScope(token: string | undefined): Scope | null {
  if (token === undefined || token === '') return null;
  const agentBuf = Buffer.from(AGENT_TOKEN);
  const opsBuf = Buffer.from(OPS_TOKEN);
  const tokBuf = Buffer.from(token);
  if (tokBuf.length === agentBuf.length && timingSafeEqual(tokBuf, agentBuf)) return 'agent';
  if (tokBuf.length === opsBuf.length && timingSafeEqual(tokBuf, opsBuf)) return 'ops';
  return null;
}

export const AGENT_TOOLS = new Set([
  'get_org_rules',
  'find_precedent',
  'create_plan',
  'validate_plan',
  'get_plan',
  'list_plans',
  'get_mandate',
  'list_mandates',
  'get_status',
]);

export const OPS_TOOLS = new Set([
  'get_org_rules',
  'find_precedent',
  'create_plan',
  'validate_plan',
  'get_plan',
  'list_plans',
  'submit_approval',
  'get_mandate',
  'list_mandates',
  'issue_mandate',
  'execute_action',
  'revoke_mandate',
  'get_status',
  'get_audit_log',
]);

export function isAllowed(scope: Scope, tool: string): boolean {
  const set = scope === 'agent' ? AGENT_TOOLS : OPS_TOOLS;
  return set.has(tool);
}

export function agentToken(): string {
  return AGENT_TOKEN;
}

export function opsToken(): string {
  return OPS_TOKEN;
}
