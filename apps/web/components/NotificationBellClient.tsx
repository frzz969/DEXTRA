"use client";

/**
 * Lonceng + dropdown notifikasi.
 *
 * HITUNGAN INI BUKAN "BELUM DIBACA". Backend tidak menyimpan status baca
 * (`read_at` / `seen_at` / `acknowledged` / `dismissed` tidak ada di mana pun),
 * jadi angka pada badge berarti "perlu tindakan": rencana yang menunggu
 * keputusan, eksekusi yang gagal, dan mandat yang segera berakhir. Label itu
 * ditulis eksplisit di header dropdown dan di `aria-label` tombol.
 *
 * Semua baris berasal dari `feed` yang disusun server dari tiga endpoint nyata
 * (`lib/notifications.ts`). Tidak ada data contoh di berkas ini.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FeedSectionKey,
  NotificationFeed,
  NotificationItem
} from "@/lib/notifications";
import "./NotificationBell.css";

const KIND_ICON: Record<NotificationItem["kind"], string> = {
  plan: "fact_check",
  execution: "error",
  mandate: "timer"
};

const SECTION_LABEL: Record<FeedSectionKey, string> = {
  plans: "Rencana",
  executions: "Eksekusi",
  mandates: "Mandat"
};

const SECTION_ORDER: FeedSectionKey[] = ["plans", "executions", "mandates"];

/** Format waktu tetap (bukan locale mesin) supaya keluaran stabil. */
const TIME_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta"
});

function formatTime(iso: string): string | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return TIME_FORMAT.format(time);
}

export default function NotificationBellClient({ feed }: { feed: NotificationFeed }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    /* Fokus dikembalikan hanya saat penutupan dipicu keyboard. Kalau pengguna
     * mengeklik elemen lain di luar menu, memaksa fokus kembali ke lonceng
     * akan membajak klik yang barusan ia lakukan. */
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        close(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const { count, shown, truncated, sections, composedAt } = feed;
  const label =
    count > 0 ? `Perlu tindakan, ${count} item` : "Perlu tindakan, tidak ada item";

  /* Sumber yang gagal dibaca — ditampilkan apa adanya, tidak diubah jadi nol. */
  const failed = SECTION_ORDER.filter((key) => !sections[key].ok);
  const allReadable = failed.length === 0;

  const composedLabel = formatTime(composedAt);

  return (
    <div className="nb" ref={wrapperRef}>
      <button
        type="button"
        id="notif-btn"
        ref={buttonRef}
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          notifications
        </span>
        {count > 0 ? (
          /* Badge disembunyikan dari pembaca layar: angkanya sudah ada di
           * aria-label tombol, jadi membacanya lagi hanya mengulang. */
          <span className="nb-badge" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="menu nb-menu"
          role="menu"
          aria-label="Daftar perlu tindakan"
        >
          <div className="menu__head nb-head">
            <div className="small strong">
              Perlu tindakan
              <span className="nb-head__count">{count}</span>
            </div>
            {/* Judul ini menyatakan arti angkanya. DEXTRA belum menyimpan
             * status baca, jadi "belum dibaca" akan menjadi klaim palsu. */}
            <div className="tiny muted">
              Bukan status &quot;belum dibaca&quot; — DEXTRA belum menyimpan
              status baca. Angka ini menghitung hal yang menunggu tindakan.
            </div>
          </div>

          {feed.items.length > 0 ? (
            <div className="nb-list">
              {feed.items.map((item) => {
                const time = item.at ? formatTime(item.at) : null;
                return (
                  <Link
                    key={item.key}
                    className="menu__item nb-item"
                    role="menuitem"
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className={`material-symbols-outlined nb-item__icon nb-item__icon--${item.kind}`}
                      aria-hidden="true"
                    >
                      {KIND_ICON[item.kind]}
                    </span>
                    <span className="nb-item__body">
                      <span className="nb-item__title">{item.title}</span>
                      <span className="nb-item__detail">{item.detail}</span>
                      {/* Waktu hanya dirender bila record memang punya waktu. */}
                      {time ? <span className="nb-item__time">{time} WIB</span> : null}
                    </span>
                  </Link>
                );
              })}
            </div>
          ) : allReadable ? (
            <div className="nb-empty">
              Tidak ada yang perlu tindakan saat ini. Ketiga sumber
              (rencana, eksekusi, mandat) terbaca dan tidak ada yang cocok.
            </div>
          ) : null}

          {truncated ? (
            <div className="nb-note">
              Menampilkan {shown} dari {count} item terbaru.
            </div>
          ) : null}

          {failed.length > 0 ? (
            <div className="nb-unavailable" role="status">
              <div className="nb-unavailable__title">
                Sebagian sumber tidak bisa dibaca
              </div>
              <ul className="nb-unavailable__list">
                {failed.map((key) => {
                  const section = sections[key];
                  if (section.ok) return null;
                  return (
                    <li key={key}>
                      <b>{SECTION_LABEL[key]}</b> tidak tersedia:{" "}
                      {section.error}
                    </li>
                  );
                })}
              </ul>
              <div className="nb-unavailable__hint">
                Bagian yang gagal tidak dihitung sebagai nol — jumlah di atas
                hanya mencakup sumber yang benar-benar terbaca.
              </div>
            </div>
          ) : null}

          <div className="menu__sep" role="separator" />

          <div className="nb-foot">
            DEXTRA belum menyimpan notifikasi maupun status baca. Daftar ini
            diturunkan langsung dari tiga sumber nyata: rencana yang menunggu
            keputusan, eksekusi yang gagal, dan mandat yang berakhir dalam 7
            hari.
            {composedLabel ? (
              <span className="nb-foot__meta">Disusun {composedLabel} WIB.</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
