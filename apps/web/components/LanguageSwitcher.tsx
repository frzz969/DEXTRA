"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/i18n/actions";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALES, LOCALE_LABEL, LOCALE_SHORT } from "@/lib/i18n/locale";
import "./LanguageSwitcher.css";

/* Pemilih bahasa: dua tombol, bukan dropdown.
 *
 * Hanya ada dua bahasa, jadi segmen dua tombol lebih cepat dipakai dan lebih
 * jelas keadaannya daripada menu. `aria-pressed` dipakai (bukan tablist) karena
 * ini bukan panel bertab melainkan sekumpulan tombol yang saling meniadakan. */
export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (next: (typeof LOCALES)[number]) => {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div
      className={`lang-switch${compact ? " lang-switch--compact" : ""}`}
      role="group"
      aria-label={t("Pilih bahasa")}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          className="lang-switch__opt"
          aria-pressed={code === locale}
          /* Nama aksesibel memakai nama bahasa lengkap; teks yang terlihat
             hanya "EN"/"ID" di varian sempit, dan itu tidak cukup deskriptif
             untuk pembaca layar. */
          aria-label={t(LOCALE_LABEL[code])}
          title={t(LOCALE_LABEL[code])}
          disabled={pending}
          onClick={() => choose(code)}
        >
          {compact ? LOCALE_SHORT[code] : t(LOCALE_LABEL[code])}
        </button>
      ))}
    </div>
  );
}
