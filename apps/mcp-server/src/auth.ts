import { timingSafeEqual } from 'node:crypto';
import {
  SCOPE_CAPABILITIES,
  UNBACKED_CAPABILITIES,
  capabilitiesForScope,
  scopeAllowsTool,
  toolsForScope,
  type Capability,
  type Scope,
  type ToolName,
} from '../../../packages/contracts/src/authorization.ts';

export type { Scope };
export { toolsForScope };

export interface AuthContext {
  scope: Scope;
  token: string;
}

/**
 * Tokens are resolved on every call rather than captured at module load.
 *
 * Reading them once at import made rotation impossible without a restart, and
 * made the auth test misleading: assigning `process.env` inside a test body had
 * no effect on the already-captured constants, so the test passed only because
 * the defaults happened to match what it wrote.
 */
function readToken(name: 'DEXTRA_AGENT_TOKEN' | 'DEXTRA_OPS_TOKEN', fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

export function agentToken(): string {
  return readToken('DEXTRA_AGENT_TOKEN', 'agent-dev-token');
}

export function opsToken(): string {
  return readToken('DEXTRA_OPS_TOKEN', 'ops-dev-token');
}

/**
 * Maps a bearer token to a scope. Returns null for anything unrecognised —
 * including an empty token, a token of the wrong length, and a token that
 * matches no configured principal. There is no fallback scope.
 */
export function resolveScope(token: string | undefined): Scope | null {
  if (token === undefined || token === '') return null;
  const tokBuf = Buffer.from(token);
  const candidates: Array<[Scope, string]> = [
    ['agent', agentToken()],
    ['ops', opsToken()],
  ];
  for (const [scope, expected] of candidates) {
    const expectedBuf = Buffer.from(expected);
    if (tokBuf.length === expectedBuf.length && timingSafeEqual(tokBuf, expectedBuf)) {
      return scope;
    }
  }
  return null;
}

/* Allowlists are derived from the capability contract, never hand-written.
 * See packages/contracts/src/authorization.ts for why. */
export const AGENT_TOOLS = new Set<string>(toolsForScope('agent'));
export const OPS_TOOLS = new Set<string>(toolsForScope('ops'));

export function isAllowed(scope: Scope, tool: string): boolean {
  return scopeAllowsTool(scope, tool);
}

/**
 * The caller's authorization context, as reported to the caller itself.
 *
 * This is what lets the dashboard stop guessing: instead of a hardcoded persona
 * deciding what the UI shows, the server states the scope it authenticated and
 * the capabilities that scope holds. The client renders that; it does not
 * invent it.
 */
export interface CallerContext {
  scope: Scope;
  /** No principal exists yet: a token identifies a capability set, not a person. */
  principal: null;
  capabilities: Capability[];
  /** Capabilities in the vocabulary that no scope grants — unimplemented, not denied. */
  unbacked_capabilities: Capability[];
  tools: ToolName[];
}

export function callerContext(scope: Scope): CallerContext {
  return {
    scope,
    principal: null,
    capabilities: capabilitiesForScope(scope),
    unbacked_capabilities: [...UNBACKED_CAPABILITIES],
    tools: toolsForScope(scope),
  };
}

/** Exported for documentation and tests; not used to make decisions. */
export const SCOPE_CAPABILITY_TABLE = SCOPE_CAPABILITIES;
