import { getPolicies, getPolicyVersions } from "@/lib/api";
import PolicyEvaluatePanel from "./PolicyEvaluatePanel";

export const dynamic = "force-dynamic";

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default async function PoliciesPage() {
  const result = await getPolicies();
  const versionsBySlug = new Map<string, Awaited<ReturnType<typeof getPolicyVersions>>>();

  if (result.ok) {
    const entries = await Promise.all(
      result.data.items.map(async (policy) => [policy.slug, await getPolicyVersions(policy.slug)] as const)
    );
    for (const [slug, vres] of entries) versionsBySlug.set(slug, vres);
  }

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Kebijakan</h1>
          <p>Aturan organisasi dari API. Riwayat versi per slug dari <code className="mono">GET /policies/&#123;slug&#125;/versions</code>. Perubahan butuh capability <code className="mono">edit_policy</code>.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">policy</span>
            <span>Belum ada kebijakan terdaftar.</span>
          </div>
        ) : (
          result.data.items.map((policy) => {
            const vres = versionsBySlug.get(policy.slug);
            return (
              <section key={policy.id} aria-label={policy.title} style={{ marginBottom: "var(--s-5)" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: 15, margin: 0 }}>
                    {policy.title} <span className="cell-sub mono">{policy.slug}</span>{" "}
                    <span className={`badge ${policy.is_active ? "badge--success" : "badge--outline"}`}>
                      {policy.is_active ? "aktif" : "nonaktif"}
                    </span>
                  </h2>
                  <span className="cell-sub">{policy.scope} · {policy.versions} versi (daftar)</span>
                </div>

                {!vres ? (
                  <div className="banner banner--warning" role="alert" style={{ marginTop: "var(--s-2)" }}>
                    <span className="material-symbols-outlined" aria-hidden="true">error</span>
                    <span>Riwayat versi {policy.slug} belum dimuat.</span>
                  </div>
                ) : !vres.ok ? (
                  <div className="banner banner--warning" role="alert" style={{ marginTop: "var(--s-2)" }}>
                    <span className="material-symbols-outlined" aria-hidden="true">error</span>
                    <span>
                      <strong>Tidak ada riwayat versi untuk {policy.slug}.</strong> {vres.error} Kolom versi di atas hanya hitungan.
                    </span>
                  </div>
                ) : vres.data.items.length === 0 ? (
                  <div className="banner" style={{ marginTop: "var(--s-2)" }}>
                    <span className="material-symbols-outlined" aria-hidden="true">history</span>
                    <span>Slug <code className="mono">{policy.slug}</code> belum punya versi.</span>
                  </div>
                ) : (
                  <div className="table-wrap" style={{ marginTop: "var(--s-2)" }}>
                    <table className="table table--compact">
                      <caption style={{ textAlign: "left", padding: "6px 0" }}>
                        Versi dari GET /policies/{policy.slug}/versions ({vres.data.items.length})
                      </caption>
                      <thead>
                        <tr><th className="num">Versi</th><th>Catatan</th><th>Dibuat</th></tr>
                      </thead>
                      <tbody>
                        {vres.data.items.map((v) => (
                          <tr key={v.id}>
                            <td className="num mono">v{v.version}</td>
                            <td>{v.change_note || "—"}</td>
                            <td className="mono">{fmtAt(v.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Kebijakan tidak tersedia.</strong> {result.error}</span>
        </div>
      )}

      <PolicyEvaluatePanel />
    </>
  );
}
