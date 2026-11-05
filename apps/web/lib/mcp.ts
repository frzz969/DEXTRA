/**
 * Klien MCP JSON-RPC DEXTRA — server-side only.
 *
 * Menghubungi gateway MCP lokal (default 127.0.0.1:8765) dengan token ops.
 * Kegagalan apa pun dialirkan sebagai `{ ok: false }` — bukan data contoh,
 * bukan hasil tebakan. Halaman yang memakainya harus menampilkan keadaan
 * apa adanya.
 */
const MCP_URL = process.env.DEXTRA_MCP_URL ?? "http://127.0.0.1:8765/";
const MCP_TOKEN = process.env.DEXTRA_OPS_TOKEN ?? "";

export type McpFailure =
  | "not-configured" // token tidak diisi
  | "unreachable" // MCP tidak jalan / network error
  | "http-error" // respons HTTP bukan 200
  | "rpc-error" // JSON-RPC error object
  | "tool-failed"; // tool mengembalikan ok:false

export type McpResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; failure: McpFailure };

export async function mcpCall<T>(tool: string, args: Record<string, unknown> = {}): Promise<McpResult<T>> {
  if (!MCP_TOKEN) {
    return {
      ok: false,
      failure: "not-configured",
      error: "DEXTRA_OPS_TOKEN belum diisi; Explorer tidak bisa berjalan tanpa token."
    };
  }
  try {
    const response = await fetch(MCP_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${MCP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "tools/call", params: { name: tool, arguments: args } }),
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, failure: "http-error", error: `MCP menolak permintaan (HTTP ${response.status}).` };
    }
    const body = (await response.json().catch(() => null)) as {
      jsonrpc?: string;
      id?: number | string | null;
      result?: { content?: { type: string; text?: string }[] };
      error?: { code?: number; message?: string };
    } | null;
    if (body?.error) {
      return { ok: false, failure: "rpc-error", error: body.error.message ?? "panggilan MCP ditolak." };
    }
    const text = body?.result?.content?.[0]?.text;
    if (typeof text !== "string") {
      return { ok: false, failure: "rpc-error", error: "Respons MCP tidak memuat konten tool." };
    }
    const parsed = JSON.parse(text) as { ok?: boolean; data?: T; error?: { code?: string; message?: string } };
    if (!parsed?.ok) {
      return {
        ok: false,
        failure: "tool-failed",
        error: parsed?.error?.message ?? "tool MCP gagal."
      };
    }
    return { ok: true, data: parsed.data as T };
  } catch {
    return {
      ok: false,
      failure: "unreachable",
      error: "MCP gateway tidak berjalan (127.0.0.1:8765). Jalankan `npm run dev:mcp` lalu muat ulang halaman."
    };
  }
}

/** Cek kesehatan gateway MCP tanpa auth: GET /health. */
export async function mcpHealth(): Promise<boolean> {
  try {
    const response = await fetch(MCP_URL.replace(/\/$/, "") + "/health", { cache: "no-store" });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; service?: string } | null;
    return response.ok && body?.service === "dextra-mcp";
  } catch {
    return false;
  }
}
