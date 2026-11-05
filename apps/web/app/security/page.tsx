import { apiGet } from "@/lib/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

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

type SecurityEvent = {
  id: string;
  at: string;
  event_type: string;
  severity: string;
  outcome: string | null;
  actor_label: string | null;
  ip_address: string | null;
};

type SessionItem = {
  id: string;
  user_email: string | null;
  issued_at: string;
  last_seen_at: string | null;
  expires_at: string;
  ip_address: string | null;
  mfa_verified: boolean;
};

type MfaStatus = {
  items: { email: string; display_name: string; mfa_enabled: boolean; mfa_enrolled_at: string | null; last_login_at: string | null }[];
  enabled: number;
  total: number;
};

const SEVERITY_TONE: Record<string, string> = {
  critical: "badge--danger",
  warning: "badge--warning",
  info: "badge--outline"
};

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function SectionUnavailable({ title, error }: { title: string; error: string }) {
  return (
    <div className="banner banner--warning" role="status" style={{ marginTop: "var(--s-3)" }}>
      <span className="material-symbols-outlined" aria-hidden="true">lock</span>
      <span>
        <strong>{title} tidak tersedia.</strong> {error}
      </span>
    </div>
  );
}

export default async function SecurityPage() {
  const [overview, events, sessions, mfa] = await Promise.all([
    apiGet<SecurityOverview>("/security/overview"),
    apiGet<{ items: SecurityEvent[]; total: number; window_hours: number }>("/security/events?limit=15"),
    apiGet<{ items: SessionItem[] }>("/security/sessions"),
    apiGet<MfaStatus>("/security/mfa-status")
  ]);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Security Center</h1>
          <p>Peristiwa keamanan, sesi aktif, dan status MFA. Semua angka berasal dari audit dan tabel sesi.</p>
        </div>
      </header>

      {overview.ok ? (
        <>
          <section className="grid grid--4" aria-label="Ringkasan keamanan" style={{ marginBottom: "var(--s-4)" }}>
            <div className="card kpi kpi--accent">
              <div className="kpi__top">
                <span className="kpi__label">Sesi aktif</span>
                <span className="kpi__icon" aria-hidden="true"><span className="material-symbols-outlined">key</span></span>
              </div>
              <div className="kpi__value">{overview.data.sessions.active}</div>
            </div>
            <div className="card kpi kpi--warn">
              <div className="kpi__top">
                <span className="kpi__label">Token aktif / total</span>
                <span className="kpi__icon" aria-hidden="true"><span className="material-symbols-outlined">vpn_key</span></span>
              </div>
              <div className="kpi__value">{overview.data.tokens.active} / {overview.data.tokens.total}</div>
            </div>
            <div className="card kpi">
              <div className="kpi__top">
                <span className="kpi__label">Service account</span>
                <span className="kpi__icon" aria-hidden="true"><span className="material-symbols-outlined">smart_toy</span></span>
              </div>
              <div className="kpi__value">{overview.data.service_accounts.active}</div>
            </div>
            <div className="card kpi kpi--success">
              <div className="kpi__top">
                <span className="kpi__label">MFA aktif</span>
                <span className="kpi__icon" aria-hidden="true"><span className="material-symbols-outlined">verified_user</span></span>
              </div>
              <div className="kpi__value">{overview.data.members.mfa_enabled} / {overview.data.members.active}</div>
            </div>
          </section>

          <div className="banner" style={{ marginBottom: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
            <span>
              24 jam terakhir: <strong>{overview.data.last_24h.failed_logins}</strong> login gagal/ditahan,{" "}
              <strong>{overview.data.last_24h.denied}</strong> permintaan ditolak. Diambil pada{" "}
              {fmtAt(overview.data.generated_at)}.
            </span>
          </div>
        </>
      ) : (
        <SectionUnavailable title="Ringkasan keamanan" error={overview.error} />
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Peristiwa keamanan terbaru</h2>
      {events.ok ? (
        events.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">shield</span>
            <span>Tidak ada peristiwa keamanan dalam jendela ini.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Tipe</th>
                  <th>Severity</th>
                  <th>Outcome</th>
                  <th>Aktor</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {events.data.items.map((event) => (
                  <tr key={event.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(event.at)}</td>
                    <td><span className="badge badge--outline">{event.event_type}</span></td>
                    <td><span className={`badge ${SEVERITY_TONE[event.severity] ?? "badge--outline"}`}>{event.severity}</span></td>
                    <td>{event.outcome ?? "—"}</td>
                    <td className="truncate" style={{ maxWidth: 160 }} title={event.actor_label ?? ""}>{event.actor_label ?? "—"}</td>
                    <td className="mono">{event.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
              Total {events.data.total} peristiwa dalam {events.data.window_hours} jam terakhir.
            </p>
          </div>
        )
      ) : (
        <SectionUnavailable title="Peristiwa keamanan" error={events.error} />
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Sesi aktif tenant</h2>
      {sessions.ok ? (
        sessions.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">logout</span>
            <span>Tidak ada sesi aktif.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Terbit</th>
                  <th>Terakhir aktif</th>
                  <th>IP</th>
                  <th>MFA</th>
                  <th>Berakhir</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="truncate" title={s.user_email ?? ""} style={{ maxWidth: 200 }}>{s.user_email ?? "—"}</td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(s.issued_at)}</td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(s.last_seen_at)}</td>
                    <td className="mono">{s.ip_address ?? "—"}</td>
                    <td>
                      <span className={`badge ${s.mfa_verified ? "badge--success" : "badge--outline"}`}>
                        {s.mfa_verified ? "verified" : "belum"}
                      </span>
                    </td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(s.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <SectionUnavailable title="Sesi aktif tenant" error={sessions.error} />
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Status MFA anggota</h2>
      {mfa.ok ? (
        <div className="banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
          <span>
            <strong>{mfa.data.enabled} dari {mfa.data.total}</strong> anggota tenant punya MFA aktif.
            {mfa.data.enabled < mfa.data.total && " Anggota tanpa MFA tidak bisa memakai capability sensitif."}
          </span>
        </div>
      ) : (
        <SectionUnavailable title="Status MFA" error={mfa.error} />
      )}

      <p className="field__hint" style={{ marginTop: "var(--s-4)" }}>
        Mencabut sesi milik orang lain membutuhkan role admin. Lihat juga <Link href="/audit">Audit Center</Link>.
      </p>
    </>
  );
}
