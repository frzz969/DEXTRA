import Link from "next/link";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type WorkflowItem = {
  id: string;
  name: string;
  version: number;
  description: string;
  status: string;
  steps: unknown[];
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  draft: "badge--outline",
  archived: "badge--warning"
};

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function WorkflowsPage() {
  const result = await apiGet<{ items: WorkflowItem[]; tenant_id?: string }>("/workflows");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Workflow Registry</h1>
          <p>Definisi workflow per tenant. Run dilakukan lewat idempotency key; gerbang persetujuan identik dengan approval manusia.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/workflows/runs">
            <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
            Lihat runs
          </Link>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
            <span>Belum ada workflow terdaftar.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Nama</th><th>Versi</th><th>Status</th><th className="num">Langkah</th><th>Dibuat</th></tr>
              </thead>
              <tbody>
                {result.data.items.map((workflow) => (
                  <tr key={workflow.id}>
                    <td>
                      <div className="cell-title">{workflow.name}</div>
                      <div className="cell-sub">{workflow.description || "—"}</div>
                    </td>
                    <td className="mono">v{workflow.version}</td>
                    <td><span className={`badge ${STATUS_TONE[workflow.status] ?? "badge--outline"}`}>{workflow.status}</span></td>
                    <td className="num">{workflow.steps.length}</td>
                    <td className="mono">{fmtAt(workflow.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Data tidak tersedia.</strong> {result.error}</span>
        </div>
      )}
    </>
  );
}
