import { getOverview } from "@/lib/api";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  active_agents: "Agen aktif",
  open_work_packages: "Work package terbuka",
  pending_approvals: "Approval menunggu",
  failed_executions: "Eksekusi gagal",
  active_mandates: "Mandate aktif"
};

export default async function OverviewPage() {
  const result = await getOverview();

  return (
    <>
      <header className="page-head">
        <h1>Overview</h1>
        <p>Ringkasan operasional. Semua angka dihitung dari database, bukan contoh.</p>
      </header>

      {result.ok ? (
        <>
          <section className="kpi-grid" aria-label="Indikator operasional">
            {Object.entries(result.data.kpi).map(([key, value]) => (
              <div className="kpi" key={key}>
                <div className="kpi__label">{LABELS[key] ?? key}</div>
                <div className="kpi__value">{value}</div>
              </div>
            ))}
          </section>

          <div className="notice" style={{ marginBottom: "var(--s-4)" }}>
            Data diambil pada {new Date(result.data.generated_at).toLocaleString("id-ID")} ·
            scope <code>{result.data.scope}</code>
          </div>

          <div className="notice" style={{ marginBottom: "var(--s-4)" }}>
            Data diambil pada {new Date(result.data.generated_at).toLocaleString("id-ID")} ·
            scope <code>{result.data.scope}</code>
          </div>

          {result.data.unavailable.length > 0 && (
            <div className="notice">
              Belum dapat dihitung: {result.data.unavailable.join(", ")}. Metrik ini tidak
              ditampilkan sebagai angka karena datanya belum ada.
            </div>
          )}
        </>
      ) : (
        <div className="notice notice--warn">
          <strong>Data tidak tersedia.</strong> {result.error}
          <br />
          Halaman ini sengaja tidak menampilkan angka contoh. Jalankan API dan isi{" "}
          <code>DEXTRA_API_TOKEN</code> untuk melihat data sebenarnya.
        </div>
      )}
    </>
  );
}
