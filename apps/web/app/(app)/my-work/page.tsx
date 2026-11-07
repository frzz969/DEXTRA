import Link from "next/link";
import { getTasks, getTaskAssignments, getWorkPackages } from "@/lib/api";
import { Badge, FilterForm, UnavailableBanner } from "@/components/p1";

export const dynamic = "force-dynamic";

type SP = { status?: string; q?: string; id?: string };

export default async function MyWorkPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [tasksRes, wpRes] = await Promise.all([getTasks(), getWorkPackages()]);
  const wpTitle = new Map((wpRes.ok ? wpRes.data.items : []).map((p) => [p.id, p.title]));
  const statuses = tasksRes.ok ? [...new Set(tasksRes.data.items.map((t) => t.status))] : [];
  let items = tasksRes.ok ? tasksRes.data.items : [];
  if (sp.status) items = items.filter((t) => t.status === sp.status);
  if (sp.q) { const q = sp.q.toLowerCase(); items = items.filter((t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)); }
  const detail = sp.id ? await getTaskAssignments(sp.id) : null;
  const detailTask = sp.id ? items.find((t) => t.id === sp.id) : undefined;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text"><h1>My Work</h1><p>Daftar tugas yang terdaftar di backend, termasuk status lifecycle-nya.</p></div>
        <div className="page-head__actions"><Link className="btn btn--secondary" href="/board" style={{ minHeight: 44 }}><span className="material-symbols-outlined" aria-hidden="true">view_kanban</span> Buka papan</Link></div>
      </header>

      {!tasksRes.ok ? <UnavailableBanner title="Daftar tugas" error={tasksRes.error} /> : (
        <>
          <FilterForm action="/my-work" fields={[
            { name: "q", label: "Cari judul / ID", value: sp.q },
            { name: "status", label: "Status", value: sp.status, type: "select", options: statuses.map((s) => ({ value: s, label: s })) }
          ]} />

          {detailTask && (
            <section className="card card--pad" aria-labelledby="task-detail-h" style={{ marginBottom: "var(--s-4)" }}>
              <h2 id="task-detail-h">{detailTask.title} <span className="cell-sub mono">{detailTask.id}</span></h2>
              <p style={{ marginTop: "var(--s-2)" }}><Badge value={detailTask.status} /> <span className="cell-sub">Paket: {wpTitle.get(detailTask.work_package_id) ?? detailTask.work_package_id}</span></p>
              {!detail?.ok ? <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>Penugasan belum terhubung. {detail?.error}</p> : detail.data.items.length === 0 ? (
                <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>Belum ada penugasan agen untuk tugas ini.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: "var(--s-3) 0 0", display: "grid", gap: "var(--s-2)" }}>
                  {detail.data.items.map((a) => <li key={a.id}><span className="mono">{a.agent_id}</span> · peran <Badge value={a.role} /></li>)}
                </ul>
              )}
              <p style={{ marginTop: "var(--s-3)" }}><Link href="/my-work">Tutup detail</Link></p>
            </section>
          )}

          {items.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">task_alt</span><span>{sp.status || sp.q ? "Tidak ada tugas yang cocok dengan filter." : "Belum ada tugas."}</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead><tr><th>ID</th><th>Judul</th><th>Status</th><th>Work package</th><th>Agen</th><th></th></tr></thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{t.id}</td>
                      <td className="cell-title">{t.title}</td>
                      <td><Badge value={t.status} /></td>
                      <td>{wpTitle.get(t.work_package_id) ?? t.work_package_id}</td>
                      <td className="mono">{t.assigned_agent_id ?? "—"}</td>
                      <td><Link href={`/my-work?id=${t.id}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>Detail</Link></td>
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
