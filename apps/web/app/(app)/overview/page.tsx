import Link from "next/link";
import {
  getAnalyticsDaily,
  getApprovals,
  getOverview,
  getPermissions,
  getPolicies,
  getWorkPackages,
  getAuditEvents,
  getAgents,
  getMandates,
  getExecutions,
  type AnalyticsDay,
} from "@/lib/api";
import { Badge, fmtDateTime, UnavailableBanner } from "@/components/p1";
import { mcpHealth } from "@/lib/mcp";

export const dynamic = "force-dynamic";

/* ---------- sparkline 7 hari (dari /analytics/daily) ---------- */

function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const w = 120;
  const h = 30;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg className="kpi__spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
  foot,
  spark,
}: {
  label: string;
  value: number;
  icon: string;
  tone: string;
  foot: string;
  spark: { values: number[]; color: string; label: string };
}) {
  return (
    <div className={`card kpi ${tone}`} role="group" aria-label={`${label}: ${value}`}>
      <div className="kpi__top">
        <span className="kpi__label">{label}</span>
        <span className="kpi__icon" aria-hidden="true"><span className="material-symbols-outlined">{icon}</span></span>
      </div>
      <div className="kpi__value">{value}</div>
      <div className="kpi__foot">
        <span className="material-symbols-outlined" aria-hidden="true">{icon === "pending_actions" ? "person" : icon === "block" ? "policy" : icon === "task_alt" ? "verified_user" : "schedule"}</span>
        <span>{foot}</span>
      </div>
      <Sparkline values={spark.values} color={spark.color} label={spark.label} />
    </div>
  );
}

/* ---------- chart aktivitas 7 hari ---------- */

function ActivityChart({ daily }: { daily: AnalyticsDay[] }) {
  const labels = daily.map((d) => {
    const dt = new Date(`${d.date}T00:00:00Z`);
    return `${dt.getUTCDate()}/${dt.getUTCMonth() + 1}`;
  });
  const series = [
    { name: "Dieksekusi", color: "var(--brand-500)", values: daily.map((d) => d.total) },
    { name: "Berhasil", color: "var(--success-600)", values: daily.map((d) => d.succeeded) },
    { name: "Diblokir", color: "var(--danger-600)", values: daily.map((d) => d.blocked) },
    { name: "Gagal", color: "var(--warning-600)", values: daily.map((d) => d.failed) },
  ];
  const maxData = Math.max(...daily.map((d) => d.total), 0);
  const max = Math.max(4, maxData);
  const W = 720;
  const H = 200;
  const padL = 28;
  const padB = 22;
  const padT = 8;
  const iw = W - padL - 8;
  const ih = H - padT - padB;
  const x = (i: number) => padL + (daily.length > 1 ? (i / (daily.length - 1)) * iw : 0);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const grid = [0, 1, 2, 3, 4].map((n) => Math.round((max * n) / 4));
  const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h2>Aktivitas eksekusi &amp; keputusan</h2>
          <p>Tujuh hari terakhir, dihitung dari eksekusi nyata</p>
        </div>
        <span className="spacer" />
        <span className="badge badge--outline">
          <span className="material-symbols-outlined" style={{ fontSize: 13 }} aria-hidden="true">receipt_long</span>
          Sumber: /analytics/daily
        </span>
      </div>
      <div className="card__body">
        <div className="chart-legend" style={{ marginBottom: 10 }}>
          {series.map((s) => (
            <span key={s.name}><i style={{ background: s.color }} aria-hidden="true" />{s.name}</span>
          ))}
          <span className="spacer" />
          <span className="tiny faint">Klik titik untuk detail nilai</span>
        </div>
        <div className="chart-box">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafik aktivitas 7 hari. ${series.map((s, i) => `${s.name} total ${totals[i]}`).join(", ")}`}>
            {grid.map((g) => (
              <g key={g}>
                <line x1={padL} x2={W - 8} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeDasharray="3 4" />
                <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize="10" fill="var(--faint)">{g}</text>
              </g>
            ))}
            {labels.map((l, i) => (
              <text key={l + i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--faint)">{l}</text>
            ))}
            {series.map((s) =>
              s.values.every((v) => v === 0) ? (
                <line key={s.name} x1={padL} x2={W - 8} y1={y(0)} y2={y(0)} stroke={s.color} strokeWidth="1.5" />
              ) : (
                <polyline
                  key={s.name}
                  points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                >
                  <title>{`${s.name}: ${s.values.map((v, i) => `${labels[i]} = ${v}`).join(", ")}`}</title>
                </polyline>
              )
            )}
          </svg>
        </div>
        <div className="row" style={{ marginTop: 14, gap: 18, flexWrap: "wrap" }}>
          {series.map((s, i) => (
            <div key={s.name}>
              <div className="tiny muted">Total {s.name.toLowerCase()}</div>
              <div className="strong" style={{ fontSize: 16 }}>{totals[i]}</div>
            </div>
          ))}
          <div className="spacer" />
          <Link className="btn btn--ghost btn--sm" href="/audit">
            Buka audit trail<span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- kartu antrean / tata kelola / workforce ---------- */

function QueueCard({ pending, ok, error }: { pending: { id: string; plan_id: string }[]; ok: boolean; error?: string }) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h2>Antrean persetujuan</h2>
          <p>{ok ? `${pending.length} menunggu keputusan manusia` : "Sumber antrean tidak merespons"}</p>
        </div>
        <span className="spacer" />
        {ok && <span className="badge badge--warning">{pending.length}</span>}
      </div>
      {!ok ? (
        <div className="card__body"><UnavailableBanner title="Antrean persetujuan" error={error ?? "Endpoint approval tidak tersedia."} /></div>
      ) : pending.length === 0 ? (
        <div className="empty">
          <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">done_all</span></div>
          <h3>Antrean bersih</h3>
          <p>Tidak ada work package yang menunggu keputusan Anda.</p>
        </div>
      ) : (
        <div className="card__body card__body--flush">
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pending.slice(0, 4).map((a) => (
              <li key={a.id} style={{ padding: "9px 20px", borderBottom: "1px solid var(--border)" }}>
                <span className="mono">{a.plan_id}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="card__foot">
        <Link className="btn btn--primary btn--sm btn--block" href="/approvals">
          <span className="material-symbols-outlined" aria-hidden="true">assignment_turned_in</span>Buka approval inbox
        </Link>
      </div>
    </div>
  );
}

function GovernanceCard({
  mandatesActive,
  mandatesOk,
  policiesActive,
  policiesTotal,
  policiesOk,
  blocked7,
  mcpUp,
}: {
  mandatesActive: number;
  mandatesOk: boolean;
  policiesActive: number;
  policiesTotal: number;
  policiesOk: boolean;
  blocked7: number;
  mcpUp: boolean;
}) {
  const row = (icon: string, color: string, title: string, sub: string, right: React.ReactNode) => (
    <div className="row">
      <span className="material-symbols-outlined" style={{ fontSize: 18, color }} aria-hidden="true">{icon}</span>
      <div style={{ flex: 1 }}><div className="small strong">{title}</div><div className="tiny muted">{sub}</div></div>
      {right}
    </div>
  );
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h2>Status tata kelola</h2>
          <p>Batas wewenang yang sedang berlaku</p>
        </div>
      </div>
      <div className="card__body">
        <div className="stack" style={{ gap: 14 }}>
          {row("verified_user", "var(--success-600)", "Mandat aktif", "Terikat plan_hash, satu kali pakai",
            <span className="strong">{mandatesOk ? mandatesActive : "—"}</span>)}
          {row("policy", "var(--brand-600)", "Kebijakan aktif", policiesOk ? `${policiesTotal - policiesActive} nonaktif dalam uji coba` : "Sumber kebijakan tidak merespons",
            <span className="strong">{policiesOk ? `${policiesActive}/${policiesTotal}` : "—"}</span>)}
          {row("dns", mcpUp ? "var(--success-600)" : "var(--warning-600)", "Gateway MCP :8765", mcpUp ? "Terhubung ke server MCP lokal" : "Tidak merespons",
            <span className={`badge ${mcpUp ? "badge--success" : "badge--warning"}`}>{mcpUp ? "Live" : "Offline"}</span>)}
          <div className="divider" style={{ margin: "2px 0" }} />
          {row("report", "var(--danger-600)", "Diblokir", "Eksekusi diblokir 7 hari terakhir",
            <span className="strong">{blocked7}</span>)}
        </div>
        <div className="banner banner--info" style={{ marginTop: 14 }}>
          <span className="material-symbols-outlined" aria-hidden="true">shield_lock</span>
          <div>Local-only service exposure · scoped execution authorization</div>
        </div>
      </div>
    </div>
  );
}

function WorkforceCard({ agents, ok, error }: { agents: { id: string; display_name: string; slug: string }[]; ok: boolean; error?: string }) {
  return (
    <div className="card">
      <div className="card__head">
        <div>
          <h2>Workforce</h2>
          <p>Spesialis AI, dibaca dari GET /agents</p>
        </div>
        <span className="spacer" />
        <Link className="icon-btn" href="/agents" title="Buka workforce" aria-label="Buka workforce">
          <span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span>
        </Link>
      </div>
      <div className="card__body">
        {!ok ? (
          <UnavailableBanner title="Workforce" error={error ?? "Endpoint agen tidak tersedia."} />
        ) : agents.length === 0 ? (
          <p className="small muted">Belum ada agen terdaftar.</p>
        ) : (
          <div>
            {agents.map((a) => (
              <Link key={a.id} href="/agents" className="row" style={{ padding: "9px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="spec-avatar" style={{ width: 30, height: 30, borderRadius: 8 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden="true">smart_toy</span>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="small strong truncate">{a.display_name}</div>
                  <div className="tiny muted truncate">{a.slug}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- halaman ---------- */

export default async function OverviewPage() {
  const [overview, daily, wp, audit, agents, approvals, mandates, policies, permissions, executions, mcpUp] = await Promise.all([
    getOverview(),
    getAnalyticsDaily(),
    getWorkPackages(),
    getAuditEvents(5),
    getAgents(),
    getApprovals(),
    getMandates(),
    getPolicies(),
    getPermissions(),
    getExecutions(50),
    mcpHealth(),
  ]);

  const days: AnalyticsDay[] = daily.ok
    ? daily.data.items
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const iso = d.toISOString().slice(0, 10);
        return { date: iso, total: 0, succeeded: 0, failed: 0, blocked: 0, pending: 0, running: 0, skipped: 0 };
      });
  const execSeries = days.map((d) => d.total);
  const pendingSeries = days.map((d) => d.pending);
  const blockedSeries = days.map((d) => d.blocked);
  const exec7 = execSeries.reduce((a, b) => a + b, 0);
  const blocked7 = blockedSeries.reduce((a, b) => a + b, 0);

  const kpi = overview.ok ? overview.data.kpi : null;
  const awaiting = kpi?.pending_approvals ?? 0;

  const h = new Date().getHours();
  const greeting = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
  const principal = permissions.ok ? permissions.data.principal : null;
  const humanName = principal?.display_name?.trim();
  const firstName = humanName && !/^gateway\b/i.test(humanName) ? humanName.split(/\s+/)[0] : null;

  const pendingApprovals = approvals.ok
    ? approvals.data.items.filter((a) => a.decision === "pending")
    : [];

  const attention = executions.ok
    ? executions.data.items
        .filter((e) => e.status === "failed" || e.status === "blocked")
        .slice(0, 3)
        .map((e) => ({
          icon: e.status === "blocked" ? "block" : "error",
          tone: e.status === "blocked" ? "danger" : "warning",
          title: `${e.plan_id ?? e.id} ${e.status === "blocked" ? "diblokir" : "gagal"}`,
          body: e.result ?? "Eksekusi tidak selesai.",
          href: "/executions",
        }))
    : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <span className="page-head__eyebrow">Workspace · Overview</span>
          <h1>Overview</h1>
          <p>
            {greeting}{firstName ? `, ${firstName}` : ""}.{" "}
            {overview.ok
              ? awaiting
                ? <><b>{awaiting} work package menunggu keputusan Anda</b> dan {blocked7} diblokir 7 hari terakhir.</>
                : "Tidak ada keputusan yang menunggu."
              : "Ringkasan operasional belum dapat dimuat."}
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/board">
            <span className="material-symbols-outlined" aria-hidden="true">view_kanban</span>Task board
          </Link>
          <Link className="btn btn--primary" href="/assistant">
            <span className="material-symbols-outlined" aria-hidden="true">add</span>Buat permintaan
          </Link>
        </div>
      </header>

      {!overview.ok ? (
        <UnavailableBanner title="Overview" error={overview.error} />
      ) : (
        <>
          <div className="banner" style={{ marginBottom: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
            <span>Data diambil pada {fmtDateTime(overview.data.generated_at)} · scope <code className="mono">{overview.data.scope}</code></span>
          </div>
          {overview.data.unavailable.length > 0 && (
            <div className="banner banner--warning" style={{ marginBottom: "var(--s-4)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">warning</span>
              <span>Belum dapat dihitung: {overview.data.unavailable.join(", ")}. Metrik ini tidak ditampilkan sebagai angka karena datanya belum ada.</span>
            </div>
          )}
          <section className="grid grid--4" aria-label="Indikator operasional" style={{ marginBottom: "var(--s-5)" }}>
            <KpiCard label="Work package aktif" value={kpi?.open_work_packages ?? 0} icon="layers" tone="kpi--accent"
              foot={`${awaiting} masih dalam proses`} spark={{ values: execSeries, color: "var(--brand-500)", label: "Tren eksekusi 7 hari" }} />
            <KpiCard label="Menunggu persetujuan" value={awaiting} icon="pending_actions" tone="kpi--warn"
              foot="Butuh keputusan manusia" spark={{ values: pendingSeries, color: "var(--warning-600)", label: "Tren eksekusi menunggu 7 hari" }} />
            <KpiCard label="Diblokir kebijakan" value={blocked7} icon="block" tone="kpi--danger"
              foot="Eksekusi diblokir 7 hari terakhir" spark={{ values: blockedSeries, color: "var(--danger-600)", label: "Tren eksekusi diblokir 7 hari" }} />
            <KpiCard label="Dieksekusi 7 hari" value={exec7} icon="task_alt" tone="kpi--success"
              foot="Seluruhnya dengan mandat" spark={{ values: execSeries, color: "var(--success-600)", label: "Tren eksekusi 7 hari" }} />
          </section>
        </>
      )}

      {!daily.ok && (
        <div className="banner banner--warning" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <span>Chart 7 hari memakai data kosong karena <code className="mono">/analytics/daily</code> tidak merespons: {daily.error}</span>
        </div>
      )}

      <div className="grid grid--sidebar">
        <div className="stack">
          <ActivityChart daily={days} />

          <div className="card">
            <div className="card__head">
              <div>
                <h2>Work package terbaru</h2>
                <p>Enam pembaruan terakhir di seluruh workspace</p>
              </div>
              <span className="spacer" />
              <Link className="btn btn--secondary btn--sm" href="/work-packages">Lihat semua</Link>
            </div>
            <div className="card__body card__body--flush">
              {!wp.ok ? (
                <div style={{ padding: "var(--s-4)" }}><UnavailableBanner title="Work package" error={wp.error} /></div>
              ) : wp.data.items.length === 0 ? (
                <div className="empty">
                  <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span></div>
                  <h3>Belum ada work package</h3>
                  <p>Belum ada work package yang tercatat di workspace ini.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>ID</th><th>Work package</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {wp.data.items.slice(0, 6).map((p) => (
                        <tr key={p.id}>
                          <td><span className="mono faint">{p.id}</span></td>
                          <td><Link href={`/work-packages/${p.id}`} className="cell-title">{p.title}</Link></td>
                          <td><Badge value={p.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid--2">
            <div className="card">
              <div className="card__head">
                <div>
                  <h2>Audit terakhir</h2>
                  <p>Append-only, tidak dapat diubah</p>
                </div>
                <span className="spacer" />
                <Link className="btn btn--ghost btn--sm" href="/audit">Semua</Link>
              </div>
              <div className="card__body">
                {!audit.ok ? (
                  <UnavailableBanner title="Audit" error={audit.error} />
                ) : audit.data.items.length === 0 ? (
                  <p className="small muted">Belum ada event audit.</p>
                ) : (
                  audit.data.items.map((e) => (
                    <div key={e.id} className="row" style={{ alignItems: "flex-start", gap: 9, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span className="tl-dot" style={{ width: 18, height: 18, flex: "0 0 auto" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }} aria-hidden="true">history</span>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tiny strong">{e.event_type.replace(/_/g, " ")}</div>
                        <div className="tiny muted truncate">{e.actor ?? "—"} · {e.action ?? "—"}</div>
                      </div>
                      <span className="tiny faint nowrap">{fmtDateTime(e.at)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <div>
                  <h2>Perlu perhatian</h2>
                  <p>Hal yang tidak dapat diselesaikan sistem sendiri</p>
                </div>
              </div>
              <div className="card__body">
                {!executions.ok ? (
                  <UnavailableBanner title="Perhatian" error={executions.error} />
                ) : attention.length === 0 ? (
                  <div className="empty" style={{ padding: "var(--s-4)" }}>
                    <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">check_circle</span></div>
                    <h3>Tidak ada yang mendesak</h3>
                    <p>Semua item berada dalam alur normal.</p>
                  </div>
                ) : (
                  attention.map((it, i) => (
                    <Link key={i} href={it.href} className="row" style={{ alignItems: "flex-start", gap: 10, padding: 10, borderRadius: 9, border: "1px solid var(--border)", marginBottom: 8 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 7, flex: "0 0 auto", display: "grid", placeItems: "center",
                        background: it.tone === "danger" ? "var(--danger-100)" : "var(--warning-100)",
                        color: it.tone === "danger" ? "var(--danger-600)" : "var(--warning-600)",
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }} aria-hidden="true">{it.icon}</span>
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="small strong">{it.title}</div>
                        <div className="tiny muted" style={{ lineHeight: 1.45 }}>{it.body}</div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <QueueCard pending={pendingApprovals} ok={approvals.ok} error={approvals.ok ? undefined : approvals.error} />
          <GovernanceCard
            mandatesActive={kpi?.active_mandates ?? 0}
            mandatesOk={overview.ok}
            policiesActive={policies.ok ? policies.data.items.filter((p) => p.is_active).length : 0}
            policiesTotal={policies.ok ? policies.data.items.length : 0}
            policiesOk={policies.ok}
            blocked7={blocked7}
            mcpUp={mcpUp}
          />
          <WorkforceCard agents={agents.ok ? agents.data.items.map((a) => ({ id: a.id, display_name: a.display_name, slug: a.slug })) : []} ok={agents.ok} error={agents.ok ? undefined : agents.error} />
        </div>
      </div>
    </>
  );
}
