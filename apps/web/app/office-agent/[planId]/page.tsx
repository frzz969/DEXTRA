import Link from "next/link";
import { apiGet } from "@/lib/api";
import ApproveActionButton from "./ApproveActionButton";

export const dynamic = "force-dynamic";

type OfficeAction = {
  action_id: string;
  action_type: string;
  params: Record<string, unknown>;
  source_ref: Record<string, unknown>;
};

type OfficePlan = {
  id: string;
  request_id: string;
  plan_id: string;
  plan_hash: string;
  status: string;
  actions: OfficeAction[];
  findings: unknown[];
  validation: Record<string, unknown>;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  received: "badge--info",
  partially_approved: "badge--warning",
  rejected: "badge--danger",
  completed: "badge--success"
};

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function shortJson(value: unknown, max = 180): string {
  try {
    const json = JSON.stringify(value, null, 0);
    return json.length > max ? json.slice(0, max) + "…" : json;
  } catch {
    return String(value);
  }
}

export default async function OfficePlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const result = await apiGet<OfficePlan>(`/office-agent/plans/${encodeURIComponent(planId)}`);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/office-agent">Office Agent</Link>
            <span className="sep">›</span>
            <span className="current">{planId}</span>
          </nav>
          <h1>Rencana <span className="mono">{planId}</span></h1>
          <p>Tinjau tindakan yang diusulkan. Persetujuan manusia menerbitkan mandat lewat engine — tidak ada tindakan yang berjalan tanpa itu.</p>
        </div>
      </header>

      {result.ok ? (
        <>
          <div className="card banner" style={{ display: "flex", gap: "var(--s-5)", flexWrap: "wrap", alignItems: "center" }}>
            <span className="material-symbols-outlined" aria-hidden="true">assignment</span>
            <span>
              <strong>status</strong> <span className={`badge ${STATUS_TONE[result.data.status] ?? "badge--outline"}`}>{result.data.status}</span>
              <br />
              <span className="cell-sub mono" title={result.data.plan_hash}>plan_hash: {result.data.plan_hash}</span>
              <div className="cell-sub">request: <span className="mono">{result.data.request_id}</span> · diterima {fmtAt(result.data.created_at)}</div>
            </span>
          </div>

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Tindakan ({result.data.actions.length})</h2>
          {result.data.actions.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><span>Tidak ada tindakan pada rencana ini.</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Aksi</th>
                    <th>Tipe</th>
                    <th>Params</th>
                    <th>Sumber</th>
                    <th>Keputusan</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.actions.map((action) => (
                    <tr key={action.action_id}>
                      <td className="mono">{action.action_id}</td>
                      <td>{action.action_type}</td>
                      <td className="mono truncate" style={{ maxWidth: 260 }} title={shortJson(action.params, 10_000)}>
                        {shortJson(action.params)}
                      </td>
                      <td className="cell-sub mono" style={{ maxWidth: 180 }}>{shortJson(action.source_ref, 80)}</td>
                      <td><ApproveActionButton planId={result.data.plan_id} actionId={action.action_id} actionType={action.action_type} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Temuan validasi ({result.data.findings.length})</h2>
          {result.data.findings.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">fact_check</span><span>Validator tidak melaporkan temuan.</span></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {result.data.findings.map((finding, i) => (
                <pre key={i} className="mono banner" style={{ padding: "var(--s-2) var(--s-3)", fontSize: 11, overflow: "auto" }}>
                  {JSON.stringify(finding, null, 2)}
                </pre>
              ))}
            </div>
          )}

          <details style={{ marginTop: "var(--s-5)" }}>
            <summary className="field__hint">Validation (mentah)</summary>
            <pre className="mono banner" style={{ padding: "var(--s-3)", overflow: "auto", fontSize: 11 }}>
              {JSON.stringify(result.data.validation, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Rencana tidak tersedia.</strong> {result.error}
          </span>
        </div>
      )}
    </>
  );
}
