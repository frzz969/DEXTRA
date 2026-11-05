import Link from "next/link";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type WorkPackageItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  task_count: number;
  due_at: string | null;
};

const STATUS_TONE: Record<string, string> = {
  draft: "badge--outline",
  pending_approval: "badge--warning",
  approved: "badge--info",
  executing: "badge--info",
  completed: "badge--success",
  rejected: "badge--danger",
  revoked: "badge--danger",
  failed: "badge--danger",
  cancelled: "badge--outline"
};

const PRIORITY_TONE: Record<string, string> = {
  low: "badge--outline",
  normal: "badge--outline",
  high: "badge--warning",
  urgent: "badge--danger"
};

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function WorkPackagesPage() {
  const result = await apiGet<{ items: WorkPackageItem[] }>("/work-packages");

  const stats = result.ok
    ? {
        total: result.data.items.length,
        running: result.data.items.filter((p) => p.status === "approved" || p.status === "executing").length,
        pending: result.data.items.filter((p) => p.status === "pending_approval").length,
        done: result.data.items.filter((p) => p.status === "completed").length
      }
    : null;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Work Packages</h1>
          <p>Paket kerja terstruktur: status, prioritas, jumlah tugas, dan tenggat.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/board">
            <span className="material-symbols-outlined" aria-hidden="true">view_kanban</span>
            Buka papan
          </Link>
        </div>
      </header>

      {result.ok && stats ? (
        <>
          <section className="grid grid--4" aria-label="Ringkasan work package" style={{ marginBottom: "var(--s-5)" }}>
            <div className="card kpi"><div className="kpi__top"><span className="kpi__label">Total paket</span></div><div className="kpi__value">{stats.total}</div></div>
            <div className="card kpi kpi--accent"><div className="kpi__top"><span className="kpi__label">Berjalan</span></div><div className="kpi__value">{stats.running}</div></div>
            <div className="card kpi kpi--warn"><div className="kpi__top"><span className="kpi__label">Menunggu approval</span></div><div className="kpi__value">{stats.pending}</div></div>
            <div className="card kpi kpi--success"><div className="kpi__top"><span className="kpi__label">Selesai</span></div><div className="kpi__value">{stats.done}</div></div>
          </section>

          {result.data.items.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><span>Belum ada work package.</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead><tr><th>Paket</th><th>Status</th><th>Prioritas</th><th className="num">Tugas</th><th>Tenggat</th></tr></thead>
                <tbody>
                  {result.data.items.map((pkg) => (
                    <tr key={pkg.id}>
                      <td className="cell-title">{pkg.title}</td>
                      <td><span className={`badge ${STATUS_TONE[pkg.status] ?? "badge--outline"}`}>{pkg.status}</span></td>
                      <td><span className={`badge ${PRIORITY_TONE[pkg.priority] ?? "badge--outline"}`}>{pkg.priority}</span></td>
                      <td className="num">{pkg.task_count}</td>
                      <td className="mono">{fmtAt(pkg.due_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Data tidak tersedia.</strong> {result.ok ? "" : result.error}</span>
        </div>
      )}
    </>
  );
}
