"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_NAV, isActivePath } from "./publicNavLinks";

/* Header pemasaran: merek, nav, tombol Dashboard, dan menu ponsel.
 *
 * Kenapa client component: aria-current butuh pathname, dan panel menu butuh
 * state. Markup-nya tetap dirender di server (client component di App Router
 * ikut di-SSR), jadi tautan nav ada di HTML pertama dan terbaca tanpa JS.
 * Panel menu sendiri butuh JS untuk dibuka; karena itu footer mengulang
 * tautan yang sama, sehingga navigasi tidak hilang saat JS mati.
 *
 * Panel ditutup oleh: tombol yang sama, Escape (fokus kembali ke tombol),
 * dan perubahan rute.
 */
export default function PublicNav() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  /* Rute berubah (termasuk klik tautan di dalam panel): tutup panel. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      btnRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="mkt-header">
      <div className="mkt-wrap mkt-header__inner">
        <Link className="mkt-brand" href="/" aria-label="DEXTRA, ke beranda">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>
          <span className="brand-text">
            <b>DEXTRA</b>
            <span>Governed AI Workforce</span>
          </span>
        </Link>

        <nav className="mkt-nav" aria-label="Navigasi utama">
          {PUBLIC_NAV.map((link) => (
            <Link
              key={link.href}
              className="mkt-nav__link"
              href={link.href}
              aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link className="btn btn--primary mkt-header__cta" href="/overview">
          Dashboard
        </Link>

        <button
          ref={btnRef}
          type="button"
          className="mkt-menu-btn"
          aria-expanded={open}
          aria-controls="mkt-menu-panel"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {open ? "close" : "menu"}
          </span>
          {open ? "Tutup" : "Menu"}
        </button>
      </div>

      {open ? (
        <div className="mkt-panel" id="mkt-menu-panel">
          <nav className="mkt-panel__inner" aria-label="Navigasi utama (ponsel)">
            {PUBLIC_NAV.map((link) => (
              <Link
                key={link.href}
                className="mkt-panel__link"
                href={link.href}
                aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
            <div className="mkt-panel__cta">
              <Link className="btn btn--primary" href="/overview">
                Dashboard
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
