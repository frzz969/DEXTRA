/* Kamus Indonesia.
 *
 * Hanya berisi teks yang di kode sudah berbahasa Inggris — label seperti
 * "Overview" atau "Governance Architecture" yang perlu padanan Indonesia. Teks
 * yang sumbernya memang sudah Indonesia tidak perlu didaftarkan: lookup yang
 * gagal mengembalikan teks aslinya, jadi versi Indonesia tampil utuh tanpa
 * entri.
 *
 * Istilah domain tetap tidak diterjemahkan (lihat catatan di en.ts): Mandate,
 * Approval, Work Package, Office Agent, Worker, Audit Trail, Policy, Token. */
export const id = {
  /* ---------- Shell: navigasi ---------- */
  Overview: "Ringkasan",
  "AI Assistant": "Asisten AI",
  Workforce: "Workforce",
  Workspace: "Ruang Kerja",

  /* ---------- Topbar ---------- */
  Dashboard: "Dasbor",
  Admin: "Admin",

  /* ---------- Bahasa ---------- */
  Language: "Bahasa",
  "Change language": "Ganti bahasa",
  "Choose a language": "Pilih bahasa",
  English: "Inggris",
  "Bahasa Indonesia": "Indonesia",

  /* ---------- Landing: navigasi ---------- */
  "AI Workforce": "AI Workforce",
  "How It Works": "Cara Kerja",
  "Controls & Audit": "Kontrol & Audit",
  "Open Dashboard": "Buka Dashboard",
  "Explore DEXTRA": "Jelajahi DEXTRA",
  "Explore DEXTRA Dashboard": "Jelajahi Dashboard DEXTRA",
  "Sign in to your account": "Masuk ke Akun",

  /* ---------- Landing: hero ---------- */
  "Transform the Way Your Organization": "Ubah Cara Organisasi Anda",
  "Works with Governed AI.": "Bekerja dengan AI yang Terkendali.",

  /* ---------- Landing: judul bagian ---------- */
  "Governance Architecture": "Arsitektur Tata Kelola",
  "AI Workforce. Human Authority. Complete Accountability.":
    "AI Workforce. Wewenang Manusia. Akuntabilitas Penuh.",
  "The 4 AI Specialists": "Empat Spesialis AI",
  "Meet the Specialized Workers Behind Your Operations.":
    "Kenali Worker Spesialis di Balik Operasional Anda.",
  "Operational Flow": "Alur Operasional",
  "From Human Request to Governed Execution.":
    "Dari Permintaan Manusia ke Eksekusi yang Terkendali.",
  "Enterprise Control Center": "Pusat Kendali Perusahaan",
  "Everything Under Your Control.": "Semuanya dalam Kendali Anda.",
  "Ecosystem Connectivity": "Konektivitas Ekosistem",
  "One Workforce. Multiple Ways to Collaborate.":
    "Satu Workforce. Banyak Cara Berkolaborasi.",
  "Measurable Value": "Nilai yang Terukur",
  "Make Your Operations More Organized, Visible, and Accountable.":
    "Buat Operasional Lebih Tertata, Terlihat, dan Dapat Dipertanggungjawabkan.",

  /* ---------- Landing: pilar ---------- */
  "Specialized Intelligence": "Kecerdasan Spesialis",
  "Human-Defined Authority": "Wewenang yang Ditetapkan Manusia",
  "Accountable Execution": "Eksekusi yang Dapat Dipertanggungjawabkan",

  /* ---------- Landing: langkah ---------- */
  Request: "Permintaan",
  Understand: "Pemahaman",
  Plan: "Rencana",
  Validate: "Validasi",
  Approve: "Persetujuan",
  Execute: "Eksekusi",
  "Read operations can be automated. Write operations require human-defined authority.":
    "Operasi baca boleh otomatis. Operasi tulis menuntut wewenang yang ditetapkan manusia.",

  /* ---------- Landing: fitur ---------- */
  "Interlock Approval Center": "Pusat Persetujuan Interlock",
  "Configuration Delta Inspector": "Inspektur Selisih Konfigurasi",
  "Execution Task Board": "Papan Tugas Eksekusi",
  "Mandate & Boundary Limits": "Mandate & Batas Wewenang",
  "AI Assistant Console": "Konsol Asisten AI",
  "Cryptographic Audit Center": "Pusat Audit Kriptografis",

  /* ---------- Landing: integrasi ---------- */
  "Web Dashboard": "Dasbor Web",
  "MCP Server": "Server MCP",
  "AI Provider (OpenAI-compatible)": "Penyedia AI (kompatibel OpenAI)",
  "WhatsApp Approval": "Persetujuan WhatsApp",
  "Telegram Ops Stream": "Umpan Operasional Telegram",
  Available: "Tersedia",
  Roadmap: "Peta Jalan",

  /* ---------- Landing: dampak ---------- */
  "Reduced Manual Coordination": "Koordinasi Manual Berkurang",
  "Clear Operational Visibility": "Visibilitas Operasional yang Jelas",
  "Controlled AI Execution": "Eksekusi AI yang Terkendali",
  "Traceable Decisions": "Keputusan yang Dapat Ditelusuri",
  "Centralized Governance": "Tata Kelola Terpusat",

  /* ---------- Landing: penutup & footer ---------- */
  "Ready to Transform Operations": "Siap Mengubah Operasional",
  "Ready to Build a More Governed": "Siap Membangun",
  "AI Workforce?": "AI Workforce yang Lebih Terkendali?",
  "Deterministic Engine": "Mesin Deterministik",
  Product: "Produk",
  "Platform & Docs": "Platform & Dokumen",
  "Operations Overview": "Ringkasan Operasional",
  "Approval Inbox": "Kotak Persetujuan",
  "Task Board": "Papan Tugas",
  "Work Packages": "Paket Kerja",
  "Audit Ledger": "Buku Audit",
  Integrations: "Integrasi",
  "Sign in": "Masuk"
} as const satisfies Record<string, string>;
