import { apiGet } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

type WorkPackageItem = {
  id: string;
  title: string;
  status: string;
  priority: string;
  task_count: number;
  due_at: string | null;
};

const COLUMNS: { key: string; label: string; statuses: string[]; tone: string }[] = [
  { key: "draft", label: "Draft", statuses: ["draft"], tone: "badge--outline" },
  { key: "pending_approval", label: "Menunggu", statuses: ["pending_approval"], tone: "badge--warning" },
  { key: "approved", label: "Disetujui", statuses: ["approved"], tone: "badge--info" },
  { key: "executing", label: "Berjalan", statuses: ["executing"], tone: "badge--info" },
  { key: "completed", label: "Selesai", statuses: ["completed"], tone: "badge--success" },
  { key: "cancelled", label: "Dibatalkan", statuses: ["rejected", "revoked", "failed", "cancelled"], tone: "badge--danger" }
];

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

export default async function BoardPage() {
  const result = await apiGet<{ items: WorkPackageItem[] }>("/work-packages");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/work-packages">Work Packages</Link>
            <span className="sep">›</span>
            <span className="current">Papan</span>
          </nav>
          <h1>Papan Work Packages</h1>
          <p>Paket kerja dikelompokkan per tahap. Perubahan status terjadi lewat alur governance, bukan dipindah-pindahkan manual di sini.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">view_kanban</span><span>Belum ada work package untuk ditampilkan di papan.</span></div>
        ) : (
          <div className="kanban" aria-label="Papan work packages">
            {COLUMNS.map((col) => {
              const pkgs = result.data.items.filter((p) => col.statuses.includes(p.status));
              return (
                <section className="kcol" key={col.key} aria-label={`Tahap ${col.label}`}>
                  <div className="kcol__head">
                    <span className="kcol__title">{col.label}</span>
                    <span className="kcol__count">{pkgs.length}</span>
                  </div>
                  <div className="kcol__body">
                    {pkgs.map((pkg) => (
                      <article className="kcard" key={pkg.id}>
                        <div className="kcard__title">{pkg.title}</div>
                        <div className="kcard__meta">
                          <span className={`badge ${PRIORITY_TONE[pkg.priority] ?? "badge--outline"}`}>{pkg.priority}</span>
                          <span className="cell-sub"><strong>{pkg.task_count}</strong> tugas</span>
                        </div>
                        <div className="kcard__meta">
                          <span className="cell-sub mono">tenggat {fmtAt(pkg.due_at)}</span>
                        </div>
                      </article>
                    ))}
                    {pkgs.length === 0 && (
                      <div className="kcard__meta" style={{ color: "var(--muted)", fontSize: 11, padding: "4px 2px" }}>
                        Tidak ada paket.
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Papan tidak tersedia.</strong> {result.error}</span>
        </div>
      )}
    </>
  );
}
