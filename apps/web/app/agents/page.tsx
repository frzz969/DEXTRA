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

export default async function AgentsPage() {
  const result = await apiGet<{ items: Agent[]; expected_specialists: string[]; unexpected: string[] }>(
    "/agents"
  );

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
          {result.data.items.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
              <span>
                Belum ada agen di database. Jalankan{" "}
                <code className="mono">python database/seeds/seed.py</code>.
              </span>
            </div>
          ) : (
            <div className="kanban" aria-label="Papan kanban agen">
              {COLUMNS.map((col) => {
                const agents = result.data.items.filter((a) => a.status === col.key);
                return (
                  <section className="kcol" key={col.key} aria-label={`Status ${col.label}`}>
                    <div className="kcol__head">
                      <span className="kcol__title">{col.label}</span>
                      <span className="kcol__count">{agents.length}</span>
                    </div>
                    <div className="kcol__body">
                      {agents.map((agent) => (
                        <article className="kcard" key={agent.id ?? agent.slug} style={{ cursor: "default" }}>
                          <div className="row" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                            <span className="mono truncate" title={agent.slug}>{agent.slug}</span>
                            <span className={`badge ${col.tone}`}>{agent.status}</span>
                          </div>
                          <div className="kcard__title" style={{ marginTop: 6 }}>{agent.display_name}</div>
                          <div className="kcard__meta">
                            <span className="badge badge--outline">{agent.agent_type}</span>
                            <span className={`badge ${agent.is_enabled ? "badge--brand" : "badge--outline"}`}>
                              {agent.is_enabled ? "enabled" : "disabled"}
                            </span>
                          </div>
                          <div className="kcard__meta">
                            <span className="truncate" style={{ color: "var(--muted)", fontSize: 11 }}
                              title={agent.capabilities.join(", ") || "tanpa capability"}>
                              {agent.capabilities.join(", ") || "tanpa capability"}
                            </span>
                          </div>
                        </article>
                      ))}
                      {agents.length === 0 && (
                        <div className="kcard__meta" style={{ color: "var(--muted)", fontSize: 11, padding: "4px 2px" }}>
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
              <span className="material-symbols-outlined" aria-hidden="true">warning</span>
              <span>Agen di luar empat spesialis: {result.data.unexpected.join(", ")}.</span>
            </div>
          )}
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Data tidak tersedia.</strong> {result.error}
          </span>
        </div>
      )}
    </>
  );
}
