import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEXTRA — Governed AI Workforce",
  description: "Specialized AI workers. Human-defined authority. Accountable execution."
};

/* Layout akar memegang <html>/<body>, stylesheet global, metadata, dan
 * penyedia bahasa.
 *
 * KENAPA DI SINI
 * Bahasa dibaca dari cookie di satu tempat ini lalu diteruskan ke seluruh pohon
 * lewat LocaleProvider. Komponen client memakai useT(), komponen server memakai
 * getT(). Kalau provider dipasang di tiap layout grup ((app), (landing),
 * (bare)), ketiganya harus dirawat terpisah dan halaman baru mudah terlupa.
 *
 * Shell aplikasi (sidebar/topbar/tabsbar) TIDAK dipasang di sini melainkan di
 * app/(app)/layout.tsx.
 *
 * AKIBAT YANG DISADARI
 * Membaca cookie membuat rute dirender per request — termasuk landing page yang
 * tadinya statis. Itu harga dari pemilih bahasa berbasis cookie; alternatifnya
 * (bahasa di segmen URL) akan menggeser setiap rute dan setiap tautan internal. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (
    <html lang={locale} suppressHydrationWarning>
      {/* Font tidak lagi diambil dari CDN. Inter, Plus Jakarta Sans dan
          Material Symbols di-host sendiri di public/fonts dan dideklarasikan
          oleh app/fonts.css (diimpor lewat globals.css). Tanpa <link> ke
          fonts.googleapis.com, tidak ada permintaan pihak ketiga di jalur
          render dan ikon tidak bergantung pada jaringan. */}
      <body>
        <LocaleProvider locale={locale} messages={messages}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
