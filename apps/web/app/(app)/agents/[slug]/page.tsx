import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgent } from "@/lib/api";
import { AgentAvatar, CapabilityChips, agentStatusTone } from "@/components/agents";
import { Badge } from "@/components/p1";
import { Unavailable } from "@/components/states";
import AgentToggle from "./AgentToggle";

export const dynamic = "force-dynamic";

/**
 * Bentuk instruksi contoh. Kalimatnya hanya membungkus nama kapabilitas yang
 * benar-benar tercatat — tidak ada kemampuan baru yang diperkenalkan di sini.
 */
const INSTRUCTION_TEMPLATES: ((capability: string) => string)[] = [
  (capability) => `Tolong tangani pekerjaan yang membutuhkan kapabilitas ${capability}.`,
  (capability) => `Periksa dulu apakah permintaan ini bisa dikerjakan dengan kapabilitas ${capability}.`,
  (capability) => `Siapkan hasilnya lewat kapabilitas ${capability}, lalu ajukan untuk persetujuan.`
];

/**
 * 2–3 contoh instruksi, diturunkan dari `capabilities` yang ada.
 * Kapabilitas sedikit → templat berbeda dipakai ulang untuk kapabilitas yang
 * sama, bukan kapabilitas karangan. Tanpa kapabilitas → tanpa contoh.
 */
function usageExamples(capabilities: string[]): { capability: string; instruction: string }[] {
  if (capabilities.length === 0) return [];
  const total = Math.min(3, Math.max(2, capabilities.length));
  return Array.from({ length: total }, (_, index) => {
    const capability = capabilities[index % capabilities.length];
    return { capability, instruction: INSTRUCTION_TEMPLATES[index % INSTRUCTION_TEMPLATES.length](capability) };
  });
}

export default async function AgentDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getAgent(slug);

  if (!result.ok) {
    // 404 = slug tidak ada di tenant ini. Selain itu API-nya yang tidak terjangkau.
    if (result.status === 404) notFound();
    return (
      <>
        <header className="page-head">
          <div className="page-head__text">
            <nav className="breadcrumbs" aria-label="breadcrumb">
              <Link href="/agents">Workforce</Link>
              <span className="sep">›</span>
              <span className="current">{slug}</span>
            </nav>
            <h1 className="mono">{slug}</h1>
          </div>
        </header>
        <Unavailable title="Profil agen" error={result.error} />
      </>
    );
  }

  const agent = result.data;
  const capabilities = agent.capabilities ?? [];
  const examples = usageExamples(capabilities);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/agents">Workforce</Link>
            <span className="sep">›</span>
            <span className="current">{agent.slug}</span>
          </nav>
          <div className="row" style={{ gap: "var(--s-3)", alignItems: "center", marginTop: "var(--s-2)" }}>
            <AgentAvatar slug={agent.slug} name={agent.display_name} size="lg" />
            <div style={{ minWidth: 0 }}>
              <h1>{agent.display_name}</h1>
              <div className="row row--wrap" style={{ gap: "var(--s-2)", marginTop: "var(--s-1)" }}>
                <span className="badge badge--outline">{agent.agent_type}</span>
                <Badge value={agent.status} tone={agentStatusTone(agent.status)} />
              </div>
            </div>
          </div>
          <p style={{ marginTop: "var(--s-3)" }}>
            {agent.description ?? "Agen ini belum mencantumkan deskripsi di registri."}
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--primary" href="/assistant">
            <span className="material-symbols-outlined" aria-hidden="true">
              forum
            </span>
            Buka AI Assistant
          </Link>
          <Link className="btn btn--secondary" href="/requests">
            <span className="material-symbols-outlined" aria-hidden="true">
              assignment
            </span>
            Lihat Requests
          </Link>
        </div>
        <p className="field__hint" style={{ flex: "1 1 100%" }}>
          Kedua tautan menuju halaman umum. Halaman tujuan belum bisa dibuka untuk agen tertentu, jadi
          tidak ada agen yang otomatis terpilih di sana.
        </p>
      </header>

      <div className="stack">
        <section className="card" aria-labelledby="agent-capabilities">
          <div className="card__head">
            <div>
              <h2 id="agent-capabilities">Kapabilitas</h2>
              <p>Yang tercatat untuk agen ini di registri.</p>
            </div>
            <span className="spacer" />
            <span className="badge badge--outline">{capabilities.length}</span>
          </div>
          <div className="card__body">
            {capabilities.length > 0 ? (
              <CapabilityChips capabilities={capabilities} />
            ) : (
              <p className="small muted">
                Agen ini tidak mencantumkan kapabilitas. Tanpa kapabilitas tercatat, tidak ada
                pekerjaan yang bisa dijelaskan dari halaman ini.
              </p>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="agent-metadata">
          <div className="card__head">
            <div>
              <h2 id="agent-metadata">Metadata</h2>
              <p>Field yang dikirim registri agen, tanpa tambahan.</p>
            </div>
          </div>
          <div className="card__body">
            <dl className="def-list">
              <dt>Slug</dt>
              <dd className="mono">{agent.slug}</dd>
              <dt>Tipe</dt>
              <dd>{agent.agent_type}</dd>
              <dt>Provider model</dt>
              <dd>
                {agent.model_provider ?? <span className="muted">tidak tersedia</span>}
              </dd>
              <dt>Jumlah versi</dt>
              <dd>
                {agent.versions == null ? <span className="muted">tidak tersedia</span> : agent.versions}
              </dd>
              <dt>Diaktifkan</dt>
              <dd>{agent.is_enabled ? "ya" : "tidak"}</dd>
            </dl>
          </div>
        </section>

        <section className="card" aria-labelledby="agent-examples">
          <div className="card__head">
            <div>
              <h2 id="agent-examples">Contoh penggunaan</h2>
              <p>Contoh bentuk permintaan — bukan daftar kemampuan tambahan.</p>
            </div>
          </div>
          <div className="card__body">
            {examples.length > 0 ? (
              <>
                <ol className="steps" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {examples.map((example, index) => (
                    <li className="step" key={`${index}-${example.capability}`}>
                      <span className="step__num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="step__title">{example.instruction}</div>
                        <div className="step__desc">
                          Diturunkan dari kapabilitas{" "}
                          <code className="mono">{example.capability}</code>.
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
                  Kalimat di atas disusun dari kapabilitas yang tercatat di halaman ini. Agen tetap
                  hanya boleh melakukan apa yang diizinkan mandat dan persetujuan manusia — kapabilitas
                  bukan izin eksekusi.
                </p>
              </>
            ) : (
              <p className="small muted">
                Tidak ada kapabilitas tercatat, jadi tidak ada contoh instruksi yang bisa diturunkan.
              </p>
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="agent-control">
          <div className="card__head">
            <div>
              <h2 id="agent-control">Aktifkan / nonaktifkan</h2>
              <p>Perubahan ditulis ke registri, bukan disimpan di halaman ini.</p>
            </div>
          </div>
          <div className="card__body">
            <p className="field__hint" style={{ marginBottom: "var(--s-3)" }}>
              Butuh capability <code className="mono">manage_integrations</code>. Kalau tombol ini
              ditolak, alasannya ditampilkan apa adanya.
            </p>
            <AgentToggle slug={agent.slug} isEnabled={agent.is_enabled} />
          </div>
        </section>
      </div>
    </>
  );
}
