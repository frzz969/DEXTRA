import Link from "next/link";
import { getAgent } from "@/lib/api";
import AgentToggle from "./AgentToggle";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  idle: "badge--info",
  busy: "badge--warning",
  disabled: "badge--outline",
  error: "badge--danger"
};

export default async function AgentDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getAgent(slug);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/agents">Workforce</Link>
            <span className="sep">›</span>
            <span className="current">{slug}</span>
          </nav>
          <h1>{result.ok ? result.data.display_name : slug}</h1>
          {result.ok && result.data.description ? <p>{result.data.description}</p> : null}
        </div>
      </header>

      {result.ok ? (
        <>
          <div className="banner" style={{ marginBottom: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              smart_toy
            </span>
            <span>
              <span className={`badge ${STATUS_TONE[result.data.status] ?? "badge--outline"}`}>
                {result.data.status}
              </span>{" "}
              <span className={`badge ${result.data.is_enabled ? "badge--brand" : "badge--outline"}`}>
                {result.data.is_enabled ? "enabled" : "disabled"}
              </span>{" "}
              <span className="mono">{result.data.slug}</span>
            </span>
          </div>

          <div className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }}>
            <h2 style={{ fontSize: 14, margin: "0 0 var(--s-3)" }}>Detail</h2>
            <dl className="def-list">
              <dt>Slug</dt>
              <dd className="mono">{result.data.slug}</dd>
              <dt>Tipe</dt>
              <dd>{result.data.agent_type}</dd>
              <dt>Provider model</dt>
              <dd>{result.data.model_provider ?? "—"}</dd>
              <dt>Status</dt>
              <dd>{result.data.status}</dd>
              <dt>Capability</dt>
              <dd>
                {result.data.capabilities.length > 0 ? (
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {result.data.capabilities.map((c) => (
                      <span key={c} className="badge badge--outline">
                        {c}
                      </span>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
              {result.data.versions != null ? (
                <>
                  <dt>Jumlah versi</dt>
                  <dd>{result.data.versions}</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className="card" style={{ padding: "var(--s-4)" }}>
            <h2 style={{ fontSize: 14, margin: "0 0 var(--s-2)" }}>Aktifkan / nonaktifkan</h2>
            <p className="field__hint" style={{ marginBottom: "var(--s-3)" }}>
              Butuh capability <code className="mono">manage_integrations</code>. Kalau tombol ini
              ditolak, alasannya ditampilkan apa adanya.
            </p>
            <AgentToggle slug={result.data.slug} isEnabled={result.data.is_enabled} />
          </div>
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
