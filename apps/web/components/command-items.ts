/* Katalog rute untuk command palette (⌘K).
 *
 * Isi katalog ini SENGAJA hanya rute yang benar-benar ada di apps/web/app —
 * 30 halaman. Palette ini tidak mencari work package, mandat, atau kebijakan
 * (itu butuh API); karena itu label di UI menyebut "Cari halaman", bukan
 * "Cari work package, mandat, kebijakan" seperti janji topbar. Janji palsu
 * lebih buruk daripada cakupan yang sempit tapi jujur.
 *
 * `icon` adalah nama ligatur Material Symbols. Semua nama di bawah sudah
 * dipakai di tempat lain di repo (layout.tsx, Topbar, atau apps/dashboard),
 * jadi dijamin ada di subset sym-0.woff2 — nama yang tidak ada di subset akan
 * tercetak sebagai kata biasa, bukan ikon. Pengecualian yang belum diperiksa:
 * `home` (entri Beranda) belum dipakai di tempat lain di repo, jadi
 * keberadaannya di subset belum terbukti.
 *
 * `keywords` memuat sinonim Indonesia/Inggris yang mungkin diketik pengguna.
 * Turunan dari `desc` di nav statis (apps/dashboard/assets/js/shell.js).
 */

export type CommandItem = {
  href: string;
  label: string;
  icon: string;
  keywords: string;
};

export const COMMAND_ITEMS: CommandItem[] = [
  { href: "/", label: "Beranda", icon: "home", keywords: "beranda landing pengenalan tentang home" },
  { href: "/overview", label: "Overview", icon: "space_dashboard", keywords: "overview ringkasan dashboard beranda ikhtisar utama home" },
  { href: "/access", label: "Akses & Peran", icon: "admin_panel_settings", keywords: "akses peran role permission izin anggota membership rbac access" },
  { href: "/account", label: "Akun & Keamanan", icon: "manage_accounts", keywords: "akun keamanan account security profil password sandi sesi profile" },
  { href: "/admin", label: "Administrasi", icon: "dns", keywords: "administrasi admin kesehatan health layanan service kapabilitas capability meta status" },
  { href: "/agents", label: "Workforce", icon: "groups", keywords: "workforce agen agents roster pekerja tenaga kerja spesialis" },
  { href: "/analytics", label: "Analytics", icon: "query_stats", keywords: "analytics analitik statistik metrik laporan report" },
  { href: "/approvals", label: "Approval Inbox", icon: "assignment_turned_in", keywords: "approval persetujuan inbox kotak masuk menunggu keputusan pending approve" },
  { href: "/assistant", label: "AI Assistant", icon: "forum", keywords: "assistant asisten ai chat obrolan tanya copilot" },
  { href: "/audit", label: "Audit Center", icon: "receipt_long", keywords: "audit trail jejak log riwayat catatan rekam append-only" },
  { href: "/board", label: "Papan Tugas", icon: "view_kanban", keywords: "board papan tugas kanban task kartu kolom" },
  { href: "/data-management", label: "Data Management", icon: "database", keywords: "data management pengelolaan database postgres tenant migrasi migration" },
  { href: "/executions", label: "Monitor Eksekusi", icon: "play_circle", keywords: "eksekusi execution monitor riwayat run history menjalankan" },
  { href: "/explorer", label: "Explorer", icon: "travel_explore", keywords: "explorer penjelajah data cari telusuri search query entitas" },
  { href: "/integrations", label: "Integrations", icon: "extension", keywords: "integrations integrasi koneksi sistem eksternal konektor" },
  { href: "/mandates", label: "Mandates", icon: "verified_user", keywords: "mandates mandat wewenang otoritas kewenangan izin" },
  { href: "/monitoring", label: "Monitoring", icon: "monitoring", keywords: "monitoring pemantauan pantau status sinyal" },
  { href: "/my-work", label: "My Work", icon: "assignment_ind", keywords: "my work pekerjaan saya tugas saya antrean queue ditugaskan" },
  { href: "/office-agent", label: "Office Agent", icon: "auto_awesome", keywords: "office agent notulen meeting rapat minutes tindak lanjut action" },
  { href: "/policies", label: "Kebijakan", icon: "policy", keywords: "kebijakan policy aturan rule batasan guardrail" },
  { href: "/requests", label: "Requests", icon: "send", keywords: "requests permintaan pengajuan tiket my requests" },
  { href: "/review", label: "Review & Validation", icon: "fact_check", keywords: "review validasi validation tinjau periksa quality gate" },
  { href: "/security", label: "Security Center", icon: "shield", keywords: "security keamanan penolakan block karantina quarantine integritas" },
  { href: "/service-identities", label: "Service Identity", icon: "smart_toy", keywords: "service identity identitas layanan service account kredensial" },
  { href: "/settings", label: "Settings", icon: "settings", keywords: "settings pengaturan konfigurasi preferensi organisasi organization" },
  { href: "/skills", label: "Skill Registry", icon: "extension", keywords: "skill registry keterampilan katalog schema tool" },
  { href: "/tokens", label: "Token & Identitas Mesin", icon: "key", keywords: "token identitas mesin api key kunci scope rotasi machine identity" },
  { href: "/work-packages", label: "Work Packages", icon: "layers", keywords: "work packages paket kerja plan rencana pekerjaan" },
  { href: "/workflows", label: "Workflow Registry", icon: "account_tree", keywords: "workflow registry alur kerja orkestrasi orchestration katalog definisi" },
  { href: "/workflows/runs", label: "Workflow Runs", icon: "history", keywords: "workflow runs riwayat run eksekusi alur checkpoint jalankan" },
];

/** Cocokkan `query` ke label + href + keywords (case-insensitive substring). */
export function matchCommands(query: string, items: CommandItem[] = COMMAND_ITEMS): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) =>
    `${item.label} ${item.href} ${item.keywords}`.toLowerCase().includes(q)
  );
}
