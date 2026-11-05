import { apiGet } from "@/lib/api";

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
  const [members, roles] = await Promise.all([
    apiGet<{ items: MemberItem[] }>("/users"),
    apiGet<{ items: RoleItem[] }>("/roles")
  ]);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Akses &amp; Peran</h1>
          <p>Anggota tenant dan peran yang mereka pegang. Perubahan anggota membutuhkan capability manage_users.</p>
        </div>
      </header>

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Anggota tenant</h2>
      {members.ok ? (
        members.data.items.length === 0 ? (
          <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">group</span><span>Belum ada anggota.</span></div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Email</th><th>Nama</th><th>Peran</th><th>Status</th><th>Gabung</th></tr>
              </thead>
              <tbody>
                {members.data.items.map((member) => (
                  <tr key={member.id}>
                    <td className="mono truncate" title={member.email} style={{ maxWidth: 220 }}>{member.email}</td>
                    <td>{member.display_name}</td>
                    <td><span className="badge badge--outline">{member.role}</span></td>
                    <td><span className={`badge ${member.status === "active" ? "badge--success" : "badge--outline"}`}>{member.status}</span></td>
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
        roles.data.items.length === 0 ? (
          <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">badge</span><span>Belum ada peran terdaftar.</span></div>
        ) : (
          <div className="grid grid--2">
            {roles.data.items.map((role) => (
              <div key={role.id} className="card" style={{ padding: "var(--s-4)" }}>
                <div className="kpi__top">
                  <span className="kpi__label">{role.name}</span>
                  {role.is_system && <span className="badge badge--outline">system</span>}
                </div>
                <p className="field__hint" style={{ marginTop: 4 }}>{role.description || "—"}</p>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: "var(--s-3)" }}>
                  {role.capabilities.map((cap) => (
                    <span key={cap} className="badge badge--outline">{cap}</span>
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
