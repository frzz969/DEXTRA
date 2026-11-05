import Link from "next/link";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type SkillItem = {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  status: string;
  latest_version: string | null;
  is_system: boolean;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  disabled: "badge--outline",
  deprecated: "badge--warning"
};

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function SkillsPage() {
  const result = await apiGet<{ items: SkillItem[] }>("/skills");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Skill Registry</h1>
          <p>Katalog skill: sistem dan milik tenant. Hanya konfigurasi penuh yang berubah di sini — mengubahnya butuh capability manajemen.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">school</span>
            <span>Belum ada skill terdaftar untuk tenant ini.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Status</th>
                  <th>Versi</th>
                  <th>Kepemilikan</th>
                  <th>Terdaftar</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((skill) => (
                  <tr key={skill.id}>
                    <td>
                      <Link href={`/skills/${encodeURIComponent(skill.slug)}`} className="cell-title mono">{skill.slug}</Link>
                      <div className="cell-sub">{skill.display_name}</div>
                    </td>
                    <td><span className={`badge ${STATUS_TONE[skill.status] ?? "badge--outline"}`}>{skill.status}</span></td>
                    <td className="mono">{skill.latest_version ?? "—"}</td>
                    <td><span className="badge badge--outline">{skill.is_system ? "system" : "tenant"}</span></td>
                    <td className="mono">{fmtAt(skill.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Data tidak tersedia.</strong> {result.error}</span>
        </div>
      )}
    </>
  );
}
