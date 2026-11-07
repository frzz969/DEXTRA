import Link from "next/link";
import BareScreen from "@/components/BareScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Belum tersedia — DEXTRA",
};

/**
 * "Coba lagi" hanya boleh menuju path di aplikasi ini. Tanpa pemeriksaan ini,
 * `?next=` menjadi open redirect ke host mana pun.
 */
function safeNext(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return "/overview";
  return value;
}

/**
 * 503. Backend tidak merespons atau tidak bisa menjawab permintaan ini.
 *
 * Sengaja dibedakan dari /forbidden: di sini tidak ada keputusan wewenang yang
 * dibuat — tidak ada yang bisa memutuskan, karena tidak ada jawaban.
 */
export default async function UnavailablePage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string; next?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const reason = (params.reason ?? "").trim();
  const next = safeNext(params.next);

  /* Jangan pernah mencetak ":8000" tanpa host — itu terbaca seperti placeholder
   * yang gagal diisi. Kalau env tidak menyebutkannya, sebut apa adanya. */
  const apiUrl = (process.env.DEXTRA_API_URL ?? "").trim();
  const apiLabel = apiUrl ? apiUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "") : "";

  return (
    <BareScreen>
      <div className="auth auth--single">
        <div className="auth__form">
          <div className="auth__forminner" style={{ textAlign: "center" }}>
            <div
              className="empty__icon"
              style={{
                margin: "0 auto 14px",
                width: 52,
                height: 52,
                background: "var(--warning-100)",
                color: "var(--warning-600)",
              }}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                cloud_off
              </span>
            </div>

            <h1 style={{ fontSize: 22 }}>Backend tidak merespons</h1>
            <p className="small muted" style={{ margin: "8px 0 14px" }}>
              Permintaan ini tidak mendapat jawaban dari{" "}
              {apiLabel ? (
                <>
                  API di <code className="mono">{apiLabel}</code>
                </>
              ) : (
                "API backend"
              )}
              . Tidak ada data yang ditampilkan karena tidak ada data yang diterima — halaman ini
              tidak mengarang isi.
            </p>

            <div
              className="banner banner--warning"
              style={{ textAlign: "left", marginBottom: 14 }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                rule
              </span>
              <span>
                <strong>Penyebab yang dilaporkan:</strong>{" "}
                {reason ? <span className="mono">{reason}</span> : (
                  <span className="muted">tidak disebutkan oleh pemanggil.</span>
                )}
                <span className="tiny" style={{ display: "block", marginTop: 4 }}>
                  Bila penyebabnya kosong, periksa proses backend dan log-nya sebelum menebak.
                </span>
              </span>
            </div>

            <div className="row" style={{ justifyContent: "center", gap: 8, marginBottom: 18 }}>
              <Link className="btn btn--primary" href={next} style={{ minHeight: 44 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  refresh
                </span>
                Coba lagi
              </Link>
              <Link className="btn btn--secondary" href="/overview" style={{ minHeight: 44 }}>
                Kembali ke Overview
              </Link>
            </div>

            <p className="tiny muted" style={{ lineHeight: 1.6 }}>
              Ini bukan penolakan wewenang: tidak ada keputusan yang dibuat, karena tidak ada
              yang bisa memutuskan. Bila server justru menolak, halamannya{" "}
              <Link href="/forbidden">Akses ditolak</Link>.
            </p>
          </div>
        </div>
      </div>
    </BareScreen>
  );
}
