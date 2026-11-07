import Link from "next/link";
import { getAgents } from "@/lib/api";
import {
  AgentAvatar,
  AGENT_STATUSES,
  CapabilityChips,
  ClampedDescription,
  agentStatusTone,
  agentStripTone
} from "@/components/agents";
import { Badge } from "@/components/p1";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

/**
 * Halaman pengenalan agen.
 *
 * Dulu papan kanban lima kolom: kartu dikelompokkan per status, sehingga satu
 * agen hanya bisa dilihat sebagai "kartu di kolom". Halaman ini untuk mengenal
 * agen — jadi bentuknya grid kartu profil, dan status tetap terbaca lewat baris
 * ringkasan di atas grid (hitungan nyata, bukan filter).
 */
export default async function AgentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase().slice(0, 200);
  const statusFilter = str(sp.status);
  const result = await getAgents();

  const all = result.ok ? result.data.items : [];
  const filtered = all.filter((agent) => {
    if (statusFilter && agent.status !== statusFilter) return false;
    if (!q) return true;
    const haystack = [agent.slug, agent.display_name, agent.agent_type, agent.status, ...(agent.capabilities ?? [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Workforce</h1>
          <p>
            Kenali agen yang bekerja di workspace ini: tipe, deskripsi, kapabilitas yang tercatat, dan
            status terkininya. Semua dibaca dari registri agen — tidak ada agen contoh.
          </p>
        </div>
      </header>

      {!result.ok ? (
        <Unavailable title="Workforce" error={result.error} />
      ) : all.length === 0 ? (
        <EmptyState
          icon="smart_toy"
          title="Belum ada agen terdaftar."
          body="Registri agen untuk tenant ini kosong. Halaman ini tidak mengisi daftarnya dengan data contoh."
        />
      ) : (
        <>
          <div
            className="statstrip"
            style={{ marginBottom: "var(--s-4)" }}
            role="group"
            aria-label="Ringkasan status agen"
          >
            {AGENT_STATUSES.map((status) => {
              const count = all.filter((agent) => agent.status === status).length;
              return (
                <div className="statstrip__item" key={status}>
                  <span className="statstrip__label">{status}</span>
                  <span className={`statstrip__value ${agentStripTone(status)}`.trim()}>{count}</span>
                </div>
              );
            })}
          </div>

          <form
            className="row"
            role="search"
            style={{ gap: "var(--s-2)", marginBottom: "var(--s-3)", alignItems: "center", flexWrap: "wrap" }}
            action="/agents"
            method="get"
          >
            <input
              className="input mono"
              type="search"
              name="q"
              aria-label="Cari agen"
              placeholder="Cari slug, nama, tipe, kapabilitas…"
              defaultValue={q}
              style={{ flex: "1 1 220px", minHeight: 44 }}
            />
            <select
              className="select"
              name="status"
              defaultValue={statusFilter}
              aria-label="Saring status"
              style={{ flex: "0 1 180px", minHeight: 44 }}
            >
              <option value="">Semua status</option>
              {AGENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
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
            <EmptyState
              icon="search_off"
              title="Tidak ada agen yang cocok dengan filter ini."
              body="Ubah kata kunci atau status, atau bersihkan filter untuk melihat seluruh roster."
              action={{ href: "/agents", label: "Bersihkan filter" }}
            />
          ) : (
            <div className="grid grid--3">
              {filtered.map((agent) => (
                <Link
                  key={agent.id}
                  href={`/agents/${encodeURIComponent(agent.slug)}`}
                  className="card spec-card"
                  aria-label={`Profil agen ${agent.display_name}`}
                >
                  <div className="spec-card__top">
                    <AgentAvatar slug={agent.slug} name={agent.display_name} />
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <h3 className="truncate" title={agent.display_name}>
                        {agent.display_name}
                      </h3>
                      <div className="role truncate">{agent.agent_type}</div>
                    </div>
                    <Badge value={agent.status} tone={agentStatusTone(agent.status)} />
                  </div>

                  <ClampedDescription
                    text={agent.description}
                    fallback="Belum ada deskripsi di registri."
                  />

                  <CapabilityChips capabilities={agent.capabilities ?? []} max={3} />

                  <span className="row tiny muted" style={{ gap: "var(--s-1)" }}>
                    Lihat profil
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">
                      arrow_forward
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          {result.data.unexpected.length > 0 ? (
            <div className="banner banner--warning" style={{ marginTop: "var(--s-4)" }} role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
              <span>Agen di luar empat spesialis: {result.data.unexpected.join(", ")}.</span>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
