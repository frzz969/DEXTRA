import { authHeaders } from "@/lib/api";

/**
 * Unduhan ekspor tenant.
 *
 * Meneruskan wewenang pemanggil apa adanya (cookie sesi + CSRF, atau token
 * server) ke `GET /api/v1/data/export` — endpoint itu yang menentukan boleh
 * atau tidak, dan ia yang menulis event audit `data_exported`. Route ini tidak
 * menambah wewenang dan tidak menyimpan berkas di disk.
 *
 * Bentuk respons gagal sengaja JSON kecil, bukan halaman HTML: berkas ini
 * dibuka sebagai unduhan, jadi pengguna harus melihat alasan penolakan dari
 * server (mis. 403 karena scope tidak punya `view_audit`).
 */

export const dynamic = "force-dynamic";

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";

function jsonError(status: number, detail: string): Response {
  return new Response(JSON.stringify({ detail }, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
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
    upstream = await fetch(`${BASE_URL}/api/v1/data/export`, { headers, cache: "no-store" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return jsonError(502, `API tidak dapat dihubungi: ${message}`);
  }

  if (!upstream.ok) {
    return jsonError(upstream.status, `API menolak ekspor (HTTP ${upstream.status}).`);
  }

  const body = await upstream.text();
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="dextra-export-${stamp}.json"`,
      "Cache-Control": "no-store"
    }
  });
}
