import Link from "next/link";
import { apiGet } from "@/lib/api";

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

export default async function OfficeAgentPage() {
  const result = await apiGet<{ items: PlanItem[] }>("/office-agent/plans");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Office Agent</h1>
          <p>Rencana yang didekomposisi dari dokumen masuk. Setujui atau tolak per tindakan; mandat terbit saat disetujui.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">assignment</span>
            <span>Belum ada rencana Office Agent masuk untuk tenant ini.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Plan</th>
                  <th>Actions</th>
                  <th>Temuan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((plan) => (
                  <tr key={plan.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(plan.created_at)}</td>
                    <td>
                      <Link href={`/office-agent/${encodeURIComponent(plan.plan_id)}`} className="mono cell-title" title={plan.plan_id}>
                        {plan.plan_id}
                      </Link>
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
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Data tidak tersedia.</strong> {result.error}
          </span>
        </div>
      )}

      <p className="field__hint" style={{ marginTop: "var(--s-4)" }}>
        Rencana masuk lewat Office Agent Gateway (dokumen → normalisasi → dekomposisi).
        Setiap persetujuan menerbitkan mandat; eksekusi dilakukan lewat <Link href="/executions">Monitor Eksekusi</Link>.
      </p>
    </>
  );
}
