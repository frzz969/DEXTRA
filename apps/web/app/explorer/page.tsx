import Link from "next/link";
import { mcpCall, mcpHealth } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "plans", label: "Rencana", icon: "map" },
  { key: "mandates", label: "Mandat", icon: "assignment_turned_in" },
  { key: "executions", label: "Eksekusi", icon: "play_circle" },
  { key: "audit", label: "Audit", icon: "receipt_long" }
] as const;

const ENTITY_STATUS: Record<string, string[]> = {
  plans: ["DRAFT", "READY", "NEEDS_REVIEW", "BLOCKED"],
  mandates: ["active", "expired", "revoked", "consumed"]
};

type Page<T> = { items: T[]; total: number; offset: number; limit: number };
type Any = Record<string, unknown>;

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function fmtAt(iso: unknown): string {
  if (typeof iso !== "string") return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(status: string): string {
  if (["READY", "active", "succeeded", "consumed"].includes(status)) return "badge--success";
  if (["BLOCKED", "revoked", "failed"].includes(status)) return "badge--danger";
  if (["DRAFT", "pending", "expired"].includes(status)) return "badge--outline";
  return "badge--info";
}

function aHref(entity: string, q: string, offset: number, status: string): string {
  const params = new URLSearchParams({ entity });
  if (q) params.set("q", q);
  if (offset > 0) params.set("offset", String(offset));
  if (status) params.set("status", status);
  return `/explorer?${params.toString()}`;
}

function Pager({ total, offset, limit, entity, q, status }: { total: number; offset: number; limit: number; entity: string; q: string; status: string }) {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const prev = Math.max(0, offset - limit);
  const next = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = next < total;
  return (
    <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: "var(--s-3)" }}>
      <span className="cell-sub">total <strong>{total}</strong> ditemukan · halaman {page} dari {pages}</span>
      <div className="row" style={{ gap: 6 }}>
        {hasPrev ? <Link className="btn btn--secondary" href={aHref(entity, q, prev, status)}><span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>Sebelumnya</Link> : null}
        {hasNext ? <Link className="btn btn--secondary" href={aHref(entity, q, next, status)}>Berikutnya<span className="material-symbols-outlined" aria-hidden="true">chevron_right</span></Link> : null}
      </div>
    </div>
  );
}

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).slice(0, 200);
  const tab = str(sp.entity);
  const entity = (TABS.some((t) => t.key === tab) ? tab : "plans") as (typeof TABS)[number]["key"];
  const status = str(sp.status);
  const offset = Math.max(0, Number.parseInt(str(sp.offset), 10) || 0);
  const limit = 25;

  const statuses = ENTITY_STATUS[entity] ?? [];
  const statusParam = statuses.includes(status) ? status : "";

  const [health, plans, mandates, executions, audit] = await Promise.all([
    mcpHealth(),
    entity === "plans" ? mcpCall<Any>("list_plans", { limit, offset, ...(q && { q }), ...(statusParam && { status: statusParam }) }) : Promise.resolve(null),
    entity === "mandates" ? mcpCall<Any>("list_mandates", { limit, offset, ...(q && { q }), ...(statusParam && { status: statusParam }) }) : Promise.resolve(null),
    entity === "executions" ? mcpCall<Any>("list_executions", { limit, offset, ...(q && { q }) }) : Promise.resolve(null),
    entity === "audit" ? mcpCall<Any>("get_audit_log", { limit, offset, ...(q && { q }) }) : Promise.resolve(null)
  ]);

  const result = plans ?? mandates ?? executions ?? audit;
  const data = result?.ok ? (result.data as { total: number; offset: number; limit: number } & Record<string, unknown[] | number>) : null;
  const total = data?.total ?? 0;
  const pageOffset = data?.offset ?? offset;
  const pageLimit = data?.limit ?? limit;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Explorer</h1>
          <p>Cari di setiap entitas secara terpisah. Pencarian tidak digabung lintas entitas; filter diterapkan di server sebelum paginasi.</p>
        </div>
        <div className="page-head__actions">
          <span className={`badge ${health ? "badge--success" : "badge--danger"}`} title={health ? "MCP gateway merespons di 127.0.0.1:8765" : "MCP gateway tidak merespons"}>
            {health ? "MCP live" : "MCP mati"}
          </span>
        </div>
      </header>

      <form className="row" role="search" style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center" }} action="/explorer" method="get">
        <input type="hidden" name="entity" value={entity} />
        {statusParam ? <input type="hidden" name="status" value={statusParam} /> : null}
        <input
          className="input mono"
          type="search"
          name="q"
          aria-label="Kata kunci pencarian"
          placeholder="Cari id, intent, status, aktor…"
          defaultValue={q}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn--primary">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          Cari
        </button>
        {q ? <Link className="btn btn--secondary" href={aHref(entity, "", 0, statusParam)}>Bersihkan</Link> : null}
      </form>

      <div role="tablist" aria-label="Entitas" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: "var(--s-4)" }}>
        {TABS.map((t) => {
          const active = t.key === entity;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              className={`btn ${active ? "btn--primary" : "btn--secondary"}`}
              href={aHref(t.key, q, 0, "")}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
        {statuses.length > 0 && (
          <form className="row" action="/explorer" method="get" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="hidden" name="entity" value={entity} />
            {q ? <input type="hidden" name="q" value={q} /> : null}
            <select className="select" name="status" defaultValue={statusParam} aria-label="Filter status">
              <option value="">Semua status</option>
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="submit" className="btn btn--secondary btn--sm">Terapkan</button>
          </form>
        )}
      </div>

      {result === null ? (
        <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">hourglass_top</span><span>Memuat…</span></div>
      ) : !result.ok ? (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <span>
            <strong>Data tidak tersedia.</strong> {result.error}
            {q && <><br />Permintaan pencarian: <code className="mono">{q}</code></>}
          </span>
        </div>
      ) : total === 0 ? (
        <div className="empty">
          <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">search_off</span></div>
          <h3>Tidak ada hasil</h3>
          <p>{q ? <>Tidak ada data cocok dengan <code className="mono">{q}</code>.</> : "Belum ada data di entitas ini."}</p>
        </div>
      ) : entity === "plans" ? (
        <>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Plan</th><th>Status</th><th>Intent</th><th className="num">Aksi</th><th>Dibuat</th></tr></thead>
              <tbody>
                {(data?.plans as Any[]).map((plan) => (
                  <tr key={String(plan.plan_id)}>
                    <td className="mono">{String(plan.plan_id)}</td>
                    <td><span className={`badge ${statusTone(String(plan.status))}`}>{String(plan.status)}</span></td>
                    <td className="truncate" style={{ maxWidth: 380 }} title={String(plan.intent ?? "")}>{String(plan.intent ?? "—")}</td>
                    <td className="num">{Array.isArray(plan.actions) ? plan.actions.length : "?"}</td>
                    <td className="mono">{fmtAt(plan.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={total} offset={pageOffset} limit={pageLimit} entity={entity} q={q} status={statusParam} />
        </>
      ) : entity === "mandates" ? (
        <>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Mandat</th><th>Status</th><th>Plan</th><th>Terbit</th><th>Kedaluwarsa</th></tr></thead>
              <tbody>
                {(data?.mandates as Any[]).map((mandate) => (
                  <tr key={String(mandate.mandate_id)}>
                    <td className="mono">{String(mandate.mandate_id)}</td>
                    <td><span className={`badge ${statusTone(String(mandate.status))}`}>{String(mandate.status)}</span></td>
                    <td className="mono">{String(mandate.plan_id ?? "—")}</td>
                    <td className="mono">{fmtAt(mandate.issued_at)}</td>
                    <td className="mono">{fmtAt(mandate.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={total} offset={pageOffset} limit={pageLimit} entity={entity} q={q} status={statusParam} />
        </>
      ) : entity === "executions" ? (
        <>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Execution</th><th>Mandat</th><th>Aksi</th><th>Hasil</th><th>Dijalankan</th></tr></thead>
              <tbody>
                {(data?.executions as Any[]).map((execution) => (
                  <tr key={String(execution.execution_id)}>
                    <td className="mono">{String(execution.execution_id)}</td>
                    <td className="mono">{String(execution.mandate_id ?? "—")}</td>
                    <td className="mono">{String(execution.action_id ?? "—")}</td>
                    <td><span className={`badge ${execution.result === "sent" ? "badge--success" : "badge--outline"}`}>{String(execution.result ?? "—")}</span></td>
                    <td className="mono">{fmtAt(execution.executed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && "summary" in data && (
            <details style={{ marginTop: "var(--s-2)" }}>
              <summary className="field__hint">Ringkasan (mentah, dari server)</summary>
              <pre className="mono banner" style={{ padding: "var(--s-3)", overflow: "auto", fontSize: 11 }}>
                {JSON.stringify(data.summary, null, 2)}
              </pre>
            </details>
          )}
          <Pager total={total} offset={pageOffset} limit={pageLimit} entity={entity} q={q} status={statusParam} />
        </>
      ) : (
        <>
          {data && "integrity" in data && (
            (() => {
              const i = data.integrity as { ok?: boolean; verified?: number; unchained?: number; checkpoint_status?: string; broken_at?: string | null; malformed_at?: number | null };
              const ok = Boolean(i?.ok);
              return (
                <div className={`banner ${ok ? "banner--success" : "banner--danger"}`} role="status" style={{ marginBottom: "var(--s-3)" }}>
                  <span className="material-symbols-outlined" aria-hidden="true">{ok ? "verified_user" : "gpp_bad"}</span>
                  <span>
                    Rantai audit {ok ? "utuh" : "RUSAK"} · terverifikasi <strong>{i?.verified ?? 0}</strong> · unchained {i?.unchained ?? 0} · checkpoint {i?.checkpoint_status ?? "—"}
                    {i?.broken_at ? <> · putus di <code className="mono">{i.broken_at}</code></> : null}
                    {i?.malformed_at != null ? <> · baris rusak ke-{i.malformed_at}</> : null}
                  </span>
                </div>
              );
            })()
          )}
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>Waktu</th><th>Tipe</th><th>Aktor</th><th>Plan</th><th>Kode</th></tr></thead>
              <tbody>
                {(data?.events as Any[]).map((event, index) => (
                  <tr key={index}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(event.at)}</td>
                    <td><span className="badge badge--outline">{String(event.type ?? "—")}</span></td>
                    <td>{String(event.actor ?? "—")}</td>
                    <td className="mono truncate" style={{ maxWidth: 180 }}>{String(event.plan_id ?? "—")}</td>
                    <td className="mono">{String(event.reason_code ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager total={total} offset={pageOffset} limit={pageLimit} entity={entity} q={q} status={statusParam} />
        </>
      )}

      <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
        Halaman ini menampilkan hasil per entitas, bukan satu daftar gabungan. <strong>Approval dan Worker tidak ada di Explorer</strong> — jejak approval ada di tab Audit; roster worker ada di <code className="mono">workbuddy/agents/</code>.
      </p>
    </>
  );
}
