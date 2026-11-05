import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { startServer } from '../src/server.ts';
import { handleTool } from '../src/handlers.ts';
import { resolveScope } from '../src/auth.ts';
import { getStorePaths, seed } from '../../../packages/store/src/index.ts';
import {
  SCOPE_CAPABILITIES,
  UNBACKED_CAPABILITIES,
  toolsForScope,
} from '../../../packages/contracts/src/authorization.ts';

/*
 * Authorization regression suite.
 *
 * These tests talk to a real HTTP server with real bearer tokens, because the
 * question "can a client bypass the UI?" can only be answered at the boundary a
 * client actually reaches. A test that calls isAllowed() directly proves the
 * table is self-consistent; it does not prove the server consults it.
 *
 * They also call handleTool() directly, on purpose. That is the function that
 * runs the operation, and it is the one place a future internal caller could
 * reach without going through handleRpc. Testing it directly is how we know the
 * defense-in-depth check inside it is real rather than decorative.
 */

const DASHBOARD_ORIGIN = 'http://127.0.0.1:3000';
const AGENT_TOKEN = 'agent-dev-token';
const OPS_TOKEN = 'ops-dev-token';

interface RawResponse {
  status: number;
  body: string;
}

function rpcCall(id: number, name: string, args: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
}

function rpcMethod(id: number, method: string): string {
  return JSON.stringify({ jsonrpc: '2.0', id, method });
}

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

describe('authorization at the HTTP boundary', () => {
  let server: Server;
  let port = 0;
  let dataDir = '';
  let previousDataDir: string | undefined;

  const send = (options: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<RawResponse> =>
    new Promise((resolve, reject) => {
      const req = request(
        { host: '127.0.0.1', port, path: '/', method: options.method, headers: options.headers },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        },
      );
      req.on('error', reject);
      req.end(options.body);
    });

  const call = async (token: string | null, name: string, args: unknown = {}): Promise<any> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Origin: DASHBOARD_ORIGIN,
    };
    if (token !== null) headers.Authorization = `Bearer ${token}`;
    const res = await send({ method: 'POST', headers, body: rpcCall(1, name, args) });
    assert.equal(res.status, 200, 'the JSON-RPC layer answers 200 and reports auth failure in the body');
    return JSON.parse(res.body);
  };

  const readMandates = async (): Promise<unknown[]> => {
    const raw = await readFile(getStorePaths().mandates, 'utf8');
    return JSON.parse(raw) as unknown[];
  };

  const readAudit = async (): Promise<Array<Record<string, unknown>>> => {
    const raw = await readFile(getStorePaths().audit, 'utf8').catch(() => '');
    return raw.split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line));
  };

  before(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'dextra-authz-'));
    previousDataDir = process.env.DEXTRA_DATA_DIR;
    process.env.DEXTRA_DATA_DIR = dataDir;
    process.env.DEXTRA_AGENT_TOKEN = AGENT_TOKEN;
    process.env.DEXTRA_OPS_TOKEN = OPS_TOKEN;
    await seed();
    server = startServer({ port: 0, allowedOrigins: [DASHBOARD_ORIGIN] });
    if (!server.listening) await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const address = server.address();
    assert.ok(address !== null && typeof address === 'object');
    port = address.port;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (previousDataDir === undefined) delete process.env.DEXTRA_DATA_DIR;
    else process.env.DEXTRA_DATA_DIR = previousDataDir;
    await removeTempDir(dataDir);
  });

  test('a valid token in the right scope is allowed', async () => {
    const res = await call(OPS_TOKEN, 'get_org_rules', { org_id: 'org_kenari' });
    assert.equal(res.result.content[0].text.includes('"ok":true'), true);
  });

  test('a valid token in the wrong scope is refused', async () => {
    const res = await call(AGENT_TOKEN, 'execute_action', {
      mandate_id: 'mandate_none', action_id: 'action_001', execution_key: 'k',
    });
    assert.equal(res.error?.code, -32003);
    assert.match(res.error.message, /not available to this caller/);
  });

  test('agent scope cannot read the audit log', async () => {
    const res = await call(AGENT_TOKEN, 'get_audit_log', { limit: 5 });
    assert.equal(res.error?.code, -32003);
  });

  test('a request with no token is unauthorized', async () => {
    const res = await call(null, 'list_plans', {});
    assert.equal(res.error?.code, -32001);
  });

  test('a request with a wrong token is unauthorized', async () => {
    const res = await call('definitely-not-a-token', 'list_plans', {});
    assert.equal(res.error?.code, -32001);
  });

  test('an unknown tool name is refused for both scopes', async () => {
    for (const token of [AGENT_TOKEN, OPS_TOKEN]) {
      const res = await call(token, 'drop_database', {});
      assert.equal(res.error?.code, -32003, 'unknown tools must not fall through to a handler');
    }
  });

  test('a refused call changes no state and is recorded in the audit log', async () => {
    const before = await readMandates();
    const res = await call(AGENT_TOKEN, 'revoke_mandate', { mandate_id: 'mandate_anything' });
    assert.equal(res.error?.code, -32003);
    assert.deepEqual(await readMandates(), before, 'a denied call must not mutate the store');

    const events = await readAudit();
    const blocked = events.filter((e) => e.type === 'action_blocked');
    assert.ok(blocked.length > 0, 'denied authorization must leave an audit trail');
    const last = blocked[blocked.length - 1] as { detail?: Record<string, string> };
    assert.equal(last.detail?.tool, 'revoke_mandate');
    assert.equal(last.detail?.scope, 'agent');
  });

  test('get_caller_context reports the scope and a server-bound principal (never a client claim)', async () => {
    const res = await call(OPS_TOKEN, 'get_caller_context', {});
    const data = JSON.parse(res.result.content[0].text).data;
    assert.equal(data.scope, 'ops');
    // Principal comes from the server-side roster, not from the request body.
    assert.ok(data.principal === null || (data.principal && typeof data.principal.principal_id === 'string'));
    assert.deepEqual(data.capabilities, [...SCOPE_CAPABILITIES.ops]);
    assert.deepEqual(data.unbacked_capabilities, [...UNBACKED_CAPABILITIES]);
  });

  test('tools/list matches the contract for each scope', async () => {
    const headers = (token: string) => ({
      'Content-Type': 'application/json',
      Origin: DASHBOARD_ORIGIN,
      Authorization: `Bearer ${token}`,
    });
    for (const [scope, token] of [['agent', AGENT_TOKEN], ['ops', OPS_TOKEN]] as const) {
      const res = await send({ method: 'POST', headers: headers(token), body: rpcMethod(1, 'tools/list') });
      const listed = JSON.parse(res.body).result.tools.map((t: { name: string }) => t.name).sort();
      assert.deepEqual(listed, [...toolsForScope(scope)].sort(), `${scope} tool list must match the contract`);
    }
  });
});

describe('authorization at the handler boundary (defense in depth)', () => {
  /*
   * handleTool is the only function that actually performs an operation. It used
   * to accept a `scope` argument and never read it, which meant any caller that
   * reached it without going through handleRpc bypassed authorization entirely.
   */
  test('an unresolvable scope is refused before any work happens', async () => {
    const res = await handleTool('list_plans', {}, 'nonsense');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'UNAUTHORIZED');
  });

  test('an agent scope cannot execute an action even if called directly', async () => {
    const res = await handleTool('execute_action', {
      mandate_id: 'mandate_none', action_id: 'action_001', execution_key: 'k',
    }, 'agent');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'ACTION_NOT_ALLOWED');
  });

  test('an agent scope cannot issue a mandate even if called directly', async () => {
    const res = await handleTool('issue_mandate', { plan_id: 'plan_x', approval_id: 'appr_x' }, 'agent');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'ACTION_NOT_ALLOWED');
  });

  test('a tool outside the contract is refused for the ops scope too', async () => {
    const res = await handleTool('get_secrets', {}, 'ops');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'ACTION_NOT_ALLOWED');
  });
});

describe('token resolution', () => {
  test('rotation takes effect without a restart, and the old token stops working', () => {
    const previous = process.env.DEXTRA_OPS_TOKEN;
    try {
      process.env.DEXTRA_OPS_TOKEN = 'rotated-ops-token-value';
      assert.equal(resolveScope('rotated-ops-token-value'), 'ops');
      assert.equal(resolveScope(OPS_TOKEN), null, 'the previous token must stop resolving after rotation');
    } finally {
      if (previous === undefined) delete process.env.DEXTRA_OPS_TOKEN;
      else process.env.DEXTRA_OPS_TOKEN = previous;
    }
    assert.equal(resolveScope(OPS_TOKEN), 'ops', 'the original token resolves again once restored');
  });

  test('an empty or missing token never resolves to a scope', () => {
    assert.equal(resolveScope(''), null);
    assert.equal(resolveScope(undefined), null);
    assert.equal(resolveScope('   '), null);
  });
});
