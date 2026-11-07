import Link from "next/link";
import { getServiceAccounts } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default async function ServiceIdentitiesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; kind?: string; status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim().toLowerCase();
  const kindFilter = (params.kind ?? "").trim();
  const statusFilter = (params.status ?? "").trim();
  const accounts = await getServiceAccounts();

  const items = accounts.ok
    ? accounts.data.items.filter((a) => {
        const matchQ = !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
        const matchKind = !kindFilter || a.kind === kindFilter;
        const matchStatus = !statusFilter || a.status === statusFilter;
        return matchQ && matchKind && matchStatus;
      })
    : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Service Identity</h1>
          <p>Service account untuk integrasi mesin-ke-mesin. Secret token tidak pernah ditampilkan — hanya prefix dan status token.</p>
        </div>
      </header>

      {accounts.ok && (
        <form method="get" className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }} role="search" aria-label="Saring service account">
          <div style={{ display: "grid", gap: "var(--s-3)", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <div className="field">
              <label className="field__label" htmlFor="si-q">Cari nama / ID</label>
              <input className="input" id="si-q" name="q" defaultValue={params.q ?? ""} placeholder="office-agent-worker" style={{ minHeight: 44 }} />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="si-kind">Kind</label>
              <select className="select" id="si-kind" name="kind" defaultValue={kindFilter} style={{ minHeight: 44 }}>
                <option value="">Semua kind</option>
                {(accounts.data.kinds ?? []).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="si-status">Status</label>
              <select className="select" id="si-status" name="status" defaultValue={statusFilter} style={{ minHeight: 44 }}>
                <option value="">Semua status</option>
                <option value="active">active</option>
                <option value="revoked">revoked</option>
              </select>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn--secondary" style={{ minHeight: 44 }}>
                <span className="material-symbols-outlined" aria-hidden="true">filter_alt</span>Terapkan
              </button>
            </div>
          </div>
          {(q || kindFilter || statusFilter) && (
            <p className="field__hint" role="status" style={{ marginTop: "var(--s-2)" }}>
              Menampilkan {items.length} dari {accounts.data.items.length}. <Link href="/service-identities">Hapus saringan</Link>
            </p>
          )}
        </form>
      )}

      {!accounts.ok ? (
        <Unavailable title="Service account" error={accounts.error} />
      ) : items.length === 0 ? (
        <EmptyState icon="badge" title={q || kindFilter || statusFilter ? "Tidak ada yang cocok." : "Belum ada service account."} body="Service account dibuat lewat API dengan capability yang sesuai (manage_integrations, sesi pengguna)." />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>Nama</th><th>Kind</th><th>Status</th><th>Scopes</th><th className="num">Token</th><th>Dibuat</th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/service-identities/${encodeURIComponent(a.id)}`} className="cell-title">{a.name}</Link>
                    <div className="cell-sub mono" title={a.id}>{a.id}</div>
                    {a.description && <div className="cell-sub">{a.description}</div>}
                  </td>
                  <td className="mono">{a.kind}</td>
                  <td><span className={`badge ${a.status === "revoked" ? "badge--danger" : "badge--success"}`}>{a.status}</span></td>
                  <td><span className="tiny muted">{(a.scopes ?? []).join(", ") || "—"}</span></td>
                  <td className="num">{a.token_count ?? 0}</td>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
