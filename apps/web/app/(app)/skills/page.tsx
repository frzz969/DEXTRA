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

const STATUSES = ["active", "disabled", "deprecated"];

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function SkillsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().toLowerCase().slice(0, 200);
  const statusFilter = str(sp.status);
  const result = await apiGet<{ items: SkillItem[] }>("/skills");

  const all = result.ok ? result.data.items : [];
  const filtered = all.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!q) return true;
    return [s.slug, s.display_name, s.description, s.status]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Skill Registry</h1>
          <p>
            Katalog skill: sistem dan milik tenant. Hanya konfigurasi penuh yang berubah di sini —
            mengubahnya butuh capability manajemen.
          </p>
        </div>
      </header>

      {result.ok ? (
        <>
          <form
            className="row"
            role="search"
            style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center", flexWrap: "wrap" }}
            action="/skills"
            method="get"
          >
            <input
              className="input mono"
              type="search"
              name="q"
              aria-label="Cari skill"
              placeholder="Cari slug, nama, deskripsi…"
              defaultValue={q}
              style={{ flex: "1 1 220px", minHeight: 44 }}
            />
            <select
              className="select"
              name="status"
              defaultValue={statusFilter}
              aria-label="Filter status"
              style={{ flex: "0 1 160px", minHeight: 44 }}
            >
              <option value="">Semua status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              <Link className="btn btn--secondary" href="/skills" style={{ minHeight: 44 }}>
                Bersihkan
              </Link>
            ) : null}
          </form>

          <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
            Menampilkan <strong>{filtered.length}</strong> dari <strong>{all.length}</strong> skill.
          </p>

          {all.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                school
              </span>
              <span>Belum ada skill terdaftar untuk tenant ini.</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="banner">
              <span className="material-symbols-outlined" aria-hidden="true">
                search_off
              </span>
              <span>Tidak ada skill yang cocok dengan filter ini.</span>
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
                  {filtered.map((skill) => (
                    <tr key={skill.id}>
                      <td>
                        <Link
                          href={`/skills/${encodeURIComponent(skill.slug)}`}
                          className="cell-title mono"
                          style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}
                        >
                          {skill.slug}
                        </Link>
                        <div className="cell-sub">{skill.display_name}</div>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_TONE[skill.status] ?? "badge--outline"}`}>
                          {skill.status}
                        </span>
                      </td>
                      <td className="mono">{skill.latest_version ?? "—"}</td>
                      <td>
                        <span className="badge badge--outline">{skill.is_system ? "system" : "tenant"}</span>
                      </td>
                      <td className="mono">{fmtAt(skill.created_at)}</td>
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
