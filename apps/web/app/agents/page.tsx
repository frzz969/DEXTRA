import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type Agent = {
  slug: string;
  display_name: string;
  agent_type: string;
  status: string;
  capabilities: string[];
};

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  idle: "badge--info",
  disabled: "badge--outline"
};

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
            <section className="grid grid--4" aria-label="Daftar agen">
              {result.data.items.map((agent) => (
                <article className="card kpi kpi--accent" key={agent.slug}>
                  <div className="kpi__top">
                    <span className="kpi__label">{agent.agent_type}</span>
                    <span className="kpi__icon" aria-hidden="true">
                      <span className="material-symbols-outlined">smart_toy</span>
                    </span>
                  </div>
                  <div className="kpi__value" style={{ fontSize: 17, lineHeight: 1.25 }}>
                    {agent.display_name}
                  </div>
                  <div className="kpi__foot">
                    <span className={`badge ${STATUS_TONE[agent.status] ?? ""}`}>{agent.status}</span>
                    <span className="truncate" title={agent.capabilities.join(", ") || "tanpa capability"}>
                      {agent.capabilities.join(", ") || "tanpa capability"}
                    </span>
                  </div>
                </article>
              ))}
            </section>
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
