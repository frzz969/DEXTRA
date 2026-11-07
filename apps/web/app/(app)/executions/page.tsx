import Link from "next/link";
import { getExecutions } from "@/lib/api";
import { Badge, FilterForm, UnavailableBanner, fmtDateTime, fmtDuration } from "@/components/p1";

export const dynamic = "force-dynamic";

type SP = { status?: string; adapter?: string; id?: string; q?: string };

/**
 * Warna angka mengikuti arti status, bukan urutan abjad. Status yang tidak
 * dikenal jatuh ke `info` — lebih baik netral daripada menebak berhasil/gagal.
 */
function statusTone(status: string): "success" | "danger" | "warning" | "info" {
  const s = status.toLowerCase();
  if (s.includes("succeed") || s.includes("success") || s.includes("ok") || s.includes("done")) return "success";
  if (s.includes("fail") || s.includes("error") || s.includes("reject")) return "danger";
  if (s.includes("pend") || s.includes("run") || s.includes("retry") || s.includes("queue")) return "warning";
  return "info";
}

export default async function ExecutionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const result = await getExecutions(200);
  const statuses = result.ok ? [...new Set(result.data.items.map((e) => e.status))] : [];
  const adapters = result.ok ? [...new Set(result.data.items.map((e) => e.adapter ?? "—"))] : [];
  const q = (sp.q ?? "").trim().toLowerCase();
  let items = result.ok ? result.data.items : [];
  if (sp.status) items = items.filter((e) => e.status === sp.status);
  if (sp.adapter) items = items.filter((e) => (e.adapter ?? "—") === sp.adapter);
  if (q) {
    items = items.filter((e) =>
      [e.id, e.status, e.adapter, e.plan_id, e.mandate_id, e.action_id, e.result]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }
  const detail = sp.id ? items.find((e) => e.id === sp.id) : undefined;

  // Hitungan diambil dari seluruh baris yang dimuat, bukan dari hasil filter —
  // strip ini menjawab "apa yang sedang terjadi", bukan "apa yang saya cari".
  const allItems = result.ok ? result.data.items : [];
  const counts = allItems.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});
  const countEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const exportQuery = new URLSearchParams();
  if (q) exportQuery.set("q", sp.q!.trim());
  if (sp.status) exportQuery.set("status", sp.status);
  if (sp.adapter) exportQuery.set("adapter", sp.adapter);
  const exportHref = `/executions/export${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text"><h1>Monitor Eksekusi</h1><p>Eksekusi aksi oleh adapter, terbaru lebih dulu. Data langsung dari API.</p></div>
        <div className="page-head__actions">
          <a className="btn btn--sm" href={exportHref} download>
            <span className="material-symbols-outlined" aria-hidden="true">download</span>
            Ekspor CSV
          </a>
        </div>
      </header>

      {!result.ok ? <UnavailableBanner title="Eksekusi" error={result.error} /> : (
        <>
          <div
            className="statstrip"
            style={{ marginBottom: "var(--s-4)", width: "fit-content", maxWidth: "100%" }}
          >
            {countEntries.map(([status, count]) => (
              <div className="statstrip__item" key={status}>
                <span className="statstrip__label">{status}</span>
                <span className={`statstrip__value statstrip__value--${statusTone(status)}`}>{count}</span>
              </div>
            ))}
            <div className="statstrip__item">
              <span className="statstrip__label">total dimuat</span>
              <span className="statstrip__value">{allItems.length}</span>
            </div>
          </div>

          <FilterForm action="/executions" fields={[
            { name: "q", label: "Cari id, plan, mandate, hasil", value: sp.q, type: "text" },
            { name: "status", label: "Status", value: sp.status, type: "select", options: statuses.map((s) => ({ value: s, label: s })) },
            { name: "adapter", label: "Adapter", value: sp.adapter, type: "select", options: adapters.map((s) => ({ value: s, label: s })) }
          ]} />

          {detail && (
            <section className="card card--pad" aria-labelledby="exec-detail-h" style={{ marginBottom: "var(--s-4)" }}>
              <h2 id="exec-detail-h">Detail <span className="mono">{detail.id}</span></h2>
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "var(--s-3)", marginTop: "var(--s-3)" }}>
                <div><dt className="field__hint">Status</dt><dd><Badge value={detail.status} /></dd></div>
                <div><dt className="field__hint">Adapter</dt><dd>{detail.adapter ?? "—"}</dd></div>
                <div><dt className="field__hint">Mulai</dt><dd className="mono">{fmtDateTime(detail.started_at)}</dd></div>
                <div><dt className="field__hint">Durasi</dt><dd>{fmtDuration(detail.duration_ms)}</dd></div>
                <div><dt className="field__hint">Plan</dt><dd className="mono">{detail.plan_id ?? "—"}</dd></div>
                <div><dt className="field__hint">Mandate</dt><dd className="mono">{detail.mandate_id ?? "—"}</dd></div>
                <div><dt className="field__hint">Action</dt><dd className="mono">{detail.action_id ?? "—"}</dd></div>
              </dl>
              {detail.result && <pre className="mono" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: "var(--s-3)", fontSize: 12 }}>{detail.result}</pre>}
              <p style={{ marginTop: "var(--s-3)" }}><Link href="/executions">Tutup detail</Link></p>
            </section>
          )}

          {items.length === 0 ? (
            <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">play_circle</span><span>{sp.status || sp.adapter ? "Tidak ada eksekusi yang cocok dengan filter." : "Belum ada eksekusi."}</span></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Status</th><th>Adapter</th><th>Mulai</th><th className="num">Durasi</th><th>Hasil</th><th>ID</th><th className="col-actions"><span className="sr-only">Aksi</span></th></tr></thead>
                <tbody>
                  {items.map((ex) => (
                    <tr key={ex.id}>
                      <td><Badge value={ex.status} /></td>
                      <td>{ex.adapter ?? "—"}</td>
                      <td>{fmtDateTime(ex.started_at)}</td>
                      <td className="num">{fmtDuration(ex.duration_ms)}</td>
                      <td><span className="truncate" title={ex.result ?? ""} style={{ display: "inline-block", maxWidth: 280 }}>{ex.result ?? "—"}</span></td>
                      <td className="mono truncate" style={{ maxWidth: 150 }} title={ex.id}>{ex.id}</td>
                      <td className="col-actions"><Link href={`/executions?id=${ex.id}`} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>Detail</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
