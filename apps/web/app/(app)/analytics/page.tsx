import { getAnalyticsDaily, getExecutions, getOverview, type AnalyticsDay } from "@/lib/api";

export const dynamic = "force-dynamic";

/* Analytics dibaca dari API :8000: /overview untuk KPI, /analytics/daily
 * untuk chart 7 hari, /executions untuk distribusi status dan durasi.
 * Backend belum punya endpoint token / biaya, jadi bagian itu ditandai
 * belum tersedia — bukan diisi nol. */

type DayRow = {
  date: string;
  label: string;
  total: number;
  succeeded: number;
  failed: number;
  blocked: number;
  pending: number;
  running: number;
  skipped: number;
};

const STATUS_LABEL: Record<string, string> = {
  succeeded: "Berhasil",
  failed: "Gagal",
  blocked: "Diblokir",
  pending: "Menunggu",
  running: "Berjalan",
  skipped: "Dilewati"
};

const STATUS_TONE: Record<string, string> = {
  succeeded: "var(--success-600)",
  failed: "var(--danger-600)",
  blocked: "var(--warning-600)",
  pending: "var(--muted)",
  running: "var(--info-600)",
  skipped: "var(--faint)"
};

function shortLabel(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString("id-ID", { weekday: "short", timeZone: "UTC" });
}

function fmtMs(ms: number | null): string {
  if (ms == null) return "tidak diukur";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} dtk`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default async function AnalyticsPage() {
  const [overview, executions, daily] = await Promise.all([
    getOverview(),
    getExecutions(200),
    getAnalyticsDaily()
  ]);

  const failedToLoad = !overview.ok && !executions.ok && !daily.ok;
  const loadError = !overview.ok
    ? overview.error
    : !executions.ok
      ? executions.error
      : !daily.ok
        ? daily.error
        : "";

  const items = executions.ok ? executions.data.items : [];
  const byStatus = new Map<string, number>();
  const durations: number[] = [];
  for (const item of items) {
    byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
    if (item.duration_ms != null) durations.push(item.duration_ms);
  }
  const maxStatus = Math.max(1, ...byStatus.values());

  // Tren 7 hari dari GET /analytics/daily (server-side, nyata).
  const dailyItems: AnalyticsDay[] = daily.ok ? daily.data.items : [];
  const days: DayRow[] = dailyItems.map((d) => ({
    date: d.date,
    label: shortLabel(d.date),
    total: d.total,
    succeeded: d.succeeded,
    failed: d.failed,
    blocked: d.blocked,
    pending: d.pending,
    running: d.running,
    skipped: d.skipped
  }));
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Analytics</h1>
          <p>Angka dari API :8000. Yang belum diukur ditandai, bukan diisi nol.</p>
        </div>
      </header>

      {failedToLoad ? (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            cloud_off
          </span>
          <span>
            <strong>Belum terhubung ke API (:8000).</strong> {loadError} Tidak ada metrik yang
            dikarang untuk mengisi tempat kosong.
          </span>
        </div>
      ) : (
        <>
          {(!overview.ok || !executions.ok || !daily.ok) && (
            <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">
                cloud_off
              </span>
              <span>
                <strong>Sebagian data belum terhubung.</strong>{" "}
                {!overview.ok ? `Overview: ${overview.error} ` : ""}
                {!executions.ok ? `Eksekusi: ${executions.error} ` : ""}
                {!daily.ok ? `Harian: ${daily.error}` : ""} Bagian yang tampil di bawah
                ini hanya dari sumber yang merespons.
              </span>
            </div>
          )}

          {overview.ok && (
            <section
              className="grid grid--4"
              aria-label="Ringkasan operasional"
              style={{ marginBottom: "var(--s-4)" }}
            >
              <div className="card kpi">
                <div className="kpi__top">
                  <span className="kpi__label">Agen aktif</span>
                </div>
                <div className="kpi__value">{overview.data.kpi.active_agents}</div>
              </div>
              <div className="card kpi">
                <div className="kpi__top">
                  <span className="kpi__label">Paket kerja terbuka</span>
                </div>
                <div className="kpi__value">{overview.data.kpi.open_work_packages}</div>
              </div>
              <div className="card kpi kpi--warn">
                <div className="kpi__top">
                  <span className="kpi__label">Approval menunggu</span>
                </div>
                <div className="kpi__value">{overview.data.kpi.pending_approvals}</div>
              </div>
              <div className="card kpi kpi--danger">
                <div className="kpi__top">
                  <span className="kpi__label">Eksekusi gagal</span>
                </div>
                <div className="kpi__value">{overview.data.kpi.failed_executions}</div>
              </div>
            </section>
          )}

          <div className="grid grid--2" style={{ alignItems: "start", marginBottom: "var(--s-4)", gap: "var(--s-4)" }}>
            <div className="card" style={{ padding: "var(--s-4)" }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>Eksekusi 7 hari terakhir</h2>
              <p className="cell-sub" style={{ marginTop: 4 }}>
                Dari <code className="mono">GET /analytics/daily</code> (server-side, 7 hari UTC).
                {daily.ok ? "" : " Gagal dimuat — chart tidak dihitung dari sumber lain."}
              </p>

              <figure
                role="img"
                aria-label={`Diagram batang eksekusi 7 hari. Total tertinggi ${maxDay}.`}
                style={{ margin: "var(--s-4) 0 0" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                    height: 140,
                    borderBottom: "1px solid var(--border)",
                    paddingBottom: 4
                  }}
                >
                  {days.map((d) => (
                    <div
                      key={d.date}
                      style={{
                        flex: "1 1 0",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        height: "100%",
                        gap: 4
                      }}
                    >
                      <span className="mono" style={{ fontSize: 11 }}>
                        {d.total}
                      </span>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 34,
                          height: `${Math.max(d.total === 0 ? 2 : 4, (d.total / maxDay) * 100)}%`,
                          background: "var(--brand-500)",
                          borderRadius: "4px 4px 0 0",
                          minHeight: 2
                        }}
                      />
                      <span className="tiny muted">{d.label}</span>
                    </div>
                  ))}
                </div>
                <figcaption className="cell-sub" style={{ marginTop: 6 }}>
                  Batang = jumlah eksekusi per hari. Angka di atas batang sama dengan tabel di bawah
                  ini.
                </figcaption>
              </figure>

              {!daily.ok ? (
                <p className="cell-sub" role="alert" style={{ marginTop: "var(--s-3)" }}>
                  Chart 7 hari tidak tersedia: {daily.error}
                </p>
              ) : (
              <div className="table-wrap" style={{ marginTop: "var(--s-3)" }}>
                <table className="table table--compact">
                  <caption style={{ textAlign: "left", padding: "6px 0" }}>
                    Tabel pendamping diagram 7 hari
                  </caption>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th className="num">Total</th>
                      <th className="num">Berhasil</th>
                      <th className="num">Gagal</th>
                      <th className="num">Diblokir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((d) => (
                      <tr key={d.date}>
                        <td className="mono">{d.date}</td>
                        <td className="num">{d.total}</td>
                        <td className="num">{d.succeeded}</td>
                        <td className="num">{d.failed}</td>
                        <td className="num">{d.blocked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>

            <div className="card" style={{ padding: "var(--s-4)" }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>Distribusi status</h2>
              <p className="cell-sub" style={{ marginTop: 4 }}>
                Dari <strong>{items.length}</strong> eksekusi terakhir yang dikirim API.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", marginTop: "var(--s-3)" }}>
                {[...byStatus.entries()].map(([status, count]) => (
                  <div key={status}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="small">{STATUS_LABEL[status] ?? status}</span>
                      <span className="mono">
                        <strong>{count}</strong>
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${STATUS_LABEL[status] ?? status}: ${count}`}
                      aria-valuenow={count}
                      aria-valuemin={0}
                      aria-valuemax={maxStatus}
                      style={{ height: 8, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden" }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(count / maxStatus) * 100}%`,
                          background: STATUS_TONE[status] ?? "var(--muted)"
                        }}
                      />
                    </div>
                  </div>
                ))}
                {byStatus.size === 0 && <p className="cell-sub">Belum ada eksekusi.</p>}
              </div>

              <h2 style={{ fontSize: 14, margin: "var(--s-5) 0 0" }}>Durasi</h2>
              <dl className="def-list" style={{ marginTop: "var(--s-3)" }}>
                <dt>Terukur</dt>
                <dd>{durations.length} eksekusi</dd>
                <dt>Median</dt>
                <dd>{fmtMs(median(durations))}</dd>
                <dt>Token &amp; biaya</dt>
                <dd>belum tersedia — API :8000 belum mengirim kolom ini</dd>
              </dl>
            </div>
          </div>

          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">
              info
            </span>
            <span>
              Token dan biaya belum tampil karena endpoint :8000 belum menyediakannya. Angka di atas
              tidak diperkirakan.
            </span>
          </div>
        </>
      )}
    </>
  );
}
