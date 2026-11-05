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

import { randomUUID } from 'node:crypto';

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

export interface CommandContext { chatId: number; text: string; reply: (msg: string) => Promise<void> }

export async function handleCommand(ctx: CommandContext): Promise<void> {
  const [cmd, ...rest] = ctx.text.trim().split(/\s+/);
  const arg = rest.join(' ').trim();
  switch (cmd.toLowerCase()) {
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
            await handleCommand({ chatId, text, reply });
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
