import Link from "next/link";
import BareScreen from "@/components/BareScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Akses ditolak — DEXTRA",
};

/**
 * 403. Server sudah memutuskan menolak pemanggil ini — bukan kegagalan teknis,
 * dan bukan halaman yang belum ada (itu /unavailable).
 *
 * `?need=<capability>` menyebut capability yang kurang. Bila parameter itu tidak
 * ada, halaman tidak mengarang nama capability: ia mengatakan bahwa server tidak
 * menyebutkannya.
 */
export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams?: Promise<{ need?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const need = (params.need ?? "").trim();

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
                background: "var(--danger-100)",
                color: "var(--danger-600)",
              }}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
                lock
              </span>
            </div>

            <h1 style={{ fontSize: 22 }}>Anda tidak punya wewenang</h1>
            <p className="small muted" style={{ margin: "8px 0 14px" }}>
              Server menolak permintaan ini atas nama peran Anda. Halaman tetap ada — hanya
              terkunci untuk pemanggil ini.
            </p>

            {need ? (
              <div className="banner banner--danger" style={{ textAlign: "left", marginBottom: 14 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  key_off
                </span>
                <span>
                  <strong>Capability yang kurang:</strong>{" "}
                  <code className="mono">{need}</code>
                  <span className="tiny" style={{ display: "block", marginTop: 4 }}>
                    Tanpa capability ini, permintaan tidak pernah sampai ke datanya.
                    Menambah peran atau capability dilakukan di Access Management.
                  </span>
                </span>
              </div>
            ) : (
              <div className="banner" style={{ textAlign: "left", marginBottom: 14 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  help
                </span>
                <span>
                  Server tidak menyebutkan capability mana yang kurang pada permintaan ini.
                  Daftar capability yang Anda pegang ada di Access Management.
                </span>
              </div>
            )}

            <div className="row" style={{ justifyContent: "center", gap: 8, marginBottom: 18 }}>
              <Link className="btn btn--primary" href="/overview" style={{ minHeight: 44 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  arrow_back
                </span>
                Kembali ke Overview
              </Link>
              <Link className="btn btn--secondary" href="/access" style={{ minHeight: 44 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  admin_panel_settings
                </span>
                Lihat capability Anda
              </Link>
            </div>

            <p className="tiny muted" style={{ lineHeight: 1.6 }}>
              Ini keputusan, bukan gangguan. Bila backend tidak merespons sama sekali,
              halamannya <Link href="/unavailable">Belum tersedia</Link>.
            </p>
          </div>
        </div>
      </div>
    </BareScreen>
  );
}
