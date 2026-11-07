import Link from "next/link";
import { getOfficePlans, type OfficePlan as OfficePlanType } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

type Finding = { code?: string; message?: string; [k: string]: unknown };

type Plan = OfficePlanType;

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function findingText(f: Finding): string {
  return [f.code, f.message].filter(Boolean).join(" — ") || JSON.stringify(f);
}

function isPendingStatus(status: string): boolean {
  return !/reject|expired/i.test(status ?? "");
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const q = (params.q ?? "").trim().toLowerCase();
  const plansResult = await getOfficePlans();
  const plans: Plan[] = plansResult.ok ? plansResult.data.items : [];
  const pending = plans.filter((p) => isPendingStatus(p.status));
  const filtered = q
    ? pending.filter((p) => [p.plan_id, p.status, ...p.actions.map((a) => `${a.action_id} ${a.action_type}`)].join(" ").toLowerCase().includes(q))
    : pending;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Review &amp; Validation</h1>
          <p>Plan menunggu validasi. Keputusan tetap lewat Approval Inbox agar audit rantai utuh.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn" href="/approvals">Buka Approval Inbox</Link>
        </div>
      </header>

      <form method="get" role="search" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "var(--s-4)" }}>
        <label htmlFor="q" className="field__label" style={{ alignSelf: "center" }}>Cari plan</label>
        <input id="q" name="q" className="input" defaultValue={params.q ?? ""} placeholder="plan_id, status, atau tipe aksi…" style={{ maxWidth: 320 }} />
        <button className="btn" type="submit" style={{ minHeight: 44 }}>Cari</button>
      </form>

      {!plansResult.ok ? (
        <Unavailable title="Antrean review" error={plansResult.error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="rate_review"
          title={q ? "Tidak ada plan yang cocok." : "Tidak ada plan menunggu review."}
          body={q ? "Coba kata kunci lain." : "Plan baru akan muncul di sini."}
        />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>Plan</th><th>Status</th><th>Aksi</th><th>Temuan</th><th>Validasi</th><th>Aksi</th></tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-title mono">{p.plan_id}</div>
                    <div className="cell-sub mono">{fmtAt(p.created_at)}</div>
                  </td>
                  <td><span className="badge badge--outline">{p.status}</span></td>
                  <td>
                    <span className="cell-title">{p.actions.length} aksi</span>
                    <div className="cell-sub">{p.actions.map((a) => a.action_type).slice(0, 3).join(", ") || "—"}</div>
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    {p.findings.length === 0 ? <span className="cell-sub">—</span> : (
                      <ul style={{ margin: 0, paddingLeft: "1em" }}>
                        {p.findings.slice(0, 3).map((f, i) => <li key={i} className="cell-sub">{findingText(f)}</li>)}
                      </ul>
                    )}
                  </td>
                  <td className="truncate" style={{ maxWidth: 240 }} title={JSON.stringify(p.validation)}>
                    {Object.keys(p.validation ?? {}).length ? JSON.stringify(p.validation) : "—"}
                  </td>
                  <td>
                    <Link className="btn btn--sm" href={`/approvals?plan=${encodeURIComponent(p.plan_id)}`} style={{ minHeight: 44 }}>
                      Review di Approval
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
            Menampilkan {filtered.length} dari {pending.length} plan menunggu. Hash: <span className="mono">{filtered[0]?.plan_hash ?? "—"}</span>
          </p>
        </div>
      )}
    </>
  );
}
