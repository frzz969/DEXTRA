import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locale";
import { getMessages, makeTranslator, type Translator } from "./messages";

/* Sisi server i18n. Berkas inilah satu-satunya yang menyentuh next/headers —
 * lihat catatan di locale.ts tentang kenapa pemisahannya penting. */

/* Dibaca di server. cookies() di Next 16 asinkron.
 *
 * Di luar konteks request (mis. saat build atau di skrip) cookies() melempar;
 * dalam kasus itu pakai default alih-alih menggagalkan render. */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    const value = store.get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/* Pintu masuk untuk komponen server.
 *
 * Setiap pemanggilan membaca cookie lagi. Itu murah (cookies() di-cache per
 * request oleh Next) dan membuat komponen server mana pun bisa menerjemahkan
 * tanpa harus menerima prop dari layout. */
export async function getT(): Promise<Translator> {
  const locale = await getLocale();
  return makeTranslator(getMessages(locale));
}

/* Versi yang sekaligus mengembalikan locale — dipakai bila komponen butuh
 * keduanya (mis. untuk memilih format tanggal atau aria-label). */
export async function getI18n(): Promise<{ locale: Locale; t: Translator }> {
  const locale = await getLocale();
  return { locale, t: makeTranslator(getMessages(locale)) };
}
