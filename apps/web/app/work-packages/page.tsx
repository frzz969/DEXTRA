import Link from "next/link";
import { getWorkPackages } from "@/lib/api";
import { Badge, FilterForm, UnavailableBanner, fmtDate } from "@/components/p1";

export const dynamic = "force-dynamic";

type SP = { q?: string; status?: string; priority?: string; sort?: string };

export default async function WorkPackagesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const result = await getWorkPackages();
  const statuses = result.ok ? [...new Set(result.data.items.map((p) => p.status))] : [];
  const priorities = result.ok ? [...new Set(result.data.items.map((p) => p.priority))] : [];
  let items = result.ok ? result.data.items : [];
  if (sp.q) { const q = sp.q.toLowerCase(); items = items.filter((p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)); }
  if (sp.status) items = items.filter((p) => p.status === sp.status);
  if (sp.priority) items = items.filter((p) => p.priority === sp.priority);
  const sort = sp.sort ?? "newest";
  items = [...items].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "due") return (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999");
    if (sort === "tasks") return b.task_count - a.task_count;
    return 0; // newest = urutan API (created_at desc)
  });
  const stats = result.ok ? { total: result.data.items.length, running: result.data.items.filter((p) => p.status === "approved" || p.status === "executing").length, pending: result.data.items.filter((p) => p.status === "pending_approval").length, done: result.data.items.filter((p) => p.status === "completed").length } : null;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text"><h1>Work Packages</h1><p>Paket kerja terstruktur: status, prioritas, jumlah tugas, dan tenggat.</p></div>
        <div className="page-head__actions"><Link className="btn btn--secondary" href="/board" style={{ minHeight: 44 }}><span className="material-symbols-outlined" aria-hidden="true">view_kanban</span> Buka papan</Link></div>
      </header>

      {!result.ok || !stats ? (
        <UnavailableBanner title="Work package" error={result.ok ? "" : result.error} />
      ) : (
        <>
          <section className="grid grid--4" aria-label="Ringkasan work package" style={{ marginBottom: "var(--s-5)" }}>
            <div className="card kpi"><div className="kpi__top"><span className="kpi__label">Total paket</span></div><div className="kpi__value">{stats.total}</div></div>
            <div className="card kpi kpi--accent"><div className="kpi__top"><span className="kpi__label">Berjalan</span></div><div className="kpi__value">{stats.running}</div></div>
            <div className="card kpi kpi--warn"><div className="kpi__top"><span className="kpi__label">Menunggu approval</span></div><div className="kpi__value">{stats.pending}</div></div>
            <div className="card kpi kpi--success"><div className="kpi__top"><span className="kpi__label">Selesai</span></div><div className="kpi__value">{stats.done}</div></div>
          </section>

          <FilterForm action="/work-packages" fields={[
            { name: "q", label: "Cari judul / ID", value: sp.q },
            { name: "status", label: "Status", value: sp.status, type: "select", options: statuses.map((s) => ({ value: s, label: s })) },
            { name: "priority", label: "Prioritas", value: sp.priority, type: "select", options: priorities.map((s) => ({ value: s, label: s })) },
            { name: "sort", label: "Urutkan", value: sort, type: "select", options: [{ value: "newest", label: "Terbaru" }, { value: "title", label: "Judul A–Z" }, { value: "due", label: "Tenggat terdekat" }, { value: "tasks", label: "Tugas terbanyak" }] }
          ]} />

          {items.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><span>{sp.q || sp.status || sp.priority ? "Tidak ada paket yang cocok dengan filter." : "Belum ada work package."}</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead><tr><th>Paket</th><th>Status</th><th>Prioritas</th><th className="num">Tugas</th><th>Tenggat</th><th><span className="sr-only">Detail</span></th></tr></thead>
                <tbody>
                  {items.map((pkg) => (
                    <tr key={pkg.id}>
                      <td className="cell-title">{pkg.title} <span className="cell-sub mono">{pkg.id}</span></td>
                      <td><Badge value={pkg.status} /></td>
                      <td><Badge value={pkg.priority} /></td>
                      <td className="num">{pkg.task_count}</td>
                      <td className="mono">{fmtDate(pkg.due_at)}</td>
                      <td><Link href={`/work-packages/${pkg.id}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>Detail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
