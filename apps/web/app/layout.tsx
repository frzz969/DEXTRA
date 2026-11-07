import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEXTRA — Governed AI Workforce",
  description: "Specialized AI workers. Human-defined authority. Accountable execution."
};

/* Layout akar hanya memegang <html>/<body>, stylesheet global, dan metadata.
 * Shell aplikasi (sidebar/topbar/tabsbar) TIDAK dipasang di sini melainkan di
 * app/(app)/layout.tsx — kalau dipasang di sini juga, halaman aplikasi akan
 * mendapat dua shell sekaligus dan halaman publik di app/(public) (termasuk
 * landing "/") ikut memakainya. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      {/* Font tidak lagi diambil dari CDN. Inter, Plus Jakarta Sans dan
          Material Symbols di-host sendiri di public/fonts dan dideklarasikan
          oleh app/fonts.css (diimpor lewat globals.css). Tanpa <link> ke
          fonts.googleapis.com, tidak ada permintaan pihak ketiga di jalur
          render dan ikon tidak bergantung pada jaringan. */}
      <body>{children}</body>
    </html>
  );
}
