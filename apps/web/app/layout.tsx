import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEXTRA — Governed AI Workforce",
  description: "Specialized AI workers. Human-defined authority. Accountable execution."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Plus Jakarta Sans (display) + Inter (body) — the font stacks in
            dextra-design-system.css expect these families. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols — icons (.nav-item, .kpi__icon, .banner …)
            render as ligature text only when this font loads. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app">
          {/* Design system shell: .sidebar is fixed at
              inset:0 auto 0 0 with width var(--sidebar-w); .main below
              carries margin-left: var(--sidebar-w). Do not nest this in a
              grid — that double-offset was the original bug. */}
          <aside className="sidebar">
            <div className="sidebar__brand">
              <span className="brand-mark" aria-hidden="true">D</span>
              <span className="brand-text">
                <b>DEXTRA</b>
                <span>Governed AI Workforce</span>
              </span>
            </div>

            <div className="sidebar__scroll">
              <nav className="nav-group" aria-label="Utama">
                <span className="nav-group__label">Workspace</span>
                <Link className="nav-item is-active" href="/" aria-current="page">
                  <span className="material-symbols-outlined" aria-hidden="true">dashboard</span>
                  <span className="nav-item__label">Overview</span>
                </Link>
              </nav>

              <nav className="nav-group" aria-label="Manajemen kerja">
                <span className="nav-group__label">Work management</span>
                <Link className="nav-item" href="/agents">
                  <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
                  <span className="nav-item__label">Workforce</span>
                </Link>
              </nav>
            </div>
          </aside>

          <main className="main">
            <div className="content">
              <div className="page">{children}</div>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
