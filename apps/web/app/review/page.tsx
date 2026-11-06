import Link from "next/link";
import { apiGet } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

type Plan = { id: string; title?: string; status?: string; summary?: string };

export default async function ReviewPage() {
  const plans = await apiGet<{ items: Plan[] }>("/office-agent/plans");
  const pending = plans.ok ? plans.data.items.filter((p) => !p.status || /pending|draft|review/i.test(p.status)) : [];
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Review &amp; Validation</h1>
          <p>Plan yang menunggu validasi manusia sebelum eksekusi. Keputusan tetap lewat Approval Inbox agar audit rantai utuh.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn" href="/approvals">Buka Approval Inbox</Link>
        </div>
      </header>
      {!plans.ok ? (
        <Unavailable title="Antrean review" error={plans.error} />
      ) : pending.length === 0 ? (
        <EmptyState icon="rate_review" title="Tidak ada plan menunggu review." body="Plan baru akan muncul di sini." />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>ID</th><th>Plan</th><th>Status</th><th>Aksi</th></tr></thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.id}</td>
                  <td>{p.title ?? p.summary ?? "—"}</td>
                  <td><span className="badge badge--outline">{p.status ?? "pending"}</span></td>
                  <td><Link className="btn btn--sm" href="/approvals">Review di Approval</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
