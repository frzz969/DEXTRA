"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { makeTranslator, type Messages, type Translator } from "./messages";

/* Jembatan bahasa untuk komponen client.
 *
 * Kamus dioper dari layout server sebagai prop biasa (peta string), jadi tidak
 * ada kamus yang diimpor langsung oleh bundel client: hanya bahasa aktif yang
 * ikut terkirim, bukan dua-duanya. */
type LocaleContextValue = {
  locale: Locale;
  t: Translator;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: makeTranslator(messages) }),
    [locale, messages]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/* Di luar provider (mis. komponen client yang dirender sendirian di tes),
 * kembalikan teks apa adanya alih-alih melempar. */
export function useLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? DEFAULT_LOCALE;
}

export function useT(): Translator {
  const ctx = useContext(LocaleContext);
  return useMemo(() => ctx?.t ?? ((text: string) => text), [ctx]);
}
