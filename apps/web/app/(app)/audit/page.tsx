import Link from "next/link";
import { apiGet, verifyAuditChain } from "@/lib/api";

export const dynamic = "force-dynamic";

type AuditEvent = {
  id: string;
  seq: number;
  at: string;
  event_type: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  decision: string | null;
  detail: unknown;
  entry_hash: string;
};

type VerifyResult = {
  ok: boolean;
  checked: number;
  broken_at_seq?: number;
  chain_versions?: number[];
};

const DECISION_TONE: Record<string, string> = {
  allow: "badge--success",
  approved: "badge--success",
  deny: "badge--danger",
  rejected: "badge--danger",
  pending: "badge--warning"
};

function fmtAt(at: string): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });
}

function fmtDetail(detail: unknown): string {
  if (detail == null) return "—";
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ limit?: string; offset?: string; q?: string; type?: string; decision?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const limit = Math.min(200, Math.max(10, Number(params.limit) || 100));
  const offset = Math.max(0, Number(params.offset) || 0);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const q = (params.q ?? "").trim();
  const typeFilter = (params.type ?? "").trim();
  const decisionFilter = (params.decision ?? "").trim();
  const [eventsResult, verifyResult] = await Promise.all([
    apiGet<{ items: AuditEvent[] }>(`/audit-events?limit=${safeLimit}&offset=${safeOffset}`),
    verifyAuditChain()
  ]);

  const rawItems = eventsResult.ok ? eventsResult.data.items : [];
  const needle = q.toLowerCase();
  const visible = rawItems.filter((ev) => {
    if (typeFilter && ev.event_type !== typeFilter) return false;
    if (decisionFilter && (ev.decision ?? "") !== decisionFilter) return false;
    if (!needle) return true;
    const haystack = [ev.event_type, ev.actor, ev.action, ev.resource, ev.decision, fmtDetail(ev.detail)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
  const filtersActive = Boolean(needle || typeFilter || decisionFilter);

  // Opsi filter diambil dari halaman yang sedang tampil — bukan dari seluruh
  // riwayat — supaya tidak pernah menawarkan nilai yang tidak akan ditemukan.
  const typeOptions = [...new Set(rawItems.map((ev) => ev.event_type))].sort();
  const decisionOptions = [...new Set(rawItems.map((ev) => ev.decision).filter((d): d is string => Boolean(d)))].sort();

  const pageQuery = (nextOffset: number) => {
    const sp = new URLSearchParams({ limit: String(safeLimit), offset: String(nextOffset) });
    if (q) sp.set("q", q);
    if (typeFilter) sp.set("type", typeFilter);
    if (decisionFilter) sp.set("decision", decisionFilter);
    return `/audit?${sp.toString()}`;
  };

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set("q", q);
  if (typeFilter) exportQuery.set("type", typeFilter);
  if (decisionFilter) exportQuery.set("decision", decisionFilter);
  const exportHref = `/audit/export${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Audit Center</h1>
          <p>Jejak audit append-only dengan verifikasi rantai hash.</p>
        </div>
        <div className="page-head__actions">
          <a className="btn btn--sm" href={exportHref} download>
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            Ekspor JSONL
          </a>
        </div>
      </header>

      <form className="card" method="get" action="/audit" style={{ marginBottom: "var(--s-4)" }}>
        <div className="row" style={{ gap: "var(--s-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "2 1 260px", margin: 0 }}>
            <span className="field__label">Cari</span>
            <input
              className="input"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="aktor, aksi, resource, isi detail…"
            />
          </label>
          <label className="field" style={{ flex: "1 1 170px", margin: 0 }}>
            <span className="field__label">Tipe peristiwa</span>
            <select className="select" name="type" defaultValue={typeFilter}>
              <option value="">Semua tipe</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: "1 1 150px", margin: 0 }}>
            <span className="field__label">Keputusan</span>
            <select className="select" name="decision" defaultValue={decisionFilter}>
              <option value="">Semua</option>
              {decisionOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <input type="hidden" name="limit" value={safeLimit} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--primary" type="submit">Terapkan</button>
            {filtersActive && (
              <Link className="btn" href={`/audit?limit=${safeLimit}`}>Reset</Link>
            )}
          </div>
        </div>
        {filtersActive && (
          <p className="field__hint" style={{ marginTop: "var(--s-2)", marginBottom: 0 }}>
            Filter berlaku pada {rawItems.length} event di halaman ini, bukan seluruh riwayat.
            Pakai ekspor JSONL untuk menyaring keseluruhan jejak.
          </p>
        )}
      </form>

      {verifyResult.ok ? (
        verifyResult.data.ok ? (
          <div className="banner banner--success" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
            <span>
              Rantai audit terverifikasi. <strong>{verifyResult.data.checked}</strong> entri diperiksa.
            </span>
          </div>
        ) : (
          <div className="banner banner--danger" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">gpp_bad</span>
            <span>
              Rantai audit <strong>rusak</strong> pada seq #{verifyResult.data.broken_at_seq ?? "?"} setelah{" "}
              {verifyResult.data.checked} entri diperiksa.
            </span>
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Verifikasi rantai tidak tersedia.</strong> {verifyResult.error}
          </span>
        </div>
      )}

      {eventsResult.ok ? (
        rawItems.length === 0 ? (
          <div className="banner" style={{ marginTop: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>
            <span>Belum ada peristiwa audit tercatat.</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="banner" style={{ marginTop: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
            <span>
              Tidak ada event yang cocok dengan filter pada halaman ini.{" "}
              <Link href={`/audit?limit=${safeLimit}`}>Hapus filter</Link> atau lanjut ke halaman
              berikutnya.
            </span>
          </div>
        ) : (
          <div className="card" style={{ marginTop: "var(--s-4)", padding: 0 }}>
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th className="num">Seq</th>
                    <th>Waktu</th>
                    <th>Tipe</th>
                    <th>Aktor</th>
                    <th>Aksi</th>
                    <th>Resource</th>
                    <th>Keputusan</th>
                    <th>Detail</th>
                    <th>Entry Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((ev) => (
                    <tr key={ev.id}>
                      <td className="num mono">{ev.seq}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(ev.at)}</td>
                      <td><span className="badge badge--outline">{ev.event_type}</span></td>
                      <td className="truncate" style={{ maxWidth: 160 }} title={ev.actor ?? ""}>{ev.actor ?? "—"}</td>
                      <td>{ev.action ?? "—"}</td>
                      <td className="truncate" style={{ maxWidth: 150 }} title={ev.resource ?? ""}>{ev.resource ?? "—"}</td>
                      <td>
                        {ev.decision ? (
                          <span className={`badge ${DECISION_TONE[ev.decision.toLowerCase()] ?? "badge--outline"}`}>
                            {ev.decision}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="truncate" style={{ maxWidth: 175 }} title={fmtDetail(ev.detail)}>
                        {fmtDetail(ev.detail)}
                      </td>
                      <td className="mono truncate" style={{ maxWidth: 140 }} title={ev.entry_hash}>
                        {ev.entry_hash.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="banner banner--warning" style={{ marginTop: "var(--s-4)" }} role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Data tidak tersedia.</strong> {eventsResult.error}
          </span>
        </div>
      )}

      {eventsResult.ok && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: "var(--s-3)", alignItems: "center" }}>
          <span className="field__hint" style={{ alignSelf: "center" }}>
            Offset {safeOffset} · Memuat {safeLimit} per halaman
            {filtersActive ? ` · ${visible.length} dari ${rawItems.length} cocok` : ""}
          </span>
          {safeOffset > 0 && (
            <Link className="btn btn--sm" style={{ minHeight: 44 }} href={pageQuery(Math.max(0, safeOffset - safeLimit))}>
              Sebelumnya
            </Link>
          )}
          <Link className="btn btn--sm" style={{ minHeight: 44 }} href={pageQuery(safeOffset + safeLimit)}>
            Berikutnya
          </Link>
        </div>
      )}
    </>
  );
}
