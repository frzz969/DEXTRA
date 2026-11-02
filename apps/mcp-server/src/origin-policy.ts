/**
 * Origin and Host policy for the local MCP server (finding D-01).
 *
 * Two independent checks, both applied before any routing:
 *
 * 1. `Host` header - the server only answers requests addressed to loopback
 *    with its own port. This is the DNS-rebinding control: a rebinding attack
 *    resolves an attacker-controlled hostname to 127.0.0.1, but the browser
 *    still sends that hostname in `Host`, so the request is refused.
 * 2. `Origin` header - browser requests must come from an explicitly trusted
 *    origin. The allowlist is exact-match; there is no wildcard and no suffix
 *    matching, so `http://127.0.0.1:3000.evil.example` never matches
 *    `http://127.0.0.1:3000`.
 *
 * Requests without `Origin` are treated as non-browser callers (curl, an MCP
 * client, the test suite). They get no CORS headers at all. They are not
 * blocked, because `Origin` is the only signal a browser can be relied on to
 * send and requiring it would break non-browser tooling. A hostile page in a
 * browser cannot omit `Origin` on a cross-origin `fetch`, so this does not
 * open a browser path.
 */

/** Dashboard dev origin documented in PRD section 35.2. */
export const DASHBOARD_PORT = 3000;

export interface RequestLike {
  method: string;
  origin?: string | undefined;
  host?: string | undefined;
}

export type RequestDecision =
  | { action: 'allow'; origin: string | null; cors: boolean }
  | {
      action: 'reject';
      status: 400 | 403;
      code: 'MISSING_ORIGIN' | 'FORBIDDEN_ORIGIN' | 'FORBIDDEN_HOST';
    };

export interface OriginPolicy {
  /** Port the server is actually bound to. */
  port: number;
  allowedOrigins: ReadonlySet<string>;
}

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function normalizeOrigin(value: string): string {
  let normalized = value.trim().toLowerCase();
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

export function defaultAllowedOrigins(port: number): string[] {
  const ports = new Set<number>([port, DASHBOARD_PORT]);
  const origins: string[] = [];
  for (const p of ports) {
    origins.push(`http://127.0.0.1:${p}`, `http://localhost:${p}`);
  }
  return origins;
}

/**
 * Builds the allowed-origin set. `DEXTRA_ALLOWED_ORIGINS` (comma separated)
 * replaces the defaults entirely, so an operator can narrow it further.
 */
export function parseAllowedOrigins(raw: string | undefined, port: number): Set<string> {
  const source =
    raw !== undefined && raw.trim() !== '' ? raw.split(',') : defaultAllowedOrigins(port);
  const result = new Set<string>();
  for (const entry of source) {
    const normalized = normalizeOrigin(entry);
    // `null` is the opaque origin of file:// pages and sandboxed frames; it is
    // never trusted, so it cannot enter the allowlist.
    if (normalized !== '' && normalized !== 'null') result.add(normalized);
  }
  return result;
}

interface ParsedHost {
  hostname: string;
  port: number | null;
}

export function parseHostHeader(host: string): ParsedHost | null {
  const value = host.trim().toLowerCase();
  if (value === '') return null;

  if (value.startsWith('[')) {
    const closing = value.indexOf(']');
    if (closing === -1) return null;
    const hostname = value.slice(0, closing + 1);
    const rest = value.slice(closing + 1);
    if (rest === '') return { hostname, port: null };
    if (!rest.startsWith(':')) return null;
    const port = Number(rest.slice(1));
    return Number.isInteger(port) && port > 0 ? { hostname, port } : null;
  }

  const colon = value.lastIndexOf(':');
  if (colon === -1) return { hostname: value, port: null };
  const hostname = value.slice(0, colon);
  const port = Number(value.slice(colon + 1));
  if (hostname === '' || !Number.isInteger(port) || port <= 0) return null;
  return { hostname, port };
}

function isLoopbackHost(parsed: ParsedHost, expectedPort: number): boolean {
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) return false;
  // A `Host` without a port is only produced by HTTP/1.0-style clients; treat
  // it as the bound port rather than guessing from the URL.
  if (parsed.port === null) return true;
  return parsed.port === expectedPort;
}

export function evaluateRequest(request: RequestLike, policy: OriginPolicy): RequestDecision {
  const host = request.host;
  if (typeof host === 'string' && host.trim() !== '') {
    const parsed = parseHostHeader(host);
    if (parsed === null || !isLoopbackHost(parsed, policy.port)) {
      return { action: 'reject', status: 403, code: 'FORBIDDEN_HOST' };
    }
  }

  const rawOrigin = request.origin;
  if (rawOrigin === undefined || rawOrigin.trim() === '') {
    // Non-browser caller: no CORS. A preflight cannot exist without Origin.
    if (request.method.toUpperCase() === 'OPTIONS') {
      return { action: 'reject', status: 400, code: 'MISSING_ORIGIN' };
    }
    return { action: 'allow', origin: null, cors: false };
  }

  const origin = normalizeOrigin(rawOrigin);
  if (origin === 'null' || !policy.allowedOrigins.has(origin)) {
    return { action: 'reject', status: 403, code: 'FORBIDDEN_ORIGIN' };
  }

  return { action: 'allow', origin, cors: true };
}