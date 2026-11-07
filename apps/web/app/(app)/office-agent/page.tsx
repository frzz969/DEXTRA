import Link from "next/link";
import { apiGet } from "@/lib/api";
import PlanIntakeForm from "./PlanIntakeForm";

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

export default async function OfficeAgentPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim().toLowerCase();
  const statusFilter = (params.status ?? "").trim();
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
      <header className="page-head">
        <div className="page-head__text">
          <h1>Office Agent</h1>
          <p>Ubah permintaan menjadi rencana. Periksa tindakan dan temuan, lalu putuskan satu per satu — mandat terbit saat disetujui. Tidak ada yang berjalan tanpa persetujuan.</p>
        </div>
      </header>

      <PlanIntakeForm />

      <section aria-labelledby="plans-heading" style={{ marginTop: "var(--s-5)" }}>
        <h2 id="plans-heading" style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Rencana tersimpan</h2>

        <form method="get" className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }} role="search" aria-label="Saring rencana">
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
              Menampilkan {items.length} dari {result.ok ? result.data.items.length : 0} rencana. <Link href="/office-agent">Hapus saringan</Link>
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
    </>
  );
}
