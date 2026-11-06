import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Copilot from "@/components/Copilot";
import Topbar from "@/components/Topbar";
import Tabsbar from "@/components/Tabsbar";
import NavItem from "@/components/NavItem";
import UserMenu from "@/components/UserMenu";
import SidebarToggle from "@/components/SidebarToggle";
import BareRoute from "@/components/BareRoute";
import { getPermissions } from "@/lib/api";
import { mcpHealth } from "@/lib/mcp";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEXTRA — Governed AI Workforce",
  description: "Specialized AI workers. Human-defined authority. Accountable execution."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  /* Identitas pemanggil dari server (GET /permissions) — tidak di-hardcode.
   * Principal token gateway lama membawa display_name "Gateway ops/agents";
   * sesi manusia membawa nama & role-nya. Bila principal kosong, tandai
   * scope API apa adanya alih-alih nama karangan. */
  const [permissions, mcpUp] = await Promise.all([getPermissions(), mcpHealth()]);
  const principal = permissions.ok ? permissions.data.principal : null;
  const userName = principal?.display_name?.trim() || `Sesi API · ${permissions.ok ? permissions.data.scope : "terputus"}`;
  const userSubtitle = principal?.role || principal?.email || principal?.kind || (permissions.ok ? permissions.data.scope : "backend tidak merespons");
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

            <SidebarToggle />
            <div className="sidebar__scroll">
              <nav className="nav-group" aria-label="Workspace">
                <span className="nav-group__label">Workspace</span>
                <NavItem href="/" icon="space_dashboard" label="Overview" />
                <NavItem href="/assistant" icon="forum" label="AI Assistant" />
                <NavItem href="/office-agent" icon="auto_awesome" label="Office Agent" />
                <NavItem href="/requests" icon="send" label="My Requests" />
                <NavItem href="/my-work" icon="assignment_ind" label="My Work" />
              </nav>

              <nav className="nav-group" aria-label="Work Management">
                <span className="nav-group__label">Work Management</span>
                <NavItem href="/work-packages" icon="layers" label="Work Packages" />
                <NavItem href="/board" icon="view_kanban" label="Task Board" />
                <NavItem href="/executions" icon="play_circle" label="Execution History" />
              </nav>

              <nav className="nav-group" aria-label="Workforce">
                <span className="nav-group__label">Workforce</span>
                <NavItem href="/agents" icon="groups" label="Workforce" />
              </nav>

              <nav className="nav-group" aria-label="Intelligence">
                <span className="nav-group__label">Intelligence</span>
                <NavItem href="/analytics" icon="query_stats" label="Analytics" />
                <NavItem href="/explorer" icon="travel_explore" label="Data Explorer" />
                <NavItem href="/monitoring" icon="monitoring" label="Monitoring" />
                <NavItem href="/skills" icon="extension" label="Skill Registry" />
                <NavItem href="/workflows" icon="account_tree" label="Workflow Orchestration" />
              </nav>

              <nav className="nav-group" aria-label="Governance">
                <span className="nav-group__label">Governance</span>
                <NavItem href="/approvals" icon="assignment_turned_in" label="Approval Inbox" />
                <NavItem href="/review" icon="fact_check" label="Review &amp; Validation" />
                <NavItem href="/mandates" icon="verified_user" label="Mandates" />
                <NavItem href="/security" icon="shield" label="Security Center" />
                <NavItem href="/audit" icon="receipt_long" label="Audit Trail" />
                <NavItem href="/policies" icon="policy" label="Policies" />
              </nav>

              <nav className="nav-group" aria-label="Administration">
                <span className="nav-group__label">Administration</span>
                <NavItem href="/access" icon="admin_panel_settings" label="Access Management" />
                <NavItem href="/tokens" icon="key" label="API Tokens" />
                <NavItem href="/service-identities" icon="smart_toy" label="Service Identity" />
                <NavItem href="/integrations" icon="extension" label="Integrations" />
                <NavItem href="/data-management" icon="database" label="Data Management" />
                <NavItem href="/settings" icon="settings" label="Settings" />
              </nav>

              <div className="nav-group" style={{ marginBottom: 4 }}>
                <div
                  style={{ margin: "0 10px", padding: "7px 9px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}
                  title="Semua layanan listen di 127.0.0.1. Sesi manusia memakai cookie httpOnly; token ops MCP disimpan di sessionStorage saja."
                >
                  <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14, color: "var(--success-600)" }}>shield_lock</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }}>Local-only · 127.0.0.1</span>
                </div>
              </div>
            </div>
            <div className="sidebar__foot">
              <UserMenu userName={userName} userSubtitle={userSubtitle} placement="up" />
            </div>
          </aside>

          <main className="main">
            <Topbar userName={userName} userSubtitle={userSubtitle} mcpUp={mcpUp} />
            <Tabsbar />
            <div className="content">
              <div className="page">{children}</div>
            </div>
          </main>
        </div>
        <BareRoute /><Copilot aiConfigured={Boolean(process.env.DEXTRA_AI_API_KEY)} />
      </body>
    </html>
  );
}
