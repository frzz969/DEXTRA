/* Konstanta bahasa — TANPA impor server.
 *
 * Berkas ini sengaja tidak menyentuh next/headers karena diimpor juga oleh
 * komponen client (LanguageSwitcher, LocaleProvider). Membaca cookie ada di
 * lib/i18n/server.ts.
 *
 * MEKANISME
 * Bahasa disimpan di cookie, bukan di URL. Halaman DEXTRA punya rute stabil dan
 * banyak tautan internal bermutlak ("/overview"), jadi segmen bahasa di path
 * akan menyentuh setiap tautan, setiap redirect di server action, dan setiap
 * tes e2e. Cookie memberi hasil yang sama bagi pengguna — pilihan bertahan
 * antar-sesi — tanpa menggeser satu rute pun.
 *
 * Konsekuensinya: satu halaman tidak punya dua URL, jadi tidak ada hreflang dan
 * mesin pencari hanya melihat versi default. Itu diterima karena dashboard ada
 * di balik login; bila nanti landing perlu terindeks per bahasa, itu perubahan
 * terpisah.
 *
 * DEFAULT: Inggris. Pengunjung baru selalu melihat Inggris; bahasa Indonesia
 * dipilih lewat pemilih bahasa di header/topbar. */

export const LOCALES = ["en", "id"] as const;
export type Locale = (typeof LOCALES)[number];

/* INGGRIS ADALAH BAHASA UTAMA. Pengunjung tanpa cookie harus melihat versi
   Inggris; Indonesia dipilih sendiri lewat pemilih bahasa.

   Jangan diubah menjadi "id" hanya karena teks sumber di komponen ditulis
   dalam bahasa Indonesia. Teks sumber adalah kunci kamus, bukan bahasa default
   — lihat catatan di en.ts. Mengubah baris ini membalik perilaku seluruh
   aplikasi tanpa mengubah satu kalimat pun. */
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "dextra_locale";

/* Setahun. Pilihan bahasa bukan data sensitif dan tidak perlu kedaluwarsa
   cepat. */
export const LOCALE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  id: "Bahasa Indonesia"
};

/* Singkatan untuk tombol yang sempit. */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  id: "ID"
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/* Opsi cookie dipakai bersama oleh server action dan route handler, supaya
   atributnya tidak pernah berbeda. */
export const localeCookieOptions = {
  path: "/",
  maxAge: LOCALE_MAX_AGE,
  sameSite: "lax" as const
};
