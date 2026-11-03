import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEXTRA — Governed AI Workforce",
  description: "Specialized AI workers. Human-defined authority. Accountable execution."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand__mark">D</span>
              <span className="brand__text">DEXTRA</span>
            </div>
            <nav className="nav">
              <span className="nav__group">Workspace</span>
              <a className="nav__item is-active" href="/">Overview</a>
              <span className="nav__group">Work management</span>
              <a className="nav__item" href="/agents">Workforce</a>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
