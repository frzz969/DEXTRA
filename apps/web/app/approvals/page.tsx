import { apiGet, getOfficePlans, type OfficePlan } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";
import Link from "next/link";
import ChallengePanel from "./ChallengePanel";
import PlanActionButtons from "./PlanActionButtons";

export const dynamic = "force-dynamic";

type ApprovalItem = {
  id: string;
  plan_id: string;
  approver_id: string | null;
  decision: string;
  reason: string | null;
  decided_at: string | null;
  mandate_id: string | null;
};

type Plan = OfficePlan;

const DECISION_TONE: Record<string, string> = {
  approved: "badge--success",
  rejected: "badge--danger",
  revision: "badge--warning",
};

function fmtAt(at: string | null): string {
  if (!at) return "—";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });
}

function fmtParams(params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) return "—";
  return JSON.stringify(params);
}

/** Plan yang masih butuh keputusan: belum rejected. */
function isPending(p: Plan): boolean {
  return !/reject|expired/i.test(p.status ?? "");
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<{ plan?: string }>;
}) {
  const [decisions, plans] = await Promise.all([
    apiGet<{ items: ApprovalItem[]; note?: string }>("/approvals"),
    getOfficePlans(),
  ]);
  const params = (await searchParams) ?? {};
  const focusPlan = (params.plan ?? "").trim();
  const pendingPlans = plans.ok ? plans.data.items.filter(isPending) : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Approval Inbox</h1>
          <p>Plan menunggu keputusan. Setujui untuk menerbitkan mandat; tolak untuk menghentikan.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn" href="/review">Lihat Review &amp; Validation</Link>
        </div>
      </header>

      <h2 style={{ fontSize: 16, margin: "var(--s-4) 0 var(--s-3)" }}>Antrean plan</h2>
      {!plans.ok ? (
        <Unavailable title="Antrean plan" error={plans.error} />
      ) : pendingPlans.length === 0 ? (
        <EmptyState icon="fact_check" title="Tidak ada plan menunggu keputusan." body="Plan baru dari Office Agent akan muncul di sini." />
      ) : (
        pendingPlans.map((plan) => (
          <section
            key={plan.id}
            id={`plan-${plan.plan_id}`}
            className="card"
            style={{ marginBottom: "var(--s-4)", borderColor: focusPlan === plan.plan_id ? "var(--brand-500)" : undefined }}
            aria-label={`Plan ${plan.plan_id}`}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }} className="mono">{plan.plan_id}</h3>
              <span className="badge badge--warning">{plan.status}</span>
            </div>
            <p className="field__hint" style={{ margin: "var(--s-2) 0" }}>
              Hash: <span className="mono">{plan.plan_hash ?? "—"}</span> · {plan.actions.length} aksi
            </p>
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr><th>Aksi</th><th>Tipe</th><th>Params</th><th>Keputusan</th></tr>
                </thead>
                <tbody>
                  {plan.actions.map((action) => (
                    <tr key={action.action_id}>
                      <td className="mono">{action.action_id}</td>
                      <td>{action.action_type}</td>
                      <td className="truncate" style={{ maxWidth: 320 }} title={fmtParams(action.params)}>{fmtParams(action.params)}</td>
                      <td><PlanActionButtons planId={plan.plan_id} actionId={action.action_id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <h2 style={{ fontSize: 16, margin: "var(--s-6) 0 var(--s-3)" }}>Riwayat keputusan</h2>
      {!decisions.ok ? (
        <Unavailable title="Riwayat keputusan" error={decisions.error} />
      ) : decisions.data.items.length === 0 ? (
        <EmptyState icon="receipt_long" title="Belum ada keputusan tercatat." />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Waktu</th><th>Keputusan</th><th>Plan ID</th><th>Approver</th><th>Alasan</th><th>Mandat</th></tr>
              </thead>
              <tbody>
                {decisions.data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(item.decided_at)}</td>
                    <td><span className={`badge ${DECISION_TONE[item.decision?.toLowerCase()] ?? "badge--outline"}`}>{item.decision}</span></td>
                    <td className="mono truncate" style={{ maxWidth: 160 }} title={item.plan_id}>{item.plan_id}</td>
                    <td className="truncate" style={{ maxWidth: 140 }} title={item.approver_id ?? ""}>{item.approver_id ?? "—"}</td>
                    <td className="truncate" style={{ maxWidth: 280 }} title={item.reason ?? ""}>{item.reason ?? "—"}</td>
                    <td className="mono truncate" style={{ maxWidth: 160 }} title={item.mandate_id ?? ""}>{item.mandate_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {decisions.ok && decisions.data.note && (
        <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>{decisions.data.note}</p>
      )}

      <h2 style={{ fontSize: 16, margin: "var(--s-6) 0 var(--s-3)" }}>Challenge manual</h2>
      <ChallengePanel />
    </>
  );
}
