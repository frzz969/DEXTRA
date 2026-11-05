import { mcpCall, mcpHealth } from "@/lib/mcp";

export const dynamic = "force-dynamic";

type ExecutionSummary = {
  total: number;
  by_result: { sent: number; blocked: number; failed: number; queued: number };
  dispatch_rate: number | null;
  latency: { scope: string; measured: number; p50_ms: number | null; p95_ms: number | null; max_ms: number | null };
  tokens: { measured: number; input: number; output: number; total: number };
  cost_usd: { measured: number; total: number; by_source: { provider_reported: number; rate_card: number; unknown: number } };
};

type ExecutionsResult = { executions: unknown[]; total: number; offset: number; limit: number; summary: ExecutionSummary };

const RESULT_TONE: Record<string, string> = {
  sent: "var(--success-600)",
  blocked: "var(--warning-600)",
  failed: "var(--danger-600)",
  queued: "var(--muted)"
};

const RESULT_LABEL: Record<string, string> = {
  sent: "Diterima adapter",
  blocked: "Ditolak governance",
  failed: "Gagal",
  queued: "Menunggu"
};

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 1000) / 10}%`;
}

function ms(value: number | null): string {
  if (value === null) return "tidak diukur";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(1)} dtk`;
}

function usd(value: number | null | undefined): string {
  if (value === null || value === undefined) return "tidak diukur";
  return `$${value.toFixed(2)}`;
}

export default async function AnalyticsPage() {
  const [health, result] = await Promise.all([
    mcpHealth(),
    mcpCall<ExecutionsResult>("list_executions", { limit: 1, offset: 0 })
  ]);

  const summary = result.ok ? result.data.summary : null;
  const total = summary?.total ?? 0;
  const sent = summary?.by_result.sent ?? 0;
  const blocked = summary?.by_result.blocked ?? 0;
  const failed = summary?.by_result.failed ?? 0;
  const queued = summary?.by_result.queued ?? 0;
  const maxResult = Math.max(sent, blocked, failed, queued, 1);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Analytics</h1>
          <p>Agregasi eksekusi apa adanya dari server — tidak ada angka estimasi, tidak ada yang dibulatkan jadi seolah "berhasil".</p>
        </div>
        <div className="page-head__actions">
          <span className={`badge ${health ? "badge--success" : "badge--danger"}`}>{health ? "MCP live" : "MCP mati"}</span>
        </div>
      </header>

      {summary === null ? (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <span>
            <strong>Analytics tidak tersedia.</strong> {result.ok ? "Ringkasan kosong." : result.error}
            <br />Tidak ada metrik yang dikarang untuk mengisi tempat kosong.
          </span>
        </div>
      ) : (
        <>
          <section className="grid grid--4" aria-label="Ringkasan eksekusi" style={{ marginBottom: "var(--s-4)" }}>
            <div className="card kpi"><div className="kpi__top"><span className="kpi__label">Total eksekusi</span></div><div className="kpi__value">{total}</div><div className="kpi__foot"><span className="cell-sub">seluruh data terfilter</span></div></div>
            <div className="card kpi kpi--success"><div className="kpi__top"><span className="kpi__label">Diterima adapter</span></div><div className="kpi__value">{sent}</div></div>
            <div className="card kpi kpi--warn"><div className="kpi__top"><span className="kpi__label">Ditolak governance</span></div><div className="kpi__value">{blocked}</div></div>
            <div className="card kpi kpi--danger"><div className="kpi__top"><span className="kpi__label">Gagal</span></div><div className="kpi__value">{failed}</div></div>
          </section>

          <div className="grid grid--2" style={{ alignItems: "start", marginBottom: "var(--s-4)" }}>
            <div className="card" style={{ padding: "var(--s-4)" }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>By hasil (seluruh data)</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", marginTop: "var(--s-3)" }}>
                {Object.entries(summary.by_result).map(([key, count]) => (
                  <div key={key}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="small">{RESULT_LABEL[key] ?? key}</span>
                      <span className="mono"><strong>{count}</strong></span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(count / maxResult) * 100}%`, background: RESULT_TONE[key] }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="cell-sub" style={{ marginTop: "var(--s-3)" }}>
                “Diterima adapter” = adapter menerima permintaan dan mengembalikan id — <strong>bukan</strong> keberhasilan bisnis. Adapter mock tidak mengirim apa pun.
              </p>
            </div>

            <div className="card" style={{ padding: "var(--s-4)" }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>Latensi &amp; performa</h2>
              <dl className="def-list" style={{ marginTop: "var(--s-3)" }}>
                <dt>Cakupan</dt><dd>{summary.latency.scope}</dd>
                <dt>Terukur</dt><dd>{summary.latency.measured} panggilan</dd>
                <dt>p50</dt><dd>{ms(summary.latency.p50_ms)}</dd>
                <dt>p95</dt><dd>{ms(summary.latency.p95_ms)}</dd>
                <dt>Maks</dt><dd>{ms(summary.latency.max_ms)}</dd>
                <dt>Dispatch rate</dt><dd>{pct(summary.dispatch_rate)} <span className="faint">(bukan tingkat keberhasilan)</span></dd>
              </dl>
              <h2 style={{ fontSize: 14, margin: "var(--s-5) 0 0" }}>Token &amp; biaya</h2>
              <dl className="def-list" style={{ marginTop: "var(--s-3)" }}>
                <dt>Terukur</dt><dd>{summary.tokens.measured} panggilan</dd>
                <dt>Token in / out</dt><dd>{summary.tokens.measured > 0 ? `${summary.tokens.input} / ${summary.tokens.output}` : "tidak diukur"}</dd>
                <dt>Total token</dt><dd>{summary.tokens.measured > 0 ? summary.tokens.total : "tidak diukur"}</dd>
                <dt>Biaya total</dt><dd>{usd(summary.cost_usd.measured > 0 ? summary.cost_usd.total : null)}</dd>
                <dt>Sumber biaya</dt>
                <dd className="muted">provider {summary.cost_usd.by_source.provider_reported} · rate-card {summary.cost_usd.by_source.rate_card} · unknown {summary.cost_usd.by_source.unknown}</dd>
              </dl>
              <p className="cell-sub" style={{ marginTop: "var(--s-3)" }}>
                Adapter mock melaporkan <code className="mono">null</code> — sampai provider nyata mengisi, semua angka token/biaya tampil “tidak diukur”, bukan tebakan.
              </p>
            </div>
          </div>

          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">info</span>
            <span>
              Angka di atas dihitung di server atas <em>seluruh</em> data terfilter, bukan halaman yang tampil.
              Halaman adalah jendela; metriknya bukan.
            </span>
          </div>
        </>
      )}
    </>
  );
}
