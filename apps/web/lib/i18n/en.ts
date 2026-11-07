/* Kamus Inggris.
 *
 * KUNCI = teks sumber apa adanya di dalam kode. Nilai = terjemahan Inggris.
 * Kunci dipakai, bukan nama semantik seperti "nav.workPackages", karena UI ini
 * sudah berbahasa Indonesia sejak awal: dengan kunci teks sumber, versi
 * Indonesia tidak perlu ditulis ulang (lookup gagal = teks asli tampil), dan
 * setiap string yang belum dimigrasikan tetap terbaca, bukan kosong.
 *
 * Konsekuensinya: satu teks Indonesia yang butuh dua terjemahan berbeda di
 * konteks berbeda tidak bisa dibedakan. Bila itu terjadi, ubah teks sumbernya
 * di komponen (beri konteks), bukan menambah mekanisme baru di sini.
 *
 * Istilah domain TIDAK diterjemahkan dan karena itu tidak muncul di berkas ini:
 * Mandate, Approval, Work Package, Office Agent, Worker, Audit Trail, Skill,
 * Execution, Policy, Token. Yang diterjemahkan hanya kalimat penjelas dan label
 * navigasi yang memang bukan istilah produk. */
export const en = {
  /* ---------- Shell: navigasi ---------- */
  "Ruang Kerja": "Workspace",
  Pekerjaan: "Work",
  Persetujuan: "Approvals",
  "Tim AI": "AI Team",
  Overview: "Overview",
  "AI Assistant": "AI Assistant",
  "Office Agent": "Office Agent",
  "Paket Kerja": "Work Packages",
  "Papan Tugas": "Task Board",
  "Riwayat Eksekusi": "Execution History",
  "Kotak Persetujuan": "Approval Inbox",
  Mandat: "Mandates",
  "Jejak Audit": "Audit Trail",
  Workforce: "Workforce",
  "Berjalan lokal": "Running locally",
  "Sistem berjalan di komputer ini. Sesi Anda tersimpan aman di peramban.":
    "This system runs on your own machine. Your session stays in this browser.",

  /* ---------- Shell: identitas & menu akun ---------- */
  "Pengguna DEXTRA": "DEXTRA user",
  "Anggota tim": "Team member",
  "Menu akun": "Account menu",
  Akun: "Account",
  "Akun & Keamanan": "Account & Security",
  "Ganti password": "Change password",
  "Profil & preferensi": "Profile & preferences",
  "Ganti tema": "Switch theme",
  Keluar: "Sign out",
  "Keluar…": "Signing out…",

  /* ---------- Shell: tabsbar ---------- */
  "Halaman terbuka": "Open pages",
  "Tutup tab": "Close tab",

  /* ---------- Topbar ---------- */
  Beranda: "Home",
  Analitik: "Analytics",
  "Penjelajah Data": "Data Explorer",
  "Daftar Keahlian": "Skill Registry",
  "Alur Kerja": "Workflows",
  "Permintaan Saya": "My Requests",
  "Pekerjaan Saya": "My Work",
  "Tinjau & Validasi": "Review & Validate",
  Integrasi: "Integrations",
  "Identitas Layanan": "Service Identities",
  Pengaturan: "Settings",
  "Kunci Akses": "API Tokens",
  "Kelola Akses": "Access Management",
  Kebijakan: "Policies",
  "Pusat Keamanan": "Security Center",
  "Kelola Data": "Data Management",
  Pemantauan: "Monitoring",
  Admin: "Admin",
  Dashboard: "Dashboard",
  "Cari halaman atau aksi": "Search pages or actions",
  "Buka pencarian cepat": "Open quick search",
  "Buka menu": "Open menu",
  "Tutup menu": "Close menu",
  Notifikasi: "Notifications",
  "Belum ada notifikasi": "No notifications yet",
  "Tandai semua dibaca": "Mark all as read",

  /* ---------- Topbar: status & kontrol ---------- */
  "Buka navigasi": "Open navigation",
  "Sistem siap": "All systems ready",
  "Sistem belum siap": "System not ready",
  "Semua bagian sistem berjalan normal": "Every part of the system is running normally",
  "Sebagian sistem belum siap": "Some parts of the system are not ready",
  "Buka Copilot": "Open Copilot",
  "Copilot (Ctrl+J)": "Copilot (Ctrl+J)",
  "Buka pencarian cepat (Ctrl+K)": "Open quick search (Ctrl+K)",
  "Pencarian cepat (Ctrl+K)": "Quick search (Ctrl+K)",
  "Cari halaman…": "Search pages…",
  "Ganti ke mode terang": "Switch to light mode",
  "Ganti ke mode gelap": "Switch to dark mode",
  "Mode gelap aktif": "Dark mode is on",
  "Mode terang aktif": "Light mode is on",
  "Tema gelap aktif": "Dark theme is on",
  "Tema terang aktif": "Light theme is on",

  /* ---------- Bahasa ---------- */
  Bahasa: "Language",
  "Ganti bahasa": "Change language",
  "Pilih bahasa": "Choose a language",

  /* ---------- Login ---------- */
  "Selamat datang kembali": "Welcome back",
  "Masuk untuk melanjutkan ke workspace.": "Sign in to continue to your workspace.",
  "Kembali ke beranda": "Back to home",
  "Kendali penuh atas tenaga kerja AI Anda.": "Full control over your AI workforce.",
  "Empat worker spesialis, wewenang yang Anda tetapkan sendiri, dan setiap tindakan tulis yang tercatat.":
    "Four specialist workers, authority you define yourself, and every write action on the record.",
  "Mandat eksplisit sebelum eksekusi": "Explicit mandates before execution",
  "Audit append-only yang bisa ditelusuri": "Append-only audit you can trace",
  "Tidak ada jalur langsung agen ke executor": "No direct path from agent to executor",
  "Instans lokal · 127.0.0.1 · Asia/Jakarta": "Local instance · 127.0.0.1 · Asia/Jakarta",
  "Akun demo": "Demo account",
  "Akses dicatat pada audit trail tenant. Tidak ada reset kata sandi mandiri di aplikasi ini.":
    "Access is recorded in the tenant audit trail. There is no self-service password reset in this app.",
  "Kosongkan untuk memakai tenant default Anda.": "Leave empty to use your default tenant.",
  "(opsional)": "(optional)",
  "nama@perusahaan.co.id": "name@company.com",
  "Akun ini mengharuskan": "This account requires",
  "Lupa kata sandi? Hubungi administrator tenant Anda":
    "Forgot your password? Contact your tenant administrator",
  Masuk: "Sign in",
  "Masuk…": "Signing in…",
  "Masukkan kata sandi": "Enter your password",
  "Kode authenticator": "Authenticator code",
  "Memverifikasi…": "Verifying…",
  "Verifikasi & masuk": "Verify & sign in",
  "Masukkan kode 6 digit dari aplikasi authenticator Anda.":
    "Enter the 6-digit code from your authenticator app.",
  "Email atau password salah.": "Incorrect email or password.",

  /* ---------- Landing: navigasi & header ---------- */
  "DEXTRA — beranda": "DEXTRA — home",
  Tentang: "About",
  "Cara Kerja": "How It Works",
  "Kontrol & Audit": "Controls & Audit",
  "Buka Dashboard": "Open Dashboard",
  "Masuk ke Akun": "Sign in to your account",

  /* ---------- Landing: hero ---------- */
  "Prinsip Inti:": "Core Principle:",
  "Baca boleh otomatis, tulis harus lewat mandat.":
    "Reads may be automated; writes must pass through a mandate.",
  Temui: "Meet",
  "platform AI workforce terotorisasi yang mengoordinasikan empat spesialis independen, merapikan operasional kantor, dan menjaga setiap aksi kritis tetap di bawah mandat otoritas manusia.":
    "an authorized AI workforce platform that coordinates four independent specialists, tidies up office operations, and keeps every critical action under a human authority mandate.",
  "Pelajari Alur Mandat": "See the Mandate Flow",
  "4 Spesialis AI": "4 AI Specialists",
  "Validator kebijakan deterministik (non-LLM)": "Deterministic policy validator (non-LLM)",
  "Jejak audit permanen": "Permanent audit trail",

  /* ---------- Landing: mockup ---------- */
  "Validator: deterministik": "Validator: deterministic",
  "Mode demo": "Demo mode",
  Rencana: "Plans",
  Spesialis: "Specialists",
  "Ringkasan operasional hari ini": "Today's operational summary",
  "Sesi aktif": "Active session",
  "Menunggu persetujuan": "Awaiting approval",
  "Tindakan bermandat": "Mandated actions",
  "Rapat koordinasi · 13 Nov 10.00": "Coordination meeting · 13 Nov, 10:00",
  "Menunggu Anda": "Waiting for you",
  "Notulen rapat operasional": "Operational meeting notes",
  "Mandat terbit": "Mandate issued",
  "Follow-up Keuangan · 13 Nov 13.15": "Finance follow-up · 13 Nov, 13:15",
  "Rencana ditahan": "Plan on hold",
  "Eksekusi berhenti sampai Anda menandatangani. Tidak ada jalur pintas.":
    "Execution stops until you sign. There is no shortcut.",
  "Setiap tindakan berhenti di persetujuan manusia": "Every action stops at human approval",

  /* ---------- Landing: tata kelola ---------- */
  "AI Workforce. Human Authority. Complete Accountability.":
    "AI Workforce. Human Authority. Complete Accountability.",
  "DEXTRA menutup risiko eksekusi liar dari model yang tidak deterministik. Setiap inisiatif operasional dibatasi tiga fondasi yang sama di semua halaman.":
    "DEXTRA closes off the risk of runaway execution by non-deterministic models. Every operational initiative is bounded by the same three foundations on every page.",
  "Bukan bot serba bisa. DEXTRA membagi beban kerja ke empat spesialis dengan batasan kemampuan dan konteks yang berbeda-beda.":
    "Not a do-everything bot. DEXTRA splits the workload across four specialists with different capability and context boundaries.",
  "Peran fungsional terisolasi dan terukur": "Isolated, measurable functional roles",
  "Sintesis berbasis bukti, bukan asumsi": "Evidence-based synthesis, not assumptions",
  "Batas wewenang yang tidak bisa dilanggar. Membaca boleh otonom; mengubah status, memodifikasi data, atau mengirim keluar wajib otorisasi manusia.":
    "Authority boundaries that cannot be crossed. Reads may be autonomous; changing status, modifying data, or sending anything out requires human authorization.",
  "Persetujuan manusia sebelum eksekusi": "Human approval before execution",
  "Mandat bertanda tangan untuk tiap tindakan": "A signed mandate for every action",
  "Setiap rencana menghasilkan jejak audit permanen: siapa menyusun, apa yang diperiksa, dan siapa yang menyetujui.":
    "Every plan produces a permanent audit trail: who drafted it, what was checked, and who approved it.",
  "Jejak audit untuk setiap tindakan": "An audit trail for every action",
  "Perbandingan rencana sebelum dijalankan": "Plan comparison before anything runs",

  /* ---------- Landing: spesialis ---------- */
  "Meet the Specialized Workers Behind Your Operations.":
    "Meet the Specialized Workers Behind Your Operations.",
  "DEXTRA dirancang dengan tepat empat spesialis. Tidak ada bot generik: setiap agen punya peran fungsional dan kapabilitas yang saling memeriksa.":
    "DEXTRA is built around exactly four specialists. There is no generic bot: each agent has a functional role and capabilities that check one another.",
  Kapabilitas: "Capabilities",
  "Membagi pekerjaan ke spesialis dan memantau kemajuannya.":
    "Splits work across specialists and tracks progress.",
  "Menyusun rencana kerja dan ringkasan untuk manusia.":
    "Drafts work plans and summaries for humans.",
  "Menyiapkan dokumen dan korespondensi sesuai mandat.":
    "Prepares documents and correspondence under mandate.",
  "Mencari cacat rencana sebelum diajukan untuk persetujuan.":
    "Looks for flaws in a plan before it goes up for approval.",
  "Arsitektur Kunci: Policy Validator BUKAN AI Worker":
    "Key Architecture: the Policy Validator Is NOT an AI Worker",
  "Policy Validator adalah mesin aturan yang": "The Policy Validator is a rules engine that",
  "tidak memakai LLM": "does not use an LLM",
  "Ia memeriksa izin, kebijakan, dan kelayakan tindakan sebelum instruksi mencapai sistem produksi — sehingga hasilnya bisa diulang dan tidak bergantung pada tebakan model.":
    "It checks permissions, policies, and whether an action is admissible before the instruction reaches a production system — so results are repeatable and never depend on a model's guess.",
  "non-LLM · hasil dapat diulang": "non-LLM · repeatable results",

  /* ---------- Landing: alur kerja ---------- */
  "From Human Request to Governed Execution.": "From Human Request to Governed Execution.",
  "Setiap tahap terlihat. Tidak ada kotak hitam, dan tidak ada eksekusi tanpa verifikasi izin serta tinjauan manusia.":
    "Every stage is visible. No black boxes, and no execution without permission checks and human review.",
  Langkah: "Step",
  Kunci: "Key",
  "Anda mengajukan tugas operasional lewat AI Assistant atau formulir Office Agent.":
    "You submit an operational task through the AI Assistant or the Office Agent form.",
  "Workforce Dispatcher memahami maksud permintaan dan memilih spesialis yang sesuai.":
    "The Workforce Dispatcher works out the intent and picks the right specialist.",
  "Executive Assistant menyusun rincian rencana dan tindakan yang akan dijalankan.":
    "The Executive Assistant drafts the plan details and the actions to be taken.",
  "Adversarial Reviewer menandai risiko, dan validator kebijakan memeriksa batas mandat.":
    "The Adversarial Reviewer flags risks, and the policy validator checks mandate boundaries.",
  "Anda memeriksa rencana dan tindakannya, lalu memutuskan setuju atau tolak. Langkah ini tidak bisa dilewati.":
    "You review the plan and its actions, then approve or reject. This step cannot be skipped.",
  "Mandat terbit dari persetujuan Anda, dan eksekusi tercatat di jejak audit.":
    "The mandate is issued from your approval, and execution is recorded in the audit trail.",
  "Fondasi Utama Filosofi Keamanan DEXTRA": "The Core of DEXTRA's Security Philosophy",
  "Lihat Dashboard": "View Dashboard",

  /* ---------- Landing: pusat kendali ---------- */
  "Everything Under Your Control.": "Everything Under Your Control.",
  "Enam instrumen kendali utama untuk kepatuhan, mitigasi risiko, dan audit — semuanya ada di dalam aplikasi yang sama.":
    "Six core control instruments for compliance, risk mitigation, and audit — all inside the same application.",
  "Antrean persetujuan berjenjang: rencana dan tindakannya ditampilkan berdampingan sebelum Anda menandatangani.":
    "A tiered approval queue: the plan and its actions sit side by side before you sign.",
  "Perbandingan konfigurasi antara dasar yang berlaku dan usulan perubahan, sebelum perubahan itu diterapkan.":
    "A configuration comparison between the current baseline and a proposed change, before that change is applied.",
  "Papan tugas dengan tahap yang jelas, sehingga posisi setiap pekerjaan terlihat tanpa perlu bertanya.":
    "A task board with clear stages, so the position of every piece of work is visible without asking.",
  "Mandat menetapkan apa yang boleh dilakukan, untuk berapa lama, dan atas dasar persetujuan siapa.":
    "A mandate sets what may be done, for how long, and on whose approval.",
  "Percakapan dengan empat spesialis sesuai perannya, dan setiap jawaban berhenti di persetujuan Anda.":
    "Conversations with the four specialists in their own roles, and every answer stops at your approval.",
  "Catatan eksekusi permanen dengan hash per rencana, sehingga isi yang disetujui tidak bisa diubah diam-diam.":
    "Permanent execution records with a per-plan hash, so approved content cannot be changed behind your back.",

  /* ---------- Landing: integrasi ---------- */
  "One Workforce. Multiple Ways to Collaborate.": "One Workforce. Multiple Ways to Collaborate.",
  "DEXTRA menjadi pusat orkestrasi antara operator manusia, dashboard operasional, AI worker, dan antarmuka eksternal.":
    "DEXTRA is the orchestration point between human operators, the operational dashboard, AI workers, and external interfaces.",
  Tersedia: "Available",
  "Aplikasi Next.js 16 dan React 19 dengan mode terang dan gelap, navigasi berjenjang, serta manajemen paket kerja.":
    "A Next.js 16 and React 19 app with light and dark modes, tiered navigation, and work package management.",
  "Konsol bahasa alami untuk meminta draf, memecah tugas, dan menilai risiko sebelum diajukan.":
    "A natural-language console for requesting drafts, breaking down tasks, and assessing risk before submission.",
  "Gateway Model Context Protocol untuk menghubungkan alat dan sumber data dengan batas izin yang jelas.":
    "A Model Context Protocol gateway that connects tools and data sources with explicit permission boundaries.",
  "Model dipilih lewat konfigurasi server, bukan di browser. Bisa OpenAI, DeepSeek, Qwen, atau endpoint sendiri.":
    "The model is chosen through server configuration, not the browser. It can be OpenAI, DeepSeek, Qwen, or your own endpoint.",
  "Notifikasi dan otorisasi lewat WhatsApp Business API. Belum dirilis; jangan diandalkan untuk demo.":
    "Notifications and authorization through the WhatsApp Business API. Not released yet; do not rely on it for a demo.",
  "Umpan telemetri untuk pengawas saat rencana tertahan atau mandat dibekukan. Masih tahap pengembangan.":
    "A telemetry feed for supervisors when a plan is stuck or a mandate is frozen. Still in development.",

  /* ---------- Landing: dampak ---------- */
  "Make Your Operations More Organized, Visible, and Accountable.":
    "Make Your Operations More Organized, Visible, and Accountable.",
  "Tanpa klaim angka yang tidak bisa dibuktikan. Yang berubah adalah cara kerja: koordinasi tercatat, posisi pekerjaan terlihat, dan keputusan punya jejak.":
    "No unprovable numbers. What changes is the way work happens: coordination is recorded, work positions are visible, and decisions leave a trail.",
  "Reduced Manual Coordination": "Reduced Manual Coordination",
  "Tidak perlu bolak-balik menanyakan status. Koordinasi antar-spesialis tercatat di satu alur.":
    "No more back-and-forth status checks. Coordination between specialists is recorded in a single flow.",
  "Clear Operational Visibility": "Clear Operational Visibility",
  "Posisi setiap pekerjaan terlihat: sedang disusun, sedang ditinjau, atau menunggu persetujuan Anda.":
    "The position of every piece of work is visible: being drafted, under review, or waiting for your approval.",
  "Controlled AI Execution": "Controlled AI Execution",
  "Aksi keluar tidak bergantung pada tebakan model. Validator memeriksa batas, manusia memegang keputusan.":
    "Outbound actions never depend on a model's guess. The validator checks boundaries, the human holds the decision.",
  "Traceable Decisions": "Traceable Decisions",
  "Setiap persetujuan mencatat siapa yang memberi wewenang dan atas dasar rencana yang mana.":
    "Every approval records who granted authority and on the basis of which plan.",
  "Centralized Governance": "Centralized Governance",
  "Satu tempat untuk mengatur mandat, peran, dan batas tindakan di seluruh workforce.":
    "One place to govern mandates, roles, and action boundaries across the whole workforce.",
  "Coba sendiri": "Try it yourself",
  "Lihat alurnya dari ujung ke ujung": "See the flow end to end",
  "Buka Office Agent, pilih satu worker, dan ikuti rencananya sampai persetujuan.":
    "Open Office Agent, pick a worker, and follow its plan through to approval.",
  "Buka Office Agent": "Open Office Agent",

  /* ---------- Landing: penutup & footer ---------- */
  "Ready to Transform Operations": "Ready to Transform Operations",
  "Ready to Build a More Governed": "Ready to Build a More Governed",
  "AI Workforce?": "AI Workforce?",
  "Temukan bagaimana DEXTRA menyatukan pekerja AI spesialis dan wewenang manusia dalam satu ruang kerja operasional.":
    "See how DEXTRA brings specialist AI workers and human authority together in one operational workspace.",
  "Explore DEXTRA Dashboard": "Explore DEXTRA Dashboard",
  "Tanpa data contoh yang dikarang": "No invented sample data",
  "Setiap tindakan lewat mandat": "Every action goes through a mandate",
  "Prinsip:": "Principle:",
  "Hak cipta dilindungi.": "All rights reserved.",
  "Tata kelola": "Governance",
  "Alur kerja": "Workflow",
  "Platform & Docs": "Platform & Docs",
  "Operations Overview": "Operations Overview",
  "Audit Ledger": "Audit Ledger",
  "Approval Inbox": "Approval Inbox",
  "Task Board": "Task Board",
  "Work Packages": "Work Packages"
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof en;
