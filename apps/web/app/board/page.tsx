import Link from "next/link";
import { getTasks, getWorkPackages } from "@/lib/api";
import { Badge, FilterForm, UnavailableBanner } from "@/components/p1";
import { transitionTask } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS: { key: string; label: string; statuses: string[] }[] = [
  { key: "draft", label: "Draft", statuses: ["draft", "todo"] },
  { key: "assigned", label: "Ditugaskan", statuses: ["assigned"] },
  { key: "in_progress", label: "Berjalan", statuses: ["in_progress"] },
  { key: "review", label: "Review", statuses: ["review"] },
  { key: "completed", label: "Selesai", statuses: ["completed"] },
  { key: "closed", label: "Dibatalkan / ditolak", statuses: ["cancelled", "rejected", "failed"] }
];
// Sama dengan _ALLOWED_TRANSITIONS di backend tasks/router.py
const ALLOWED: Record<string, string[]> = {
  draft: ["assigned", "cancelled", "rejected"],
  assigned: ["in_progress", "cancelled", "rejected"],
  in_progress: ["review", "cancelled", "rejected"],
  review: ["completed", "cancelled", "rejected"],
  todo: ["cancelled", "rejected"]
};

type SP = { wp?: string; q?: string; msg?: string; err?: string; task?: string };

export default async function BoardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [tasksRes, wpRes] = await Promise.all([getTasks(), getWorkPackages()]);
  const wpTitle = new Map((wpRes.ok ? wpRes.data.items : []).map((p) => [p.id, p.title]));
  let tasks = tasksRes.ok ? tasksRes.data.items : [];
  if (sp.wp) tasks = tasks.filter((t) => t.work_package_id === sp.wp);
  if (sp.q) { const q = sp.q.toLowerCase(); tasks = tasks.filter((t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)); }
  const known = new Set(COLUMNS.flatMap((c) => c.statuses));
  const other = tasks.filter((t) => !known.has(t.status));

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb"><Link href="/work-packages">Work Packages</Link><span className="sep">›</span><span className="current">Papan</span></nav>
          <h1>Papan Tugas</h1>
          <p>Kanban dari endpoint <code className="mono">tasks</code>. Pindah status memanggil <code className="mono">POST /tasks/{"{id}"}/transition</code>; backend menolak transisi yang tidak diizinkan.</p>
        </div>
      </header>

      {sp.msg && <div className="banner" role="status" style={{ marginBottom: "var(--s-4)" }}><span className="material-symbols-outlined" aria-hidden="true">check_circle</span><span>{sp.msg}</span></div>}
      {sp.err && <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}><span className="material-symbols-outlined" aria-hidden="true">error</span><span>{sp.err}</span></div>}

      <FilterForm action="/board" fields={[
        { name: "q", label: "Cari judul / ID tugas", value: sp.q },
        { name: "wp", label: "Work package", value: sp.wp, type: "select", options: wpRes.ok ? wpRes.data.items.map((p) => ({ value: p.id, label: p.title })) : [] }
      ]} />

      {!tasksRes.ok ? <UnavailableBanner title="Papan tugas" error={tasksRes.error} /> : tasks.length === 0 ? (
        <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">view_kanban</span><span>Belum ada tugas untuk ditampilkan.</span></div>
      ) : (
        <div className="kanban" aria-label="Papan tugas" style={{ overflowX: "auto" }}>
          {COLUMNS.map((col) => {
            const rows = tasks.filter((t) => col.statuses.includes(t.status));
            return (
              <section className="kcol" key={col.key} aria-label={`Kolom ${col.label}`} style={{ minWidth: 240 }}>
                <div className="kcol__head"><span className="kcol__title">{col.label}</span><span className="kcol__count">{rows.length}</span></div>
                <div className="kcol__body">
                  {rows.map((t) => {
                    const next = ALLOWED[t.status] ?? ["cancelled", "rejected"];
                    return (
                      <article className="kcard" key={t.id} id={sp.task === t.id ? "target-task" : undefined} style={sp.task === t.id ? { outline: "2px solid var(--brand-500)" } : undefined}>
                        <div className="kcard__title">{t.title}</div>
                        <div className="kcard__meta"><Badge value={t.status} /><span className="cell-sub">{wpTitle.get(t.work_package_id) ?? t.work_package_id}</span></div>
                        <div className="kcard__meta mono" style={{ fontSize: 11 }}>{t.id}{t.assigned_agent_id ? ` · agen ${t.assigned_agent_id}` : ""}</div>
                        {next.length > 0 && (
                          <form action={transitionTask} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }} aria-label={`Pindah status ${t.title}`}>
                            <input type="hidden" name="task_id" value={t.id} />
                            {next.map((to) => <button key={to} type="submit" name="to_status" value={to} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>→ {to}</button>)}
                          </form>
                        )}
                      </article>
                    );
                  })}
                  {rows.length === 0 && <div className="kcard__meta" style={{ color: "var(--muted)", fontSize: 11, padding: "4px 2px" }}>Tidak ada tugas.</div>}
                </div>
              </section>
            );
          })}
          {other.length > 0 && (
            <section className="kcol" aria-label="Status lain" style={{ minWidth: 240 }}>
              <div className="kcol__head"><span className="kcol__title">Status lain</span><span className="kcol__count">{other.length}</span></div>
              <div className="kcol__body">{other.map((t) => <article className="kcard" key={t.id}><div className="kcard__title">{t.title}</div><div className="kcard__meta"><Badge value={t.status} /></div></article>)}</div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
