// Telegram adapter skeleton — DEXTRA (post-MVP / optional integration)
// Requires: npm install telegraf (or node-telegram-bot-api)
// Env: TELEGRAM_BOT_TOKEN, DEXTRA_MCP_URL, DEXTRA_OPS_TOKEN

const MCP_URL = process.env.DEXTRA_MCP_URL || "http://127.0.0.1:8765";
const OPS_TOKEN = process.env.DEXTRA_OPS_TOKEN || "ops-dev-token";

/** Call an MCP tool via JSON-RPC. */
async function callMcp(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(MCP_URL + "/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPS_TOKEN}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "MCP error");
  return json.result;
}

// TODO: wire telegraf bot
// import { Telegraf } from "telegraf";
// const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
// bot.command("status", async (ctx) => {
//   const r = await callMcp("get_status", { org_id: "org_kenari" });
//   await ctx.reply(JSON.stringify(r, null, 2));
// });
// bot.launch();

console.log("Telegram adapter skeleton. Implement commands per README.md.");
console.log("MCP target:", MCP_URL);

export { callMcp };
