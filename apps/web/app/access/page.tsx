import { getMembers, getPermissions, getRoles } from "@/lib/api";

export const dynamic = "force-dynamic";

type MemberItem = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  joined_at: string;
};

type RoleItem = {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  capabilities: string[];
};

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

export default async function AccessPage() {
  const [members, roles, permissions] = await Promise.all([
    getMembers(),
    getRoles(),
    getPermissions(),
  ]);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Akses &amp; Peran</h1>
          <p>Anggota tenant dan peran yang mereka pegang. Daftar ini read-only.</p>
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
      {members.ok ? (
        (members.data.items as MemberItem[]).length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">group</span>
            <span>Belum ada anggota.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <caption className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                Anggota tenant pemanggil.
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
                {(members.data.items as MemberItem[]).map((member) => (
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
        )
      ) : (
        <SectionUnavailable title="Daftar anggota" error={members.error} />
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Peran &amp; capability</h2>
      {roles.ok ? (
        (roles.data.items as RoleItem[]).length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">badge</span>
            <span>Belum ada peran terdaftar.</span>
          </div>
        ) : (
          <div className="grid grid--2">
            {(roles.data.items as RoleItem[]).map((role) => (
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
