import { apiGet } from "@/lib/api";

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

export default async function AuditPage() {
  const [eventsResult, verifyResult] = await Promise.all([
    apiGet<{ items: AuditEvent[] }>("/audit-events?limit=100&offset=0"),
    apiGet<VerifyResult>("/audit-events/verify")
  ]);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Audit Center</h1>
          <p>Jejak audit append-only dengan verifikasi rantai hash.</p>
        </div>
      </header>

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
        eventsResult.data.items.length === 0 ? (
          <div className="banner" style={{ marginTop: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>
            <span>Belum ada peristiwa audit tercatat.</span>
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
                  {eventsResult.data.items.map((ev) => (
                    <tr key={ev.id}>
                      <td className="num mono">{ev.seq}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(ev.at)}</td>
                      <td><span className="badge badge--outline">{ev.event_type}</span></td>
                      <td className="truncate" style={{ maxWidth: 160 }} title={ev.actor ?? ""}>{ev.actor ?? "—"}</td>
                      <td>{ev.action ?? "—"}</td>
                      <td className="truncate" style={{ maxWidth: 180 }} title={ev.resource ?? ""}>{ev.resource ?? "—"}</td>
                      <td>
                        {ev.decision ? (
                          <span className={`badge ${DECISION_TONE[ev.decision.toLowerCase()] ?? "badge--outline"}`}>
                            {ev.decision}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="truncate" style={{ maxWidth: 240 }} title={fmtDetail(ev.detail)}>
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
    </>
  );
}
