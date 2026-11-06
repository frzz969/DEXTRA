import Link from "next/link";
import { getTasks, getWorkPackages } from "@/lib/api";
import { Badge, UnavailableBanner, fmtDate } from "@/components/p1";

export const dynamic = "force-dynamic";

export default async function WorkPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [wpRes, tasksRes] = await Promise.all([getWorkPackages(), getTasks()]);
  const pkg = wpRes.ok ? wpRes.data.items.find((p) => p.id === id) : undefined;
  const tasks = tasksRes.ok ? tasksRes.data.items.filter((t) => t.work_package_id === id) : [];
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb"><Link href="/work-packages">Work Packages</Link><span className="sep">›</span><span className="current">Detail</span></nav>
          <h1>{pkg?.title ?? id}</h1>
          <p>Detail paket dan daftar tugasnya. Backend belum menyediakan endpoint tunggal per work package, jadi halaman ini membaca daftar yang sama dengan halaman indeks.</p>
        </div>
      </header>
      {!wpRes.ok ? <UnavailableBanner title="Work package" error={wpRes.error} /> : !pkg ? (
        <div className="banner banner--warning" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span><span>Work package <code className="mono">{id}</code> tidak ditemukan di daftar backend.</span></div>
      ) : (
        <>
          <section className="card card--pad" aria-label="Ringkasan paket" style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-4)", marginBottom: "var(--s-4)" }}>
            <span>Status: <Badge value={pkg.status} /></span>
            <span>Prioritas: <Badge value={pkg.priority} /></span>
            <span>Tugas: <strong>{pkg.task_count}</strong></span>
            <span>Tenggat: <span className="mono">{fmtDate(pkg.due_at)}</span></span>
            <span className="cell-sub mono">{pkg.id}</span>
          </section>
          <h2>Tugas dalam paket ini ({tasks.length})</h2>
          {!tasksRes.ok ? <UnavailableBanner title="Tugas" error={tasksRes.error} /> : tasks.length === 0 ? (
            <div className="banner" style={{ marginTop: "var(--s-3)" }}><span className="material-symbols-outlined" aria-hidden="true">task_alt</span><span>Belum ada tugas pada paket ini.</span></div>
          ) : (
            <div className="table-wrap" style={{ marginTop: "var(--s-3)" }}>
              <table className="table table--compact"><thead><tr><th>Tugas</th><th>Status</th><th>Agen ditugaskan</th><th></th></tr></thead>
                <tbody>{tasks.map((t) => <tr key={t.id}><td className="cell-title">{t.title} <span className="cell-sub mono">{t.id}</span></td><td><Badge value={t.status} /></td><td className="mono">{t.assigned_agent_id ?? "—"}</td><td><Link href={`/board?task=${t.id}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>Di papan</Link></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
