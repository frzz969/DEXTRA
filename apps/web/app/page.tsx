import { getOverview } from "@/lib/api";

export const dynamic = "force-dynamic";

const KPI_META: Record<
  string,
  { label: string; icon: string; tone?: string }
> = {
  active_agents: { label: "Agen aktif", icon: "smart_toy", tone: "kpi--accent" },
  open_work_packages: { label: "Work package terbuka", icon: "inventory_2" },
  pending_approvals: { label: "Approval menunggu", icon: "hourglass_top", tone: "kpi--warn" },
  failed_executions: { label: "Eksekusi gagal", icon: "error", tone: "kpi--danger" },
  active_mandates: { label: "Mandate aktif", icon: "shield", tone: "kpi--success" }
};

export default async function OverviewPage() {
  const result = await getOverview();

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Overview</h1>
          <p>Ringkasan operasional. Semua angka dihitung dari database, bukan contoh.</p>
        </div>
      </header>

      {result.ok ? (
        <>
          <section className="grid grid--4" aria-label="Indikator operasional" style={{ marginBottom: "var(--s-5)" }}>
            {Object.entries(result.data.kpi).map(([key, value]) => {
              const meta = KPI_META[key];
              return (
                <div className={`card kpi ${meta?.tone ?? ""}`} key={key}>
                  <div className="kpi__top">
                    <span className="kpi__label">{meta?.label ?? key}</span>
                    <span className="kpi__icon" aria-hidden="true">
                      <span className="material-symbols-outlined">{meta?.icon ?? "data_usage"}</span>
                    </span>
                  </div>
                  <div className="kpi__value">{value}</div>
                </div>
              );
            })}
          </section>

          <div className="banner" style={{ marginBottom: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
            <span>
              Data diambil pada {new Date(result.data.generated_at).toLocaleString("id-ID")} · scope{" "}
              <code className="mono">{result.data.scope}</code>
            </span>
          </div>

          {result.data.unavailable.length > 0 && (
            <div className="banner banner--warning">
              <span className="material-symbols-outlined" aria-hidden="true">warning</span>
              <span>
                Belum dapat dihitung: {result.data.unavailable.join(", ")}. Metrik ini tidak
                ditampilkan sebagai angka karena datanya belum ada.
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Data tidak tersedia.</strong> {result.error}
            <br />
            Halaman ini sengaja tidak menampilkan angka contoh. Jalankan API dan isi{" "}
            <code className="mono">DEXTRA_API_TOKEN</code> untuk melihat data sebenarnya.
          </span>
        </div>
      )}
    </>
  );
}
