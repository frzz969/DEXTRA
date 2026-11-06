import Link from "next/link";
import { apiGet, getHealth, getMeta, getPermissions } from "@/lib/api";

export const dynamic = "force-dynamic";

type SettingsData = { settings: Record<string, unknown>; tenant_id?: string };

/* Tidak ada endpoint konfigurasi di backend. Halaman ini menampilkan hanya
 * data nyata yang bisa dibaca: /health (publik), /meta, /permissions.
 * Tidak ada form pengaturan karena tidak ada endpoint untuk menyimpannya. */

export default async function SettingsPage() {
  const [health, meta, permissions, settings] = await Promise.all([getHealth(), getMeta(), getPermissions(), apiGet<SettingsData>("/settings")]);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Settings</h1>
          <p>Konfigurasi sistem. Hanya data nyata dari API, tidak ada pengaturan contoh.</p>
        </div>
      </header>

      {settings.ok ? (
        <section className="card card--pad" aria-label="Pengaturan tenant" style={{ marginBottom: "var(--s-4)" }}>
          <h2 style={{ fontSize: 15, margin: "0 0 var(--s-2)" }}>Pengaturan tenant</h2>
          {Object.keys(settings.data.settings).length === 0 ? (
            <p className="muted">Belum ada pengaturan tersimpan.</p>
          ) : (
            <dl className="def-list">
              {Object.entries(settings.data.settings).map(([k, v]) => (
                <div key={k}><dt className="mono">{k}</dt><dd className="mono">{String(v)}</dd></div>
              ))}
            </dl>
          )}
          <p className="small muted">Perubahan pengaturan lewat <code className="mono">PATCH /settings</code> dengan capability <code className="mono">manage_integrations</code>; setiap perubahan tercatat di audit.</p>
        </section>
      ) : (
        <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <span><strong>Pengaturan tenant belum terhubung.</strong> {settings.error}</span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Status layanan (dari API nyata)</h2>
      {health.ok ? (
        <section className="card card--pad" aria-label="Status layanan" style={{ marginBottom: "var(--s-4)" }}>
          <dl className="def-list">
            <dt>Layanan</dt>
            <dd className="mono">{health.data.service}</dd>
            <dt>Versi</dt>
            <dd className="mono">{health.data.version}</dd>
            <dt>Environment</dt>
            <dd className="mono">{health.data.environment}</dd>
            <dt>Database</dt>
            <dd>{health.data.database.ok ? "terhubung" : "tidak terhubung"}</dd>
            <dt>Endpoint</dt>
            <dd className="mono">GET /health (publik, tanpa auth)</dd>
          </dl>
        </section>
      ) : (
        <div className="banner banner--warning" role="status" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Health endpoint tidak tersedia.</strong> {health.error}
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Konteks pemanggil (dari API)</h2>
      {meta.ok && permissions.ok ? (
        <section className="card card--pad" aria-label="Konteks pemanggil" style={{ marginBottom: "var(--s-4)" }}>
          <dl className="def-list">
            <dt>Jalur masuk</dt>
            <dd className="mono">{meta.data.auth_kind}</dd>
            <dt>Scope</dt>
            <dd className="mono">{permissions.data.scope}</dd>
            <dt>Capability aktif</dt>
            <dd>{permissions.data.capabilities.join(", ") || "tidak ada"}</dd>
            <dt>Capability ditegakkan</dt>
            <dd>{meta.data.enforced_capabilities.join(", ") || "tidak ada"}</dd>
            <dt>Belum ditegakkan</dt>
            <dd>{meta.data.unbacked_capabilities.join(", ") || "tidak ada"}</dd>
          </dl>
          <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
            Sumber: <code className="mono">GET /meta</code> dan <code className="mono">GET /permissions</code>.
            Daftar capability ditegakkan dihitung server dari endpoint yang terpasang, bukan ditulis manual.
          </p>
        </section>
      ) : (
        <div className="banner banner--warning" role="status" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Konteks pemanggil tidak tersedia.</strong>{" "}
            {!meta.ok ? meta.error : ""} {!permissions.ok ? permissions.error : ""}
          </span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Halaman terkait</h2>
      <section className="grid grid--2" aria-label="Halaman terkait">
        <div className="card card--pad">
          <h3 style={{ fontSize: 14 }}>Kebijakan</h3>
          <p className="field__hint" style={{ marginTop: 4 }}>
            Policy yang aktif dan versinya. Dikelola di halaman Policies, bukan di sini.
          </p>
          <Link className="btn btn--secondary" href="/policies" style={{ minHeight: 44, marginTop: "var(--s-3)" }}>
            Buka Policies
          </Link>
        </div>
        <div className="card card--pad">
          <h3 style={{ fontSize: 14 }}>Keamanan</h3>
          <p className="field__hint" style={{ marginTop: 4 }}>
            Sesi, MFA, dan peristiwa keamanan. Dikelola di Security Center.
          </p>
          <Link className="btn btn--secondary" href="/security" style={{ minHeight: 44, marginTop: "var(--s-3)" }}>
            Buka Security Center
          </Link>
        </div>
        <div className="card card--pad">
          <h3 style={{ fontSize: 14 }}>Akses</h3>
          <p className="field__hint" style={{ marginTop: 4 }}>
            Anggota dan peran tenant. Read-only sampai endpoint mutasi ada.
          </p>
          <Link className="btn btn--secondary" href="/access" style={{ minHeight: 44, marginTop: "var(--s-3)" }}>
            Buka Akses
          </Link>
        </div>
        <div className="card card--pad">
          <h3 style={{ fontSize: 14 }}>Token</h3>
          <p className="field__hint" style={{ marginTop: 4 }}>
            Token API dan service account. Buat dan cabut dari sana.
          </p>
          <Link className="btn btn--secondary" href="/tokens" style={{ minHeight: 44, marginTop: "var(--s-3)" }}>
            Buka Token
          </Link>
        </div>
      </section>

      <p className="field__hint" style={{ marginTop: "var(--s-4)" }}>
        Preferensi tampilan (tema terang/gelap dan sidebar ringkas) tersimpan di peramban lewat kontrol
        di topbar, bukan lewat API. Lihat <code className="mono">apps/dashboard/assets/js/views/admin.js</code>{" "}
        untuk tampilan lama Settings.
      </p>
    </>
  );
}
