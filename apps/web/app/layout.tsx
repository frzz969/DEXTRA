import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Copilot from "@/components/Copilot";
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
                <Link className="nav-item" href="/assistant">
                  <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                  <span className="nav-item__label">Assistant</span>
                </Link>
                <Link className="nav-item" href="/office-agent">
                  <span className="material-symbols-outlined" aria-hidden="true">list_alt</span>
                  <span className="nav-item__label">Office Agent</span>
                </Link>
                <Link className="nav-item" href="/agents">
                  <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
                  <span className="nav-item__label">Workforce</span>
                </Link>
                <Link className="nav-item" href="/work-packages">
                  <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
                  <span className="nav-item__label">Paket Kerja</span>
                </Link>
                <Link className="nav-item" href="/board">
                  <span className="material-symbols-outlined" aria-hidden="true">view_kanban</span>
                  <span className="nav-item__label">Papan</span>
                </Link>
                <Link className="nav-item" href="/executions">
                  <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
                  <span className="nav-item__label">Executions</span>
                </Link>
                <Link className="nav-item" href="/explorer">
                  <span className="material-symbols-outlined" aria-hidden="true">manage_search</span>
                  <span className="nav-item__label">Explorer</span>
                </Link>
                <Link className="nav-item" href="/analytics">
                  <span className="material-symbols-outlined" aria-hidden="true">monitoring</span>
                  <span className="nav-item__label">Analytics</span>
                </Link>
              </nav>

              <nav className="nav-group" aria-label="Tata kelola">
                <span className="nav-group__label">Governance</span>
                <Link className="nav-item" href="/approvals">
                  <span className="material-symbols-outlined" aria-hidden="true">fact_check</span>
                  <span className="nav-item__label">Approval</span>
                </Link>
                <Link className="nav-item" href="/mandates">
                  <span className="material-symbols-outlined" aria-hidden="true">assignment_turned_in</span>
                  <span className="nav-item__label">Mandates</span>
                </Link>
                <Link className="nav-item" href="/policies">
                  <span className="material-symbols-outlined" aria-hidden="true">policy</span>
                  <span className="nav-item__label">Kebijakan</span>
                </Link>
                <Link className="nav-item" href="/audit">
                  <span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>
                  <span className="nav-item__label">Audit</span>
                </Link>
              </nav>

              <nav className="nav-group" aria-label="Registry">
                <span className="nav-group__label">Registry</span>
                <Link className="nav-item" href="/skills">
                  <span className="material-symbols-outlined" aria-hidden="true">school</span>
                  <span className="nav-item__label">Skills</span>
                </Link>
                <Link className="nav-item" href="/workflows">
                  <span className="material-symbols-outlined" aria-hidden="true">account_tree</span>
                  <span className="nav-item__label">Workflow</span>
                </Link>
              </nav>

              <nav className="nav-group" aria-label="Akun dan akses">
                <span className="nav-group__label">Akun &amp; akses</span>
                <Link className="nav-item" href="/account">
                  <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
                  <span className="nav-item__label">Akun</span>
                </Link>
                <Link className="nav-item" href="/access">
                  <span className="material-symbols-outlined" aria-hidden="true">group</span>
                  <span className="nav-item__label">Akses</span>
                </Link>
                <Link className="nav-item" href="/tokens">
                  <span className="material-symbols-outlined" aria-hidden="true">vpn_key</span>
                  <span className="nav-item__label">Token</span>
                </Link>
              </nav>

              <nav className="nav-group" aria-label="Administrasi">
                <span className="nav-group__label">Administrasi</span>
                <Link className="nav-item" href="/admin">
                  <span className="material-symbols-outlined" aria-hidden="true">settings</span>
                  <span className="nav-item__label">Admin</span>
                </Link>
                <Link className="nav-item" href="/data-management">
                  <span className="material-symbols-outlined" aria-hidden="true">database</span>
                  <span className="nav-item__label">Data Management</span>
                </Link>
              </nav>

              <nav className="nav-group" aria-label="Keamanan">
                <span className="nav-group__label">Security</span>
                <Link className="nav-item" href="/security">
                  <span className="material-symbols-outlined" aria-hidden="true">shield</span>
                  <span className="nav-item__label">Security Center</span>
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
        <Copilot aiConfigured={Boolean(process.env.DEXTRA_AI_API_KEY)} />
      </body>
    </html>
  );
}
