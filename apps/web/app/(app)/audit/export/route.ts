import { authHeaders } from "@/lib/api";

/**
 * Ekspor jejak audit sebagai JSONL.
 *
 * Meneruskan wewenang pemanggil apa adanya ke `GET /api/v1/audit-events`.
 * Tidak ada penyaringan wewenang tambahan di sini: kalau server menolak
 * (mis. token tanpa `view_audit`), penolakan itu yang dipakai. Tidak ada
 * data yang dikarang bila server tidak menjawab.
 *
 * JSONL dipilih, bukan CSV, karena kolom `detail` berbentuk objek bebas —
 * CSV akan memaksa serialisasi yang kehilangan struktur aslinya. Satu baris
 * = satu event utuh, jadi berkas ini bisa langsung dipakai sebagai bukti
 * rantai hash (`entry_hash` ikut disertakan).
 */

export const dynamic = "force-dynamic";

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";

/** Batas per permintaan di server; dipakai juga sebagai ukuran halaman. */
const PAGE = 200;
/** Batas keras supaya ekspor tidak pernah menjadi tarikan tanpa ujung. */
const MAX_EVENTS = 5000;

type AuditEvent = Record<string, unknown>;

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

  const collected: AuditEvent[] = [];
  let offset = 0;
  let complete = false;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const typeFilter = (url.searchParams.get("type") ?? "").trim();
  const decisionFilter = (url.searchParams.get("decision") ?? "").trim();

  while (collected.length < MAX_EVENTS) {
    let upstream: Response;
    try {
      upstream = await fetch(`${BASE_URL}/api/v1/audit-events?limit=${PAGE}&offset=${offset}`, {
        headers,
        cache: "no-store"
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "gagal menghubungi API";
      return jsonError(502, `API tidak dapat dihubungi: ${message}`);
    }

    if (!upstream.ok) {
      return jsonError(upstream.status, `API menolak ekspor audit (HTTP ${upstream.status}).`);
    }

    let payload: { items?: AuditEvent[] };
    try {
      payload = (await upstream.json()) as { items?: AuditEvent[] };
    } catch {
      return jsonError(502, "Balasan API bukan JSON yang valid.");
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    collected.push(...items);

    if (items.length < PAGE) {
      complete = true;
      break;
    }
    offset += PAGE;
  }

  const matches = (event: AuditEvent): boolean => {
    if (typeFilter && String(event.event_type ?? "") !== typeFilter) return false;
    if (decisionFilter && String(event.decision ?? "") !== decisionFilter) return false;
    if (!q) return true;
    const detail =
      typeof event.detail === "string" ? event.detail : JSON.stringify(event.detail ?? {});
    return [event.event_type, event.actor, event.action, event.resource, event.decision, detail]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  };

  const filtered = collected.slice(0, MAX_EVENTS).filter(matches);
  const lines = filtered.map((event) => JSON.stringify(event));
  const stamp = new Date().toISOString().slice(0, 10);
  const truncated = !complete && collected.length >= MAX_EVENTS;

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Content-Disposition": `attachment; filename="dextra-audit-${stamp}.jsonl"`,
    "Cache-Control": "no-store"
  };
  if (truncated) {
    // Jujur soal cakupan: pemakai berkas harus tahu ini bukan seluruh riwayat.
    responseHeaders["X-Dextra-Truncated"] = `true; max=${MAX_EVENTS}`;
  }

  return new Response(lines.join("\n") + (lines.length ? "\n" : ""), {
    status: 200,
    headers: responseHeaders
  });
}
