import Link from "next/link";
import type { ReactNode } from "react";
import { apiGet, getPermissions } from "@/lib/api";
import { fmtDateTime } from "@/components/p1";
import { EmptyState, Unavailable } from "@/components/states";
import SignOutButton from "./SignOutButton";
import { RevokeButton, RevokeOthersButton } from "./SessionActions";
import MfaPanel from "./MfaPanel";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

/**
 * Acuan: apps/dashboard/assets/js/views/account.js:196-290.
 *
 * Empat tab mengikuti acuan (ref :210-215): Sesi aktif, MFA, Password,
 * Aktivitas login. Ringkasan identitas di atas tab mengikuti ref :232-242.
 *
 * Perbedaan dengan acuan — semuanya karena sumber datanya berbeda:
 *
 * - Acuan memakai fixture (Maya Lestari, sesi demo, aktivitas contoh) karena
 *   backend P8 saat itu belum mencatat apa pun. Di sini setiap baris berasal
 *   dari endpoint nyata, dan yang tidak tersedia ditandai.
 * - "Password diganti" pada ringkasan acuan tidak bisa diisi: tidak ada
 *   endpoint yang mengembalikan `password_changed_at`.
 * - Isi capability diambil dari GET /api/v1/permissions — data nyata yang sudah
 *   ditampilkan halaman ini sebelum tab ditambahkan, jadi dipertahankan.
 *
 * Endpoint akun (sesi, MFA, password) menuntut `auth_kind == "session"`
 * (cookie httpOnly). Dengan token gateway, server menjawab 400/401 — halaman
 * ini menampilkan keadaan "memerlukan sesi" beserta alasannya, bukan hasil
 * karangan.
 */

type TabKey = "sesi" | "mfa" | "password" | "aktivitas";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sesi", label: "Sesi aktif" },
  { key: "mfa", label: "MFA" },
  { key: "password", label: "Password" },
  { key: "aktivitas", label: "Aktivitas login" }
];

type AuthSession = {
  authenticated: boolean;
  auth_kind: string;
  pending_mfa: boolean;
  scope: string;
  capabilities: string[];
  principal: Record<string, unknown> | null;
  tenant?: { id: string; slug: string };
  role?: string;
  mfa_enabled?: boolean;
};

type SessionItem = {
  id: string;
  issued_at: string;
  last_seen_at: string | null;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  mfa_verified: boolean;
  current: boolean;
};

type LoginEvent = {
  at: string;
  event_type: string;
  outcome: string | null;
  actor_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  detail: unknown;
};

function Chips({ items, tone }: { items: string[]; tone: string }) {
  if (items.length === 0) return <span className="cell-sub">tidak ada</span>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {items.map((cap) => (
        <span key={cap} className={`badge ${tone}`}>
          {cap}
        </span>
      ))}
    </div>
  );
}

function CardHead({ title, desc, aside }: { title: string; desc?: string; aside?: ReactNode }) {
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

/** Keadaan "tidak tersedia karena butuh sesi" — bukan galat, bukan data contoh. */
function NeedsSession({ what, endpoint, error }: { what: string; endpoint: string; error?: string }) {
  return (
    <div className="banner banner--info" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">
        key
      </span>
      <span>
        <strong>{what} memerlukan sesi pengguna.</strong> Endpoint <code className="mono">{endpoint}</code> hanya
        melayani pemanggil dengan <code className="mono">auth_kind=session</code> (cookie httpOnly); pemanggil sekarang
        memakai token gateway, jadi server menolaknya{error ? ` — ${error}` : ""}. Masuk lewat{" "}
        <Link href="/login">halaman masuk</Link> untuk memakai bagian ini.
      </span>
    </div>
  );
}

function outcomeBadge(outcome: string | null) {
  const value = outcome ?? "tidak dicatat";
  const tone = outcome === "success" ? "badge--success" : outcome === "failure" ? "badge--danger" : "badge--outline";
  return <span className={`badge ${tone}`}>{value}</span>;
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const active: TabKey = TABS.some((tab) => tab.key === sp.tab) ? (sp.tab as TabKey) : "sesi";

  const [permissions, session, sessionsRes, history] = await Promise.all([
    getPermissions(),
    apiGet<AuthSession>("/auth/session"),
    apiGet<{ items: SessionItem[] }>("/auth/sessions"),
    apiGet<{ items: LoginEvent[] }>("/security/login-history?limit=20")
  ]);

  const sessionData = session.ok ? session.data : null;
  const hasSession = sessionData !== null && sessionData.auth_kind === "session";
  const principal = permissions.ok ? permissions.data.principal : null;
  const sessions = sessionsRes.ok ? sessionsRes.data.items : [];
  const otherSessionIds = sessions.filter((item) => !item.current).map((item) => item.id);

  /* Dibaca eksplisit: `mfa_enabled` hanya ada bila pemanggil bersesi pengguna
   * (auth/router.py:477-487). Nilai yang tidak ada dibiarkan null, bukan false. */
  const mfaEnabled: boolean | null =
    sessionData !== null && typeof sessionData.mfa_enabled === "boolean" ? sessionData.mfa_enabled : null;
  const sessionEmail: string | null =
    sessionData !== null &&
    sessionData.principal !== null &&
    typeof sessionData.principal.email === "string"
      ? sessionData.principal.email
      : null;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Akun &amp; Keamanan</h1>
          <p>
            Identitas, sesi, dan kredensial pemanggil ini. Semua baris berasal dari{" "}
            <code className="mono">/api/v1/auth</code> dan <code className="mono">/api/v1/security</code>; yang tidak
            tersedia ditandai, bukan diisi contoh.
          </p>
        </div>
        <div className="page-head__actions">
          {hasSession ? (
            <SignOutButton />
          ) : (
            <Link className="btn btn--primary" href="/login" style={{ minHeight: 44 }}>
              <span className="material-symbols-outlined" aria-hidden="true">
                login
              </span>
              Masuk
            </Link>
          )}
        </div>
      </header>

      {/* ---------------- Ringkasan identitas (ref :232-242) ---------------- */}
      <section className="card" aria-label="Ringkasan akun" style={{ marginBottom: "var(--s-4)" }}>
        <CardHead
          title="Ringkasan akun"
          desc="GET /api/v1/auth/session + GET /api/v1/permissions"
          aside={
            <span className={`badge ${hasSession ? "badge--success" : "badge--outline"}`}>
              {hasSession ? "sesi pengguna" : "token gateway"}
            </span>
          }
        />
        <div className="card__body">
          <dl className="def-list">
            <dt>Principal</dt>
            <dd className="mono mono--wrap">
              {!permissions.ok
                ? "tidak tersedia"
                : principal === null
                  ? "tidak ada (token gateway tanpa tenant)"
                  : JSON.stringify(principal)}
            </dd>
            <dt>Peran</dt>
            <dd>{sessionData?.role ?? "tidak tersedia (butuh sesi)"}</dd>
            <dt>Tenant</dt>
            <dd className="mono">
              {sessionData?.tenant ? `${sessionData.tenant.slug} · ${sessionData.tenant.id}` : "tidak tersedia (butuh sesi)"}
            </dd>
            <dt>Jalur masuk</dt>
            <dd className="mono">{sessionData ? sessionData.auth_kind : "tidak tersedia"}</dd>
            <dt>MFA</dt>
            <dd>
              {mfaEnabled === null ? (
                <span className="cell-sub">tidak tersedia (butuh sesi)</span>
              ) : (
                <span className={`badge ${mfaEnabled ? "badge--success" : "badge--warning"}`}>
                  {mfaEnabled ? "aktif" : "belum aktif"}
                </span>
              )}
            </dd>
            <dt>Password diganti</dt>
            <dd>
              <span className="cell-sub">tidak tersedia — tidak ada endpoint yang mengembalikan tanggalnya</span>
            </dd>
            <dt>Scope</dt>
            <dd className="mono">{permissions.ok ? permissions.data.scope : "tidak tersedia"}</dd>
          </dl>

          <div className="divider" />

          <h3 style={{ fontSize: 13, margin: "0 0 var(--s-2)" }}>Capability untuk scope ini</h3>
          {permissions.ok ? (
            <>
              <Chips items={permissions.data.capabilities} tone="badge--success" />
              <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
                Ditegakkan endpoint: {permissions.data.enforced_capabilities.length} dari{" "}
                {permissions.data.all_capabilities.length} capability yang dikenal sistem.
              </p>

              <h3 style={{ fontSize: 13, margin: "var(--s-4) 0 var(--s-2)" }}>
                Capability yang BELUM punya penegak
              </h3>
              <Chips items={permissions.data.unbacked_capabilities} tone="badge--warning" />
              <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
                Capability ini dikenal kontrak tapi belum dijaga endpoint mana pun — tidak diberikan ke scope mana pun
                secara efektif.
              </p>
              {permissions.data.note ? (
                <div className="banner" style={{ marginTop: "var(--s-3)" }}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <span>{permissions.data.note}</span>
                </div>
              ) : null}
            </>
          ) : (
            <Unavailable title="Izin" error={permissions.error} />
          )}
        </div>
      </section>

      {/* Tab sebagai tautan GET biasa: bekerja tanpa hidrasi dan bisa di-bookmark. */}
      <form
        method="get"
        action="/account"
        className="segmented"
        role="group"
        aria-label="Bagian akun"
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

      {/* ---------------- Tab: sesi aktif (ref :210-261) ---------------- */}
      {active === "sesi" ? (
        <section className="card" aria-label="Sesi aktif">
          <CardHead
            title="Sesi aktif"
            desc="Perangkat yang punya sesi sah untuk akun ini"
            aside={
              sessionsRes.ok ? (
                <span className="badge badge--outline">{sessions.length} sesi</span>
              ) : undefined
            }
          />
          <div className="card__body card__body--flush">
            {!hasSession ? (
              <div style={{ padding: "var(--s-4)" }}>
                <NeedsSession
                  what="Daftar sesi aktif"
                  endpoint="GET /api/v1/auth/sessions"
                  error={sessionsRes.ok ? undefined : sessionsRes.error}
                />
              </div>
            ) : !sessionsRes.ok ? (
              <div style={{ padding: "var(--s-4)" }}>
                <Unavailable title="Sesi aktif" error={sessionsRes.error} />
              </div>
            ) : sessions.length === 0 ? (
              <EmptyState icon="logout" title="Tidak ada sesi aktif" body="Tabel sesi tidak berisi baris untuk akun ini." />
            ) : (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Perangkat</th>
                      <th>IP</th>
                      <th>Terakhir aktif</th>
                      <th>Terbit</th>
                      <th>Berakhir</th>
                      <th>MFA</th>
                      <th>Status</th>
                      <th className="col-actions">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((item) => (
                      <tr key={item.id}>
                        <td className="truncate" style={{ maxWidth: 220 }} title={item.user_agent ?? ""}>
                          {item.user_agent ?? "—"}
                        </td>
                        <td className="mono">{item.ip_address ?? "—"}</td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {fmtDateTime(item.last_seen_at)}
                        </td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {fmtDateTime(item.issued_at)}
                        </td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {fmtDateTime(item.expires_at)}
                        </td>
                        <td>
                          <span className={`badge ${item.mfa_verified ? "badge--success" : "badge--outline"}`}>
                            {item.mfa_verified ? "verified" : "belum"}
                          </span>
                        </td>
                        <td>
                          {item.current ? (
                            <span className="badge badge--brand">sesi ini</span>
                          ) : (
                            <span className="badge badge--outline">aktif</span>
                          )}
                        </td>
                        <td className="col-actions">
                          <RevokeButton sessionId={item.id} isCurrent={item.current} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {hasSession && sessionsRes.ok && sessions.length > 0 ? (
            <div className="card__foot">
              <span className="field__hint" style={{ flex: 1 }}>
                Pencabutan memanggil <code className="mono">POST /api/v1/auth/sessions/&#123;id&#125;/revoke</code> satu
                per satu — tidak ada endpoint borongan. Sesi yang sedang dipakai tidak ditawari tombol cabut; keluar
                lewat tombol Keluar di atas.
              </span>
              <RevokeOthersButton ids={otherSessionIds} />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------- Tab: MFA (ref :262-272) ---------------- */}
      {active === "mfa" ? (
        <section className="card" aria-label="Multi-factor authentication">
          <CardHead title="Multi-factor authentication" desc="TOTP, dikelola lewat /api/v1/auth/mfa/*" />
          <div className="card__body">
            {!hasSession ? (
              <NeedsSession
                what="Status dan pengelolaan MFA"
                endpoint="POST /api/v1/auth/mfa/enroll · activate · disable"
                error={session.ok ? undefined : session.error}
              />
            ) : (
              <MfaPanel mfaEnabled={mfaEnabled} email={sessionEmail} />
            )}
          </div>
        </section>
      ) : null}

      {/* ---------------- Tab: password (ref :273-275) ---------------- */}
      {active === "password" ? (
        <section className="card" aria-label="Ganti kata sandi">
          <CardHead title="Ganti kata sandi" desc="Minimal 12 karakter; sesi lain dicabut setelah berubah" />
          <div className="card__body">
            {!hasSession ? (
              <NeedsSession
                what="Ganti password"
                endpoint="POST /api/v1/auth/password"
                error={session.ok ? undefined : session.error}
              />
            ) : (
              <PasswordForm />
            )}
          </div>
        </section>
      ) : null}

      {/* ---------------- Tab: aktivitas login (ref :275-287) ---------------- */}
      {active === "aktivitas" ? (
        <section className="card" aria-label="Aktivitas login">
          <CardHead
            title="Aktivitas login"
            desc="login_succeeded · login_failed · login_throttled · logout"
            aside={history.ok ? <span className="badge badge--outline">{history.data.items.length} baris</span> : undefined}
          />
          <div className="card__body card__body--flush">
            {!history.ok ? (
              <div style={{ padding: "var(--s-4)" }}>
                <Unavailable title="Riwayat login" error={history.error} />
              </div>
            ) : history.data.items.length === 0 ? (
              <EmptyState
                icon="history"
                title="Belum ada aktivitas login"
                body="Tabel security_events belum berisi peristiwa login untuk tenant ini."
              />
            ) : (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Kejadian</th>
                      <th>Aktor</th>
                      <th>IP</th>
                      <th>Perangkat</th>
                      <th>Hasil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.items.map((event, index) => (
                      <tr key={`${event.at}-${event.event_type}-${index}`}>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {fmtDateTime(event.at)}
                        </td>
                        <td>
                          <span className="badge badge--outline">{event.event_type}</span>
                        </td>
                        <td className="truncate" style={{ maxWidth: 180 }} title={event.actor_label ?? ""}>
                          {event.actor_label ?? "—"}
                        </td>
                        <td className="mono">{event.ip_address ?? "—"}</td>
                        <td className="truncate" style={{ maxWidth: 220 }} title={event.user_agent ?? ""}>
                          {event.user_agent ?? "—"}
                        </td>
                        <td>{outcomeBadge(event.outcome)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card__foot">
            <span className="field__hint">
              Sumber: <code className="mono">GET /api/v1/security/login-history?limit=20</code> — dibaca dari tabel
              security_events, bukan tabel terpisah. Butuh capability <code className="mono">view_audit</code>.
            </span>
          </div>
        </section>
      ) : null}
    </>
  );
}
