// Telegram adapter — DEXTRA (post-MVP channel adapter).
//
// Implementasi nyata: polling long-poll ke Telegram Bot API, lalu meneruskan
// perintah ke MCP server DEXTRA. Tidak ada telegraf dependency — pakai fetch
// bawaan Node >= 20. Semua aksi tulis tetap lewat mandat (lihat README.md).
//
// Env:
//   TELEGRAM_BOT_TOKEN  — dari @BotFather (wajib, kalau kosong adapter idle)
//   DEXTRA_MCP_URL     — default http://127.0.0.1:8765
//   DEXTRA_OPS_TOKEN   — default ops-dev-token
//   DEXTRA_AGENT_TOKEN  — default agent-dev-token
//   DEXTRA_DASHBOARD_URL — default http://127.0.0.1:8899 (untuk link approval)

import { parseIntent } from '../../packages/office-agent/src/intent.ts';

const MCP_URL = (process.env.DEXTRA_MCP_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const OPS_TOKEN = process.env.DEXTRA_OPS_TOKEN || 'ops-dev-token';
const AGENT_TOKEN = process.env.DEXTRA_AGENT_TOKEN || 'agent-dev-token';
const DASHBOARD_URL = (process.env.DEXTRA_DASHBOARD_URL || 'http://127.0.0.1:8899').replace(/\/$/, '');
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

/** Tool yang tidak boleh dipanggil adapter ini, apa pun alasannya. */
const FORBIDDEN_TOOLS = new Set(['execute_action', 'submit_approval', 'issue_mandate', 'revoke_mandate']);

export interface McpResult { ok: boolean; data?: unknown; error?: { code: string; message: string } }

/** Call an MCP tool via JSON-RPC. Throws on HTTP/JSON-RPC error. */
export async function callMcp(tool: string, args: Record<string, unknown> = {}, token = OPS_TOKEN): Promise<McpResult> {
  if (FORBIDDEN_TOOLS.has(tool)) {
    throw new Error(`Adapter tidak boleh memanggil tool mutasi: ${tool}`);
  }
  const res = await fetch(MCP_URL + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: tool, arguments: args } }),
  });
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
  const json = (await res.json()) as { result?: { content?: Array<{ text?: string }>; isError?: boolean }; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message || 'MCP error');
  const text = json.result?.content?.[0]?.text;
  let parsed: unknown = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = text; } }
  const envelope = (parsed && typeof parsed === 'object') ? (parsed as { ok?: boolean; data?: unknown; error?: { code: string; message: string } }) : null;
  if (envelope && typeof envelope.ok === 'boolean') {
    return { ok: envelope.ok, data: envelope.data, error: envelope.error };
  }
  return { ok: !json.result?.isError, data: parsed };
}

// ---------- command handlers (pure-ish, testable) ----------

export interface CommandContext {
  chatId: number;
  text: string;
  reply: (msg: string) => Promise<void>;
  /** update_id Telegram; dipakai untuk id request pesan pertama. */
  updateId?: number;
  /** Injection untuk tes; default callMcp (jaringan sungguhan). */
  callTool?: typeof callMcp;
}

/**
 * Id request untuk satu pesan. Pesan pertama dari sebuah chat memakai id ini;
 * server menyimpannya sebagai id kanonik chat, sehingga pesan berikutnya
 * (dengan update_id berbeda) tetap melanjutkan request yang sama.
 */
export function requestIdForChat(chatId: number, updateId: number): string {
  const sign = chatId < 0 ? 'n' : 'p';
  const chat = Math.abs(chatId).toString(36);
  const update = Math.max(0, Math.floor(updateId)).toString(36);
  return `req_tg_${sign}${chat}_${update}`;
}

function dashboardLink(planId: string | null): string {
  return planId === null
    ? `${DASHBOARD_URL}/#/office-agent`
    : `${DASHBOARD_URL}/#/work-packages/${encodeURIComponent(planId)}`;
}

/** Balasan manusiawi untuk hasil office_agent_run; tidak pernah melempar. */
export function formatOfficeAgentReply(result: McpResult): string {
  if (!result.ok) {
    return `Maaf, permintaan belum bisa diproses.\n${result.error?.code ?? 'ERROR'}: ${result.error?.message ?? 'unknown'}`;
  }
  const data = (result.data ?? {}) as {
    status?: string;
    plan?: { plan_id?: string; plan_hash?: string } | null;
    session?: { questions?: Array<{ prompt?: string }> } | null;
  };
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

  lines.push(`Dashboard: ${dashboardLink(planId)}`);
  const message = lines.join('\n');
  return message.length > 4000 ? `${message.slice(0, 3997)}...` : message;
}

async function handleFreeText(ctx: CommandContext): Promise<void> {
  const call = ctx.callTool ?? callMcp;
  const parsed = parseIntent(ctx.text);
  const requestId = requestIdForChat(ctx.chatId, ctx.updateId ?? Date.now());

  let result: McpResult;
  try {
    result = await call(
      'office_agent_run',
      {
        request_id: requestId,
        chat_id: String(ctx.chatId),
        instruction: parsed.instruction,
        assumptions: parsed.assumptions,
      },
      AGENT_TOKEN,
    );
  } catch (error) {
    await ctx.reply(`Maaf, layanan DEXTRA tidak dapat dihubungi: ${(error as Error).message}`);
    return;
  }
  await ctx.reply(formatOfficeAgentReply(result));
}

export async function handleCommand(ctx: CommandContext): Promise<void> {
  const trimmed = ctx.text.trim();
  if (trimmed === '') {
    await ctx.reply('Pesan kosong. Tulis permintaan atau ketik /help.');
    return;
  }
  if (!trimmed.startsWith('/')) {
    await handleFreeText({ ...ctx, text: trimmed });
    return;
  }

  const [cmd, ...rest] = trimmed.split(/\s+/);
  const arg = rest.join(' ').trim();
  switch ((cmd ?? '').toLowerCase()) {
    case '/start':
      await ctx.reply(
        'DEXTRA — Governed AI Workforce.\n' +
        'Perintah: /status, /plans, /approve <plan_id>, /help.\n' +
        'Aksi tulis (kirim email, jadwal, dll.) tetap memerlukan approval manusia lewat dashboard.',
      );
      return;
    case '/help':
      await ctx.reply('/status — ringkasan Work Package.\n/plans — daftar rencana terbaru.\n/approve <plan_id> — buka dashboard untuk approval (mandat tetap di backend).\n/help — daftar ini.');
      return;
    case '/status': {
      const r = await callMcp('get_status', {});
      if (!r.ok) { await ctx.reply(`Gagal: ${r.error?.message ?? 'unknown'}`); return; }
      const d = (r.data ?? {}) as { execution?: unknown };
      await ctx.reply(`Status: ${JSON.stringify(d).slice(0, 500)}`);
      return;
    }
    case '/plans': {
      const r = await callMcp('list_plans', { limit: 10 });
      if (!r.ok) { await ctx.reply(`Gagal: ${r.error?.message ?? 'unknown'}`); return; }
      const plans = ((r.data as { plans?: Array<{ plan_id: string; status: string; intent: string }> })?.plans) ?? [];
      if (plans.length === 0) { await ctx.reply('Belum ada rencana.'); return; }
      const lines = plans.map((p) => `${p.plan_id} [${p.status}] ${p.intent}`).join('\n');
      await ctx.reply(lines.slice(0, 3900));
      return;
    }
    case '/approve': {
      if (!arg) { await ctx.reply('Pakai: /approve <plan_id>'); return; }
      await ctx.reply(`Buka dashboard untuk menyetujui ${arg}:\n${DASHBOARD_URL}/#/governance\n\nMandat tetap diterbitkan backend setelah approval.`);
      return;
    }
    default:
      await ctx.reply('Perintah tidak dikenal. Ketik /help.');
  }
}

// ---------- Telegram polling (production entry) ----------

async function telegramApi(method: string, body: Record<string, unknown> = {}): Promise<unknown> {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN tidak di-set');
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  if (!json.ok) throw new Error(json.description || `telegram ${method} failed`);
  return json.result;
}

interface TgUpdate { update_id: number; message?: { chat: { id: number }; text?: string } }

export async function runBot(): Promise<void> {
  if (!BOT_TOKEN) {
    console.log('Telegram adapter idle: TELEGRAM_BOT_TOKEN tidak di-set. MCP target:', MCP_URL);
    return;
  }
  console.log('Telegram adapter starting. MCP target:', MCP_URL);
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const updates = (await telegramApi('getUpdates', { offset, timeout: 25 })) as TgUpdate[];
      for (const u of updates) {
        offset = u.update_id + 1;
        const chatId = u.message?.chat?.id;
        const text = u.message?.text;
        if (chatId !== undefined && text) {
          const reply = async (msg: string) => { await telegramApi('sendMessage', { chat_id: chatId, text: msg }); };
          try {
            await handleCommand({ chatId, text, reply, updateId: u.update_id });
          } catch (err) {
            await reply(`Error: ${(err as Error).message}`);
          }
        }
      }
    } catch (err) {
      console.error('poll error:', (err as Error).message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// Auto-start only when run as entrypoint (not imported by tests).
const isMain = process.argv[1] && process.argv[1].endsWith('index.ts');
if (isMain && BOT_TOKEN) {
  runBot().catch((e) => { console.error(e); process.exit(1); });
} else if (isMain) {
  console.log('Telegram adapter idle: TELEGRAM_BOT_TOKEN tidak di-set. MCP target:', MCP_URL);
}

export { FORBIDDEN_TOOLS };
