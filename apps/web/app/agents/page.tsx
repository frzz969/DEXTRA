import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type Agent = {
  slug: string;
  display_name: string;
  agent_type: string;
  status: string;
  capabilities: string[];
};

export default async function AgentsPage() {
  const result = await apiGet<{ items: Agent[]; expected_specialists: string[]; unexpected: string[] }>(
    "/agents"
  );

  return (
    <>
      <header className="page-head">
        <h1>Workforce</h1>
        <p>Empat spesialis yang benar-benar ditetapkan. Tidak ada agen fiktif.</p>
      </header>

      {result.ok ? (
        <>
          {result.data.items.length === 0 ? (
            <div className="notice">
              Belum ada agen di database. Jalankan <code>python database/seeds/seed.py</code>.
            </div>
          ) : (
            <section className="kpi-grid" aria-label="Daftar agen">
              {result.data.items.map((agent) => (
                <div className="kpi" key={agent.slug}>
                  <div className="kpi__label">{agent.agent_type}</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>{agent.display_name}</div>
                  <div className="kpi__value" style={{ fontSize: 14 }}>
                    {agent.status}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                    {agent.capabilities.join(", ") || "tanpa capability"}
                  </div>
                </div>
              ))}
            </section>
          )}

          {result.data.unexpected.length > 0 && (
            <div className="notice notice--warn">
              Agen di luar empat spesialis: {result.data.unexpected.join(", ")}.
            </div>
          )}
        </>
      ) : (
        <div className="notice notice--warn">
          <strong>Data tidak tersedia.</strong> {result.error}
        </div>
      )}
    </>
  );
}
