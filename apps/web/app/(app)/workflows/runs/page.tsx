import Link from "next/link";
import { apiGet } from "@/lib/api";
import GateButton from "./GateButton";
import { ResumeRunButton } from "../RunButtons";

export const dynamic = "force-dynamic";

type WorkflowStepRun = {
  step_id: string;
  status: string;
  attempts: number;
  error: string | null;
  output: unknown;
  started_at: string | null;
  finished_at: string | null;
  approved_by: string | null;
};

type WorkflowRun = {
  id: string;
  workflow_id: string;
  status: string;
  idempotency_key: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  steps: WorkflowStepRun[];
};

const STATUS_TONE: Record<string, string> = {
  succeeded: "badge--success",
  running: "badge--info",
  pending: "badge--outline",
  waiting_approval: "badge--warning",
  failed: "badge--danger",
  cancelled: "badge--outline"
};

const STATUSES = ["running", "pending", "waiting_approval", "succeeded", "failed", "cancelled"];

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default async function WorkflowRunsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = str(sp.status);
  const result = await apiGet<{ items: WorkflowRun[] }>("/workflows/runs");

  const all = result.ok ? result.data.items : [];
  const filtered = statusFilter ? all.filter((r) => r.status === statusFilter) : all;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/workflows">Workflow Registry</Link>
            <span className="sep">›</span>
            <span className="current">Runs</span>
          </nav>
          <h1>Workflow Runs</h1>
          <p>
            Eksekusi workflow terbaru. Gerbang <code className="mono">waiting_approval</code> hanya
            bisa dilewati persetujuan manusia yang ber-capability approve.
          </p>
        </div>
      </header>

      {result.ok ? (
        <>
          <form
            className="row"
            role="search"
            style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center", flexWrap: "wrap" }}
            action="/workflows/runs"
            method="get"
          >
            <select
              className="select"
              name="status"
              defaultValue={statusFilter}
              aria-label="Filter status run"
              style={{ flex: "0 1 220px", minHeight: 44 }}
            >
              <option value="">Semua status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>
              <span className="material-symbols-outlined" aria-hidden="true">
                search
              </span>
              Terapkan
            </button>
            {statusFilter ? (
              <Link className="btn btn--secondary" href="/workflows/runs" style={{ minHeight: 44 }}>
                Bersihkan
              </Link>
            ) : null}
          </form>

          <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
            Menampilkan <strong>{filtered.length}</strong> dari <strong>{all.length}</strong> run.
          </p>

          {filtered.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                play_circle
              </span>
              <span>
                {all.length === 0
                  ? "Belum ada run workflow untuk tenant ini."
                  : "Tidak ada run dengan status ini."}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
              {filtered.map((run) => (
                <details key={run.id} className="card" style={{ padding: "var(--s-3) var(--s-4)" }}>
                  <summary
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      flexWrap: "wrap",
                      minHeight: 44
                    }}
                  >
                    <span className={`badge ${STATUS_TONE[run.status] ?? "badge--outline"}`}>{run.status}</span>
                    <span
                      className="mono"
                      style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={run.idempotency_key}
                    >
                      {run.idempotency_key}
                    </span>
                    <span className="cell-sub">
                      mulai {fmtAt(run.started_at)}
                      {run.finished_at ? ` · selesai ${fmtAt(run.finished_at)}` : ""}
                    </span>
                    {run.error && (
                      <span className="field__error" role="alert">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          error
                        </span>
                        {run.error}
                      </span>
                    )}
                    <span className="field__hint">{run.steps.length} langkah</span>
                  </summary>

                  <div className="table-wrap" style={{ marginTop: "var(--s-3)" }}>
                    <table className="table table--compact">
                      <thead>
                        <tr>
                          <th>Langkah</th>
                          <th>Status</th>
                          <th className="num">Percobaan</th>
                          <th>Gagal</th>
                          <th>Gate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {run.steps.map((step) => (
                          <tr key={step.step_id}>
                            <td className="mono">{step.step_id}</td>
                            <td>
                              <span className={`badge ${STATUS_TONE[step.status] ?? "badge--outline"}`}>
                                {step.status}
                              </span>
                            </td>
                            <td className="num">{step.attempts}</td>
                            <td className="truncate" style={{ maxWidth: 240 }} title={step.error ?? ""}>
                              {step.error ?? "—"}
                            </td>
                            <td>
                              {step.status === "waiting_approval" ? (
                                <GateButton runId={run.id} stepId={step.step_id} />
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {run.status === "failed" || run.status === "waiting_approval" ? (
                    <div style={{ marginTop: "var(--s-3)" }}>
                      <ResumeRunButton runId={run.id} />
                    </div>
                  ) : null}
                </details>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            cloud_off
          </span>
          <span>
            <strong>Belum terhubung ke API (:8000).</strong> {result.error}
          </span>
        </div>
      )}
    </>
  );
}
