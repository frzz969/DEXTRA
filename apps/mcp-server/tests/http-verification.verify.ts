import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { connect } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';

import { startServer } from '../src/server.ts';
import { getStorePaths, seed } from '../../../packages/store/src/index.ts';
import { toolsForScope } from '../../../packages/contracts/src/authorization.ts';

const DASHBOARD_ORIGIN = 'http://127.0.0.1:3000';
const AGENT_TOKEN = 'agent-dev-token';
const OPS_TOKEN = 'ops-dev-token';

interface RawResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface StoreState {
  plans: string;
  approvals: string;
  mandates: string;
  executions: string;
  audit: string;
}

const CREATE_PLAN_ARGS = {
  org_id: 'org_kenari',
  request_id: 'req_review01',
  intent: 'kirim notulen rapat ke Budi',
  actions: [
    {
      action_type: 'send_email',
      target: {
        contact_id: 'c_budi_fin',
        display_name: 'Budi Santoso',
        channel: 'email',
        masked_address: 'b***@kenari.co.id',
      },
      schedule: { start_at: '2026-11-04T09:00:00+07:00', timezone: 'Asia/Jakarta', all_day: false },
      content: { subject: 'Notulen Rapat', body: 'Halo Budi, berikut notulen rapat.', locale: 'id-ID' },
    },
  ],
};

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

describe('D-01 HTTP verification', () => {
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

  /** Raw HTTP over a socket: the only way to send an absent or malformed Host. */
  const raw = (text: string): Promise<{ status: number; body: string }> =>
    new Promise((resolve, reject) => {
      const socket = connect({ host: '127.0.0.1', port }, () => socket.write(text));
      let data = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk) => { data += chunk; });
      socket.on('end', () => {
        const statusLine = data.split('\r\n')[0] ?? '';
        const status = Number(statusLine.split(' ')[1] ?? 0);
        resolve({ status, body: data });
      });
      socket.on('error', reject);
      socket.setTimeout(3000, () => { socket.destroy(); });
    });

  const readStore = async (): Promise<StoreState> => {
    const paths = getStorePaths();
    const read = async (file: string): Promise<string> => {
      try {
        return await readFile(file, 'utf8');
      } catch {
        return '<missing>';
      }
    };
    return {
      plans: await read(paths.plans),
      approvals: await read(paths.approvals),
      mandates: await read(paths.mandates),
      executions: await read(paths.executions),
      audit: await read(paths.audit),
    };
  };

  const expectNoCors = (res: RawResponse): void => {
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  };

  before(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'dextra-http-'));
    previousDataDir = process.env.DEXTRA_DATA_DIR;
    process.env.DEXTRA_DATA_DIR = dataDir;
    await seed();
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

  // ---------------------------------------------------------------- F02 / U04
  test('F02: external Host is refused with no CORS grant', async () => {
    const res = await send({
      method: 'GET',
      path: '/health',
      headers: { Host: `attacker.example:${port}`, Origin: DASHBOARD_ORIGIN },
    });
    assert.equal(res.status, 403);
    assert.match(res.body, /FORBIDDEN_HOST/);
    expectNoCors(res);
  });

  test('F02: wrong-port and ambiguous Host values are refused', async () => {
    for (const host of [`127.0.0.1:${port === 65535 ? 65534 : port + 1}`, `127.0.0.1:${port}:80`]) {
      const res = await send({ method: 'GET', path: '/health', headers: { Host: host, Origin: DASHBOARD_ORIGIN } });
      assert.equal(res.status, 403, host);
      assert.match(res.body, /FORBIDDEN_HOST/);
      expectNoCors(res);
    }
  });

  test('F02: Host without a port is refused over HTTP', async () => {
    const res = await raw(`GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    assert.equal(res.status, 403);
    assert.match(res.body, /FORBIDDEN_HOST/);
  });

  // Observed behaviour: Node's HTTP/1.0 parser accepts a request without Host,
  // so it reaches our handler and is answered by MISSING_HOST.
  test('U04: a request with no Host header at all is refused by our handler', async () => {
    const res = await raw(`GET /health HTTP/1.0\r\nConnection: close\r\n\r\n`);
    assert.equal(res.status, 400);
    assert.match(res.body, /MISSING_HOST/);
  });

  // Observed behaviour: Node accepts the value and our parser refuses it
  // (whitespace is never repaired into a loopback host).
  test('U04: a malformed Host header is refused by our host parser', async () => {
    const res = await raw(`GET /health HTTP/1.1\r\nHost: bad host:${port}\r\nConnection: close\r\n\r\n`);
    assert.equal(res.status, 403);
    assert.match(res.body, /FORBIDDEN_HOST/);
  });

  test('U04/F02: forwarding headers never override the Host check', async () => {
    const spoofedForward = await send({
      method: 'GET',
      path: '/health',
      headers: { Host: `attacker.example:${port}`, 'X-Forwarded-Host': `127.0.0.1:${port}`, Origin: DASHBOARD_ORIGIN },
    });
    assert.equal(spoofedForward.status, 403);
    assert.match(spoofedForward.body, /FORBIDDEN_HOST/);

    const forwardedOnly = await send({
      method: 'GET',
      path: '/health',
      headers: {
        Host: `127.0.0.1:${port}`,
        'X-Forwarded-Host': 'attacker.example',
        Forwarded: 'host=attacker.example',
        Origin: DASHBOARD_ORIGIN,
      },
    });
    assert.equal(forwardedOnly.status, 200, 'forwarding headers are ignored, so a valid Host still works');
  });

  // ---------------------------------------------------------------------- U02
  test('U02: OPTIONS without Origin gets no preflight grant', async () => {
    const res = await send({
      method: 'OPTIONS',
      path: '/',
      headers: { 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 400);
    assert.match(res.body, /MISSING_ORIGIN/);
    expectNoCors(res);
  });

  test('U02: preflight is granted only to the allowed origin, never with a wildcard', async () => {
    const allowed = await send({
      method: 'OPTIONS',
      path: '/',
      headers: {
        Origin: DASHBOARD_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers['access-control-allow-origin'], DASHBOARD_ORIGIN);
    assert.notEqual(allowed.headers['access-control-allow-origin'], '*');

    const denied = await send({
      method: 'OPTIONS',
      path: '/',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(denied.status, 403);
    expectNoCors(denied);
  });

  // ---------------------------------------------------------------------- U03
  test('U03: an external origin is rejected before any tool, store write, or audit event', async () => {
    const beforeState = await readStore();

    const res = await send({
      method: 'POST',
      path: '/',
      headers: {
        Origin: 'https://evil.example',
        Authorization: `Bearer ${OPS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: rpcCall(1, 'create_plan', CREATE_PLAN_ARGS),
    });

    assert.equal(res.status, 403);
    assert.match(res.body, /FORBIDDEN_ORIGIN/);
    expectNoCors(res);

    const afterState = await readStore();
    assert.equal(afterState.plans, beforeState.plans, 'plans must not change');
    assert.equal(afterState.mandates, beforeState.mandates, 'mandates must not change');
    assert.equal(afterState.executions, beforeState.executions, 'executions must not change');
    assert.equal(afterState.audit, beforeState.audit, 'no audit event may be written');
    assert.ok(!afterState.plans.includes('plan_review01'), 'the plan must not exist');
  });

  // ---------------------------------------------------------------------- U01
  test('U01: POST without Origin still requires a token and refuses to run a tool', async () => {
    const beforeState = await readStore();

    const missing = await send({
      method: 'POST',
      path: '/',
      headers: { 'Content-Type': 'application/json' },
      body: rpcCall(2, 'execute_action', { mandate_id: 'mandate_x', action_id: 'action_001', execution_key: 'k1' }),
    });
    assert.equal(missing.status, 200);
    const missingPayload = JSON.parse(missing.body);
    assert.equal(missingPayload.error.code, -32001);

    const wrongScope = await send({
      method: 'POST',
      path: '/',
      headers: { Authorization: `Bearer ${AGENT_TOKEN}`, 'Content-Type': 'application/json' },
      body: rpcCall(3, 'execute_action', { mandate_id: 'mandate_x', action_id: 'action_001', execution_key: 'k2' }),
    });
    assert.equal(wrongScope.status, 200);
    const wrongScopePayload = JSON.parse(wrongScope.body);
    assert.equal(wrongScopePayload.error.code, -32003);

    const afterState = await readStore();
    assert.equal(afterState.plans, beforeState.plans);
    assert.equal(afterState.executions, beforeState.executions, 'executor must not run');
    assert.equal(afterState.mandates, beforeState.mandates);
    // An audit entry for the rejected call is intended behaviour (PRD TC-010).
    assert.notEqual(afterState.audit, beforeState.audit);
    assert.match(afterState.audit, /action_blocked/);
  });

  test('U01: a legit non-browser caller without Origin can still read rules', async () => {
    const res = await send({
      method: 'POST',
      path: '/',
      headers: { Authorization: `Bearer ${AGENT_TOKEN}`, 'Content-Type': 'application/json' },
      body: rpcCall(4, 'get_org_rules', { org_id: 'org_kenari' }),
    });
    assert.equal(res.status, 200);
    const payload = JSON.parse(res.body);
    assert.equal(payload.result.isError, false);
    const data = JSON.parse(payload.result.content[0].text);
    assert.equal(data.ok, true);
    assert.equal(data.data.org_id, 'org_kenari');
  });

  // ---------------------------------------------------------------------- U05
  test('U05: initialize works without an Origin header', async () => {
    const res = await send({
      method: 'POST',
      path: '/',
      headers: { 'Content-Type': 'application/json' },
      body: rpcMethod(5, 'initialize'),
    });
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).result.serverInfo.name, 'dextra-mcp');
  });

  test('U05: tools/list works from the dashboard origin with an agent token', async () => {
    const res = await send({
      method: 'POST',
      path: '/',
      headers: {
        Origin: DASHBOARD_ORIGIN,
        Authorization: `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: rpcMethod(6, 'tools/list'),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], DASHBOARD_ORIGIN);
    const payload = JSON.parse(res.body);
    // Derived, not a magic number: a hardcoded count silently rots every time
    // the agent scope gains a tool.
    assert.deepEqual(
      payload.result.tools.map((t: { name: string }) => t.name).sort(),
      [...toolsForScope('agent')].sort(),
    );
  });

  test('U05: tools/call from the dashboard origin performs the allowed read path', async () => {
    const res = await send({
      method: 'POST',
      path: '/',
      headers: {
        Origin: DASHBOARD_ORIGIN,
        Authorization: `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: rpcCall(7, 'get_org_rules', { org_id: 'org_kenari' }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], DASHBOARD_ORIGIN);
    const data = JSON.parse(JSON.parse(res.body).result.content[0].text);
    assert.equal(data.ok, true);
  });

  test('U05: a mutating tools/call from the dashboard origin is actually executed', async () => {
    const beforeState = await readStore();
    const res = await send({
      method: 'POST',
      path: '/',
      headers: {
        Origin: DASHBOARD_ORIGIN,
        Authorization: `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: rpcCall(8, 'create_plan', CREATE_PLAN_ARGS),
    });
    assert.equal(res.status, 200);
    const payload = JSON.parse(res.body);
    const data = JSON.parse(payload.result.content[0].text);
    assert.equal(data.ok, true, JSON.stringify(data));
    const afterState = await readStore();
    assert.notEqual(afterState.plans, beforeState.plans, 'the plan is persisted');
    assert.match(afterState.plans, /plan_review01/);
  });

  test('U05: a file:// style opaque origin is refused, so the dashboard must be served over http', async () => {
    const res = await send({
      method: 'POST',
      path: '/',
      headers: { Origin: 'null', Authorization: `Bearer ${OPS_TOKEN}`, 'Content-Type': 'application/json' },
      body: rpcMethod(9, 'initialize'),
    });
    assert.equal(res.status, 403);
    assert.match(res.body, /FORBIDDEN_ORIGIN/);
    expectNoCors(res);
  });
});