import { apiGet } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

type Account = { id: string; name: string; kind: string; status: string; token_count: number; created_at: string };

export default async function ServiceIdentitiesPage() {
  const accounts = await apiGet<{ items: Account[] }>("/service-accounts");
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Service Identity</h1>
          <p>Service account untuk integrasi mesin-ke-mesin. Secret token tidak pernah ditampilkan.</p>
        </div>
      </header>
      {!accounts.ok ? (
        <Unavailable title="Service account" error={accounts.error} />
      ) : accounts.data.items.length === 0 ? (
        <EmptyState icon="badge" title="Belum ada service account." body="Service account dibuat lewat API dengan capability yang sesuai." />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>Nama</th><th>Kind</th><th>Status</th><th className="num">Token aktif</th><th>Dibuat</th></tr></thead>
            <tbody>
              {accounts.data.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td className="mono">{a.kind}</td>
                  <td><span className="badge badge--outline">{a.status}</span></td>
                  <td className="num">{a.token_count}</td>
                  <td className="mono">{a.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
