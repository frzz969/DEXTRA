import { apiGet } from "@/lib/api";
import ChallengePanel from "./ChallengePanel";

export const dynamic = "force-dynamic";

type ApprovalItem = {
  id: string;
  plan_id: string;
  approver_id: string | null;
  decision: string;
  reason: string | null;
  decided_at: string | null;
  mandate_id: string | null;
};

const DECISION_TONE: Record<string, string> = {
  approved: "badge--success",
  rejected: "badge--danger",
  revision: "badge--warning"
};

function fmtAt(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });
}

export default async function ApprovalsPage() {
  const result = await apiGet<{ items: ApprovalItem[]; note?: string }>("/approvals");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Approval Challenge</h1>
          <p>Keputusan persetujuan untuk rencana aksi agen, beserta penerbitan mandat.</p>
        </div>
      </header>

      <ChallengePanel />

      <div style={{ marginTop: "var(--s-6)" }}>
        {result.ok ? (
          result.data.items.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">fact_check</span>
              <span>Belum ada keputusan persetujuan tercatat.</span>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Keputusan</th>
                      <th>Plan ID</th>
                      <th>Approver</th>
                      <th>Alasan</th>
                      <th>Mandat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.items.map((item) => (
                      <tr key={item.id}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(item.decided_at)}</td>
                        <td>
                          <span className={`badge ${DECISION_TONE[item.decision?.toLowerCase()] ?? "badge--outline"}`}>
                            {item.decision}
                          </span>
                        </td>
                        <td className="mono truncate" style={{ maxWidth: 160 }} title={item.plan_id}>{item.plan_id}</td>
                        <td className="truncate" style={{ maxWidth: 140 }} title={item.approver_id ?? ""}>{item.approver_id ?? "—"}</td>
                        <td className="truncate" style={{ maxWidth: 280 }} title={item.reason ?? ""}>{item.reason ?? "—"}</td>
                        <td className="mono truncate" style={{ maxWidth: 160 }} title={item.mandate_id ?? ""}>{item.mandate_id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="banner banner--warning" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <span><strong>Data tidak tersedia.</strong> {result.error}</span>
          </div>
        )}
        {result.ok && result.data.note && (
          <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>{result.data.note}</p>
        )}
      </div>
    </>
  );
}
