import { apiGet } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

type Plan = { id: string; title?: string; status?: string; summary?: string; created_at?: string };

export default async function RequestsPage() {
  const plans = await apiGet<{ items: Plan[] }>("/office-agent/plans");
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Requests</h1>
          <p>Pengajuan kerja dari Office Agent dan kanal terhubung. Status dibaca langsung dari backend.</p>
        </div>
      </header>
      {!plans.ok ? (
        <Unavailable title="Daftar request" error={plans.error} />
      ) : plans.data.items.length === 0 ? (
        <EmptyState icon="send" title="Belum ada request." body="Request baru muncul di sini setelah dibuat dari Office Agent atau kanal terhubung." />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>ID</th><th>Judul</th><th>Status</th><th>Dibuat</th></tr></thead>
            <tbody>
              {plans.data.items.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>{p.title ?? p.summary ?? "—"}</td>
                  <td><span className="badge badge--outline">{p.status ?? "—"}</span></td>
                  <td className="mono">{p.created_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
