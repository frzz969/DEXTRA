import { parseIntent } from '../../packages/office-agent/src/intent.ts';

const MCP_URL = (process.env.DEXTRA_MCP_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const OPS_TOKEN = process.env.DEXTRA_OPS_TOKEN || 'ops-dev-token';
const AGENT_TOKEN = process.env.DEXTRA_AGENT_TOKEN || 'agent-dev-token';
const WA_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const PORT = Number(process.env.DEXTRA_WHATSAPP_PORT || process.env.PORT || 8788);

const FORBIDDEN_TOOLS = new Set(['execute_action', 'submit_approval', 'issue_mandate', 'revoke_mandate']);

export interface McpResult { ok: boolean; data?: unknown; error?: { code: string; message: string } }

export async function callMcp(tool: string, args: Record<string, unknown> = {}, token = OPS_TOKEN): Promise<McpResult> {
  if (FORBIDDEN_TOOLS.has(tool)) throw new Error(`Adapter tidak boleh memanggil tool mutasi: ${tool}`);
  const res = await fetch(MCP_URL + '/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: tool, arguments: args } }) });
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean }; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || 'MCP error');
  const text = json.result?.content?.[0]?.text;
  let parsed: unknown = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
  const envelope = (parsed && typeof parsed === 'object') ? (parsed as { ok?: boolean; data?: unknown; error?: { code: string; message: string } }) : null;
  if (envelope && typeof envelope.ok === 'boolean') return { ok: envelope.ok, data: envelope.data, error: envelope.error };
  return { ok: !json.result?.isError, data: parsed };
}

export interface CommandContext { chatId: string | number; text: string; reply: (msg: string) => Promise<void>; updateId?: number; callTool?: typeof callMcp; }

export function requestIdForChat(chatId: number | string, updateId: number): string {
  const sign = String(chatId).startsWith('-') ? 'n' : 'p';
  const chat = Math.abs(Number(chatId)).toString(36);
  const update = Math.max(0, Math.floor(updateId)).toString(36);
  return `req_wa_${sign}${chat}_${update}`;
}

export function formatOfficeAgentReply(result: McpResult): string {
  if (!result.ok) return `Maaf, permintaan belum bisa diproses.\n${result.error?.code ?? 'ERROR'}: ${result.error?.message ?? 'unknown'}`;
  const data = (result.data ?? {}) as { status?: string; plan?: { plan_id?: string; plan_hash?: string } | null; session?: { questions?: Array<{ prompt?: string }> } | null };
  const status = data.status ?? 'unknown';
  const planId = typeof data.plan?.plan_id === 'string' ? data.plan.plan_id : null;
  const lines: string[] = [`Status: ${status}`];
  if (status === 'needs_clarification') {
    const questions = data.session?.questions ?? [];
    lines.push('Saya perlu klarifikasi:');
    if (questions.length === 0) lines.push('- Pertanyaan klarifikasi belum tersedia.');
    else for (const question of questions) lines.push(`- ${question.prompt ?? 'Pertanyaan tanpa teks.'}`);
  } else if (status === 'plan_ready' && data.plan !== null && data.plan !== undefined) {
    lines.push(`Plan: ${planId ?? '-'}`);
    if (typeof data.plan.plan_hash === 'string') lines.push(`Hash: ${data.plan.plan_hash}`);
    lines.push('Plan belum dieksekusi; persetujuan manusia tetap diperlukan.');
  } else if (status === 'blocked') {
    lines.push('Plan belum dapat dibentuk; periksa detail di dashboard.');
  }
  const message = lines.join('\n');
  return message.length > 4000 ? `${message.slice(0, 3997)}...` : message;
}

async function handleFreeText(ctx: CommandContext): Promise<void> {
  const call = ctx.callTool ?? callMcp;
  const parsed = parseIntent(ctx.text);
  const requestId = requestIdForChat(ctx.chatId, ctx.updateId ?? Date.now());
  let result: McpResult;
  try {
    result = await call('office_agent_run', { request_id: requestId, chat_id: String(ctx.chatId), instruction: parsed.instruction, assumptions: parsed.assumptions }, AGENT_TOKEN);
  } catch (error) {
    await ctx.reply(`Maaf, layanan DEXTRA tidak dapat dihubungi: ${(error as Error).message}`);
    return;
  }
  await ctx.reply(formatOfficeAgentReply(result));
}

export async function handleCommand(ctx: CommandContext): Promise<void> {
  const trimmed = ctx.text.trim();
  if (trimmed === '') { await ctx.reply('Pesan kosong. Tulis permintaan atau ketik /help.'); return; }
  if (!trimmed.startsWith('/')) { await handleFreeText({ ...ctx, text: trimmed }); return; }
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(' ').trim();
  switch ((cmd ?? '').toLowerCase()) {
    case '/start':
      await ctx.reply('DEXTRA — Governed AI Workforce.\nPerintah: /status, /plans, /help.'); return;
    case '/help':
      await ctx.reply('/status — ringkasan.\n/plans — daftar rencana.\n/help — daftar ini.'); return;
    case '/status': {
      const r = await callMcp('get_status', {});
      if (!r.ok) { await ctx.reply(`Gagal: ${r.error?.message ?? 'unknown'}`); return; }
      const d = (r.data ?? {}) as { execution?: unknown };
      await ctx.reply(`Status: ${JSON.stringify(d).slice(0, 500)}`); return;
    }
    case '/plans': {
      const r = await callMcp('list_plans', { limit: 10 });
      if (!r.ok) { await ctx.reply(`Gagal: ${r.error?.message ?? 'unknown'}`); return; }
      const plans = ((r.data as { plans?: Array<{ plan_id: string; status: string; intent: string }> })?.plans) ?? [];
      if (plans.length === 0) { await ctx.reply('Belum ada rencana.'); return; }
      const lines = plans.map((p) => `${p.plan_id} [${p.status}] ${p.intent}`).join('\n');
      await ctx.reply(lines.slice(0, 3900)); return;
    }
    default: await ctx.reply('Perintah tidak dikenal. Ketik /help.');
  }
}

async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!WA_TOKEN || !PHONE_NUMBER_ID) return;
  await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${WA_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
  });
}

export async function startServer(): Promise<void> {
  if (!WA_TOKEN) { console.log('WhatsApp adapter idle: WHATSAPP_TOKEN tidak di-set. MCP target:', MCP_URL); return; }
  const { createServer } = await import('node:http');
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`);
    if (req.method === 'GET' && url.pathname === '/webhook') {
      if (url.searchParams.get('hub.verify_token') === VERIFY_TOKEN) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(url.searchParams.get('hub.challenge') || '');
      } else {
        res.writeHead(403); res.end('forbidden');
      }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/webhook') {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        try {
          const json = JSON.parse(body) as { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from: string; text?: { body?: string } }> } }> }> };
          for (const entry of json.entry ?? []) {
            for (const change of entry.changes ?? []) {
              for (const msg of change.value?.messages ?? []) {
                if (msg.text?.body) {
                  const reply = async (m: string) => { await sendWhatsApp(msg.from, m); };
                  await handleCommand({ chatId: msg.from, text: msg.text.body, reply });
                }
              }
            }
          }
        } catch (e) { console.error(e); }
        res.writeHead(200); res.end('OK');
      });
      return;
    }
    res.writeHead(404); res.end('not found');
  });
  server.listen(PORT, () => console.log('WhatsApp adapter listening on', PORT));
}

const isMain = process.argv[1] && process.argv[1].endsWith('index.ts');
if (isMain) {
  if (WA_TOKEN) startServer().catch((e) => { console.error(e); process.exit(1); });
  else console.log('WhatsApp adapter idle: WHATSAPP_TOKEN tidak di-set. MCP target:', MCP_URL);
}

export { FORBIDDEN_TOOLS };