import Link from "next/link";
import { apiGet, type SkillDetail } from "@/lib/api";
import SkillStatusButton from "./SkillStatusButton";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  disabled: "badge--outline",
  deprecated: "badge--warning"
};

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function SchemaBlock({ title, schema }: { title: string; schema: Record<string, unknown> | undefined }) {
  if (!schema || Object.keys(schema).length === 0) return null;
  return (
    <details style={{ marginTop: "var(--s-2)" }}>
      <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--muted)", minHeight: 44, display: "flex", alignItems: "center" }}>
        {title}
      </summary>
      <pre
        className="mono"
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          padding: "var(--s-3)",
          fontSize: 11
        }}
      >
        {JSON.stringify(schema, null, 2)}
      </pre>
    </details>
  );
}

export default async function SkillDetailPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await apiGet<SkillDetail>(`/skills/${encodeURIComponent(slug)}`);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/skills">Skill Registry</Link>
            <span className="sep">›</span>
            <span className="current">{slug}</span>
          </nav>
          <h1>{result.ok ? result.data.display_name : slug}</h1>
          {result.ok && <p>{result.data.description}</p>}
        </div>
      </header>

      {result.ok ? (
        <>
          <div className="banner" style={{ marginBottom: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              school
            </span>
            <span>
              <span className={`badge ${STATUS_TONE[result.data.status] ?? "badge--outline"}`}>
                {result.data.status}
              </span>{" "}
              v{result.data.latest_version ?? "—"} ·{" "}
              {result.data.is_system ? "Skill sistem (tidak bisa diubah tenant)" : "Skill milik tenant"}
            </span>
          </div>

          {!result.data.is_system && (
            <div className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }}>
              <h2 style={{ fontSize: 14, margin: "0 0 var(--s-2)" }}>Ubah status</h2>
              <p className="field__hint" style={{ marginBottom: "var(--s-3)" }}>
                Butuh capability <code className="mono">manage_integrations</code>. Skill sistem tidak
                bisa diubah dari sini.
              </p>
              <SkillStatusButton slug={result.data.slug} current={result.data.status} />
            </div>
          )}

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Versi ({result.data.versions.length})</h2>
          {result.data.versions.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                inventory_2
              </span>
              <span>Belum ada versi terdaftar.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Versi</th>
                    <th>Status</th>
                    <th>Capability</th>
                    <th>Catatan</th>
                    <th>Terbit</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.versions.map((version) => (
                    <tr key={version.version}>
                      <td className="mono">{version.version}</td>
                      <td>
                        <span className={`badge ${STATUS_TONE[version.status] ?? "badge--outline"}`}>
                          {version.status}
                        </span>
                      </td>
                      <td className="truncate" style={{ maxWidth: 220 }} title={version.required_capabilities.join(", ")}>
                        {version.required_capabilities.join(", ") || "—"}
                      </td>
                      <td>
                        <span className="truncate" style={{ maxWidth: 240 }} title={version.notes}>
                          {version.notes || "—"}
                        </span>
                        <SchemaBlock title="Input schema" schema={version.input_schema} />
                        <SchemaBlock title="Output schema" schema={version.output_schema} />
                      </td>
                      <td className="mono">{fmtAt(version.published_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
