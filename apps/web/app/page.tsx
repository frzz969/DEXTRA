import Link from "next/link";
import { getOverview, getWorkPackages, getAuditEvents, getAgents, getApprovals, getMandates, getExecutions } from "@/lib/api";
import { Badge, FilterForm, Greeting, UnavailableBanner, fmtDateTime } from "@/components/p1";

export const dynamic = "force-dynamic";

const KPI_META: Record<string, { label: string; icon: string; tone?: string }> = {
  active_agents: { label: "Agen aktif", icon: "smart_toy", tone: "kpi--accent" },
  open_work_packages: { label: "Work package terbuka", icon: "inventory_2" },
  pending_approvals: { label: "Approval menunggu", icon: "hourglass_top", tone: "kpi--warn" },
  failed_executions: { label: "Eksekusi gagal", icon: "error", tone: "kpi--danger" },
  active_mandates: { label: "Mandate aktif", icon: "shield", tone: "kpi--success" }
};

function Chart7Days({ executions, error }: { executions: { started_at: string | null; status: string }[] | null; error?: string }) {
  if (!executions) return <UnavailableBanner title="Grafik 7 hari" error={error ?? "Endpoint eksekusi tidak tersedia."} />;
  if (executions.length === 0) return <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">monitoring</span><span>Belum ada eksekusi dalam 7 hari terakhir. Grafik kosong karena datanya memang kosong.</span></div>;
  const days: { label: string; count: number; failed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const rows = executions.filter((e) => e.started_at && new Date(e.started_at).toDateString() === key);
    days.push({ label: d.toLocaleDateString("id-ID", { weekday: "short" }), count: rows.length, failed: rows.filter((r) => r.status === "failed").length });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div role="img" aria-label={`Grafik eksekusi 7 hari: ${days.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--s-2)", minHeight: 120 }}>
        {days.map((d) => (
          <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>{d.count}</span>
            <div style={{ width: "100%", maxWidth: 44, height: Math.max(4, (d.count / max) * 96), background: d.failed === d.count && d.count > 0 ? "var(--danger-600)" : "var(--brand-600)", borderRadius: 6 }} title={`${d.label}: ${d.count} eksekusi, ${d.failed} gagal`} />
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{d.label}</span>
          </div>
        ))}
      </div>
      <p className="field__hint">Dihitung dari <code className="mono">started_at</code> eksekusi nyata. Tidak ada endpoint grafik khusus di backend.</p>
    </div>
  );
}

export default async function OverviewPage() {
  const [overview, wp, audit, agents, approvals, mandates, executions] = await Promise.all([
    getOverview(), getWorkPackages(), getAuditEvents(5), getAgents(), getApprovals(), getMandates(), getExecutions(200)
  ]);
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1><Greeting /></h1>
          <p>Ringkasan operasional. Semua angka dihitung dari database, bukan contoh.</p>
        </div>
        <div className="page-head__actions"><Link className="btn btn--secondary" href="/board" style={{ minHeight: 44 }}><span className="material-symbols-outlined" aria-hidden="true">view_kanban</span> Buka papan</Link></div>
      </header>

      {!overview.ok ? (
        <UnavailableBanner title="Overview" error={overview.error} />
      ) : (
        <>
          <section className="grid grid--4" aria-label="Indikator operasional" style={{ marginBottom: "var(--s-5)" }}>
            {Object.entries(overview.data.kpi).map(([key, value]) => {
              const meta = KPI_META[key];
              return (
                <div className={`card kpi ${meta?.tone ?? ""}`} key={key}>
                  <div className="kpi__top"><span className="kpi__label">{meta?.label ?? key}</span><span className="kpi__icon" aria-hidden="true"><span className="material-symbols-outlined">{meta?.icon ?? "data_usage"}</span></span></div>
                  <div className="kpi__value">{value}</div>
                </div>
              );
            })}
          </section>
          <div className="banner" style={{ marginBottom: "var(--s-4)" }}><span className="material-symbols-outlined" aria-hidden="true">schedule</span><span>Data diambil pada {fmtDateTime(overview.data.generated_at)} · scope <code className="mono">{overview.data.scope}</code></span></div>
          {overview.data.unavailable.length > 0 && <div className="banner banner--warning"><span className="material-symbols-outlined" aria-hidden="true">warning</span><span>Belum dapat dihitung: {overview.data.unavailable.join(", ")}. Metrik ini tidak ditampilkan sebagai angka karena datanya belum ada.</span></div>}
        </>
      )}

      <section aria-labelledby="chart-h" style={{ marginTop: "var(--s-5)" }}>
        <h2 id="chart-h">Eksekusi 7 hari</h2>
        <div className="card card--pad" style={{ marginTop: "var(--s-3)" }}>
          <Chart7Days executions={executions.ok ? executions.data.items : null} error={executions.ok ? undefined : executions.error} />
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginTop: "var(--s-5)" }}>
        <section aria-labelledby="wp-h">
          <h2 id="wp-h">Work package terbaru</h2>
          <div className="card card--pad" style={{ marginTop: "var(--s-3)" }}>
            {!wp.ok ? <UnavailableBanner title="Work package" error={wp.error} /> : wp.data.items.length === 0 ? <p className="field__hint">Belum ada work package.</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--s-2)" }}>
                {wp.data.items.slice(0, 5).map((p) => <li key={p.id}><Link href={`/work-packages/${p.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, minHeight: 44, alignItems: "center" }}><span className="cell-title">{p.title}</span><Badge value={p.status} /></Link></li>)}
              </ul>
            )}
            <p style={{ marginTop: "var(--s-3)" }}><Link href="/work-packages">Lihat semua →</Link></p>
          </div>
        </section>

        <section aria-labelledby="wf-h">
          <h2 id="wf-h">Workforce</h2>
          <div className="card card--pad" style={{ marginTop: "var(--s-3)" }}>
            {!agents.ok ? <UnavailableBanner title="Workforce" error={agents.error} /> : agents.data.items.length === 0 ? <p className="field__hint">Belum ada agen terdaftar.</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--s-2)" }}>
                {agents.data.items.map((a) => <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{a.display_name} <span className="cell-sub mono">{a.slug}</span></span><Badge value={a.status} /></li>)}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="aq-h">
          <h2 id="aq-h">Approval queue</h2>
          <div className="card card--pad" style={{ marginTop: "var(--s-3)" }}>
            {!approvals.ok ? <UnavailableBanner title="Approval" error={approvals.error} /> : approvals.data.items.length === 0 ? <p className="field__hint">Tidak ada keputusan approval tercatat.</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--s-2)" }}>
                {approvals.data.items.slice(0, 5).map((a) => <li key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span className="mono">{a.plan_id}</span><Badge value={a.decision} /></li>)}
              </ul>
            )}
            <p style={{ marginTop: "var(--s-3)" }}><Link href="/approvals">Buka approval →</Link></p>
          </div>
        </section>

        <section aria-labelledby="gov-h">
          <h2 id="gov-h">Status governance</h2>
          <div className="card card--pad" style={{ marginTop: "var(--s-3)" }}>
            {!mandates.ok ? <UnavailableBanner title="Mandate" error={mandates.error} /> : mandates.data.items.length === 0 ? <p className="field__hint">Belum ada mandate.</p> : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--s-2)" }}>
                {mandates.data.items.slice(0, 5).map((m) => <li key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span className="mono">{m.id}</span><Badge value={m.status} /></li>)}
              </ul>
            )}
            <p style={{ marginTop: "var(--s-3)" }}><Link href="/mandates">Lihat mandate →</Link></p>
          </div>
        </section>
      </div>

      <section aria-labelledby="audit-h" style={{ marginTop: "var(--s-5)" }}>
        <h2 id="audit-h">Audit terbaru</h2>
        <div className="card card--pad" style={{ marginTop: "var(--s-3)" }}>
          {!audit.ok ? <UnavailableBanner title="Audit" error={audit.error} /> : audit.data.items.length === 0 ? <p className="field__hint">Belum ada event audit.</p> : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "var(--s-2)" }}>
              {audit.data.items.map((e) => <li key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span><strong>{e.event_type}</strong> · {e.actor} · {e.action}</span><span className="cell-sub mono">{fmtDateTime(e.at)}</span></li>)}
            </ul>
          )}
          <p style={{ marginTop: "var(--s-3)" }}><Link href="/audit">Buka audit →</Link></p>
        </div>
      </section>
    </>
  );
}
