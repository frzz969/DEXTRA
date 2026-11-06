"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Topbar() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("dextra-theme");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = saved ? saved === "dark" : prefers;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
  }, []);
  const toggle = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.dataset.theme = next ? "dark" : "light";
      localStorage.setItem("dextra-theme", next ? "dark" : "light");
      return next;
    });
  };
  return (
    <header className="topbar" role="banner">
      <div className="topbar__left">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">DEXTRA</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span className="current">Dashboard</span>
        </nav>
      </div>
      <div className="topbar__right">
        <Link className="search-trigger" href="/explorer" aria-label="Cari di Explorer">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <span className="label">Cari…</span><kbd>⌘K</kbd>
        </Link>
        <span className="env-pill" data-state="demo" title="Sumber data: Python API :8000, MCP :8765"><span className="dot" />Lokal</span>
        <button type="button" className="icon-btn" onClick={toggle} aria-label={dark ? "Mode terang" : "Mode gelap"}>
          <span className="material-symbols-outlined" aria-hidden="true">{dark ? "light_mode" : "dark_mode"}</span>
        </button>
        <Link className="icon-btn" href="/approvals" aria-label="Persetujuan menunggu">
          <span className="material-symbols-outlined" aria-hidden="true">notifications</span>
        </Link>
        <Link className="user-chip" href="/account" aria-label="Akun">
          <span className="avatar" aria-hidden="true">D</span>
          <span className="user-chip__meta"><b>DEXTRA</b><span>Operator</span></span>
        </Link>
      </div>
    </header>
  );
}
