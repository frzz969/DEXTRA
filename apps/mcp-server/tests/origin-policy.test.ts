import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import {
  DASHBOARD_PORT,
  evaluateRequest,
  normalizeOrigin,
  parseAllowedOrigins,
  parseHostHeader,
} from '../src/origin-policy.ts';
import { startServer } from '../src/server.ts';

const DASHBOARD_ORIGIN = `http://127.0.0.1:${DASHBOARD_PORT}`;
const POLICY_PORT = 8765;
const policy = { port: POLICY_PORT, allowedOrigins: parseAllowedOrigins(undefined, POLICY_PORT) };

describe('origin policy (unit)', () => {
  test('allows the documented dashboard loopback origin', () => {
    const decision = evaluateRequest(
      { method: 'POST', origin: DASHBOARD_ORIGIN, host: `127.0.0.1:${POLICY_PORT}` },
      policy,
    );
    assert.deepEqual(decision, { action: 'allow', origin: DASHBOARD_ORIGIN, cors: true });
  });

  test('rejects an external origin and returns no CORS grant', () => {
    const decision = evaluateRequest(
      { method: 'POST', origin: 'https://evil.example', host: `127.0.0.1:${POLICY_PORT}` },
      policy,
    );
    assert.deepEqual(decision, { action: 'reject', status: 403, code: 'FORBIDDEN_ORIGIN' });
  });

  test('allows a request without Origin as a non-browser caller, without CORS', () => {
    const decision = evaluateRequest({ method: 'POST', host: `127.0.0.1:${POLICY_PORT}` }, policy);
    assert.deepEqual(decision, { action: 'allow', origin: null, cors: false });
  });

  test('rejects suspicious origins: opaque, suffix attack, wrong scheme, wrong port', () => {
    const suspicious = [
      'null',
      `http://127.0.0.1:${DASHBOARD_PORT}.evil.example`,
      `https://127.0.0.1:${DASHBOARD_PORT}`,
      'http://127.0.0.1:9999',
      'http://localhost.evil.example:3000',
    ];
    for (const origin of suspicious) {
      const decision = evaluateRequest(
        { method: 'POST', origin, host: `127.0.0.1:${POLICY_PORT}` },
        policy,
      );
      assert.equal(decision.action, 'reject', `${origin} must be rejected`);
      if (decision.action === 'reject') assert.equal(decision.code, 'FORBIDDEN_ORIGIN');
    }
  });

  test('rejects a preflight that carries no Origin', () => {
    const decision = evaluateRequest({ method: 'OPTIONS', host: `127.0.0.1:${POLICY_PORT}` }, policy);
    assert.deepEqual(decision, { action: 'reject', status: 400, code: 'MISSING_ORIGIN' });
  });

  test('rejects a DNS-rebinding Host header even without Origin', () => {
    const decision = evaluateRequest(
      { method: 'POST', host: `attacker.example:${POLICY_PORT}` },
      policy,
    );
    assert.deepEqual(decision, { action: 'reject', status: 403, code: 'FORBIDDEN_HOST' });
  });

  test('rejects a loopback Host whose port is not the bound port', () => {
    const decision = evaluateRequest({ method: 'GET', host: '127.0.0.1:3000' }, policy);
    assert.deepEqual(decision, { action: 'reject', status: 403, code: 'FORBIDDEN_HOST' });
  });

  test('accepts loopback Host forms: 127.0.0.1, localhost, [::1]', () => {
    for (const host of [`127.0.0.1:${POLICY_PORT}`, `localhost:${POLICY_PORT}`, `[::1]:${POLICY_PORT}`]) {
      const decision = evaluateRequest({ method: 'GET', host }, policy);
      assert.equal(decision.action, 'allow', `${host} must be allowed`);
    }
  });

  test('origin allowlist never contains a wildcard or the opaque null origin', () => {
    for (const entry of policy.allowedOrigins) {
      assert.notEqual(entry, '*');
      assert.notEqual(entry, 'null');
    }
  });

  test('DEXTRA_ALLOWED_ORIGINS narrows the allowlist instead of widening it', () => {
    const narrowed = parseAllowedOrigins(' http://127.0.0.1:3000 , ', POLICY_PORT);
    assert.deepEqual([...narrowed], ['http://127.0.0.1:3000']);
    const wildcard = parseAllowedOrigins('*', POLICY_PORT);
    assert.equal(wildcard.has('*'), true, 'the parser is literal; a wildcard is matched exactly');
    const decision = evaluateRequest(
      { method: 'POST', origin: 'http://127.0.0.1:3001', host: `127.0.0.1:${POLICY_PORT}` },
      { port: POLICY_PORT, allowedOrigins: wildcard },
    );
    assert.equal(decision.action, 'reject');
  });

  test('normalizeOrigin strips trailing slashes and lowercases', () => {
    assert.equal(normalizeOrigin(' HTTP://127.0.0.1:3000/ '), 'http://127.0.0.1:3000');
  });

  test('parseHostHeader handles IPv6 and malformed values', () => {
    assert.deepEqual(parseHostHeader('[::1]:8765'), { hostname: '[::1]', port: 8765 });
    assert.deepEqual(parseHostHeader('127.0.0.1'), { hostname: '127.0.0.1', port: null });
    assert.equal(parseHostHeader('127.0.0.1:abc'), null);
    assert.equal(parseHostHeader(''), null);
  });
});

interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/**
 * `startServer` starts `ensureStoreFiles()` without awaiting it, so a store
 * write can land while the temp directory is being removed. Retry the cleanup
 * rather than failing an otherwise green suite on teardown.
 */
async function removeTempDir(dir: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

describe('origin policy (http surface)', () => {
  let server: Server;
  let port = 0;
  let dataDir = '';
  let previousDataDir: string | undefined;

  const send = (options: {
    method: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<RawResponse> =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path: options.path ?? '/',
          method: options.method,
          headers: options.headers,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }));
        },
      );
      req.on('error', reject);
      req.end(options.body);
    });

  before(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'dextra-origin-'));
    previousDataDir = process.env.DEXTRA_DATA_DIR;
    process.env.DEXTRA_DATA_DIR = dataDir;
    server = startServer({ port: 0, allowedOrigins: [DASHBOARD_ORIGIN] });
    if (!server.listening) await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    assert.ok(address !== null && typeof address === 'object');
    port = address.port;
  });

  after(async () => {
    if (server !== undefined) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (previousDataDir === undefined) delete process.env.DEXTRA_DATA_DIR;
    else process.env.DEXTRA_DATA_DIR = previousDataDir;
    if (dataDir !== '') await removeTempDir(dataDir);
  });

  test('binds to loopback only', () => {
    const address = server.address();
    assert.ok(address !== null && typeof address === 'object');
    assert.equal(address.address, '127.0.0.1');
  });

  test('allowed dashboard origin receives an exact CORS grant on /health', async () => {
    const res = await send({ method: 'GET', path: '/health', headers: { Origin: DASHBOARD_ORIGIN } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], DASHBOARD_ORIGIN);
    assert.notEqual(res.headers['access-control-allow-origin'], '*');
    assert.match(String(res.headers.vary ?? ''), /Origin/i);
    assert.equal(JSON.parse(res.body).ok, true);
  });

  test('external origin is refused with 403 and no CORS headers', async () => {
    const res = await send({ method: 'GET', path: '/health', headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.match(res.body, /FORBIDDEN_ORIGIN/);
  });

  test('request without Origin still works and gets no CORS grant', async () => {
    const res = await send({ method: 'GET', path: '/health' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('OPTIONS preflight from the allowed origin answers 204 with scoped headers', async () => {
    const res = await send({
      method: 'OPTIONS',
      path: '/',
      headers: {
        Origin: DASHBOARD_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers['access-control-allow-origin'], DASHBOARD_ORIGIN);
    assert.match(String(res.headers['access-control-allow-methods'] ?? ''), /POST/);
    assert.match(String(res.headers['access-control-allow-headers'] ?? ''), /Authorization/i);
    assert.equal(res.headers['access-control-allow-credentials'], undefined);
  });

  test('OPTIONS preflight from an untrusted origin is refused', async () => {
    const res = await send({
      method: 'OPTIONS',
      path: '/',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 403);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('DNS-rebinding Host header is refused before any tool runs', async () => {
    const res = await send({
      method: 'GET',
      path: '/health',
      headers: { Host: `attacker.example:${port}`, Origin: DASHBOARD_ORIGIN },
    });
    assert.equal(res.status, 403);
    assert.match(res.body, /FORBIDDEN_HOST/);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  test('non-browser JSON-RPC client without Origin still completes initialize', async () => {
    const res = await send({
      method: 'POST',
      path: '/',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    });
    assert.equal(res.status, 200);
    const payload = JSON.parse(res.body);
    assert.equal(payload.result.serverInfo.name, 'dextra-mcp');
  });
});