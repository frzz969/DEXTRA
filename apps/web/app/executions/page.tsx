import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type Execution = {
  id: string;
  plan_id: string | null;
  mandate_id: string | null;
  action_id: string | null;
  status: string;
  adapter: string | null;
  started_at: string | null;
  duration_ms: number | null;
  result: string | null;
};

const STATUS_TONE: Record<string, string> = {
  running: "badge--info",
  pending: "badge--outline",
  failed: "badge--outline"
};

function formatStarted(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} dtk`;
  const m = Math.floor(s / 60);
  return `${m} mnt ${Math.round(s % 60)} dtk`;
}

export default async function ExecutionsPage() {
  const result = await apiGet<{ items: Execution[] }>("/executions");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Monitor Eksekusi</h1>
          <p>Eksekusi aksi oleh adapter, terbaru lebih dulu. Data langsung dari API.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">
              <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
            </div>
            <h3>Belum ada eksekusi</h3>
            <p>API mengembalikan daftar kosong. Tidak ada data yang dikarang — eksekusi akan muncul di sini setelah dijalankan.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Adapter</th>
                  <th>Mulai</th>
                  <th className="num">Durasi</th>
                  <th>Hasil</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((ex) => (
                  <tr key={ex.id}>
                    <td>
                      <span className={`badge ${STATUS_TONE[ex.status] ?? "badge--outline"}`}>{ex.status}</span>
                      {ex.status === "failed" && (
                        <span className="material-symbols-outlined" aria-hidden="true" style={{ color: "var(--danger)", verticalAlign: "middle", marginLeft: 4, fontSize: 16 }}>error</span>
                      )}
                    </td>
                    <td>{ex.adapter ?? "—"}</td>
                    <td>{formatStarted(ex.started_at)}</td>
                    <td className="num">{formatDuration(ex.duration_ms)}</td>
                    <td>
                      <span className="truncate" title={ex.result ?? ""} style={{ display: "inline-block", maxWidth: 320 }}>
                        {ex.result ?? "—"}
                      </span>
                    </td>
                    <td>
                      <div className="cell-sub mono truncate" title={ex.id} style={{ maxWidth: 160 }}>exec: {ex.id}</div>
                      {ex.plan_id && <div className="cell-sub mono truncate" title={ex.plan_id} style={{ maxWidth: 160 }}>plan: {ex.plan_id}</div>}
                      {ex.mandate_id && <div className="cell-sub mono truncate" title={ex.mandate_id} style={{ maxWidth: 160 }}>mandate: {ex.mandate_id}</div>}
                      {ex.action_id && <div className="cell-sub mono truncate" title={ex.action_id} style={{ maxWidth: 160 }}>action: {ex.action_id}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Data tidak tersedia.</strong> {result.error}
          </span>
        </div>
      )}
    </>
  );
}
