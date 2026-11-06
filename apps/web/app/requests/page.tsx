import Link from "next/link";
import { getOfficePlans, getPlanDetail } from "@/lib/api";
import { Badge, FilterForm, UnavailableBanner, fmtDateTime } from "@/components/p1";

export const dynamic = "force-dynamic";

type SP = { status?: string; q?: string; id?: string };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const plans = await getOfficePlans();
  const statuses = plans.ok ? [...new Set(plans.data.items.map((p) => p.status ?? "—"))] : [];
  let items = plans.ok ? plans.data.items : [];
  if (sp.status) items = items.filter((p) => p.status === sp.status);
  if (sp.q) { const q = sp.q.toLowerCase(); items = items.filter((p) => p.plan_id.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q)); }
  const detail = sp.id ? await getPlanDetail(sp.id) : null;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text"><h1>Requests</h1><p>Pengajuan kerja dari Office Agent dan kanal terhubung. Status dibaca langsung dari backend.</p></div>
      </header>

      {!plans.ok ? <UnavailableBanner title="Daftar request" error={plans.error} /> : (
        <>
          <FilterForm action="/requests" fields={[
            { name: "q", label: "Cari judul / ID", value: sp.q },
            { name: "status", label: "Status", value: sp.status, type: "select", options: statuses.map((s) => ({ value: s, label: s })) }
          ]} />

          {detail?.ok && (
            <section className="card card--pad" aria-labelledby="req-detail-h" style={{ marginBottom: "var(--s-4)" }}>
              <h2 id="req-detail-h">Detail request</h2>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "var(--s-3)", fontSize: 12 }}>{JSON.stringify(detail.data, null, 2)}</pre>
              <p style={{ marginTop: "var(--s-3)" }}><Link href="/requests">Tutup detail</Link></p>
            </section>
          )}
          {detail && !detail.ok && <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}><span className="material-symbols-outlined" aria-hidden="true">error</span><span>Detail belum terhubung. {detail.error}</span></div>}

          {items.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">send</span><span>{sp.status || sp.q ? "Tidak ada request yang cocok dengan filter." : "Belum ada request."}</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead><tr><th>ID</th><th>Judul</th><th>Status</th><th>Dibuat</th><th></th></tr></thead>
                <tbody>
                  {items.map((p) => {
                    const pid = p.plan_id ?? p.id ?? "";
                    return (
                    <tr key={pid}>
                      <td className="mono">{pid}</td>
                      <td className="cell-title">{(p as { title?: string }).title ?? (p as { summary?: string }).summary ?? pid}</td>
                      <td><Badge value={p.status ?? "—"} /></td>
                      <td className="mono">{fmtDateTime(p.created_at as string | undefined)}</td>
                      <td><Link href={`/requests?id=${pid}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>Detail</Link></td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
