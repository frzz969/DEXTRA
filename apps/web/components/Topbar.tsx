"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "dextra-theme";

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    /* penyimpanan tidak tersedia — tema tetap berlaku sesi ini */
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** Label breadcrumb untuk rute utama; rute lain memakai segmen pertama path. */
function crumbFor(pathname: string): string {
  const map: Record<string, string> = {
    "/": "Overview",
    "/board": "Task Board",
    "/approvals": "Approval Inbox",
    "/audit": "Audit Trail",
    "/agents": "Workforce",
    "/executions": "Execution History",
    "/analytics": "Analytics",
    "/explorer": "Data Explorer",
    "/skills": "Skill Registry",
    "/workflows": "Workflow",
    "/requests": "My Requests",
    "/my-work": "My Work",
    "/review": "Review & Validation",
    "/integrations": "Integrations",
    "/service-identities": "Service Identity",
    "/settings": "Settings",
    "/assistant": "AI Assistant",
    "/office-agent": "Office Agent",
    "/tokens": "API Tokens",
    "/access": "Access Management",
    "/mandates": "Mandates",
    "/policies": "Policies",
    "/security": "Security Center",
    "/work-packages": "Work Packages",
    "/data-management": "Data Management",
    "/monitoring": "Monitoring",
    "/account": "Akun & Keamanan",
    "/admin": "Admin",
  };
  return map[pathname] ?? pathname.split("/").filter(Boolean)[0] ?? "Dashboard";
}

export default function Topbar({
  userName,
  userSubtitle,
  mcpUp,
}: {
  userName: string;
  userSubtitle: string;
  mcpUp: boolean;
}) {
  const [dark, setDark] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = saved ? saved === "dark" : prefers;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }, []);
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      applyTheme(next);
      return next;
    });
  };
  return (
    <header className="topbar" role="banner">
      <div className="topbar__left">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">DEXTRA</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span className="current">{crumbFor(pathname ?? "/")}</span>
        </nav>
        <span
          className="env-pill"
          data-state={mcpUp ? "live" : "offline"}
          title={mcpUp ? "Gateway MCP menjawab di 127.0.0.1:8765" : "Gateway MCP tidak merespons di 127.0.0.1:8765"}
        >
          <span className="dot" aria-hidden="true" />
          MCP :8765 · {mcpUp ? "Terhubung" : "Tidak terhubung"}
        </span>
      </div>
      <div className="topbar__right">
        <button
          type="button"
          className="copilot-trigger"
          onClick={() => window.dispatchEvent(new CustomEvent("dextra:copilot-toggle"))}
          title="Copilot (Ctrl+J)"
          aria-label="Buka Copilot"
        >
          <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
          <span className="label">Copilot</span><kbd>⌘J</kbd>
        </button>
        <Link className="search-trigger" href="/explorer" aria-label="Cari di Explorer">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <span className="label">Cari work package, mandat, kebijakan…</span><kbd>⌘K</kbd>
        </Link>
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          aria-pressed={dark}
          aria-label={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
          title={dark ? "Mode gelap aktif" : "Mode terang aktif"}
        >
          <span className="material-symbols-outlined" aria-hidden="true">{dark ? "light_mode" : "dark_mode"}</span>
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {dark ? "Tema gelap aktif" : "Tema terang aktif"}
        </span>
        <Link className="icon-btn" href="/approvals" aria-label="Persetujuan menunggu">
          <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
        </Link>
        <Link className="user-chip" href="/account" aria-label={`Akun ${userName}`}>
          <span className="avatar" aria-hidden="true">{initials(userName)}</span>
          <span className="user-chip__meta"><b>{userName}</b><span>{userSubtitle}</span></span>
        </Link>
      </div>
    </header>
  );
}
