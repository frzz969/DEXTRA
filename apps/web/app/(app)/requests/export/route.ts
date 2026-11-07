import { authHeaders } from "@/lib/api";

/**
 * Ekspor permintaan (rencana Office Agent) sebagai CSV.
 *
 * Meneruskan wewenang pemanggil apa adanya ke `GET /api/v1/office-agent/plans`.
 * Tidak ada penyaringan wewenang tambahan di sini — penolakan server dipakai
 * apa adanya, dan tidak ada baris yang dikarang bila API tidak menjawab.
 *
 * `actions`, `findings`, dan `validation` berbentuk objek/array. Nilainya
 * diserialisasi dengan `JSON.stringify` di dalam sel yang dikutip, bukan
 * dibiarkan menjadi `[object Object]` — tanpa itu kolomnya kehilangan isi.
 * Semua nilai dikutip dan tanda kutip di dalamnya digandakan sesuai RFC 4180.
 *
 * Catatan cakupan: `GET /office-agent/plans` memangkas hasilnya sendiri
 * (`.limit(100)` di router, tanpa parameter `limit`/`offset`), jadi berkas ini
 * memuat paling banyak 100 permintaan terbaru — bukan seluruh riwayat.
 */

export const dynamic = "force-dynamic";

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";

/** Bentuk baris dari `_serialize` di `modules/office_agent/router.py`. */
type OfficePlan = {
  id: string;
  request_id: string;
  plan_id: string;
  plan_hash: string;
  status: string;
  actions: unknown;
  findings: unknown;
  validation: unknown;
  created_at: string;
};

const COLUMNS = [
  "id",
  "request_id",
  "plan_id",
  "status",
  "created_at",
  "plan_hash",
  "actions",
  "findings",
  "validation"
] as const;

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
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
    upstream = await fetch(`${BASE_URL}/api/v1/office-agent/plans`, { headers, cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return jsonError(502, `API tidak dapat dihubungi: ${message}`);
  }

  if (!upstream.ok) {
    return jsonError(upstream.status, `API menolak ekspor permintaan (HTTP ${upstream.status}).`);
  }

  let payload: { items?: OfficePlan[] };
  try {
    payload = (await upstream.json()) as { items?: OfficePlan[] };
  } catch {
    return jsonError(502, "Balasan API bukan JSON yang valid.");
  }

  const items = Array.isArray(payload.items) ? payload.items : [];

  // Filter yang sama dengan halaman /requests, supaya berkas tidak berbeda
  // dari layar: `q` mencocokkan plan_id atau id, `status` cocok persis.
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const status = url.searchParams.get("status") ?? "";

  const rows = items.filter((item) => {
    if (status && item.status !== status) return false;
    if (!q) return true;
    return item.plan_id.toLowerCase().includes(q) || (item.id ?? "").toLowerCase().includes(q);
  });

  const body = [
    COLUMNS.map((column) => cell(column)).join(","),
    ...rows.map((row) => COLUMNS.map((column) => cell(row[column as keyof OfficePlan])).join(","))
  ].join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${body}\r\n`, {
    status: 200,
    headers: {
      // BOM di depan supaya Excel membaca UTF-8 dengan benar.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dextra-permintaan-${stamp}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
