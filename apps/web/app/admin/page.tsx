import { apiGet, apiRootGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type Health = {
  ok: boolean;
  service: string;
  version: string;
  environment: string;
  database: { ok: boolean; dialect?: string };
};

type Meta = {
  api_prefix: string;
  capabilities: string[];
  enforced_capabilities: string[];
  unbacked_capabilities: string[];
  auth_kind: string;
};

export default async function AdminPage() {
  const [health, meta] = await Promise.all([
    apiRootGet<Health>("/health"),
    apiGet<Meta>("/meta")
  ]);

  const dbText = health.ok ? JSON.stringify(health.data.database) : "tidak tersedia";
  const aiConfigured = Boolean(process.env.DEXTRA_AI_API_KEY);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Administrasi</h1>
          <p>Keadaan layanan apa adanya: kesehatan, identitas panggilan, dan kapabilitas yang benar-benar ditegakkan.</p>
        </div>
      </header>

      <section className="grid grid--4" aria-label="Kesehatan layanan" style={{ marginBottom: "var(--s-4)" }}>
        <div className="card kpi">
          <div className="kpi__top"><span className="kpi__label">Layanan API</span></div>
          <div className="kpi__value" style={{ fontSize: 18 }}>{health.ok ? health.data.service : "tidak tersedia"}</div>
          <div className="kpi__foot"><span className="cell-sub">versi {health.ok ? health.data.version : "—"} · env {health.ok ? health.data.environment : "—"}</span></div>
        </div>
        <div className="card kpi">
          <div className="kpi__top"><span className="kpi__label">Database</span></div>
          <div className="kpi__value" style={{ fontSize: 18 }}>{health.ok && health.data.database?.ok === true ? "sehat" : "tidak tersedia"}</div>
          <div className="kpi__foot"><span className="cell-sub mono" style={{ fontSize: 11, overflowWrap: "anywhere" }}>{dbText}</span></div>
        </div>
        <div className="card kpi">
          <div className="kpi__top"><span className="kpi__label">Jenis auth</span></div>
          <div className="kpi__value" style={{ fontSize: 18 }}>{meta.ok ? meta.data.auth_kind : "—"}</div>
          <div className="kpi__foot"><span className="cell-sub">prefix {meta.ok ? meta.data.api_prefix : "—"}</span></div>
        </div>
        <div className="card kpi">
          <div className="kpi__top"><span className="kpi__label">AI provider</span></div>
          <div className="kpi__value" style={{ fontSize: 18 }}>{aiConfigured ? "terkonfigurasi" : "belum diatur"}</div>
          <div className="kpi__foot"><span className="cell-sub">DEXTRA_AI_API_KEY {aiConfigured ? "diisi" : "kosong"}</span></div>
        </div>
      </section>

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Kapabilitas yang benar-benar ditegakkan</h2>
      {meta.ok ? (
        <>
          <div className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: "var(--s-3)" }}>
              {meta.data.enforced_capabilities.map((cap) => (
                <span key={cap} className="badge badge--success"><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 12 }}>check_circle</span>{cap}</span>
              ))}
            </div>
            <p className="field__hint">
              {meta.data.enforced_capabilities.length} dari {meta.data.capabilities.length} kapabilitas kontrak punya penegak nyata; sisanya {meta.data.unbacked_capabilities.length} belum.
            </p>
          </div>

          <h2 style={{ fontSize: 15, margin: "var(--s-4) 0 var(--s-3)" }}>Belum punya penegak (bukan berarti ditolak)</h2>
          <div className="card" style={{ padding: "var(--s-4)" }}>
            {meta.data.unbacked_capabilities.length === 0 ? (
              <p className="field__hint">Tidak ada — semua capability kontrak sudah ditegakkan.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {meta.data.unbacked_capabilities.map((cap) => (
                  <span key={cap} className="badge badge--warning">{cap}</span>
                ))}
              </div>
            )}
            <div className="banner banner--warning" style={{ marginTop: "var(--s-3)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">info</span>
              <span>“Tidak didukung” berarti server belum punya kemampuannya — beda dengan “ditolak”, yang berarti server memutuskan pemanggil tidak berhak.</span>
            </div>
          </div>
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Kontrak kapabilitas tidak tersedia.</strong> {meta.error}</span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Catatan jujur</h2>
      <ul className="small muted" style={{ lineHeight: 1.8 }}>
        <li>Login Google sengaja belum tersedia (endpoint mengembalikan 503) sampai sesi bisa diterbitkan dengan benar.</li>
        <li>Daftar tabel database tidak diekspos API; yang bisa diverifikasi adalah audit chain (<a href="/audit">Audit Center</a>) dan <a href="/security">Security Center</a>.</li>
        <li>Matriks “peran × kemampuan” tidak ada di model identitas — token membawa scope, bukan nama orang.</li>
      </ul>
    </>
  );
}
