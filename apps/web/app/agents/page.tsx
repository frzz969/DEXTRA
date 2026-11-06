import Link from "next/link";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  slug: string;
  display_name: string;
  agent_type: string;
  description: string | null;
  model_provider: string | null;
  status: string;
  is_enabled: boolean;
  capabilities: string[];
};

const COLUMNS: { key: string; label: string; tone: string }[] = [
  { key: "active", label: "Active", tone: "badge--success" },
  { key: "idle", label: "Idle", tone: "badge--info" },
  { key: "busy", label: "Busy", tone: "badge--warning" },
  { key: "disabled", label: "Disabled", tone: "badge--outline" },
  { key: "error", label: "Error", tone: "badge--danger" }
];

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

export default async function AgentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase().slice(0, 200);
  const statusFilter = str(sp.status);
  const result = await apiGet<{ items: Agent[]; expected_specialists: string[]; unexpected: string[] }>(
    "/agents"
  );

  const all = result.ok ? result.data.items : [];
  const filtered = all.filter((a) => {
    if (statusFilter && a.status !== statusFilter) return false;
    if (!q) return true;
    const haystack = [a.slug, a.display_name, a.agent_type, a.status, ...(a.capabilities ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Workforce</h1>
          <p>Empat spesialis yang benar-benar ditetapkan. Tidak ada agen fiktif.</p>
        </div>
      </header>

      {result.ok ? (
        <>
          <form
            className="row"
            role="search"
            style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center", flexWrap: "wrap" }}
            action="/agents"
            method="get"
          >
            <input
              className="input mono"
              type="search"
              name="q"
              aria-label="Cari agen"
              placeholder="Cari slug, nama, tipe, capability…"
              defaultValue={q}
              style={{ flex: "1 1 220px", minHeight: 44 }}
            />
            <select
              className="select"
              name="status"
              defaultValue={statusFilter}
              aria-label="Filter status"
              style={{ flex: "0 1 180px", minHeight: 44 }}
            >
              <option value="">Semua status</option>
              {COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>
              <span className="material-symbols-outlined" aria-hidden="true">
                search
              </span>
              Cari
            </button>
            {q || statusFilter ? (
              <Link className="btn btn--secondary" href="/agents" style={{ minHeight: 44 }}>
                Bersihkan
              </Link>
            ) : null}
          </form>

          <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
            Menampilkan <strong>{filtered.length}</strong> dari <strong>{all.length}</strong> agen
            {q ? (
              <>
                {" "}
                untuk <code className="mono">{q}</code>
              </>
            ) : null}
            .
          </p>

          {filtered.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                search_off
              </span>
              <span>
                {all.length === 0
                  ? "Belum ada agen di database."
                  : "Tidak ada agen yang cocok dengan filter ini."}
              </span>
            </div>
          ) : (
            <div className="kanban" aria-label="Papan kanban agen">
              {COLUMNS.map((col) => {
                const agents = filtered.filter((a) => a.status === col.key);
                return (
                  <section className="kcol" key={col.key} aria-label={`Status ${col.label}`}>
                    <div className="kcol__head">
                      <span className="kcol__title">{col.label}</span>
                      <span className="kcol__count">{agents.length}</span>
                    </div>
                    <div className="kcol__body">
                      {agents.map((agent) => (
                        <Link
                          className="kcard"
                          key={agent.id ?? agent.slug}
                          href={`/agents/${encodeURIComponent(agent.slug)}`}
                          style={{ display: "block" }}
                          aria-label={`Detail agen ${agent.display_name}`}
                        >
                          <div
                            className="row"
                            style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}
                          >
                            <span className="mono truncate" title={agent.slug}>
                              {agent.slug}
                            </span>
                            <span className={`badge ${col.tone}`}>{agent.status}</span>
                          </div>
                          <div className="kcard__title" style={{ marginTop: 6 }}>
                            {agent.display_name}
                          </div>
                          <div className="kcard__meta">
                            <span className="badge badge--outline">{agent.agent_type}</span>
                            <span
                              className={`badge ${agent.is_enabled ? "badge--brand" : "badge--outline"}`}
                            >
                              {agent.is_enabled ? "enabled" : "disabled"}
                            </span>
                          </div>
                          <div className="kcard__meta">
                            <span
                              className="truncate"
                              style={{ color: "var(--muted)", fontSize: 11 }}
                              title={agent.capabilities.join(", ") || "tanpa capability"}
                            >
                              {agent.capabilities.join(", ") || "tanpa capability"}
                            </span>
                          </div>
                        </Link>
                      ))}
                      {agents.length === 0 && (
                        <div
                          className="kcard__meta"
                          style={{ color: "var(--muted)", fontSize: 11, padding: "4px 2px" }}
                        >
                          Tidak ada agen.
                        </div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {result.data.unexpected.length > 0 && (
            <div className="banner banner--warning" style={{ marginTop: "var(--s-4)" }} role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
              <span>Agen di luar empat spesialis: {result.data.unexpected.join(", ")}.</span>
            </div>
          )}
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            cloud_off
          </span>
          <span>
            <strong>Belum terhubung ke API (:8000).</strong> {result.error}
          </span>
        </div>
      )}
    </>
  );
}
