import Link from "next/link";
import type { ReactNode } from "react";
import {
  apiGet,
  getHealth,
  getMeta,
  getPermissions,
  getPolicies,
  getSettings,
  type SettingsResponse
} from "@/lib/api";
import { Unavailable } from "@/components/states";
import { fmtDateTime } from "@/components/p1";
import DataTools from "./DataTools";

export const dynamic = "force-dynamic";

/**
 * Acuan: apps/dashboard/assets/js/views/admin.js:198-326.
 *
 * Empat tab mengikuti pembagian acuan (ref :336-339), dengan dua penyesuaian
 * yang diminta eksplisit:
 *
 * 1. "Jendela waktu terlindungi" (ref :205-236) dipisah menjadi tab sendiri
 *    karena ia satu-satunya bagian yang benar-benar visual.
 * 2. Tab "Tampilan" (ref :289-307) tidak dibuat: preferensi tema dan sidebar
 *    disimpan di peramban (localStorage), tidak ada endpoint yang membacanya.
 *    Menampilkannya di sini akan menjadi kontrol yang tidak menyimpan apa pun.
 *
 * Sumber data tab ini semuanya endpoint nyata:
 *   - GET /api/v1/settings            → nama org, id, jam kerja, hari libur, versi
 *   - GET /api/v1/policies            → daftar policy aktif
 *   - GET /api/v1/security/overview   → angka sesi/token/MFA/24 jam
 *   - GET /api/v1/meta, /permissions  → konteks pemanggil (dipakai tab Keamanan)
 *   - GET /health                     → status layanan
 *   - GET /api/v1/data/export         → unduhan JSON (lewat ./export/route.ts)
 *   - POST /api/v1/data/reset         → reset conversation demo (./actions.ts)
 *
 * Kunci organisasi (office_hours, friday_prayer, holidays, …) TIDAK punya
 * skema tetap: `/settings` mengembalikan `settings_json` tenant apa adanya
 * (backend/dextra/modules/settings/router.py:32-46). Karena itu setiap kunci
 * dibaca dengan pemeriksaan bentuk dan yang tidak ada ditandai "belum
 * disimpan" — bukan diisi nilai contoh.
 */

type TabKey = "org" | "waktu" | "keamanan" | "data";

const TABS: { key: TabKey; label: string }[] = [
  { key: "org", label: "Aturan organisasi" },
  { key: "waktu", label: "Jendela waktu terlindungi" },
  { key: "keamanan", label: "Keamanan" },
  { key: "data", label: "Data & prototipe" }
];

type SecurityOverview = {
  tenant_id: string;
  generated_at: string;
  sessions: { active: number };
  tokens: { active: number; total: number };
  service_accounts: { active: number };
  members: { active: number; mfa_enabled: number };
  last_24h: { events_by_type: Record<string, number>; failed_logins: number; denied: number };
  capabilities: { can_revoke_sessions: boolean };
};

/* ---------- pembacaan nilai settings tanpa menebak bentuk ---------- */

type TimeRange = { start: string; end: string };

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const text = asString(item);
    if (text) out.push(text);
  }
  return out;
}

function asTimeRange(value: unknown): TimeRange | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const start = asString(record.start);
  const end = asString(record.end);
  return start !== null && end !== null ? { start, end } : null;
}

function minutesOf(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/* ---------- komponen kecil ---------- */

function OrgField({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div className={`small ${missing ? "muted" : "strong"}`} style={{ marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function CardHead({
  title,
  desc,
  aside
}: {
  title: string;
  desc?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="card__head">
      <div>
        <h2>{title}</h2>
        {desc ? <p>{desc}</p> : null}
      </div>
      <div className="spacer" />
      {aside}
    </div>
  );
}

function ReadOnlyBadge() {
  return (
    <span className="badge badge--outline">
      <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 13 }}>
        lock
      </span>
      Read-only
    </span>
  );
}

/* ---------- tab 2: jendela waktu ---------- */

function TimeWindow({
  window,
  friday,
  holidays
}: {
  window: TimeRange | null;
  friday: TimeRange | null;
  holidays: string[];
}) {
  const startMinutes = window ? minutesOf(window.start) : null;
  const endMinutes = window ? minutesOf(window.end) : null;
  const usable = window !== null && startMinutes !== null && endMinutes !== null && endMinutes > startMinutes;

  if (!usable || window === null || startMinutes === null || endMinutes === null) {
    return (
      <div className="empty">
        <div className="empty__icon">
          <span className="material-symbols-outlined" aria-hidden="true">
            schedule
          </span>
        </div>
        <h3>Jendela kerja belum tersimpan</h3>
        <p>
          Kunci <code className="mono">office_hours</code> tidak ada pada{" "}
          <code className="mono">settings</code> tenant, atau bentuknya bukan{" "}
          <code className="mono">{`{ "start": "08:00", "end": "17:00" }`}</code>. Bar waktu tidak digambar dari nilai
          karangan.
        </p>
      </div>
    );
  }

  const span = endMinutes - startMinutes;
  const fridayStart = friday ? minutesOf(friday.start) : null;
  const fridayEnd = friday ? minutesOf(friday.end) : null;
  const fridayDrawable = fridayStart !== null && fridayEnd !== null && fridayEnd > fridayStart;

  let left = 0;
  let width = 0;
  if (fridayStart !== null && fridayEnd !== null && fridayEnd > fridayStart) {
    left = ((fridayStart - startMinutes) / span) * 100;
    width = ((fridayEnd - fridayStart) / span) * 100;
  }
  const outside = fridayDrawable && (left < 0 || left + width > 100);

  return (
    <>
      <div className="timebar">
        <div className="timebar__track">
          {fridayDrawable && !outside ? (
            <span
              className="timebar__blocked"
              style={{ left: `${left}%`, width: `${width}%` }}
              aria-hidden="true"
            />
          ) : null}
        </div>
        <div className="timebar__scale" aria-hidden="true">
          <span>{window.start}</span>
          {fridayDrawable && !outside && friday ? (
            <>
              <span style={{ left: `${left}%` }}>{friday.start}</span>
              <span style={{ left: `${left + width}%` }}>{friday.end}</span>
            </>
          ) : null}
          <span style={{ left: "100%" }}>{window.end}</span>
        </div>
      </div>

      <div className="row row--wrap" style={{ gap: 16, marginTop: 14 }}>
        <span className="row" style={{ gap: 6 }}>
          <span className="dot dot--brand" aria-hidden="true" />
          <span className="tiny muted">
            Jam kerja {window.start}–{window.end}
          </span>
        </span>
        {friday && fridayDrawable && !outside ? (
          <span className="row" style={{ gap: 6 }}>
            <span className="dot dot--danger" aria-hidden="true" />
            <span className="tiny muted">
              Salat Jumat {friday.start}–{friday.end} · tidak dapat dijadwalkan
            </span>
          </span>
        ) : null}
      </div>

      {friday && outside ? (
        <div className="banner banner--warning" role="status" style={{ marginTop: 14 }}>
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          <span>
            Jendela Salat Jumat {friday.start}–{friday.end} berada di luar jam kerja {window.start}–{window.end},
            jadi tidak dapat digambar pada bar ini. Nilai tersimpan tetap ditampilkan apa adanya.
          </span>
        </div>
      ) : null}

      {holidays.length > 0 ? (
        <>
          <div className="divider" style={{ margin: "14px 0 10px" }} />
          <div className="row row--wrap" style={{ gap: 8 }}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 15, color: "var(--muted)" }}>
              event_busy
            </span>
            <span className="tiny muted" style={{ flex: 1 }}>
              Hari libur tersimpan
            </span>
            {holidays.map((day) => (
              <span key={day} className="badge badge--outline">
                {day}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="field__hint" style={{ marginTop: 14 }}>
          Tidak ada hari libur berbentuk teks pada kunci <code className="mono">holidays</code>, jadi tidak ada tanggal
          yang ditandai. Bentuk lain tidak ditafsirkan.
        </p>
      )}
    </>
  );
}

/* ---------- halaman ---------- */

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const active: TabKey = TABS.some((tab) => tab.key === sp.tab) ? (sp.tab as TabKey) : "org";

  const [settings, policies, security, meta, permissions, health] = await Promise.all([
    getSettings(),
    getPolicies(),
    apiGet<SecurityOverview>("/security/overview"),
    getMeta(),
    getPermissions(),
    getHealth()
  ]);

  const settingsData: SettingsResponse | null = settings.ok ? settings.data : null;
  const values: Record<string, unknown> = settingsData ? settingsData.settings : {};
  const tenantSlug = settingsData ? settingsData.tenant_slug : "";

  const officeHours = asTimeRange(values.office_hours);
  const fridayPrayer = asTimeRange(values.friday_prayer);
  const holidays = asStringList(values.holidays);
  const holidaysShapeUnknown =
    values.holidays !== undefined && values.holidays !== null && holidays.length === 0;
  const timezones = asStringList(values.timezones);
  const timezoneSingle = asString(values.timezone);
  const approvalMatrixVersion = asString(values.approval_matrix_version);
  const contractVersion = asString(values.contract_version);
  const orgId = asString(values.org_id) ?? (settingsData ? settingsData.tenant_id : null);

  const canManageIntegrations = permissions.ok && permissions.data.capabilities.includes("manage_integrations");

  const timePolicies = policies.ok
    ? policies.data.items.filter((policy) =>
        /(time|waktu|jumat|friday|libur|holiday)/i.test(`${policy.slug} ${policy.title} ${policy.scope}`)
      )
    : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Settings</h1>
          <p>
            Konfigurasi organisasi, jendela waktu terlindungi, keamanan, dan transparansi data. Semua nilai dibaca
            dari API; yang belum tersimpan ditandai, bukan diisi contoh.
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/integrations" style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              extension
            </span>
            Integrasi
          </Link>
        </div>
      </header>

      {/* Tab sebagai tautan GET biasa: tetap bekerja tanpa hidrasi dan bisa
          di-bookmark — pola yang sama dengan filter di /work-packages. */}
      <form
        method="get"
        action="/settings"
        className="segmented"
        role="group"
        aria-label="Bagian settings"
        style={{ marginBottom: "var(--s-4)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="submit"
            name="tab"
            value={tab.key}
            className={tab.key === active ? "is-active" : undefined}
            aria-pressed={tab.key === active}
          >
            {tab.label}
          </button>
        ))}
      </form>

      {!settings.ok ? (
        <div style={{ marginBottom: "var(--s-4)" }}>
          <Unavailable title="Pengaturan tenant" error={settings.error} />
        </div>
      ) : null}

      {/* ---------------- Tab 1: aturan organisasi ---------------- */}
      {active === "org" ? (
        <>
          <section className="card" aria-label="Aturan organisasi">
            <CardHead
              title="Aturan organisasi"
              desc="Sumber: GET /api/v1/settings (settings_json tenant)"
              aside={<ReadOnlyBadge />}
            />
            <div className="card__body">
              <div className="grid grid--2" style={{ gap: 16 }}>
                <OrgField
                  label="Organisasi"
                  value={settingsData ? settingsData.tenant_name : "tidak tersedia"}
                  missing={settingsData === null}
                />
                <OrgField label="Org ID" value={orgId ?? "belum disimpan"} missing={orgId === null} />
                <OrgField
                  label="Zona waktu"
                  value={
                    timezones.length > 0
                      ? timezones.join(", ")
                      : timezoneSingle ?? "belum disimpan"
                  }
                  missing={timezones.length === 0 && timezoneSingle === null}
                />
                <OrgField
                  label="Jam kerja"
                  value={officeHours ? `${officeHours.start} – ${officeHours.end}` : "belum disimpan"}
                  missing={officeHours === null}
                />
                <OrgField
                  label="Salat Jumat"
                  value={fridayPrayer ? `${fridayPrayer.start} – ${fridayPrayer.end}` : "tidak ada"}
                  missing={fridayPrayer === null}
                />
                <OrgField
                  label="Hari libur"
                  value={
                    holidays.length > 0
                      ? holidays.join(", ")
                      : holidaysShapeUnknown
                        ? "bentuk kunci holidays tidak dikenali"
                        : "belum disimpan"
                  }
                  missing={holidays.length === 0}
                />
                <OrgField
                  label="Versi matriks persetujuan"
                  value={approvalMatrixVersion ?? "belum disimpan"}
                  missing={approvalMatrixVersion === null}
                />
                <OrgField
                  label="Versi kontrak"
                  value={contractVersion ?? "belum disimpan"}
                  missing={contractVersion === null}
                />
              </div>

              <div className="banner banner--info" style={{ marginTop: 16 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  info
                </span>
                <span>
                  Aturan ini dibaca dari server. Mengubahnya butuh capability{" "}
                  <code className="mono">manage_integrations</code> lewat{" "}
                  <code className="mono">PATCH /api/v1/settings</code>; setiap perubahan tercatat di audit.{" "}
                  {permissions.ok
                    ? canManageIntegrations
                      ? "Scope pemanggil memegang capability itu."
                      : `Scope ${permissions.data.scope} tidak memegang capability itu, jadi formulir tulis tidak ditampilkan.`
                    : "Capability pemanggil tidak dapat dibaca."}
                </span>
              </div>
            </div>
          </section>

          <section className="card" aria-label="Kunci settings tersimpan" style={{ marginTop: 16 }}>
            <CardHead title="Kunci tersimpan" desc="Isi settings_json apa adanya, tanpa penafsiran" />
            <div className="card__body">
              {Object.keys(values).length === 0 ? (
                <p className="muted">Belum ada pengaturan tersimpan untuk tenant ini.</p>
              ) : (
                <dl className="def-list">
                  {Object.entries(values).map(([key, value]) => (
                    <div key={key} style={{ display: "contents" }}>
                      <dt className="mono">{key}</dt>
                      <dd className="mono mono--wrap">
                        {typeof value === "string" ? value : JSON.stringify(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>

          <section className="card" aria-label="Kebijakan aktif" style={{ marginTop: 16 }}>
            <CardHead
              title="Kebijakan aktif"
              desc="Ringkas; kelola di halaman Policies"
              aside={
                <Link className="btn btn--secondary btn--sm" href="/policies">
                  Buka policies
                </Link>
              }
            />
            <div className="card__body card__body--flush">
              {!policies.ok ? (
                <div style={{ padding: "var(--s-4)" }}>
                  <Unavailable title="Kebijakan" error={policies.error} />
                </div>
              ) : policies.data.items.length === 0 ? (
                <p className="muted" style={{ padding: "var(--s-4)" }}>
                  Belum ada policy di tenant ini.
                </p>
              ) : (
                policies.data.items.slice(0, 4).map((policy) => (
                  <div
                    key={policy.id}
                    className="row"
                    style={{ padding: "11px 16px", borderBottom: "1px solid var(--border)" }}
                  >
                    <span className="mono tiny faint truncate" style={{ width: 64 }}>
                      {policy.slug}
                    </span>
                    <span className="small" style={{ flex: 1 }}>
                      {policy.title}
                    </span>
                    {policy.is_active ? (
                      <span className="badge badge--success">aktif</span>
                    ) : (
                      <span className="badge badge--outline">nonaktif</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Halaman terkait</h2>
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
        </>
      ) : null}

      {/* ---------------- Tab 2: jendela waktu terlindungi ---------------- */}
      {active === "waktu" ? (
        <>
          <section className="card" aria-label="Jendela waktu terlindungi">
            <CardHead
              title="Jendela waktu terlindungi"
              desc={
                officeHours
                  ? "Sumber: settings tenant (GET /api/v1/settings)"
                  : "Sumber: belum ada di settings tenant"
              }
            />
            <div className="card__body">
              <TimeWindow window={officeHours} friday={fridayPrayer} holidays={holidays} />
            </div>
          </section>

          <section className="card" aria-label="Yang ditegakkan engine" style={{ marginTop: 16 }}>
            <CardHead title="Yang ditegakkan engine" desc="Bukan klaim: reason code dan masukannya nyata" />
            <div className="card__body">
              <dl className="def-list">
                <dt>Reason code jendela</dt>
                <dd className="mono mono--wrap">
                  OUTSIDE_OFFICE_HOURS · HOLIDAY_CONFLICT · FRIDAY_PRAYER_CONFLICT
                </dd>
                <dt>Jam kerja di engine</dt>
                <dd>
                  default kode <code className="mono">(8, 18)</code> — <strong>tidak</strong> dibaca dari settings
                  tenant
                </dd>
                <dt>Masukan evaluasi</dt>
                <dd className="mono mono--wrap">POST /api/v1/policies/evaluate (at, is_friday_prayer, is_holiday)</dd>
                <dt>Sumber kode</dt>
                <dd className="mono mono--wrap">backend/dextra/governance/policy.py:44, 98-113</dd>
              </dl>

              <div className="banner banner--warning" style={{ marginTop: 16 }} role="status">
                <span className="material-symbols-outlined" aria-hidden="true">
                  info
                </span>
                <span>
                  Bar di atas menggambarkan nilai yang <em>tersimpan</em>, bukan yang ditegakkan. Engine menerima jam
                  rencana sebagai masukan dan memakai default <code className="mono">8–18</code>; batas jam kerja dan
                  jendela Salat Jumat belum dibaca dari settings tenant. Uji keputusan nyata lewat{" "}
                  <Link href="/policies">Policies → evaluasi</Link>.
                </span>
              </div>

              <div className="divider" />

              <h3 style={{ fontSize: 13, margin: "0 0 var(--s-2)" }}>Policy yang menyebut jendela waktu</h3>
              {!policies.ok ? (
                <Unavailable title="Daftar policy" error={policies.error} />
              ) : timePolicies.length === 0 ? (
                <p className="small muted" style={{ lineHeight: 1.6 }}>
                  Tidak ada policy di tenant ini yang menyebut waktu, Jumat, atau hari libur. Kebijakan{" "}
                  <code className="mono">TIME-03</code> pada acuan hanya hidup di prototipe dashboard
                  (apps/dashboard/assets/js/data.js:316) dan tidak punya padanan di backend.
                </p>
              ) : (
                <div className="tag-row">
                  {timePolicies.map((policy) => (
                    <span key={policy.id} className="badge badge--outline">
                      {policy.slug} · {policy.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {/* ---------------- Tab 3: keamanan ---------------- */}
      {active === "keamanan" ? (
        <>
          <section className="card" aria-label="Model keamanan">
            <CardHead title="Model keamanan" desc="Angka dari GET /api/v1/security/overview, bukan label" />
            <div className="card__body">
              {!security.ok ? (
                <Unavailable title="Ringkasan keamanan" error={security.error} />
              ) : (
                <>
                  <div className="stack" style={{ gap: 14 }}>
                    <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: 18, color: "var(--success-600)", marginTop: 1 }}
                      >
                        check_circle
                      </span>
                      <div>
                        <div className="small strong">Wewenang diperiksa server, bukan prompt</div>
                        <div className="tiny muted" style={{ lineHeight: 1.5 }}>
                          {permissions.ok ? (
                            <>
                              {permissions.data.enforced_capabilities.length} dari{" "}
                              {permissions.data.all_capabilities.length} capability punya penegak endpoint;{" "}
                              {permissions.data.capabilities.length} di antaranya dipegang scope{" "}
                              <span className="mono">{permissions.data.scope}</span>.
                            </>
                          ) : (
                            "Daftar capability tidak dapat dibaca (GET /permissions gagal)."
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: 18, color: "var(--success-600)", marginTop: 1 }}
                      >
                        check_circle
                      </span>
                      <div>
                        <div className="small strong">Kredensial mesin terpisah dari sesi manusia</div>
                        <div className="tiny muted" style={{ lineHeight: 1.5 }}>
                          Token aktif {security.data.tokens.active} dari {security.data.tokens.total}; service account
                          aktif {security.data.service_accounts.active}; sesi aktif {security.data.sessions.active}.
                        </div>
                      </div>
                    </div>

                    <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: 18, color: "var(--success-600)", marginTop: 1 }}
                      >
                        check_circle
                      </span>
                      <div>
                        <div className="small strong">MFA dihitung dari tabel anggota</div>
                        <div className="tiny muted" style={{ lineHeight: 1.5 }}>
                          {security.data.members.mfa_enabled} dari {security.data.members.active} anggota aktif punya
                          MFA. Anggota tanpa MFA tidak bisa memakai capability sensitif.
                        </div>
                      </div>
                    </div>

                    <div className="divider" style={{ margin: "2px 0" }} />

                    <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{ fontSize: 18, color: "var(--warning-600)", marginTop: 1 }}
                      >
                        info
                      </span>
                      <div>
                        <div className="small strong">Bukan jaminan absolut</div>
                        <div className="tiny muted" style={{ lineHeight: 1.5 }}>
                          24 jam terakhir: {security.data.last_24h.failed_logins} login gagal/ditahan dan{" "}
                          {security.data.last_24h.denied} permintaan ditolak. Angka nol berarti tidak ada peristiwa
                          tercatat — bukan berarti tidak ada percobaan. Diambil {fmtDateTime(security.data.generated_at)}.
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card" aria-label="Sesi saat ini" style={{ marginTop: 16 }}>
            <CardHead title="Sesi saat ini" desc="Konteks pemanggil dari GET /meta dan GET /permissions" />
            <div className="card__body">
              {meta.ok && permissions.ok ? (
                <>
                  <dl className="def-list">
                    <dt>Jalur masuk</dt>
                    <dd className="mono">{meta.data.auth_kind}</dd>
                    <dt>Scope</dt>
                    <dd className="mono">{permissions.data.scope}</dd>
                    <dt>Principal</dt>
                    <dd className="mono mono--wrap">
                      {permissions.data.principal === null
                        ? "tidak ada (token gateway legacy tanpa tenant)"
                        : JSON.stringify(permissions.data.principal)}
                    </dd>
                    <dt>Capability aktif</dt>
                    <dd>{permissions.data.capabilities.join(", ") || "tidak ada"}</dd>
                    <dt>Capability ditegakkan</dt>
                    <dd>{meta.data.enforced_capabilities.join(", ") || "tidak ada"}</dd>
                    <dt>Belum ditegakkan</dt>
                    <dd>{meta.data.unbacked_capabilities.join(", ") || "tidak ada"}</dd>
                    <dt>Cabut sesi tenant</dt>
                    <dd>
                      {security.ok
                        ? security.data.capabilities.can_revoke_sessions
                          ? "diizinkan untuk scope ini"
                          : "butuh capability manage_users"
                        : "tidak diketahui (overview gagal)"}
                    </dd>
                  </dl>
                  <div className="row" style={{ justifyContent: "flex-end", marginTop: "var(--s-3)" }}>
                    <Link className="btn btn--secondary" href="/security" style={{ minHeight: 44 }}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        shield
                      </span>
                      Security Center
                    </Link>
                  </div>
                </>
              ) : (
                <div className="banner banner--warning" role="status">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    error
                  </span>
                  <span>
                    <strong>Konteks pemanggil tidak tersedia.</strong> {!meta.ok ? meta.error : ""}{" "}
                    {!permissions.ok ? permissions.error : ""}
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className="card" aria-label="Status layanan" style={{ marginTop: 16 }}>
            <CardHead title="Status layanan" desc="GET /health (publik, tanpa auth)" />
            <div className="card__body">
              {health.ok ? (
                <dl className="def-list">
                  <dt>Layanan</dt>
                  <dd className="mono">{health.data.service}</dd>
                  <dt>Versi</dt>
                  <dd className="mono">{health.data.version}</dd>
                  <dt>Environment</dt>
                  <dd className="mono">{health.data.environment}</dd>
                  <dt>Database</dt>
                  <dd>{health.data.database.ok ? "terhubung" : "tidak terhubung"}</dd>
                </dl>
              ) : (
                <div className="banner banner--warning" role="status">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    error
                  </span>
                  <span>
                    <strong>Health endpoint tidak tersedia.</strong> {health.error}
                  </span>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {/* ---------------- Tab 4: data & prototipe ---------------- */}
      {active === "data" ? (
        <>
          <section className="card" aria-label="Data dan prototipe">
            <CardHead title="Data & prototipe" desc="Transparansi sumber data dan aksi yang benar-benar ada" />
            <div className="card__body">
              {meta.ok && health.ok ? (
                <div className="banner banner--success" style={{ marginBottom: 14 }}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    cloud_done
                  </span>
                  <span>
                    <strong>Data live.</strong> Seluruh angka di aplikasi ini berasal dari API{" "}
                    <code className="mono">{health.data.environment}</code> versi{" "}
                    <code className="mono">{health.data.version}</code>. Tidak ada dataset contoh di peramban.
                  </span>
                </div>
              ) : (
                <div className="banner banner--warning" style={{ marginBottom: 14 }} role="status">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    cloud_off
                  </span>
                  <span>
                    <strong>Sebagian data tidak tersedia.</strong> {!meta.ok ? meta.error : ""}{" "}
                    {!health.ok ? health.error : ""}
                  </span>
                </div>
              )}

              <dl className="def-list">
                <dt>Tenant</dt>
                <dd className="mono mono--wrap">
                  {settingsData
                    ? `${settingsData.tenant_name} · ${settingsData.tenant_slug} · ${settingsData.tenant_id}`
                    : "tidak tersedia (GET /settings gagal)"}
                </dd>
                <dt>Ekspor</dt>
                <dd className="mono mono--wrap">GET /api/v1/data/export</dd>
                <dt>Reset</dt>
                <dd className="mono mono--wrap">POST /api/v1/data/reset (scope conversations)</dd>
                <dt>Penjaga reset</dt>
                <dd>
                  capability <code className="mono">manage_integrations</code> + konfirmasi sama dengan slug tenant
                </dd>
                <dt>Tidak ikut ekspor</dt>
                <dd>password hash, secret MFA, hash token</dd>
              </dl>

              <div className="divider" />

              <DataTools tenantSlug={tenantSlug} canReset={canManageIntegrations} />

              <p className="tiny muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
                Reset hanya menghapus conversation dan pesannya. Governance, audit, identitas, dan tenant tidak pernah
                disentuh endpoint itu — karena itu ia tidak bisa dipakai menghancurkan data demo inti.
              </p>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
