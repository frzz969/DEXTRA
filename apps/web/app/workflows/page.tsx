import Link from "next/link";
import { apiGet } from "@/lib/api";
import { StartRunButton } from "./RunButtons";

export const dynamic = "force-dynamic";

type WorkflowStep = {
  id: string;
  type?: string;
  depends_on?: string[];
  max_attempts?: number;
  params?: Record<string, unknown>;
};

type WorkflowItem = {
  id: string;
  name: string;
  version: number;
  description: string;
  status: string;
  steps: WorkflowStep[];
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  draft: "badge--outline",
  archived: "badge--warning"
};

const STATUSES = ["active", "draft", "archived"];

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function WorkflowsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase().slice(0, 200);
  const statusFilter = str(sp.status);
  const result = await apiGet<{ items: WorkflowItem[]; tenant_id?: string }>("/workflows");

  const all = result.ok ? result.data.items : [];
  const filtered = all.filter((w) => {
    if (statusFilter && w.status !== statusFilter) return false;
    if (!q) return true;
    return [w.name, w.id, w.description, w.status].join(" ").toLowerCase().includes(q);
  });

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Workflow Registry</h1>
          <p>
            Definisi workflow per tenant. Run dilakukan lewat idempotency key; gerbang persetujuan
            identik dengan approval manusia.
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/workflows/runs" style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              play_circle
            </span>
            Lihat runs
          </Link>
        </div>
      </header>

      {result.ok ? (
        <>
          <form
            className="row"
            role="search"
            style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center", flexWrap: "wrap" }}
            action="/workflows"
            method="get"
          >
            <input
              className="input mono"
              type="search"
              name="q"
              aria-label="Cari workflow"
              placeholder="Cari nama, id, deskripsi…"
              defaultValue={q}
              style={{ flex: "1 1 220px", minHeight: 44 }}
            />
            <select
              className="select"
              name="status"
              defaultValue={statusFilter}
              aria-label="Filter status"
              style={{ flex: "0 1 160px", minHeight: 44 }}
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
              Cari
            </button>
            {q || statusFilter ? (
              <Link className="btn btn--secondary" href="/workflows" style={{ minHeight: 44 }}>
                Bersihkan
              </Link>
            ) : null}
          </form>

          <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
            Menampilkan <strong>{filtered.length}</strong> dari <strong>{all.length}</strong> workflow.
          </p>

          {all.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                account_tree
              </span>
              <span>Belum ada workflow terdaftar.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                search_off
              </span>
              <span>Tidak ada workflow yang cocok dengan filter ini.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Versi</th>
                    <th>Status</th>
                    <th className="num">Langkah</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((workflow) => (
                    <tr key={workflow.id}>
                      <td>
                        <div className="cell-title">{workflow.name}</div>
                        <div className="cell-sub">{workflow.description || "—"}</div>
                        <details style={{ marginTop: 4 }}>
                          <summary
                            style={{
                              cursor: "pointer",
                              fontSize: 12,
                              color: "var(--muted)",
                              minHeight: 44,
                              display: "flex",
                              alignItems: "center"
                            }}
                          >
                            Langkah ({workflow.steps.length})
                          </summary>
                          <ol style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                            {workflow.steps.map((step) => (
                              <li key={step.id}>
                                <span className="mono">{step.id}</span> · {step.type ?? "noop"}
                                {step.depends_on && step.depends_on.length > 0 ? (
                                  <span className="cell-sub"> · butuh {step.depends_on.join(", ")}</span>
                                ) : null}
                                {step.max_attempts != null ? (
                                  <span className="cell-sub"> · maks {step.max_attempts}×</span>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        </details>
                      </td>
                      <td className="mono">v{workflow.version}</td>
                      <td>
                        <span className={`badge ${STATUS_TONE[workflow.status] ?? "badge--outline"}`}>
                          {workflow.status}
                        </span>
                      </td>
                      <td className="num">{workflow.steps.length}</td>
                      <td className="mono">{fmtAt(workflow.created_at)}</td>
                      <td>
                        <StartRunButton workflowId={workflow.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
