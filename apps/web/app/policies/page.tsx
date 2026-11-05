import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type PolicyItem = {
  id: string;
  slug: string;
  title: string;
  scope: string;
  is_active: boolean;
  versions: number;
};

export default async function PoliciesPage() {
  const result = await apiGet<{ items: PolicyItem[]; writable: boolean }>("/policies");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Kebijakan</h1>
          <p>Aturan organisasi yang benar-benar ditegakkan: scope, status aktif, jumlah versi. Perubahan butuh capability `edit_policy`.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">policy</span>
            <span>Belum ada kebijakan terdaftar.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Kebijakan</th><th>Ruang lingkup</th><th>Status</th><th className="num">Versi</th></tr>
              </thead>
              <tbody>
                {result.data.items.map((policy) => (
                  <tr key={policy.id}>
                    <td>
                      <div className="cell-title">{policy.title}</div>
                      <div className="cell-sub mono">{policy.slug}</div>
                    </td>
                    <td>{policy.scope}</td>
                    <td><span className={`badge ${policy.is_active ? "badge--success" : "badge--outline"}`}>{policy.is_active ? "aktif" : "nonaktif"}</span></td>
                    <td className="num">{policy.versions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Kebijakan tidak tersedia.</strong> {result.error}</span>
        </div>
      )}

      <p className="field__hint" style={{ marginTop: "var(--s-4)" }}>
        Mengubah kebijakan menuntut capability <code className="mono">edit_policy</code>; caller ini tidak memegangnya — tombol ubah sengaja tidak ada.
      </p>
    </>
  );
}
