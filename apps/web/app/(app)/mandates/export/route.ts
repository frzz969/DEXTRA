import { authHeaders } from "@/lib/api";

/**
 * Ekspor mandate sebagai CSV.
 *
 * Meneruskan wewenang pemanggil apa adanya ke `GET /api/v1/mandates`.
 * Tidak ada penyaringan wewenang tambahan di sini — penolakan server dipakai
 * apa adanya, dan tidak ada baris yang dikarang bila API tidak menjawab.
 *
 * Halaman /mandates tidak punya filter `searchParams`, jadi berkas ini memuat
 * daftar yang sama dengan layar tanpa penyaringan tambahan.
 *
 * Semua nilai dikutip dan tanda kutip di dalamnya digandakan sesuai RFC 4180.
 *
 * Catatan cakupan: `GET /mandates` memangkas hasilnya sendiri (`.limit(200)` di
 * router, tanpa parameter `limit`/`offset`), jadi berkas ini memuat paling
 * banyak 200 mandate terbaru — bukan seluruh riwayat.
 */

export const dynamic = "force-dynamic";

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";

/** Bentuk baris dari `_serialize` di `modules/mandates/router.py`. */
type Mandate = {
  id: string;
  plan_id: string;
  approval_id: string | null;
  action_id: string;
  action_type: string;
  resource_scope: string | null;
  recipient_scope: string | null;
  params_hash: string | null;
  approver_id: string | null;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  usable: boolean;
};

const COLUMNS = [
  "id",
  "plan_id",
  "approval_id",
  "action_id",
  "action_type",
  "status",
  "approver_id",
  "resource_scope",
  "recipient_scope",
  "issued_at",
  "expires_at",
  "revoked_at",
  "usable",
  "params_hash"
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

export async function GET(): Promise<Response> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
    return jsonError(503, "DEXTRA_API_TOKEN belum diisi dan tidak ada sesi; ekspor tidak dapat dibuat.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BASE_URL}/api/v1/mandates`, { headers, cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return jsonError(502, `API tidak dapat dihubungi: ${message}`);
  }

  if (!upstream.ok) {
    return jsonError(upstream.status, `API menolak ekspor mandate (HTTP ${upstream.status}).`);
  }

  let payload: { items?: Mandate[] };
  try {
    payload = (await upstream.json()) as { items?: Mandate[] };
  } catch {
    return jsonError(502, "Balasan API bukan JSON yang valid.");
  }

  const rows = Array.isArray(payload.items) ? payload.items : [];

  const body = [
    COLUMNS.map((column) => cell(column)).join(","),
    ...rows.map((row) => COLUMNS.map((column) => cell(row[column as keyof Mandate])).join(","))
  ].join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(`\uFEFF${body}\r\n`, {
    status: 200,
    headers: {
      // BOM di depan supaya Excel membaca UTF-8 dengan benar.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dextra-mandat-${stamp}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
