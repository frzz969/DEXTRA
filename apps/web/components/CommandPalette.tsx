"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { matchCommands, type CommandItem } from "@/components/command-items";
import "./CommandPalette.css";

/**
 * Command palette (⌘K / Ctrl+K) — pencarian cepat antar halaman.
 *
 * Ini menepati janji yang sudah tertulis di Topbar: pill pencarian di sana
 * mencetak <kbd>⌘K</kbd> tanpa handler apa pun. Palette ini juga bisa dibuka
 * lewat CustomEvent `dextra:palette-open` (pola yang sama dengan
 * `dextra:copilot-toggle`), sehingga tombol topbar cukup mengirim event dan
 * tidak perlu tahu apa pun soal komponen ini.
 *
 * Batas yang disengaja:
 *  - Hanya mencari halaman (lihat components/command-items.ts). Tidak
 *    mengaku mencari work package/mandat/kebijakan.
 *  - Tidak pernah menavigasi sendiri selain lewat useRouter().push.
 *  - Tidak tampil di layar bare (login/403/503/404) yang tidak punya shell.
 */
export default function CommandPalette() {
  const router = useRouter();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;

  const [open, setOpen] = useState(false);
  const [bare, setBare] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const openRef = useRef(false);
  const bareRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /* Elemen yang memegang fokus sebelum palette dibuka — dikembalikan saat
     ditutup supaya pengguna keyboard tidak terlempar ke awal dokumen. */
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const results = useMemo(() => matchCommands(query), [query]);
  const activeItem = results[activeIndex];

  const closePalette = useCallback(() => {
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    /* openRef diperbarui langsung, bukan lewat effect: Escape lalu ⌘K dalam
       satu tick tidak boleh dianggap "sudah terbuka". */
    openRef.current = false;
    setOpen(false);
    if (target && target.isConnected) target.focus();
  }, []);

  const openPalette = useCallback(() => {
    /* Layar bare tidak punya shell: jangan pernah muncul di sana. */
    if (bareRef.current) return;
    /* Sudah terbuka: cukup kembalikan fokus ke input, jangan hapus ketikan. */
    if (openRef.current) {
      inputRef.current?.focus();
      return;
    }
    openRef.current = true;
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  const navigate = useCallback(
    (item: CommandItem) => {
      closePalette();
      router.push(item.href);
    },
    [closePalette, router]
  );

  /* Pintasan papan ketik + event eksternal.
   *
   * Tabrakan dengan Copilot (components/Copilot.tsx: Ctrl/⌘+J): handler ini
   * keluar lebih awal untuk SEMUA tombol selain "k", dan handler Copilot
   * keluar untuk semua selain "j". Dua listener di window, tombol berbeda —
   * tidak ada yang saling menelan. Ketikan biasa ("k" tanpa Ctrl/⌘) juga tidak
   * pernah dicegat. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!openRef.current) return;
        event.preventDefault();
        closePalette();
        return;
      }
      if (event.key.toLowerCase() !== "k") return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.altKey) return;
      event.preventDefault();
      openPalette();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("dextra:palette-open", openPalette);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("dextra:palette-open", openPalette);
    };
  }, [closePalette, openPalette]);

  /* `body.is-bare` di-toggle runtime oleh BareRoute, jadi kelasnya diamati,
     bukan dibaca sekali. Begitu bare aktif (mis. sesi habis lalu diarahkan ke
     /login), palette ditutup dan tidak dirender sama sekali. */
  useEffect(() => {
    const body = document.body;
    const sync = () => {
      const isBare = body.classList.contains("is-bare");
      bareRef.current = isBare;
      setBare(isBare);
      if (isBare) closePalette();
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [closePalette]);

  /* Ingat fokus sebelumnya, lalu pindahkan fokus ke input saat dibuka. */
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
  }, [open]);

  /* Item aktif harus tetap terlihat saat digerakkan dengan panah. */
  useEffect(() => {
    if (!open) return;
    const options = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    options?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, results]);

  if (!open || bare) return null;

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length > 0) setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length > 0) setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) navigate(item);
    } else if (event.key === "Tab") {
      /* Dialog ini aria-modal: fokus tidak boleh lolos ke halaman di balik
         scrim. Satu-satunya elemen yang bisa fokus adalah input. */
      event.preventDefault();
    }
  };

  return createPortal(
    <div
      className="overlay overlay--center cmdk-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian cepat"
      /* mousedown, bukan click: menyeret dari dalam panel lalu melepas di
         scrim tidak boleh menutup palette. */
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePalette();
      }}
    >
      <div className="cmdk cmdk--palette">
        <input
          ref={inputRef}
          className="cmdk__input"
          type="text"
          role="combobox"
          aria-label="Cari halaman"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeItem ? optionId(activeIndex) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder="Cari halaman…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onInputKeyDown}
        />

        <div className="cmdk__list" id={listId} role="listbox" aria-label="Halaman" ref={listRef}>
          {results.map((item, index) => (
            <div
              key={item.href}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              className={`cmdk__item${index === activeIndex ? " is-active" : ""}`}
              onClick={() => navigate(item)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              {item.label}
              <span className="path" aria-hidden="true">{item.href}</span>
            </div>
          ))}
        </div>

        {/* Di luar listbox: listbox hanya boleh berisi option. Saat kosong,
            `.cmdk__list:empty` disembunyikan supaya tidak ada pita kosong. */}
        {results.length === 0 && (
          <p className="cmdk__empty">Tidak ada hasil untuk “{query}”.</p>
        )}

        <div className="card__foot">
          <span className="tiny faint">
            <kbd className="cmdk__kbd">↑</kbd>
            <kbd className="cmdk__kbd">↓</kbd> pilih · <kbd className="cmdk__kbd">↵</kbd> buka ·{" "}
            <kbd className="cmdk__kbd">esc</kbd> tutup
          </span>
          <span className="spacer" />
          <span className="tiny faint">Halaman · pencarian lokal</span>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {results.length === 0
            ? `Tidak ada hasil untuk ${query}`
            : `${results.length} halaman ditemukan`}
        </p>
      </div>
    </div>,
    document.body
  );
}
