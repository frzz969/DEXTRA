"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, localeCookieOptions } from "./locale";

/* Menyimpan pilihan bahasa.
 *
 * Sengaja tidak me-redirect: pemanggilnya (LanguageSwitcher) memanggil
 * router.refresh() setelahnya, sehingga pengguna tetap di halaman yang sama
 * dan hanya server component yang dirender ulang. */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, localeCookieOptions);
}
