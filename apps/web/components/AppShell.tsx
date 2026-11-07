import type { ReactNode } from "react";
import Copilot from "@/components/Copilot";
import Topbar from "@/components/Topbar";
import Tabsbar from "@/components/Tabsbar";
import NavItem from "@/components/NavItem";
import UserMenu from "@/components/UserMenu";
import SidebarToggle from "@/components/SidebarToggle";
import BareRoute from "@/components/BareRoute";
import CommandPalette from "@/components/CommandPalette";
import { getPermissions } from "@/lib/api";
import { getNotificationFeed } from "@/lib/notifications";
import { mcpHealth } from "@/lib/mcp";
import { getT } from "@/lib/i18n/server";

/* Shell aplikasi: sidebar + topbar + tabsbar. Dipasang oleh
 * app/(app)/layout.tsx saja, sehingga halaman publik di app/(public) tidak
 * memakainya. Isi markup di bawah ini pindahan apa adanya dari app/layout.tsx
 * (satu-satunya layout sebelum rute dipisah per grup) — jangan mengubah
 * strukturnya tanpa menguji seluruh halaman aplikasi.
 *
 * Berkas ini sengaja TIDAK mengimpor CSS apa pun: stylesheet global dimiliki
 * app/layout.tsx. */
export default async function AppShell({ children }: { children: ReactNode }) {
  /* Identitas pemanggil dari server (GET /permissions) — tidak di-hardcode.
   * Bila identitas tidak tersedia, tampilkan sebutan umum yang tetap jujur
   * alih-alih nama karangan atau istilah teknis. */
  /* Feed notifikasi disusun di server: `getNotificationFeed` membaca sesi
   * lewat `next/headers`, jadi tidak bisa dipanggil dari Topbar yang client
   * component. Hasilnya dioper sebagai prop — bentuknya data biasa, sehingga
   * aman menyeberang batas server/client. */
  const [permissions, mcpUp, notifFeed] = await Promise.all([
    getPermissions(),
    mcpHealth(),
    getNotificationFeed()
  ]);
  const t = await getT();
  const profile = permissions.ok ? permissions.data.principal : null;
  const userName = profile?.display_name?.trim() || t("Pengguna DEXTRA");
  const userSubtitle = profile?.role || profile?.email || t("Anggota tim");
  return (
    <>
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
            {/* Navigasi utama sengaja pendek: empat kelompok, sepuluh tujuan.
                Halaman lain tetap ada dan bisa dicapai lewat pencarian cepat
                (⌘K) atau tautan antarhalaman — hanya tidak dipajang di sini. */}
            <nav className="nav-group" aria-label={t("Ruang Kerja")}>
              <span className="nav-group__label">{t("Ruang Kerja")}</span>
              <NavItem href="/overview" icon="space_dashboard" label={t("Overview")} />
              <NavItem href="/assistant" icon="forum" label={t("AI Assistant")} />
              <NavItem href="/office-agent" icon="auto_awesome" label={t("Office Agent")} />
            </nav>

            <nav className="nav-group" aria-label={t("Pekerjaan")}>
              <span className="nav-group__label">{t("Pekerjaan")}</span>
              <NavItem href="/work-packages" icon="layers" label={t("Paket Kerja")} />
              <NavItem href="/board" icon="view_kanban" label={t("Papan Tugas")} />
              <NavItem href="/executions" icon="play_circle" label={t("Riwayat Eksekusi")} />
            </nav>

            <nav className="nav-group" aria-label={t("Persetujuan")}>
              <span className="nav-group__label">{t("Persetujuan")}</span>
              <NavItem href="/approvals" icon="assignment_turned_in" label={t("Kotak Persetujuan")} />
              <NavItem href="/mandates" icon="verified_user" label={t("Mandat")} />
              <NavItem href="/audit" icon="receipt_long" label={t("Jejak Audit")} />
            </nav>

            <nav className="nav-group" aria-label={t("Tim AI")}>
              <span className="nav-group__label">{t("Tim AI")}</span>
              <NavItem href="/agents" icon="groups" label={t("Workforce")} />
            </nav>

            <div className="nav-group" style={{ marginBottom: 4 }}>
              <div
                style={{ margin: "0 10px", padding: "7px 9px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}
                title={t("Sistem berjalan di komputer ini. Sesi Anda tersimpan aman di peramban.")}
              >
                <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 14, color: "var(--success-600)" }}>shield_lock</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }}>{t("Berjalan lokal")}</span>
              </div>
            </div>
          </div>
          <div className="sidebar__foot">
            <UserMenu userName={userName} userSubtitle={userSubtitle} placement="up" />
          </div>
        </aside>

        <main className="main">
          <Topbar userName={userName} userSubtitle={userSubtitle} mcpUp={mcpUp} notifFeed={notifFeed} />
          <Tabsbar />
          <div className="content">
            <div className="page">{children}</div>
          </div>
        </main>
      </div>
      <BareRoute /><Copilot aiConfigured={Boolean(process.env.DEXTRA_AI_API_KEY)} />
      {/* Palette global: mendengarkan ⌘K sendiri dan menyembunyikan diri saat
          body.is-bare, jadi aman dipasang di sini untuk semua halaman. */}
      <CommandPalette />
    </>
  );
}
