import type { ReactNode } from "react";
import PublicFooter from "@/components/PublicFooter";
import PublicNav from "@/components/PublicNav";
import "./marketing.css";

/* Shell pemasaran untuk halaman publik: header, main, footer.
 *
 * Layar bare (/login, /forbidden, /unavailable) tidak lagi berada di grup ini
 * melainkan di app/(bare), yang layout-nya hanya meneruskan children. Jadi
 * tidak ada chrome yang perlu disembunyikan di sini.
 *
 * Tidak ada fetch sesi di sini: halaman pemasaran harus tetap 200 dan utuh
 * saat backend mati. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mkt">
      <a className="mkt-skip" href="#main">
        Lompat ke konten
      </a>
      <PublicNav />
      <main className="mkt-main" id="main" tabIndex={-1}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
