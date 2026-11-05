import Link from "next/link";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type SkillVersion = {
  version: string;
  status: string;
  required_capabilities: string[];
  notes: string;
  published_at: string | null;
  created_at: string;
};

type SkillDetail = {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  status: string;
  latest_version: string | null;
  is_system: boolean;
  created_at: string;
  versions: SkillVersion[];
};

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

export default async function SkillDetailPage({
  params,
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
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">school</span>
            <span>
              <span className={`badge ${STATUS_TONE[result.data.status] ?? "badge--outline"}`}>{result.data.status}</span>
              {" "}v{result.data.latest_version ?? "—"}
              {" ·"} {result.data.is_system ? "Skill sistem (tidak bisa diubah tenant)" : "Skill milik tenant"}
            </span>
          </div>

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Versi ({result.data.versions.length})</h2>
          {result.data.versions.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><span>Belum ada versi terdaftar.</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr><th>Versi</th><th>Status</th><th>Capability</th><th>Catatan</th><th>Terbit</th></tr>
                </thead>
                <tbody>
                  {result.data.versions.map((version) => (
                    <tr key={version.version}>
                      <td className="mono">{version.version}</td>
                      <td><span className={`badge ${STATUS_TONE[version.status] ?? "badge--outline"}`}>{version.status}</span></td>
                      <td className="truncate" style={{ maxWidth: 220 }} title={version.required_capabilities.join(", ")}>
                        {version.required_capabilities.join(", ") || "—"}
                      </td>
                      <td className="truncate" style={{ maxWidth: 240 }} title={version.notes}>{version.notes || "—"}</td>
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
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Skill tidak tersedia.</strong> {result.error}</span>
        </div>
      )}
    </>
  );
}
