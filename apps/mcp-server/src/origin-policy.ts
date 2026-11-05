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
 * open a browser path - but it is also not an authentication bypass: token and
 * scope checks still run for every `tools/call`.
 *
 * Fail-closed rules added by the D-01 review:
 * - a missing or blank `Host` is refused (400), not assumed to be loopback;
 * - a `Host` without a port is refused, because the bound port cannot be verified;
 * - origins are matched only after `parseStrictOrigin`, never after `normalizeOrigin`;
 * - `DEXTRA_ALLOWED_ORIGINS` can only narrow the built-in defaults.
 */

/** Dashboard dev origin documented in PRD section 35.2. */
export const DASHBOARD_PORT = 3000;

/**
 * Port of the static dashboard (`npm run dev:dashboard`).
 *
 * It has to be in the defaults, not in `DEXTRA_ALLOWED_ORIGINS`: that variable
 * can only narrow the built-in set, so a port missing here could never be
 * allowed. Without this entry the documented way to run the dashboard (a static
 * server on 8899) was blocked by CORS on every call — a run-from-zero failure
 * that only showed up when someone actually followed the README.
 */
export const STATIC_DASHBOARD_PORT = 8899;

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
      code: 'MISSING_HOST' | 'MISSING_ORIGIN' | 'FORBIDDEN_ORIGIN' | 'FORBIDDEN_HOST';
    };

/** Raised when DEXTRA_ALLOWED_ORIGINS is malformed or would widen the default allowlist. */
export class InvalidOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOriginConfigurationError';
  }
}

export interface OriginPolicy {
  /** Port the server is actually bound to. */
  port: number;
  allowedOrigins: ReadonlySet<string>;
}

const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * Normalises a value for display/comparison only. It is deliberately permissive,
 * so it MUST NOT be used to decide whether an Origin is trusted: `.../`,
 * `...///` and other malformed values would collapse onto a trusted string.
 * Trust decisions use `parseStrictOrigin`.
 */
export function normalizeOrigin(value: string): string {
  let normalized = value.trim().toLowerCase();
  while (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized;
}

const STRICT_ORIGIN_PATTERN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):([1-9][0-9]{0,4})$/;

/**
 * Parses an exact `http://<loopback>:<port>` origin. Returns `null` for
 * anything else: other schemes, external hostnames, missing/leading-zero/
 * out-of-range ports, trailing slashes, paths, credentials, whitespace, and the
 * opaque `null` origin. There is no fallback parsing: an ambiguous value is
 * rejected rather than repaired.
 */
export function parseStrictOrigin(value: string): string | null {
  if (value === '' || value !== value.trim()) return null;
  const lowered = value.toLowerCase();
  const match = STRICT_ORIGIN_PATTERN.exec(lowered);
  if (match === null) return null;
  const port = Number(match[2]);
  if (port > 65535) return null;
  return lowered;
}

export function defaultAllowedOrigins(port: number): string[] {
  const ports = new Set<number>([port, DASHBOARD_PORT, STATIC_DASHBOARD_PORT]);
  const envPort = Number(process.env.DEXTRA_DASHBOARD_PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort <= 65535) ports.add(envPort);
  const origins: string[] = [];
  for (const p of ports) {
    origins.push(`http://127.0.0.1:${p}`, `http://localhost:${p}`);
  }
  return origins;
}

/**
 * Builds the allowed-origin set.
 *
 * `DEXTRA_ALLOWED_ORIGINS` (comma separated) can only NARROW the built-in
 * loopback defaults. Every entry must parse strictly and must already be part
 * of the default set; the result is the intersection, never a union. A
 * malformed entry, an external origin, a wildcard, or a list that narrows the
 * allowlist to nothing is a configuration error and fails closed at startup
 * instead of silently degrading to a wider policy.
 */
export function parseAllowedOrigins(raw: string | undefined, port: number): Set<string> {
  const defaults = new Set(defaultAllowedOrigins(port));
  if (raw === undefined || raw.trim() === '') {
    return defaults;
  }

  const result = new Set<string>();
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    // Whitespace-only segments (a trailing comma, a stray space) are formatting,
    // not policy. They are skipped; a list with no usable entry still fails below.
    if (trimmed === '') continue;
    const origin = parseStrictOrigin(trimmed);
    if (origin === null) {
      throw new InvalidOriginConfigurationError(
        `DEXTRA_ALLOWED_ORIGINS entry ${JSON.stringify(trimmed)} is not a strict http loopback origin.`,
      );
    }
    if (!defaults.has(origin)) {
      throw new InvalidOriginConfigurationError(
        `DEXTRA_ALLOWED_ORIGINS entry ${JSON.stringify(trimmed)} would widen the default allowlist; only narrowing is allowed.`,
      );
    }
    result.add(origin);
  }

  if (result.size === 0) {
    throw new InvalidOriginConfigurationError('DEXTRA_ALLOWED_ORIGINS narrowed the allowlist to nothing.');
  }
  return result;
}

interface ParsedHost {
  hostname: string;
  port: number | null;
}

export function parseHostHeader(host: string): ParsedHost | null {
  if (/\s/.test(host)) return null;
  const value = host.trim().toLowerCase();
  if (value === '') return null;

  if (value.startsWith('[')) {
    const closing = value.indexOf(']');
    if (closing === -1) return null;
    const hostname = value.slice(0, closing + 1);
    const rest = value.slice(closing + 1);
    if (rest === '') return { hostname, port: null };
    if (!rest.startsWith(':')) return null;
    const port = parsePort(rest.slice(1));
    return port === null ? null : { hostname, port };
  }

  const colon = value.lastIndexOf(':');
  if (colon === -1) return { hostname: value, port: null };
  const hostname = value.slice(0, colon);
  if (hostname === '') return null;
  const port = parsePort(value.slice(colon + 1));
  return port === null ? null : { hostname, port };
}

/** Ports must be plain decimal digits: `8765.`, `08765`, and `+8765` are rejected. */
function parsePort(text: string): number | null {
  if (!/^[1-9][0-9]{0,4}$/.test(text)) return null;
  const port = Number(text);
  return port <= 65535 ? port : null;
}

function isLoopbackHost(parsed: ParsedHost, expectedPort: number): boolean {
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname)) return false;
  // The port is mandatory: without it the bound port cannot be verified, so the
  // value is treated as ambiguous and refused rather than assumed.
  if (parsed.port === null) return false;
  return parsed.port === expectedPort;
}

export function evaluateRequest(request: RequestLike, policy: OriginPolicy): RequestDecision {
  const host = request.host;
  if (host === undefined || host === null || host.trim() === '') {
    // Fail closed: Host is the DNS-rebinding control, so a request that does not
    // carry one is not served. Forwarding headers are never consulted.
    return { action: 'reject', status: 400, code: 'MISSING_HOST' };
  }
  const parsedHost = parseHostHeader(host);
  if (parsedHost === null || !isLoopbackHost(parsedHost, policy.port)) {
    return { action: 'reject', status: 403, code: 'FORBIDDEN_HOST' };
  }

  const rawOrigin = request.origin;
  if (rawOrigin === undefined) {
    // Non-browser caller: no CORS grant. A preflight cannot exist without Origin.
    // This is not an authentication bypass: token and scope checks still run.
    if (request.method.toUpperCase() === 'OPTIONS') {
      return { action: 'reject', status: 400, code: 'MISSING_ORIGIN' };
    }
    return { action: 'allow', origin: null, cors: false };
  }
  // A present but empty/whitespace Origin is a malformed header, not an absent one.

  // Trust decisions use the strict parser, never `normalizeOrigin`.
  const parsedOrigin = parseStrictOrigin(rawOrigin);
  if (parsedOrigin === null || !policy.allowedOrigins.has(parsedOrigin)) {
    return { action: 'reject', status: 403, code: 'FORBIDDEN_ORIGIN' };
  }

  return { action: 'allow', origin: parsedOrigin, cors: true };
}