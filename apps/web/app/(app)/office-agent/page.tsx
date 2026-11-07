import Link from "next/link";
import { apiGet } from "@/lib/api";
import { AgentAvatar, CapabilityChips } from "@/components/agents";
import PlanIntakeForm from "./PlanIntakeForm";
import { WORKERS, WORKER_FLOW, WORKER_PRINCIPLES, findWorker, type Worker } from "@/lib/workers";
import "./worker-picker.css";

export const dynamic = "force-dynamic";

type PlanItem = {
  id: string;
  request_id: string;
  plan_id: string;
  plan_hash: string;
  status: string;
  actions: unknown[];
  findings: unknown[];
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  received: "badge--info",
  partially_approved: "badge--warning",
  rejected: "badge--danger",
  completed: "badge--success"
};

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

/** Bagian yang menjelaskan tim dan aturannya; sama di kedua langkah. */
function TeamBrief() {
  return (
    <>
      <section aria-labelledby="flow-heading" style={{ marginTop: "var(--s-6)" }}>
        <h2 id="flow-heading" style={{ fontSize: 15, margin: "0 0 var(--s-2)" }}>Bagaimana keempatnya bekerja sama</h2>
        <p className="small muted" style={{ margin: "0 0 var(--s-4)", maxWidth: "70ch" }}>
          Contoh: <em>&ldquo;Tolong jadwalkan rapat dengan tim besok pukul 10.00 dan siapkan undangannya.&rdquo;</em>{" "}
          Urutannya tidak berubah: pekerjaan mengalir ke bawah, dan tidak ada yang berjalan sebelum Anda menyetujui.
        </p>

        <ol className="flow">
          {WORKER_FLOW.map((step, index) => (
            <li key={step.actor} className={`flow__step flow__step--${step.kind}`}>
              <span className="flow__index" aria-hidden="true">{index + 1}</span>
              <div style={{ minWidth: 0 }}>
                <div className="flow__actor">{step.actor}</div>
                <div className="flow__action">{step.action}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="principles-heading" style={{ marginTop: "var(--s-6)" }}>
        <h2 id="principles-heading" style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Yang membuat berbeda</h2>
        <div className="grid grid--2">
          {WORKER_PRINCIPLES.map((item) => (
            <div className="card" key={item.title} style={{ padding: "var(--s-4)" }}>
              <h3 style={{ fontSize: 13, margin: 0 }}>{item.title}</h3>
              <p className="small muted" style={{ margin: "4px 0 0" }}>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="banner" role="note" style={{ marginTop: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
          <span>
            <strong>Policy Validator bukan agent kelima.</strong> Ia mesin governance deterministik yang memeriksa
            izin, kebijakan, dan kelayakan tindakan — bukan AI yang menilai sendiri.
          </span>
        </div>
      </section>
    </>
  );
}

export default async function OfficeAgentPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; worker?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim().toLowerCase();
  const statusFilter = (params.status ?? "").trim();
  const workerSlug = (params.worker ?? "").trim();
  const worker = workerSlug ? findWorker(workerSlug) : undefined;

  const head = (
    <header className="page-head">
      <div className="page-head__text">
        <h1>Office Agent</h1>
        <p>
          Tim pekerja AI di dalam DEXTRA: ada yang mengatur pekerjaan, menjadi sekretaris, mengurus administrasi, dan
          mengaudit hasilnya. Manusia tetap pemegang keputusan dan wewenang.
        </p>
      </div>
    </header>
  );

  // Langkah 1: belum ada worker terpilih (atau slug-nya tidak dikenal).
  if (!worker) {
    return (
      <>
        {head}

        {workerSlug ? (
          <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <span>
              <strong>Worker tidak dikenal.</strong> Tidak ada worker dengan slug{" "}
              <code className="mono mono--wrap">{workerSlug}</code>. Pilih salah satu worker di bawah.
            </span>
          </div>
        ) : null}

        <section aria-labelledby="worker-picker-heading">
          <div className="row" style={{ justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap" }}>
            <h2 id="worker-picker-heading" style={{ fontSize: 15, margin: 0 }}>Pilih worker</h2>
            <span className="tiny muted">Langkah 1 dari 2</span>
          </div>
          <p className="small muted" style={{ margin: "4px 0 var(--s-4)", maxWidth: "68ch" }}>
            Tentukan dulu worker yang menangani rencana ini. Setelah itu Anda mengisi tugasnya.
          </p>

          <div className="grid grid--4">
            {WORKERS.map((option: Worker) => (
              <div className="card spec-card worker-card" key={option.slug}>
                <div className="spec-card__top">
                  <AgentAvatar slug={option.slug} name={option.name} size="lg" />
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <h3 style={{ margin: 0 }}>{option.name}</h3>
                    <div className="role">{option.role}</div>
                  </div>
                </div>
                <p className="spec-card__desc" style={{ margin: 0 }}>{option.summary}</p>
                <ul className="worker-examples">
                  {option.examples.slice(0, 2).map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
                <CapabilityChips capabilities={[...option.capabilities]} />
                <div className="worker-card__actions">
                  <Link
                    href={`/office-agent?worker=${encodeURIComponent(option.slug)}`}
                    className="btn btn--primary btn--block"
                    style={{ minHeight: 44 }}
                  >
                    Pilih worker
                  </Link>
                  <Link
                    href={`/assistant?worker=${encodeURIComponent(option.slug)}`}
                    className="btn btn--ghost btn--block"
                    style={{ minHeight: 44 }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
                    Spawn di AI Assistant
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <TeamBrief />
      </>
    );
  }

  // Langkah 2: worker terpilih, jadi formulir dan daftar rencana baru relevan.
  const result = await apiGet<{ items: PlanItem[] }>("/office-agent/plans");

  const items = result.ok
    ? result.data.items.filter((p) => {
        const matchQ = !q || p.plan_id.toLowerCase().includes(q) || p.request_id.toLowerCase().includes(q);
        const matchStatus = !statusFilter || p.status === statusFilter;
        return matchQ && matchStatus;
      })
    : [];

  return (
    <>
      {head}

      <section className="card" aria-labelledby="worker-panel-heading" style={{ marginBottom: "var(--s-4)" }}>
        <div className="card__head worker-panel__head">
          <AgentAvatar slug={worker.slug} name={worker.name} size="xl" />
          <div style={{ minWidth: 0 }}>
            <h2 id="worker-panel-heading" style={{ fontSize: 15, margin: 0 }}>{worker.name}</h2>
            <div className="tiny muted">{worker.role} · {worker.type}</div>
          </div>
          <span className="spacer" />
          <Link className="btn btn--secondary" href="/office-agent" style={{ minHeight: 44 }}>
            Ganti worker
          </Link>
        </div>
        <div className="card__body" style={{ display: "grid", gap: "var(--s-3)" }}>
          <p className="small" style={{ margin: 0 }}>{worker.summary}</p>
          <ul className="worker-examples">
            {worker.examples.map((example) => (
              <li key={example}>{example}</li>
            ))}
          </ul>
          <CapabilityChips capabilities={[...worker.capabilities]} />
          <p className="field__hint" style={{ margin: 0 }}>
            Pilihan ini menentukan tipe tindakan awal dan dicatat pada rencana. Eksekusi tetap lewat mandat dan
            persetujuan manusia. Ingin mengobrol dulu dengan worker ini?{" "}
            <Link href={`/assistant?worker=${encodeURIComponent(worker.slug)}`}>Spawn di AI Assistant</Link>.
          </p>
        </div>
      </section>

      {/* key: berganti worker harus mengulang formulir, supaya tipe tindakan awal ikut worker baru. */}
      <PlanIntakeForm key={worker.slug} worker={worker} />

      <section aria-labelledby="plans-heading" style={{ marginTop: "var(--s-5)" }}>
        <h2 id="plans-heading" style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Rencana tersimpan</h2>

        <form method="get" className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }} role="search" aria-label="Saring rencana">
          <input type="hidden" name="worker" value={worker.slug} />
          <div style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="field">
              <label className="field__label" htmlFor="plan-q">Cari plan / request</label>
              <input className="input" id="plan-q" name="q" defaultValue={params.q ?? ""} placeholder="pln-… atau req-…" style={{ minHeight: 44 }} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="plan-status">Status</label>
              <select className="select" id="plan-status" name="status" defaultValue={statusFilter} style={{ minHeight: 44 }}>
                <option value="">Semua status</option>
                <option value="received">received</option>
                <option value="partially_approved">partially_approved</option>
                <option value="rejected">rejected</option>
                <option value="completed">completed</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn--secondary" style={{ minHeight: 44 }}>
                <span className="material-symbols-outlined" aria-hidden="true">filter_alt</span>Terapkan
              </button>
            </div>
          </div>
          {(q || statusFilter) && (
            <p className="field__hint" role="status" style={{ marginTop: "var(--s-2)" }}>
              Menampilkan {items.length} dari {result.ok ? result.data.items.length : 0} rencana. <Link href={`/office-agent?worker=${encodeURIComponent(worker.slug)}`}>Hapus saringan</Link>
            </p>
          )}
        </form>

        {!result.ok ? (
          <div className="banner banner--warning" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            <span><strong>Data tidak tersedia.</strong> {result.error}</span>
          </div>
        ) : items.length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">assignment</span>
            <span>{q || statusFilter ? "Tidak ada rencana yang cocok dengan saringan ini." : "Belum ada rencana. Kirim rencana pertama lewat formulir di atas."}</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Waktu</th><th>Plan</th><th>Actions</th><th>Temuan</th><th>Status</th></tr>
              </thead>
              <tbody>
                {items.map((plan) => (
                  <tr key={plan.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(plan.created_at)}</td>
                    <td>
                      <Link href={`/office-agent/${encodeURIComponent(plan.plan_id)}`} className="mono cell-title" title={plan.plan_id}>{plan.plan_id}</Link>
                      <div className="cell-sub mono" title={plan.request_id}>req: {plan.request_id}</div>
                    </td>
                    <td className="num">{plan.actions.length}</td>
                    <td className="num">{plan.findings.length}</td>
                    <td><span className={`badge ${STATUS_TONE[plan.status] ?? "badge--outline"}`}>{plan.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="field__hint" style={{ marginTop: "var(--s-4)" }}>
        Rencana masuk lewat <code className="mono">POST /api/v1/office-agent/plans</code>. Setiap persetujuan menerbitkan mandat; eksekusi lewat <Link href="/executions">Monitor Eksekusi</Link>.
      </p>

      <TeamBrief />
    </>
  );
}
