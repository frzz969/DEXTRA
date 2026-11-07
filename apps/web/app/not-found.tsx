import Link from "next/link";
import BareScreen from "@/components/BareScreen";

export const metadata = {
  title: "Halaman tidak ditemukan — DEXTRA",
};

/** Tautan yang benar-benar ada di sidebar — bukan daftar harapan. */
const USEFUL = [
  { href: "/overview", label: "Overview", desc: "KPI dan keadaan sistem" },
  { href: "/approvals", label: "Approval Inbox", desc: "Keputusan yang menunggu Anda" },
  { href: "/work-packages", label: "Work Packages", desc: "Paket kerja dan tugasnya" },
  { href: "/audit", label: "Audit Trail", desc: "Jejak append-only" },
];

export default function NotFound() {
  return (
    <BareScreen>
      <div className="auth auth--single">
        <div className="auth__form">
          <div className="auth__forminner" style={{ textAlign: "center" }}>
            <div
              className="empty__icon"
              style={{ margin: "0 auto 14px" }}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined">explore_off</span>
            </div>

            <h1 style={{ fontSize: 22 }}>Halaman tidak ditemukan</h1>
            <p className="small muted" style={{ margin: "8px 0 20px" }}>
              Alamat ini tidak cocok dengan layar mana pun di DEXTRA. Tidak ada data yang
              hilang — hanya tidak ada halaman di sini.
            </p>

            <div className="row" style={{ justifyContent: "center", gap: 8, marginBottom: 24 }}>
              <Link className="btn btn--primary" href="/overview" style={{ minHeight: 44 }}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  arrow_back
                </span>
                Kembali ke Overview
              </Link>
            </div>

            <div style={{ textAlign: "left" }}>
              <p className="field__label" style={{ marginBottom: 8 }}>
                Layar yang mungkin Anda cari
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {USEFUL.map((item) => (
                  <li key={item.href} style={{ marginBottom: 6 }}>
                    <Link
                      href={item.href}
                      style={{
                        display: "block",
                        padding: "9px 11px",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface-2)",
                      }}
                    >
                      <span className="small strong">{item.label}</span>
                      <span className="tiny muted" style={{ display: "block" }}>
                        {item.desc}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </BareScreen>
  );
}
