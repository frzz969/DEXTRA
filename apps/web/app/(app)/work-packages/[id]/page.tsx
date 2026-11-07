import Link from "next/link";
import {
  getAgents,
  getTaskAssignments,
  getWorkPackageDetail,
  type ApiResult,
  type AssignmentItem
} from "@/lib/api";
import { Badge, PRIORITY_TONE, UnavailableBanner, fmtDate, fmtDateTime } from "@/components/p1";
import CopyExportButtons from "./CopyExportButtons";
import { FORWARD_STATUSES, NEGATIVE_STATUSES, PRIORITY_LABEL, statusLabel } from "../labels";

export const dynamic = "force-dynamic";

/**
 * Acuan: apps/dashboard/assets/js/views/workpackages.js:142-308.
 *
 * Struktur acuan yang diikuti: page-head dengan badge status + jumlah tindakan,
 * aksi "Salin ID" / "Ekspor JSON" (ref :167-168, :280-285), grid dua kolom
 * (konten + sidebar, ref :172-273), stepper status di sidebar (ref :234),
 * kartu Metadata (ref :251-261), dan kartu Tindakan (ref :263-270).
 *
 * Yang tidak bisa diikuti — karena datanya memang tidak ada pada work package:
 * lingkup tindakan (ref :175-192), temuan validasi (:194-202), bukti eksekusi
 * (:204-215), jejak audit (:217-229), dan kartu Mandat (:236-249). Semua itu
 * milik *plan* (`office_plan_requests`), bukan work package. Alasannya
 * dijelaskan apa adanya di panel "Panel tata kelola" di bawah, bukan diisi
 * angka atau tombol contoh.
 */

/** Batas jumlah tugas yang penugasannya diambil; menghindari ledakan request. */
const ASSIGNMENT_FETCH_LIMIT = 25;

export default async function WorkPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wpRes = await getWorkPackageDetail(id);

  if (!wpRes.ok) {
    const notFound = wpRes.status === 404;
    return (
      <>
        <header className="page-head">
          <div className="page-head__text">
            <nav className="breadcrumbs" aria-label="breadcrumb">
              <Link href="/work-packages">Work Packages</Link>
              <span className="sep">›</span>
              <span className="current mono">{id}</span>
            </nav>
            <h1>{notFound ? "Work package tidak ditemukan" : "Work package tidak tersedia"}</h1>
          </div>
        </header>
        {notFound ? (
          <div className="card">
            <div className="empty">
              <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">search_off</span></div>
              <h3>ID <span className="mono">{id}</span> tidak ada</h3>
              <p>Work package mungkin belum dibuat, atau ID tidak sesuai. Backend membalas 404 — bukan data kosong.</p>
              <Link href="/work-packages" className="btn btn--primary">Kembali ke daftar</Link>
            </div>
          </div>
        ) : (
          <UnavailableBanner title="Work package" error={wpRes.error} />
        )}
      </>
    );
  }

  const pkg = wpRes.data;
  const tasks = pkg.tasks;

  // Nama agen dan peran penugasan: dua endpoint nyata. Kalau salah satunya
  // gagal, kolomnya jadi "tidak tersedia" — tidak diganti nilai contoh.
  const fetchAssignments = tasks.length > 0 && tasks.length <= ASSIGNMENT_FETCH_LIMIT;
  const assignmentPromise: Promise<ApiResult<{ items: AssignmentItem[] }>[]> = fetchAssignments
    ? Promise.all(tasks.map((task) => getTaskAssignments(task.id)))
    : Promise.resolve([]);

  const [agentsRes, assignmentResults] = await Promise.all([getAgents(), assignmentPromise]);

  const agentName = new Map<string, string>();
  if (agentsRes.ok) {
    for (const agent of agentsRes.data.items) agentName.set(agent.id, agent.display_name);
  }

  const rolesByTask = new Map<string, string[]>();
  for (const result of assignmentResults) {
    if (!result.ok) continue;
    for (const assignment of result.data.items) {
      const roles = rolesByTask.get(assignment.task_id) ?? [];
      if (!roles.includes(assignment.role)) roles.push(assignment.role);
      rolesByTask.set(assignment.task_id, roles);
    }
  }

  const currentIdx = (FORWARD_STATUSES as readonly string[]).indexOf(pkg.status);
  const isNegative = NEGATIVE_STATUSES.has(pkg.status);
  const isClosed = pkg.status === "completed";

  // Satu kalimat jujur tentang kolom mana yang tidak lengkap, dan mengapa.
  // Tidak ada angka contoh: yang kosong tetap kosong dan diberi alasan.
  const assignmentNote = !agentsRes.ok
    ? "Nama agen tidak tersedia: GET /api/v1/agents gagal dipanggil. ID agen ditampilkan apa adanya."
    : tasks.length === 0
      ? ""
      : !fetchAssignments
        ? `Peran penugasan tidak diambil: paket punya ${tasks.length} tugas, melewati batas ${ASSIGNMENT_FETCH_LIMIT} permintaan per halaman.`
        : assignmentResults.some((result) => !result.ok)
          ? "Sebagian peran penugasan tidak tersedia: GET /api/v1/tasks/{id}/assignments gagal untuk tugas tersebut."
          : "";

  const payloadForExport = {
    source: "GET /api/v1/work-packages/{id}",
    work_package: pkg,
    assignments: assignmentResults.filter((r) => r.ok).flatMap((r) => (r.ok ? r.data.items : []))
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/work-packages">Work Packages</Link>
            <span className="sep">›</span>
            <span className="current mono">{pkg.id}</span>
          </nav>
          <div className="row row--wrap" style={{ gap: "var(--s-2)", marginBottom: 6 }}>
            <Badge value={pkg.status} />
            <Badge value={PRIORITY_LABEL[pkg.priority] ?? pkg.priority} tone={PRIORITY_TONE[pkg.priority]} />
            <span className="badge badge--outline">{tasks.length} tugas</span>
          </div>
          <h1 style={{ maxWidth: "70ch" }}>{pkg.title}</h1>
          <p className="mono tiny" style={{ marginTop: 6 }}>work_package_id {pkg.id}</p>
        </div>
        <div className="page-head__actions">
          <CopyExportButtons id={pkg.id} payload={payloadForExport} filename={`${pkg.id}.json`} />
          <Link className="btn btn--primary" href={`/board?wp=${encodeURIComponent(pkg.id)}`} style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">view_kanban</span>
            Buka di papan
          </Link>
        </div>
      </header>

      <div className="grid grid--sidebar">
        <div className="stack">
          {/* ---- Tugas: satu-satunya isi work package yang benar-benar ada ---- */}
          <section className="card" aria-label="Tugas dalam paket">
            <div className="card__head">
              <div>
                <h2>Tugas ({tasks.length})</h2>
                <p>Dari <code className="mono">GET /api/v1/work-packages/{"{id}"}</code> — field <code className="mono">tasks[]</code>.</p>
              </div>
              <div className="spacer" />
              <Link className="btn btn--ghost btn--sm" href={`/board?wp=${encodeURIComponent(pkg.id)}`}>Papan</Link>
            </div>
            <div className="card__body card__body--flush">
              {tasks.length === 0 ? (
                <div className="empty">
                  <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">task_alt</span></div>
                  <h3>Belum ada tugas</h3>
                  <p>Paket ini belum berisi tugas. Tugas ditambahkan lewat <code className="mono">POST /api/v1/tasks</code>.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Tugas</th>
                        <th>Status</th>
                        <th>Agen</th>
                        <th>Peran</th>
                        <th className="num">Urutan</th>
                        <th aria-label="Aksi" />
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((task) => {
                        const roles = rolesByTask.get(task.id) ?? [];
                        return (
                          <tr key={task.id}>
                            <td>
                              <span className="cell-title">{task.title}</span>
                              {task.description ? <span className="cell-sub">{task.description}</span> : null}
                              <span className="cell-sub mono">{task.id}</span>
                            </td>
                            <td><Badge value={task.status} /></td>
                            <td>
                              {task.assigned_agent_id ? (
                                <span className="small">{agentName.get(task.assigned_agent_id) ?? task.assigned_agent_id}</span>
                              ) : (
                                <span className="faint tiny">belum ditugaskan</span>
                              )}
                            </td>
                            <td>
                              {roles.length === 0 ? (
                                <span className="faint tiny">—</span>
                              ) : (
                                <span className="small">{roles.join(", ")}</span>
                              )}
                            </td>
                            <td className="num">{task.sort_order ?? "—"}</td>
                            <td>
                              <Link href={`/board?task=${encodeURIComponent(task.id)}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>
                                Papan
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
            {assignmentNote ? (
              <div className="card__foot">
                <span className="field__hint">{assignmentNote}</span>
              </div>
            ) : null}
          </section>

          {/* ---- Panel yang ada di acuan tapi tidak punya data di sini ---- */}
          <section className="card" aria-label="Panel tata kelola">
            <div className="card__head">
              <div>
                <h2>Panel tata kelola — tidak tersedia</h2>
                <p>Panel ini ada pada acuan, tetapi work package tidak menyimpan datanya.</p>
              </div>
            </div>
            <div className="card__body stack" style={{ gap: "var(--s-3)" }}>
              <div className="banner banner--info" role="status">
                <span className="material-symbols-outlined" aria-hidden="true">info</span>
                <span>
                  <strong>Bukan kegagalan koneksi.</strong> Work package dan <em>plan</em> adalah dua entitas berbeda di
                  backend. Tabel <code className="mono">work_packages</code> hanya punya{" "}
                  <code className="mono">title, org_id, status, priority, due_at</code> — tidak ada kolom plan, mandat,
                  temuan, atau audit.
                </span>
              </div>
              <dl className="def-list">
                <dt>Lingkup tindakan</dt>
                <dd>Tidak tersedia — work package tidak menyimpan <code className="mono">actions[]</code> (penerima ter-mask, kanal, jadwal, subjek, isi persis).</dd>
                <dt>Temuan validasi</dt>
                <dd>Tidak tersedia — tidak ada <code className="mono">findings[]</code> pada work package.</dd>
                <dt>Bukti eksekusi</dt>
                <dd>Tidak tersedia — <code className="mono">executions</code> terhubung lewat <code className="mono">plan_id</code> / <code className="mono">mandate_id</code>, bukan <code className="mono">work_package_id</code>.</dd>
                <dt>Jejak audit</dt>
                <dd>Tidak tersedia — operasi tulis work package tidak menulis event audit, dan <code className="mono">audit_events</code> berkunci <code className="mono">plan_id</code>, bukan <code className="mono">work_package_id</code>.</dd>
                <dt>Mandat</dt>
                <dd>Tidak tersedia — <code className="mono">mandates</code> terbit per <code className="mono">plan_id</code> + <code className="mono">action_id</code>.</dd>
                <dt>Sidik rencana</dt>
                <dd>Tidak tersedia — tidak ada <code className="mono">plan_hash</code> pada work package.</dd>
              </dl>
              <div className="banner banner--demo">
                <span className="material-symbols-outlined" aria-hidden="true">assignment</span>
                <span>
                  Panel-panel di atas tersedia pada halaman rencana: <Link href="/office-agent">Office Agent</Link> →
                  detail plan. Di sanalah <code className="mono">actions</code>, <code className="mono">findings</code>,{" "}
                  <code className="mono">plan_hash</code>, mandat, dan audit benar-benar ada.
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="stack">
          {/* ---- Stepper status (acuan ref :234) ---- */}
          <section className="card" aria-label="Alur status">
            <div className="card__head"><div><h2>Alur status</h2></div></div>
            <div className="card__body">
              <div className="timeline" style={{ marginTop: -4 }}>
                {FORWARD_STATUSES.map((status, i) => {
                  const cls = currentIdx === -1 ? "" : i < currentIdx ? "is-done" : i === currentIdx ? "is-current" : "";
                  const icon = cls === "is-done" ? "check" : cls === "is-current" ? "radio_button_checked" : "circle";
                  return (
                    <div className={`tl-item ${cls}`} key={status}>
                      <div className="tl-dot"><span className="material-symbols-outlined" aria-hidden="true">{icon}</span></div>
                      <div className="tl-body">
                        <div className="tl-title">{statusLabel(status)}</div>
                        <div className="tl-meta">
                          {cls === "is-current" ? "status saat ini" : cls === "is-done" ? "sudah dilalui" : "belum terjadi"}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isNegative ? (
                  <div className="tl-item is-blocked">
                    <div className="tl-dot"><span className="material-symbols-outlined" aria-hidden="true">block</span></div>
                    <div className="tl-body">
                      <div className="tl-title">{statusLabel(pkg.status)}</div>
                      <div className="tl-meta">status akhir — paket berhenti di sini</div>
                    </div>
                  </div>
                ) : null}
              </div>
              <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
                Urutan mengikuti enum <code className="mono">WORK_STATUSES</code>. Backend{" "}
                <strong>tidak</strong> menegakkan transisi berurutan untuk work package:{" "}
                <code className="mono">PATCH /work-packages/{"{id}"}</code> menerima status apa pun dari enum. Jadi
                stepper ini menunjukkan posisi, bukan aturan transisi.
                {isClosed ? " Paket sudah selesai." : ""}
              </p>
            </div>
          </section>

          {/* ---- Metadata (acuan ref :251-261) ---- */}
          <section className="card" aria-label="Metadata">
            <div className="card__head"><div><h2>Metadata</h2></div></div>
            <div className="card__body">
              <dl className="def-list">
                <dt>ID</dt>
                <dd className="mono mono--wrap">{pkg.id}</dd>
                <dt>Status</dt>
                <dd>{statusLabel(pkg.status)}</dd>
                <dt>Prioritas</dt>
                <dd>{PRIORITY_LABEL[pkg.priority] ?? pkg.priority}</dd>
                <dt>Organisasi</dt>
                <dd className="mono mono--wrap">{pkg.org_id ?? "—"}</dd>
                <dt>Tenant</dt>
                <dd className="mono mono--wrap">{pkg.tenant_id ?? "—"}</dd>
                <dt>Tenggat</dt>
                <dd>{fmtDate(pkg.due_at)}</dd>
                <dt>Dibuat</dt>
                <dd>{fmtDateTime(pkg.created_at)}</dd>
              </dl>
            </div>
          </section>

          {/* ---- Tindakan (acuan ref :263-270) ---- */}
          <section className="card" aria-label="Tindakan">
            <div className="card__head"><div><h2>Tindakan</h2></div></div>
            <div className="card__body">
              <div className="stack" style={{ gap: 8 }}>
                <Link className="btn btn--secondary btn--block" href={`/board?wp=${encodeURIComponent(pkg.id)}`}>
                  Lihat di papan tugas
                </Link>
                <Link className="btn btn--ghost btn--block" href="/office-agent">
                  Rencana &amp; mandat terkait (Office Agent)
                </Link>
                <p className="field__hint">
                  Tidak ada tombol tinjau/cabut mandat di sini: keduanya bekerja pada plan, dan work package tidak
                  menyimpan <code className="mono">plan_id</code>.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
