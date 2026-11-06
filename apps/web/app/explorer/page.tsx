import Link from "next/link";
import {
  getAgents,
  getApprovals,
  getAuditEvents,
  getExecutions,
  getMandates,
  getOfficePlans,
  getSkills,
  getWorkPackages,
  getWorkflows
} from "@/lib/api";

export const dynamic = "force-dynamic";

/* Explorer mencari lintas entitas lewat API :8000. Backend belum punya
 * parameter pencarian di server, jadi daftar dari tiap endpoint disaring di
 * sini. Batasnya dicantumkan di halaman, bukan disembunyikan. */

const TABS = [
  { key: "plans", label: "Rencana", icon: "map" },
  { key: "mandates", label: "Mandat", icon: "assignment_turned_in" },
  { key: "executions", label: "Eksekusi", icon: "play_circle" },
  { key: "audit", label: "Audit", icon: "receipt_long" },
  { key: "all", label: "Semua", icon: "manage_search" }
] as const;

type TabKey = (typeof TABS)[number]["key"];

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function fmtAt(iso: unknown): string {
  if (typeof iso !== "string") return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(status: string): string {
  if (["succeeded", "active", "approved", "completed", "granted", "usable"].includes(status))
    return "badge--success";
  if (["failed", "blocked", "revoked", "rejected", "cancelled"].includes(status)) return "badge--danger";
  if (["pending", "draft", "running", "waiting_approval"].includes(status)) return "badge--warning";
  return "badge--info";
}

function matches(item: Record<string, unknown>, q: string): boolean {
  if (!q) return true;
  const haystack = Object.values(item)
    .map((v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)))
    .join(" ")
    .toLowerCase();
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function aHref(entity: string, q: string): string {
  const params = new URLSearchParams({ entity });
  if (q) params.set("q", q);
  return `/explorer?${params.toString()}`;
}

export default async function ExplorerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase().slice(0, 200);
  const tab = str(sp.entity);
  const entity: TabKey = (TABS.some((t) => t.key === tab) ? tab : "plans") as TabKey;

  const [plans, mandates, executions, audit, agents, skills, workflows, workPackages, approvals] =
    await Promise.all([
      getOfficePlans(),
      getMandates(),
      getExecutions(200),
      getAuditEvents(100),
      getAgents(),
      getSkills(),
      getWorkflows(),
      getWorkPackages(),
      getApprovals()
    ]);

  const sources = [
    { key: "plans", label: "Rencana", result: plans, items: plans.ok ? plans.data.items : [] },
    { key: "mandates", label: "Mandat", result: mandates, items: mandates.ok ? mandates.data.items : [] },
    { key: "executions", label: "Eksekusi", result: executions, items: executions.ok ? executions.data.items : [] },
    { key: "audit", label: "Audit", result: audit, items: audit.ok ? audit.data.items : [] },
    { key: "agents", label: "Agen", result: agents, items: agents.ok ? agents.data.items : [] },
    { key: "skills", label: "Skill", result: skills, items: skills.ok ? skills.data.items : [] },
    { key: "workflows", label: "Workflow", result: workflows, items: workflows.ok ? workflows.data.items : [] },
    { key: "work-packages", label: "Paket kerja", result: workPackages, items: workPackages.ok ? workPackages.data.items : [] },
    { key: "approvals", label: "Approval", result: approvals, items: approvals.ok ? approvals.data.items : [] }
  ] as const;

  const visible = entity === "all" ? sources : sources.filter((s) => s.key === entity);
  const failedSources = visible.filter((s) => !s.result.ok);

  const filtered = visible.map((s) => ({
    ...s,
    rows: (s.items as unknown as Record<string, unknown>[]).filter((item) => matches(item, q))
  }));
  const totalRows = filtered.reduce((n, s) => n + s.rows.length, 0);

  function renderTable(key: string, rows: Record<string, unknown>[]) {
    if (key === "plans") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Status</th>
              <th>Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.plan_id)}>
                <td className="mono">{String(r.plan_id)}</td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td className="mono">{fmtAt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "mandates") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Mandat</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Kedaluwarsa</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="mono">{String(r.id)}</td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td className="mono">{String(r.plan_id ?? "—")}</td>
                <td className="mono">{fmtAt(r.expires_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "executions") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Eksekusi</th>
              <th>Mandat</th>
              <th>Aksi</th>
              <th>Status</th>
              <th>Mulai</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="mono">{String(r.id)}</td>
                <td className="mono">{String(r.mandate_id ?? "—")}</td>
                <td className="mono">{String(r.action_id ?? "—")}</td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td className="mono">{fmtAt(r.started_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "audit") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Tipe</th>
              <th>Aktor</th>
              <th>Aksi</th>
              <th>Keputusan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  {fmtAt(r.at)}
                </td>
                <td>
                  <span className="badge badge--outline">{String(r.event_type ?? "—")}</span>
                </td>
                <td>{String(r.actor ?? "—")}</td>
                <td>{String(r.action ?? "—")}</td>
                <td>{String(r.decision ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "agents") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Agen</th>
              <th>Status</th>
              <th>Capability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>
                  <Link href={`/agents/${encodeURIComponent(String(r.slug))}`} className="cell-title mono">
                    {String(r.slug)}
                  </Link>
                  <div className="cell-sub">{String(r.display_name ?? "")}</div>
                </td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td className="truncate" style={{ maxWidth: 260 }} title={Array.isArray(r.capabilities) ? r.capabilities.join(", ") : ""}>
                  {Array.isArray(r.capabilities) ? r.capabilities.join(", ") || "—" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "skills") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Skill</th>
              <th>Status</th>
              <th>Versi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>
                  <Link href={`/skills/${encodeURIComponent(String(r.slug))}`} className="cell-title mono">
                    {String(r.slug)}
                  </Link>
                  <div className="cell-sub">{String(r.display_name ?? "")}</div>
                </td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td className="mono">{String(r.latest_version ?? "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "workflows") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Status</th>
              <th className="num">Langkah</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>
                  <div className="cell-title">{String(r.name)}</div>
                  <div className="cell-sub">{String(r.description || "—")}</div>
                </td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td className="num">{Array.isArray(r.steps) ? r.steps.length : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (key === "work-packages") {
      return (
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Paket</th>
              <th>Status</th>
              <th>Prioritas</th>
              <th className="num">Tugas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td className="cell-title">{String(r.title)}</td>
                <td>
                  <span className={`badge ${statusTone(String(r.status ?? ""))}`}>{String(r.status ?? "—")}</span>
                </td>
                <td>{String(r.priority ?? "—")}</td>
                <td className="num">{Number(r.task_count ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    return (
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Approval</th>
            <th>Plan</th>
            <th>Keputusan</th>
            <th>Diputus</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)}>
              <td className="mono">{String(r.id)}</td>
              <td className="mono">{String(r.plan_id ?? "—")}</td>
              <td>
                <span className={`badge ${statusTone(String(r.decision ?? ""))}`}>{String(r.decision ?? "—")}</span>
              </td>
              <td className="mono">{fmtAt(r.decided_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Explorer</h1>
          <p>
            Cari lintas entitas lewat API :8000. Backend belum punya pencarian di server, jadi daftar
            dari tiap endpoint disaring di sini.
          </p>
        </div>
      </header>

      <form
        className="row"
        role="search"
        style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center", flexWrap: "wrap" }}
        action="/explorer"
        method="get"
      >
        <input type="hidden" name="entity" value={entity} />
        <input
          className="input mono"
          type="search"
          name="q"
          aria-label="Kata kunci pencarian"
          placeholder="Cari id, nama, status, aktor…"
          defaultValue={q}
          style={{ flex: "1 1 260px", minHeight: 44 }}
        />
        <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>
          <span className="material-symbols-outlined" aria-hidden="true">
            search
          </span>
          Cari
        </button>
        {q ? (
          <Link className="btn btn--secondary" href={aHref(entity, "")} style={{ minHeight: 44 }}>
            Bersihkan
          </Link>
        ) : null}
      </form>

      <div
        role="tablist"
        aria-label="Entitas"
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "var(--s-4)" }}
      >
        {TABS.map((t) => {
          const active = t.key === entity;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              className={`btn ${active ? "btn--primary" : "btn--secondary"}`}
              style={{ minHeight: 44 }}
              href={aHref(t.key, q)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>

      <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
        Hasil untuk <code className="mono">{q || "—"}</code>: <strong>{totalRows}</strong> baris dari{" "}
        {filtered.length} entitas.
      </p>

      {failedSources.length > 0 ? (
        <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">
            cloud_off
          </span>
          <span>
            <strong>Belum terhubung untuk: {failedSources.map((s) => s.label).join(", ")}.</strong>{" "}
            {failedSources[0].result.ok ? "" : failedSources[0].result.error} Entitas lain tetap
            ditampilkan dari sumber yang merespons.
          </span>
        </div>
      ) : null}

      {totalRows === 0 ? (
        <div className="empty">
          <div className="empty__icon">
            <span className="material-symbols-outlined" aria-hidden="true">
              search_off
            </span>
          </div>
          <h3>Tidak ada hasil</h3>
          <p>
            {q ? (
              <>
                Tidak ada data cocok dengan <code className="mono">{q}</code>.
              </>
            ) : (
              "Belum ada data di entitas ini."
            )}
          </p>
        </div>
      ) : (
        filtered.map((s) =>
          s.rows.length === 0 ? null : (
            <section key={s.key} aria-label={s.label} style={{ marginBottom: "var(--s-5)" }}>
              <h2 style={{ fontSize: 14, margin: "0 0 var(--s-2)" }}>
                {s.label} <span className="cell-sub">({s.rows.length})</span>
              </h2>
              <div className="table-wrap">{renderTable(s.key, s.rows)}</div>
            </section>
          )
        )
      )}

      <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
        Halaman ini menampilkan hasil per entitas, bukan satu daftar gabungan. <strong>Approval dan
        Worker tidak ada di Explorer</strong> — jejak approval ada di tab Audit; roster worker ada di{" "}
        <code className="mono">workbuddy/agents/</code>. Batas baca: eksekusi 200 baris, audit 100 baris.
      </p>
    </>
  );
}
