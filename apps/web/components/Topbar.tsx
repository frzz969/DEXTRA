"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import UserMenu from "@/components/UserMenu";
import NotificationBellClient from "@/components/NotificationBellClient";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useT } from "@/lib/i18n/client";
import type { NotificationFeed } from "@/lib/notifications";

const STORAGE_KEY = "dextra-theme";

function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    /* penyimpanan tidak tersedia — tema tetap berlaku sesi ini */
  }
}

/** Label breadcrumb untuk rute utama; rute lain memakai segmen pertama path.
 *  Nilainya ditulis dalam bahasa sumber lalu diterjemahkan saat render, supaya
 *  satu peta ini melayani kedua bahasa. */
function crumbFor(pathname: string): string {
  const map: Record<string, string> = {
    "/": "Beranda",
    "/overview": "Overview",
    "/board": "Papan Tugas",
    "/approvals": "Kotak Persetujuan",
    "/audit": "Jejak Audit",
    "/agents": "Workforce",
    "/executions": "Riwayat Eksekusi",
    "/analytics": "Analitik",
    "/explorer": "Penjelajah Data",
    "/skills": "Daftar Keahlian",
    "/workflows": "Alur Kerja",
    "/requests": "Permintaan Saya",
    "/my-work": "Pekerjaan Saya",
    "/review": "Tinjau & Validasi",
    "/integrations": "Integrasi",
    "/service-identities": "Identitas Layanan",
    "/settings": "Pengaturan",
    "/assistant": "AI Assistant",
    "/office-agent": "Office Agent",
    "/tokens": "Kunci Akses",
    "/access": "Kelola Akses",
    "/mandates": "Mandat",
    "/policies": "Kebijakan",
    "/security": "Pusat Keamanan",
    "/work-packages": "Paket Kerja",
    "/data-management": "Kelola Data",
    "/monitoring": "Pemantauan",
    "/account": "Akun & Keamanan",
    "/admin": "Admin",
  };
  return map[pathname] ?? pathname.split("/").filter(Boolean)[0] ?? "Dashboard";
}

export default function Topbar({
  userName,
  userSubtitle,
  mcpUp,
  notifFeed,
}: {
  userName: string;
  userSubtitle: string;
  mcpUp: boolean;
  /* Disusun di RootLayout (server) lalu dioper ke sini. Topbar adalah client
     component, jadi ia tidak boleh memanggil API yang membaca sesi. */
  notifFeed: NotificationFeed;
}) {
  const t = useT();
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
        <button
          type="button"
          className="icon-btn menu-btn"
          aria-label={t("Buka navigasi")}
          onClick={() => {
            document.body.classList.add("is-mobile-open");
            document.querySelector(".mobile-scrim")?.remove();
            const s = document.createElement("div");
            s.className = "mobile-scrim";
            s.addEventListener("click", () => {
              document.body.classList.remove("is-mobile-open");
              s.remove();
            });
            document.body.appendChild(s);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">menu</span>
        </button>
        <nav className="breadcrumbs" aria-label={t("Breadcrumb")}>
          <Link href="/">DEXTRA</Link>
          <span className="sep" aria-hidden="true">/</span>
          <span className="current">{t(crumbFor(pathname ?? "/"))}</span>
        </nav>
        <span
          className="env-pill"
          data-state={mcpUp ? "live" : "offline"}
          role="status"
          aria-label={t(mcpUp ? "Sistem siap" : "Sistem belum siap")}
          title={t(mcpUp ? "Semua bagian sistem berjalan normal" : "Sebagian sistem belum siap")}
        >
          <span className="dot" aria-hidden="true" />
          {t(mcpUp ? "Sistem siap" : "Sistem belum siap")}
        </span>
      </div>
      <div className="topbar__right">
        <button
          type="button"
          className="copilot-trigger"
          onClick={() => window.dispatchEvent(new CustomEvent("dextra:copilot-toggle"))}
          title={t("Copilot (Ctrl+J)")}
          aria-label={t("Buka Copilot")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
          <span className="label">Copilot</span><kbd>⌘J</kbd>
        </button>
        {/* Pemicu palette. Sebelumnya ini <Link ke /explorer> yang mencetak
            <kbd>⌘K</kbd> tanpa handler — janji tanpa pelaksana. Sekarang ia
            mengirim event yang sama polanya dengan tombol Copilot, sehingga
            Topbar tidak perlu tahu isi palette. */}
        <button
          type="button"
          className="search-trigger"
          onClick={() => window.dispatchEvent(new CustomEvent("dextra:palette-open"))}
          aria-label={t("Buka pencarian cepat (Ctrl+K)")}
          title={t("Pencarian cepat (Ctrl+K)")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <span className="label">{t("Cari halaman…")}</span><kbd>⌘K</kbd>
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          aria-pressed={dark}
          aria-label={t(dark ? "Ganti ke mode terang" : "Ganti ke mode gelap")}
          title={t(dark ? "Mode gelap aktif" : "Mode terang aktif")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">{dark ? "light_mode" : "dark_mode"}</span>
        </button>
        <span className="sr-only" role="status" aria-live="polite">
          {t(dark ? "Tema gelap aktif" : "Tema terang aktif")}
        </span>
        <NotificationBellClient feed={notifFeed} />
        <LanguageSwitcher compact />
        <div className="vdivider" style={{ height: 24, margin: "0 4px" }} aria-hidden="true" />
        <UserMenu userName={userName} userSubtitle={userSubtitle} placement="down" id="topbar-user" />
      </div>
    </header>
  );
}
