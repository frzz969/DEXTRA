import Link from "next/link";
import { apiGet, getExecutions } from "@/lib/api";

export const dynamic = "force-dynamic";

type VerifyResult = { ok: boolean; checked: number; broken_at_seq?: number; chain_versions?: number[] };
type Counted = { items: unknown[] };

/* Endpoint data memang ada: `GET /data/export`, `POST /data/seed`,
 * `POST /data/reset`. Yang tidak ada adalah izinnya pada token dev — export
 * butuh `view_audit`, reset butuh `manage_integrations`. Karena itu tombolnya
 * TIDAK diduplikasi di sini: alatnya tinggal di /settings?tab=data, tempat
 * capability pemanggil diperiksa dan alasannya ditampilkan. Halaman ini fokus
 * pada bukti integritas, bukan pada aksi destruktif. */

export default async function DataManagementPage() {
  const [verify, packages, tasks, executions, audit] = await Promise.all([
    apiGet<VerifyResult>("/audit-events/verify"),
    apiGet<Counted>("/work-packages"),
    apiGet<Counted>("/tasks"),
    getExecutions(1),
    apiGet<Counted>("/audit-events?limit=1"),
  ]);

  function count(result: { ok: boolean; data?: Counted }): string {
    return result.ok && result.data ? String(result.data.items.length) : "?";
  }

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Data Management</h1>
          <p>Bukti data dari API saja. Aksi seed, reset, dan export ada di Settings → Data.</p>
        </div>
      </header>

      <div className="banner banner--info" role="status" style={{ marginBottom: "var(--s-4)" }}>
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        <span>
          <strong>Alat data tinggal di Settings → Data.</strong> Endpoint-nya ada
          (<code className="mono">GET /data/export</code>,{" "}
          <code className="mono">POST /data/reset</code>), tetapi masing-masing menuntut capability
          berbeda. Di sana tombol ditampilkan mati beserta alasannya bila token Anda tidak
          memilikinya — bukan disembunyikan, dan bukan dibuat seolah berhasil.
        </span>
      </div>

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Integritas audit (satu-satunya bukti end-to-end)</h2>
      {verify.ok ? (
        <div className={`banner ${verify.data.ok ? "banner--success" : "banner--danger"}`} role="status">
          <span className="material-symbols-outlined" aria-hidden="true">
            {verify.data.ok ? "verified_user" : "gpp_bad"}
          </span>
          <span>
            Rantai audit {verify.data.ok ? "utuh" : "RUSAK"} — {verify.data.checked ?? 0} entri diperiksa
            {verify.data.broken_at_seq !== undefined && <> · terputus di seq #{verify.data.broken_at_seq}</>}.
          </span>
        </div>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Verifikasi rantai tidak tersedia.</strong> {verify.error}
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Isi database menurut API</h2>
      <section className="grid grid--2" aria-label="Isi database">
        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Work package</span>
          </div>
          <div className="kpi__value">{count(packages)}</div>
          <div className="kpi__foot">
            <span className="mono">GET /work-packages</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Task</span>
          </div>
          <div className="kpi__value">{count(tasks)}</div>
          <div className="kpi__foot">
            <span className="mono">GET /tasks</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Event audit terakhir</span>
          </div>
          <div className="kpi__value">{count(audit)}</div>
          <div className="kpi__foot">
            <span className="mono">GET /audit-events</span>
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi__top">
            <span className="kpi__label">Eksekusi (sampel 1)</span>
          </div>
          <div className="kpi__value">{executions.ok ? String(executions.data.items.length) : "?"}</div>
          <div className="kpi__foot">
            <span className="mono">GET /executions</span>
          </div>
        </div>
      </section>
      {(!packages.ok || !tasks.ok || !audit.ok) && (
        <div className="banner banner--warning" role="status" style={{ marginTop: "var(--s-3)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            {[!packages.ok && packages.error, !tasks.ok && tasks.error, !audit.ok && audit.error]
              .filter(Boolean)
              .join(" ")}
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Yang belum ada endpoint</h2>
      <ul className="small muted" style={{ lineHeight: 1.8 }}>
        <li>Mendaftar tabel database: tidak ada endpoint.</li>
        <li>Menjalankan migrasi dari UI: tidak ada endpoint. Pakai Alembic CLI.</li>
        <li>Ekspor data ke file: tidak ada endpoint.</li>
        <li>Reset atau seed data: tidak ada endpoint.</li>
        <li>Konsistensi kontrak dibaca lewat audit chain dan <Link href="/security">Security Center</Link>.</li>
      </ul>
    </>
  );
}
