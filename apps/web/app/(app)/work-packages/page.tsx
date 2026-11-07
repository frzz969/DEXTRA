import Link from "next/link";
import { getAgents, getTasks, getWorkPackages } from "@/lib/api";
import { Badge, PRIORITY_TONE, UnavailableBanner, fmtDate } from "@/components/p1";
import ExportCsvButton, { type CsvRow } from "./ExportCsvButton";
import { PRIORITY_LABEL, STATUS_ORDER, statusLabel } from "./labels";

export const dynamic = "force-dynamic";

/**
 * Acuan tampilan: apps/dashboard/assets/js/views/workpackages.js:17-101.
 *
 * Yang diikuti dari acuan: chip status berjumlah (ref :36-45), pencarian,
 * filter agen, ekspor CSV (ref :93-98), dan kolom tabel yang ringkas.
 *
 * Yang TIDAK bisa diikuti — dan karena itu ditandai, bukan dikarang:
 * kolom Risiko, Mandat, dan "Diperbarui" pada acuan (ref :58-75) berasal dari
 * objek plan di dashboard statis. `GET /api/v1/work-packages`
 * (backend/dextra/modules/tasks/router.py:116-135) hanya mengembalikan
 * id, title, status, priority, task_count, due_at. Tidak ada risk, mandate_id,
 * specialist, maupun created_at pada payload daftar. Status plan
 * (READY/NEEDS_REVIEW/BLOCKED/EXECUTED) juga tidak berlaku: work package
 * memakai enum WORK_STATUSES di backend/dextra/models/tasks.py:16-29.
 */

type SP = { q?: string; status?: string; priority?: string; agent?: string; sort?: string };

const DECIDE = new Set(["pending_approval", "review"]);
const RUNNING = new Set(["assigned", "in_progress", "approved", "executing"]);

export default async function WorkPackagesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;

  // Tiga endpoint nyata, satu gelombang. Kegagalan salah satunya tidak
  // menjatuhkan yang lain — kolom yang bergantung padanya jadi "tidak tersedia".
  const [wpRes, tasksRes, agentsRes] = await Promise.all([getWorkPackages(), getTasks(), getAgents()]);

  const all = wpRes.ok ? wpRes.data.items : [];

  const agentName = new Map<string, string>();
  if (agentsRes.ok) {
    for (const agent of agentsRes.data.items) agentName.set(agent.id, agent.display_name);
  }
  const agentsKnown = agentsRes.ok;
  const tasksKnown = tasksRes.ok;

  /** work_package_id → agen yang ditugaskan pada tugas di dalamnya. */
  const wpAgents = new Map<string, string[]>();
  const wpAgentIds = new Map<string, string[]>();
  for (const task of tasksKnown ? tasksRes.data.items : []) {
    if (!task.assigned_agent_id) continue;
    const names = wpAgents.get(task.work_package_id) ?? [];
    const name = agentName.get(task.assigned_agent_id) ?? task.assigned_agent_id;
    if (!names.includes(name)) names.push(name);
    wpAgents.set(task.work_package_id, names);
    const ids = wpAgentIds.get(task.work_package_id) ?? [];
    if (!ids.includes(task.assigned_agent_id)) ids.push(task.assigned_agent_id);
    wpAgentIds.set(task.work_package_id, ids);
  }

  let items = all;
  if (sp.q) {
    const q = sp.q.toLowerCase();
    items = items.filter((p) => p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }
  if (sp.status) items = items.filter((p) => p.status === sp.status);
  if (sp.priority) items = items.filter((p) => p.priority === sp.priority);
  if (sp.agent) items = items.filter((p) => (wpAgentIds.get(p.id) ?? []).includes(sp.agent!));

  const sort = sp.sort ?? "newest";
  items = [...items].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "due") return (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999");
    if (sort === "tasks") return b.task_count - a.task_count;
    return 0; // newest = urutan API (created_at desc)
  });

  // Hitungan chip selalu dari himpunan penuh, supaya angkanya tetap jadi
  // peta navigasi walau satu filter sedang aktif.
  const statusCounts = new Map<string, number>();
  for (const pkg of all) statusCounts.set(pkg.status, (statusCounts.get(pkg.status) ?? 0) + 1);
  const presentStatuses = STATUS_ORDER.filter((s) => statusCounts.has(s));

  const stats = {
    total: all.length,
    decide: all.filter((p) => DECIDE.has(p.status)).length,
    running: all.filter((p) => RUNNING.has(p.status)).length,
    done: all.filter((p) => p.status === "completed").length
  };

  function hrefFor(next: Partial<SP>): string {
    const merged: SP = { q: sp.q, status: sp.status, priority: sp.priority, agent: sp.agent, sort: sp.sort, ...next };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, String(value));
    }
    const qs = params.toString();
    return `/work-packages${qs ? `?${qs}` : ""}`;
  }

  // Opsi filter agen: hanya agen yang benar-benar muncul pada tugas.
  const agentOptions = [...wpAgentIds.values()]
    .flat()
    .filter((id, i, arr) => arr.indexOf(id) === i)
    .map((id) => ({ value: id, label: agentName.get(id) ?? id }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const priorityOptions = [...new Set(all.map((p) => p.priority))];

  const csvRows: CsvRow[] = items.map((pkg) => ({
    id: pkg.id,
    title: pkg.title,
    status: pkg.status,
    priority: pkg.priority,
    task_count: pkg.task_count,
    due_at: pkg.due_at,
    agents: wpAgents.get(pkg.id) ?? []
  }));

  const filtered = Boolean(sp.q || sp.status || sp.priority || sp.agent);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Work Packages</h1>
          <p>
            Paket kerja terstruktur: status, prioritas, agen yang ditugaskan pada tugas, jumlah tugas, dan tenggat.
            Sumber: <code className="mono">GET /api/v1/work-packages</code>.
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/board" style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">view_kanban</span> Buka papan
          </Link>
          <Link className="btn btn--primary" href="/office-agent" style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span> Buat permintaan
          </Link>
        </div>
      </header>

      {!wpRes.ok ? (
        <UnavailableBanner title="Work package" error={wpRes.error} />
      ) : (
        <>
          <section className="statstrip" aria-label="Ringkasan work package" style={{ marginBottom: "var(--s-4)" }}>
            <div className="statstrip__item">
              <span className="statstrip__label">Total</span>
              <span className="statstrip__value">{stats.total}</span>
              <span className="statstrip__hint">Seluruh workspace</span>
            </div>
            <div className="statstrip__item">
              <span className="statstrip__label">Menunggu keputusan</span>
              <span className="statstrip__value statstrip__value--warning">{stats.decide}</span>
              <span className="statstrip__hint">review + menunggu approval</span>
            </div>
            <div className="statstrip__item">
              <span className="statstrip__label">Berjalan</span>
              <span className="statstrip__value statstrip__value--info">{stats.running}</span>
              <span className="statstrip__hint">ditugaskan · berjalan · disetujui · eksekusi</span>
            </div>
            <div className="statstrip__item">
              <span className="statstrip__label">Selesai</span>
              <span className="statstrip__value statstrip__value--success">{stats.done}</span>
              <span className="statstrip__hint">status completed</span>
            </div>
          </section>

          {/* Chip status: acuan workpackages.js:36-45. Tautan biasa, bukan JS —
              filter tetap bekerja tanpa hidrasi dan bisa di-bookmark. */}
          <div
            className="card card--pad"
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)", alignItems: "center", marginBottom: "var(--s-3)" }}
            role="group"
            aria-label="Filter status"
          >
            <Link
              href={hrefFor({ status: undefined })}
              className={`chip${!sp.status ? " is-active" : ""}`}
              aria-current={!sp.status ? "true" : undefined}
            >
              Semua <span className="faint">{all.length}</span>
            </Link>
            {presentStatuses.map((status) => (
              <Link
                key={status}
                href={hrefFor({ status })}
                className={`chip${sp.status === status ? " is-active" : ""}`}
                aria-current={sp.status === status ? "true" : undefined}
              >
                {statusLabel(status)} <span className="faint">{statusCounts.get(status)}</span>
              </Link>
            ))}
          </div>

          <form
            method="get"
            action="/work-packages"
            className="card card--pad"
            aria-label="Filter work package"
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "flex-end", marginBottom: "var(--s-4)" }}
          >
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <label className="field" htmlFor="wp-q" style={{ minWidth: 200, flex: "2 1 220px" }}>
              <span className="field__label">Cari judul / ID</span>
              <input
                id="wp-q"
                name="q"
                defaultValue={sp.q ?? ""}
                className="input"
                placeholder="Cari work package…"
                style={{ minHeight: 44 }}
              />
            </label>
            <label className="field" htmlFor="wp-agent" style={{ minWidth: 170, flex: "1 1 170px" }}>
              <span className="field__label">Agen pada tugas</span>
              <select
                id="wp-agent"
                name="agent"
                defaultValue={sp.agent ?? ""}
                className="select"
                style={{ minHeight: 44 }}
                disabled={agentOptions.length === 0}
              >
                <option value="">{agentOptions.length === 0 ? "Tidak tersedia" : "Semua agen"}</option>
                {agentOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="wp-priority" style={{ minWidth: 150, flex: "1 1 150px" }}>
              <span className="field__label">Prioritas</span>
              <select id="wp-priority" name="priority" defaultValue={sp.priority ?? ""} className="select" style={{ minHeight: 44 }}>
                <option value="">Semua</option>
                {priorityOptions.map((value) => (
                  <option key={value} value={value}>{PRIORITY_LABEL[value] ?? value}</option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor="wp-sort" style={{ minWidth: 170, flex: "1 1 170px" }}>
              <span className="field__label">Urutkan</span>
              <select id="wp-sort" name="sort" defaultValue={sort} className="select" style={{ minHeight: 44 }}>
                <option value="newest">Terbaru</option>
                <option value="title">Judul A–Z</option>
                <option value="due">Tenggat terdekat</option>
                <option value="tasks">Tugas terbanyak</option>
              </select>
            </label>
            <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>Terapkan</button>
            <Link href="/work-packages" className="btn btn--secondary" style={{ minHeight: 44 }}>Reset</Link>
          </form>

          {!tasksKnown || !agentsKnown ? (
            <div className="banner banner--info" role="status" style={{ marginBottom: "var(--s-3)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              <span>
                Kolom <strong>Agen</strong> dan filter agen ditampilkan sebagai tidak tersedia karena{" "}
                {!tasksKnown && !agentsKnown
                  ? "GET /tasks dan GET /agents gagal dipanggil"
                  : !tasksKnown
                    ? "GET /tasks gagal dipanggil"
                    : "GET /agents gagal dipanggil"}
                . Kolom lain tetap memakai data nyata.
              </span>
            </div>
          ) : null}

          <div className="card">
            <div className="card__head">
              <div>
                <h2>Daftar work package</h2>
                <p>{items.length} dari {all.length} paket</p>
              </div>
              <div className="spacer" />
              <ExportCsvButton rows={csvRows} />
            </div>
            <div className="card__body card__body--flush">
              {items.length === 0 ? (
                <div className="empty">
                  <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">search_off</span></div>
                  <h3>{filtered ? "Tidak ada work package yang cocok" : "Belum ada work package"}</h3>
                  <p>
                    {filtered
                      ? "Tidak ada item yang cocok dengan filter saat ini. Longgarkan filter atau reset."
                      : "Belum ada paket kerja pada tenant ini. Paket dibuat lewat permintaan di Office Agent."}
                  </p>
                  {filtered ? (
                    <Link href="/work-packages" className="btn btn--secondary">Reset filter</Link>
                  ) : (
                    <Link href="/office-agent" className="btn btn--primary">Buat permintaan</Link>
                  )}
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Paket</th>
                        <th>Status</th>
                        <th>Prioritas</th>
                        <th>Agen pada tugas</th>
                        <th className="num">Tugas</th>
                        <th>Tenggat</th>
                        <th aria-label="Detail" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((pkg) => {
                        const names = wpAgents.get(pkg.id) ?? [];
                        return (
                          <tr key={pkg.id}>
                            <td>
                              <span className="cell-title">{pkg.title}</span>
                              <span className="cell-sub mono">{pkg.id}</span>
                            </td>
                            <td><Badge value={pkg.status} /></td>
                            <td><Badge value={PRIORITY_LABEL[pkg.priority] ?? pkg.priority} tone={PRIORITY_TONE[pkg.priority]} /></td>
                            <td>
                              {names.length === 0 ? (
                                <span className="faint tiny">—</span>
                              ) : (
                                <span className="small">{names.join(", ")}</span>
                              )}
                            </td>
                            <td className="num">{pkg.task_count}</td>
                            <td className="mono">{fmtDate(pkg.due_at)}</td>
                            <td>
                              <Link href={`/work-packages/${pkg.id}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>
                                Detail
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card__foot">
              <span className="field__hint">
                Kolom <strong>Risiko</strong>, <strong>Mandat</strong>, dan <strong>Diperbarui</strong> dari acuan tidak
                ditampilkan: <code className="mono">GET /api/v1/work-packages</code> tidak mengembalikan{" "}
                <code className="mono">risk</code>, <code className="mono">mandate_id</code>,{" "}
                <code className="mono">specialist</code>, maupun <code className="mono">created_at</code>. Panel itu ada
                pada halaman rencana di <Link href="/office-agent">Office Agent</Link>.
              </span>
            </div>
          </div>
        </>
      )}
    </>
  );
}
