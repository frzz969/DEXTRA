import { authHeaders } from "@/lib/api";

/**
 * Ekspor eksekusi sebagai CSV.
 *
 * Meneruskan wewenang pemanggil apa adanya ke `GET /api/v1/executions`.
 * Tidak ada penyaringan wewenang tambahan di sini — penolakan server dipakai
 * apa adanya, dan tidak ada baris yang dikarang bila API tidak menjawab.
 *
 * `result` adalah teks bebas (kadang JSON) sehingga bisa memuat koma, kutip,
 * dan baris baru. Semua nilai dikutip dan tanda kutip di dalamnya digandakan
 * sesuai RFC 4180; tanpa itu berkas akan rusak saat dibuka di Excel.
 */

export const dynamic = "force-dynamic";

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";

type Execution = {
  id: string;
  status: string;
  adapter: string | null;
  started_at: string;
  duration_ms: number | null;
  plan_id?: string | null;
  mandate_id?: string | null;
  action_id?: string | null;
  result?: string | null;
};

const COLUMNS = [
  "id",
  "status",
  "adapter",
  "started_at",
  "duration_ms",
  "plan_id",
  "mandate_id",
  "action_id",
  "result"
] as const;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function jsonError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
  });
}

export async function GET(request: Request): Promise<Response> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
    return jsonError(503, "DEXTRA_API_TOKEN belum diisi dan tidak ada sesi; ekspor tidak dapat dibuat.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE_URL}/api/v1/executions?limit=500`, { headers, cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return jsonError(502, `API tidak dapat dihubungi: ${message}`);
  }

  if (!upstream.ok) {
    return jsonError(upstream.status, `API menolak ekspor eksekusi (HTTP ${upstream.status}).`);
  }

  let payload: { items?: Execution[] };
  try {
    payload = (await upstream.json()) as { items?: Execution[] };
  } catch {
    return jsonError(502, "Balasan API bukan JSON yang valid.");
  }

  const items = Array.isArray(payload.items) ? payload.items : [];

  // Filter yang sama dengan halaman, supaya berkas tidak berbeda dari layar.
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const status = (url.searchParams.get("status") ?? "").trim();
  const adapter = (url.searchParams.get("adapter") ?? "").trim();

  const rows = items.filter((item) => {
    if (status && item.status !== status) return false;
    if (adapter && (item.adapter ?? "—") !== adapter) return false;
    if (!q) return true;
    return [item.id, item.status, item.adapter, item.plan_id, item.mandate_id, item.action_id, item.result]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const body = [
    COLUMNS.map((column) => cell(column)).join(","),
    ...rows.map((row) => COLUMNS.map((column) => cell(row[column as keyof Execution])).join(","))
  ].join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${body}\r\n`, {
    status: 200,
    headers: {
      // BOM di depan supaya Excel membaca UTF-8 dengan benar.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dextra-eksekusi-${stamp}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
