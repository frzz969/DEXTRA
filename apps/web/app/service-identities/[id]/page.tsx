import Link from "next/link";
import { getServiceAccount } from "@/lib/api";
import RevokeButton from "../RevokeButton";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default async function ServiceIdentityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getServiceAccount(id);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <nav className="breadcrumbs" aria-label="breadcrumb">
            <Link href="/service-identities">Service Identity</Link>
            <span className="sep">›</span>
            <span className="current mono">{id}</span>
          </nav>
          <h1>Detail service account</h1>
          <p>Secret tidak ditampilkan. Yang terlihat hanya prefix token dan statusnya.</p>
        </div>
      </header>

      {!result.ok ? (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Tidak tersedia.</strong> {result.error}</span>
        </div>
      ) : (
        <>
          <section className="card" aria-labelledby="si-detail-heading" style={{ marginBottom: "var(--s-4)" }}>
            <div className="card__head">
              <div style={{ minWidth: 0 }}>
                <h2 id="si-detail-heading" style={{ fontSize: 15, margin: 0 }}>{result.data.name}</h2>
                <p className="mono" style={{ margin: "4px 0 0" }}>{result.data.id}</p>
              </div>
              <span className="spacer" />
              <span className={`badge ${result.data.status === "revoked" ? "badge--danger" : "badge--success"}`}>{result.data.status}</span>
            </div>
            <dl className="card__body" style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div><dt className="field__label">Kind</dt><dd className="mono" style={{ margin: "4px 0 0" }}>{result.data.kind}</dd></div>
              <div><dt className="field__label">Deskripsi</dt><dd style={{ margin: "4px 0 0" }}>{result.data.description || "—"}</dd></div>
              <div><dt className="field__label">Dibuat</dt><dd style={{ margin: "4px 0 0" }}>{fmtDate(result.data.created_at)}</dd></div>
              <div><dt className="field__label">Dicabut</dt><dd style={{ margin: "4px 0 0" }}>{fmtDate(result.data.revoked_at)}{result.data.revoke_reason ? ` (${result.data.revoke_reason})` : ""}</dd></div>
              <div><dt className="field__label">Scopes</dt><dd style={{ margin: "4px 0 0" }}>{(result.data.scopes ?? []).join(", ") || "—"}</dd></div>
            </dl>
          </section>

          <section className="card" aria-labelledby="si-tokens-heading" style={{ marginBottom: "var(--s-4)" }}>
            <div className="card__head">
              <h2 id="si-tokens-heading" style={{ fontSize: 15, margin: 0 }}>Token milik identitas ini ({result.data.tokens.length})</h2>
            </div>
            {result.data.tokens.length === 0 ? (
              <div className="card__body"><p className="field__hint" role="status">Tidak ada token. Terbitkan lewat halaman Tokens dengan service_account_id ini.</p></div>
            ) : (
              <div className="table-wrap" style={{ border: 0 }}>
                <table className="table table--compact">
                  <thead><tr><th>Nama</th><th>Prefix</th><th>Status</th><th>Terakhir dipakai</th></tr></thead>
                  <tbody>
                    {result.data.tokens.map((t) => (
                      <tr key={t.id}>
                        <td className="cell-title">{t.name}<div className="cell-sub mono">{t.id}</div></td>
                        <td className="mono">{t.prefix}…</td>
                        <td><span className={`badge ${t.status === "revoked" ? "badge--danger" : "badge--success"}`}>{t.status}</span></td>
                        <td className="mono">{fmtDate(t.last_used_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="card" aria-labelledby="si-revoke-heading">
            <div className="card__head"><h2 id="si-revoke-heading" style={{ fontSize: 15, margin: 0 }}>Cabut identitas</h2></div>
            <div className="card__body">
              <RevokeButton id={result.data.id} name={result.data.name} status={result.data.status} />
            </div>
          </section>
        </>
      )}
    </>
  );
}
