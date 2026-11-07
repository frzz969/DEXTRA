import Link from "next/link";
import { getMembers, getPermissions, getRoles, type MemberItem } from "@/lib/api";
import { CapabilityMatrix } from "./matrix";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function SectionUnavailable({ title, error }: { title: string; error: string }) {
  return (
    <div className="banner banner--warning" role="status" style={{ marginTop: "var(--s-2)" }}>
      <span className="material-symbols-outlined" aria-hidden="true">lock</span>
      <span>
        <strong>{title} tidak tersedia.</strong> {error}
      </span>
    </div>
  );
}

function fmtAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

/** Pencocokan teks untuk filter `q`: email, nama tampilan, atau peran. */
function matchesQuery(member: MemberItem, needle: string): boolean {
  if (!needle) return true;
  return [member.email, member.display_name, member.role].join(" ").toLowerCase().includes(needle);
}

export default async function AccessPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 200);
  const roleFilter = str(sp.role);
  const needle = q.toLowerCase();
  const filterActive = q !== "" || roleFilter !== "";

  const [members, roles, permissions] = await Promise.all([
    getMembers(),
    getRoles(),
    getPermissions(),
  ]);

  const allMembers: MemberItem[] = members.ok ? members.data.items : [];
  const filteredMembers = allMembers.filter(
    (member) => (!roleFilter || member.role === roleFilter) && matchesQuery(member, needle)
  );
  /* Opsi filter peran hanya dari anggota yang benar-benar dimuat — supaya tidak
   * pernah menawarkan nilai yang pasti tidak ditemukan di daftar ini. */
  const roleOptions = [...new Set(allMembers.map((member) => member.role).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "id")
  );

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Akses &amp; Peran</h1>
          <p>
            Anggota tenant, peran yang mereka pegang, dan capability tiap peran. Daftar ini read-only.
          </p>
        </div>
      </header>

      <div className="banner banner--warning" role="status" style={{ marginBottom: "var(--s-4)" }}>
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        <span>
          Backend belum menyediakan endpoint untuk menambah, mengubah, atau mencabut anggota.
          Halaman ini hanya menampilkan daftar dari <code className="mono">GET /users</code> dan{" "}
          <code className="mono">GET /roles</code>. Tidak ada tombol ubah karena tidak ada endpoint-nya.
        </span>
      </div>

      {permissions.ok && (
        <section className="card card--pad" aria-label="Capability Anda" style={{ marginBottom: "var(--s-4)" }}>
          <h2 style={{ fontSize: 14 }}>Capability Anda di tenant ini</h2>
          <p className="field__hint" style={{ marginTop: 4 }}>
            Dinyatakan server lewat <code className="mono">GET /permissions</code>. Server memeriksa ulang setiap permintaan.
          </p>
          {permissions.data.capabilities.length === 0 ? (
            <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>Tidak ada capability administratif.</p>
          ) : (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "var(--s-3)" }}>
              {permissions.data.capabilities.map((cap) => (
                <span key={cap} className="badge badge--outline">
                  {cap}
                </span>
              ))}
            </div>
          )}
          {permissions.data.unbacked_capabilities.length > 0 && (
            <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
              Belum ada penegak: <span className="mono">{permissions.data.unbacked_capabilities.join(", ")}</span>.
            </p>
          )}
        </section>
      )}
      {!permissions.ok && <SectionUnavailable title="Konteks capability" error={permissions.error} />}

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Anggota tenant</h2>
      {!members.ok ? (
        <SectionUnavailable title="Daftar anggota" error={members.error} />
      ) : allMembers.length === 0 ? (
        <div className="banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">group</span>
          <span>Belum ada anggota.</span>
        </div>
      ) : (
        <>
          <form
            className="row"
            role="search"
            method="get"
            action="/access"
            style={{ gap: "var(--s-3)", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "var(--s-2)" }}
          >
            <div className="field" style={{ flex: "1 1 240px", minWidth: 0 }}>
              <label className="field__label" htmlFor="anggota-q">
                Cari anggota
              </label>
              <input
                id="anggota-q"
                className="input"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Email, nama, atau peran…"
                style={{ minHeight: 44 }}
              />
            </div>
            <div className="field" style={{ flex: "0 1 200px", minWidth: 0 }}>
              <label className="field__label" htmlFor="anggota-role">
                Peran
              </label>
              <select
                id="anggota-role"
                className="select"
                name="role"
                defaultValue={roleFilter}
                style={{ minHeight: 44 }}
              >
                <option value="">Semua peran</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>
              <span className="material-symbols-outlined" aria-hidden="true">search</span>
              Terapkan
            </button>
            {filterActive && (
              <Link className="btn btn--secondary" href="/access" style={{ minHeight: 44 }}>
                Reset
              </Link>
            )}
          </form>
          <p className="field__hint" style={{ marginBottom: "var(--s-3)" }}>
            Filter berjalan di halaman ini atas <strong>{allMembers.length}</strong> anggota yang baru
            dimuat dari <code className="mono">GET /users</code>. Tidak ada pencarian di server, jadi
            anggota di luar daftar ini tidak ikut tersaring.
          </p>
          <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
            Menampilkan <strong>{filteredMembers.length}</strong> dari <strong>{allMembers.length}</strong> anggota
            {q ? (
              <>
                {" "}untuk <code className="mono">{q}</code>
              </>
            ) : null}
            {roleFilter ? (
              <>
                {" "}dengan peran <code className="mono">{roleFilter}</code>
              </>
            ) : null}
            .
          </p>

          {filteredMembers.length === 0 ? (
            <div className="banner banner--warning" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
              <span>
                Tidak ada anggota yang cocok dengan filter ini.{" "}
                <Link href="/access" className="mono">Reset filter</Link> untuk melihat seluruh daftar.
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <caption className="sr-only">
                  Anggota tenant pemanggil, beserta peran dan statusnya.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Nama</th>
                    <th scope="col">Peran</th>
                    <th scope="col">Status</th>
                    <th scope="col">Gabung</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <td className="mono truncate" title={member.email} style={{ maxWidth: 220 }}>
                        {member.email}
                      </td>
                      <td>{member.display_name}</td>
                      <td>
                        <span className="badge badge--outline">{member.role}</span>
                      </td>
                      <td>
                        <span className={`badge ${member.status === "active" ? "badge--success" : "badge--outline"}`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="mono">{fmtAt(member.joined_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-2)" }}>Matriks capability &amp; peran</h2>
      <p className="field__hint" style={{ marginBottom: "var(--s-3)" }}>
        Setiap baris adalah capability yang muncul pada setidaknya satu peran; setiap kolom adalah peran.
        Peran sistem ditampilkan lebih dulu.
      </p>
      {!roles.ok ? (
        <SectionUnavailable title="Matriks capability" error={roles.error} />
      ) : roles.data.items.length === 0 ? (
        <div className="banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">badge</span>
          <span>Belum ada peran terdaftar, jadi matriks belum bisa disusun.</span>
        </div>
      ) : (
        <CapabilityMatrix roles={roles.data.items} />
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Peran &amp; capability</h2>
      {roles.ok ? (
        roles.data.items.length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">badge</span>
            <span>Belum ada peran terdaftar.</span>
          </div>
        ) : (
          <div className="grid grid--2">
            {roles.data.items.map((role) => (
              <div key={role.id} className="card" style={{ padding: "var(--s-4)" }}>
                <div className="kpi__top">
                  <span className="kpi__label">{role.name}</span>
                  {role.is_system && <span className="badge badge--outline">system</span>}
                </div>
                <p className="field__hint" style={{ marginTop: 4 }}>
                  {role.description || "—"}
                </p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "var(--s-3)" }}>
                  {role.capabilities.map((cap) => (
                    <span key={cap} className="badge badge--outline">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <SectionUnavailable title="Daftar peran" error={roles.error} />
      )}
    </>
  );
}
