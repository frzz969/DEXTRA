import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolveScope, isAllowed, toolsForScope } from './auth.ts';
import { handleTool } from './handlers.ts';
import { ensureStoreFiles } from '../../../packages/store/src/json-file.ts';
import { appendAudit } from '../../../packages/store/src/repository.ts';
import { evaluateRequest, parseAllowedOrigins, type OriginPolicy } from './origin-policy.ts';

const PORT = Number(process.env.DEXTRA_MCP_PORT ?? 8765);

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function logUnauthorized(tool: string, scope: string | null, tokenHint: string) {
  try {
    await ensureStoreFiles();
    await appendAudit({
      event_id: `evt_${Date.now()}`,
      at: new Date().toISOString(),
      type: 'action_blocked',
      actor: 'agent',
      reason_code: 'ACTION_NOT_ALLOWED',
      detail: { tool, scope: scope ?? 'none', token_hint: '[redacted]' },
    } as any);
  } catch {
    // audit failure must not crash the server
  }
}

async function handleRpc(req: IncomingMessage, res: ServerResponse, body: any) {
  const id = body?.id ?? null;
  const method = body?.method;
  const params = body?.params ?? {};

  const reply = (result: unknown) => sendJson(res, 200, { jsonrpc: '2.0', id, result });
  const replyError = (code: number, message: string) => sendJson(res, 200, { jsonrpc: '2.0', id, error: { code, message } });

  if (method === 'initialize') {
    return reply({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'dextra-mcp', version: '1.0.0' },
    });
  }

  if (method === 'tools/list') {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const scope = resolveScope(token);
    if (!scope) return replyError(-32001, 'Unauthorized: invalid or missing token');
    const allowed = toolsForScope(scope);
    const tools = allowed.map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name] ?? name,
      inputSchema: TOOL_SCHEMAS[name] ?? { type: 'object', properties: {} },
      annotations: TOOL_ANNOTATIONS[name] ?? {},
    }));
    return reply({ tools });
  }

  if (method === 'tools/call') {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const scope = resolveScope(token);
    const toolName = params?.name;
    if (!scope) {
      await logUnauthorized(toolName ?? 'unknown', null, token);
      return replyError(-32001, 'Unauthorized: invalid or missing token');
    }
    if (!isAllowed(scope, toolName)) {
      await logUnauthorized(toolName, scope, token);
      return replyError(-32003, `Forbidden: ${toolName} is not available to this caller`);
    }
    try {
      const result = await handleTool(toolName, params?.arguments ?? {}, scope);
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
    } catch (err: any) {
      return reply({ content: [{ type: 'text', text: JSON.stringify({ ok: false, error: { code: 'EXECUTOR_FAILURE', message: err?.message ?? 'unknown' } }) }], isError: true });
    }
  }

  return replyError(-32601, `Method not found: ${method}`);
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_caller_context: 'Report the scope this token authenticated as and the capabilities it holds.',
  get_org_rules: 'Read organization rules (timezones, office hours, Friday prayer, holidays).',
  find_precedent: 'Find candidate recipients by subject and context.',
  create_plan: 'Create a work plan from an instruction.',
  validate_plan: 'Validate a plan against org rules and policies.',
  get_plan: 'Read a plan by id.',
  list_plans: 'List plans, newest first. Optional status filter and limit.',
  submit_approval: 'Submit a human approval decision for a plan.',
  get_mandate: 'Read a mandate by id.',
  list_mandates: 'List mandates, newest first. Optional status filter and limit.',
  issue_mandate: 'Issue a mandate from an existing granted approval. Available to the ops scope; audited as mandate_issued.',
  execute_action: 'Execute one action under a valid mandate (executor only).',
  revoke_mandate: 'Revoke an active mandate.',
  list_executions: 'List execution results, newest first. Optional mandate filter and limit.',
  get_status: 'Read execution status for a mandate+action.',
  get_audit_log: 'Read the audit log (dashboard only).',
  list_specialists: 'Read the specialist roster from workbuddy/agents/*.md: name, role, limits, tools.',
};

const TOOL_SCHEMAS: Record<string, any> = {
  get_caller_context: { type: 'object', properties: {} },
  get_org_rules: { type: 'object', properties: { org_id: { type: 'string' } }, required: ['org_id'] },
  find_precedent: { type: 'object', properties: { subject: { type: 'string' }, context: { type: 'string' }, org_id: { type: 'string' } }, required: ['subject', 'org_id'] },
  create_plan: { type: 'object', properties: { org_id: { type: 'string' }, request_id: { type: 'string' }, intent: { type: 'string' }, actions: { type: 'array' }, assignee_id: { type: 'string' } }, required: ['org_id', 'request_id', 'intent', 'actions'] },
  validate_plan: { type: 'object', properties: { plan: { type: 'object' }, org_id: { type: 'string' } }, required: ['plan'] },
  get_plan: { type: 'object', properties: { plan_id: { type: 'string' } }, required: ['plan_id'] },
  list_plans: { type: 'object', properties: { status: { type: 'string', enum: ['DRAFT', 'READY', 'NEEDS_REVIEW', 'BLOCKED'] }, limit: { type: 'number' }, requester_id: { type: 'string' }, assignee_id: { type: 'string' } } },
  submit_approval: { type: 'object', properties: { plan_id: { type: 'string' }, plan_hash: { type: 'string' }, decision: { type: 'string', enum: ['approve', 'reject', 'revise'] }, approver_id: { type: 'string' }, approval_token: { type: 'string' } }, required: ['plan_id', 'plan_hash', 'decision', 'approver_id', 'approval_token'] },
  get_mandate: { type: 'object', properties: { mandate_id: { type: 'string' } }, required: ['mandate_id'] },
  list_mandates: { type: 'object', properties: { status: { type: 'string', enum: ['active', 'expired', 'revoked', 'consumed'] }, limit: { type: 'number' } } },
  issue_mandate: { type: 'object', properties: { plan_id: { type: 'string' }, approval_id: { type: 'string' } }, required: ['plan_id', 'approval_id'] },
  execute_action: { type: 'object', properties: { mandate_id: { type: 'string' }, action_id: { type: 'string' }, execution_key: { type: 'string' } }, required: ['mandate_id', 'action_id', 'execution_key'] },
  revoke_mandate: { type: 'object', properties: { mandate_id: { type: 'string' } }, required: ['mandate_id'] },
  list_executions: { type: 'object', properties: { mandate_id: { type: 'string' }, limit: { type: 'number' } } },
  get_status: { type: 'object', properties: { mandate_id: { type: 'string' }, action_id: { type: 'string' } }, required: ['mandate_id', 'action_id'] },
  get_audit_log: { type: 'object', properties: { limit: { type: 'number' } } },
  list_specialists: { type: 'object', properties: {} },
};

const TOOL_ANNOTATIONS: Record<string, any> = {
  get_caller_context: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  get_org_rules: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  find_precedent: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  create_plan: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  validate_plan: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  get_plan: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  list_plans: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  submit_approval: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  get_mandate: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  list_mandates: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  issue_mandate: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  execute_action: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  revoke_mandate: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  list_executions: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  get_status: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  get_audit_log: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  list_specialists: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};

export interface ServerOptions {
  port?: number;
  allowedOrigins?: Iterable<string>;
}

export function startServer(options: ServerOptions = {}) {
  ensureStoreFiles().catch(() => {});
  const policy: OriginPolicy = {
    port: options.port ?? PORT,
    allowedOrigins: new Set(
      options.allowedOrigins ?? parseAllowedOrigins(process.env.DEXTRA_ALLOWED_ORIGINS, options.port ?? PORT),
    ),
  };
  const server = createServer(async (req, res) => {
    // D-01: no wildcard CORS. Host and Origin are checked before any routing,
    // so a hostile page or a DNS-rebinding hostname never reaches a tool.
    res.setHeader('Vary', 'Origin');
    const decision = evaluateRequest(
      { method: req.method ?? 'GET', origin: req.headers.origin, host: req.headers.host },
      policy,
    );
    if (decision.action === 'reject') {
      return sendJson(res, decision.status, { error: decision.code });
    }
    if (decision.cors && decision.origin !== null) {
      res.setHeader('Access-Control-Allow-Origin', decision.origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    if (req.url === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, service: 'dextra-mcp', port: PORT });
    }
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'method not allowed' });
    }
    const raw = await readBody(req);
    let body: any;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
    }
    await handleRpc(req, res, body);
  });
  server.listen(policy.port, '127.0.0.1', () => {
    const address = server.address();
    if (address !== null && typeof address === 'object') {
      // An ephemeral port (0) is resolved here; the host check must compare
      // against the port that was actually bound.
      policy.port = address.port;
    }
    console.log(`DEXTRA MCP server listening on 127.0.0.1:${policy.port}`);
    // D-02: never log tokens/secrets, even in dev.
  });
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
