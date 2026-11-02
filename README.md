# DEXTRA — Governed Enterprise AI Workforce & Customer Operations Platform

**Specialized AI workers. Human-defined authority. Accountable execution.**

Tencent Cloud Hackathon Indonesia 2026 — Challenge B: The Office Agent

An office agent that acts only on human-approved mandates.

## Prinsip

> Baca boleh otomatis, tulis harus lewat mandat.

## Struktur

```
dextra/
├── apps/
│   ├── dashboard/          # SPA operasional: 23 rute, tanpa build step
│   ├── mcp-server/         # Gateway JSON-RPC di 127.0.0.1:8765
│   └── telegram-adapter/   # Channel adapter (post-MVP)
├── packages/
│   ├── contracts/          # Skema Plan, Mandate, ActionResult + kontrak otorisasi
│   ├── store/              # Persistensi, repository, audit log
│   ├── policy-engine/      # Aturan deterministik + reason code
│   ├── plan/               # Penyusunan rencana + hash parameter
│   ├── mandate-engine/     # Validasi siklus mandat
│   ├── executor/           # Eksekusi terkontrol + idempotensi
│   └── replay/             # Rekonstruksi jejak eksekusi
├── workbuddy/              # Manifest agen, skills, knowledge, mcp.json
├── docs/                   # PRD, model otorisasi, audit, peta monorepo
└── stitch-ref/             # Referensi desain (bukan kode produksi)
```

`apps/dashboard-legacy/` (14 halaman HTML lama) **tidak ada di repo ini** — folder itu
di-ignore Git dan hanya ada di mesin yang membuatnya. Isinya masih bisa diambil dari
commit sebelum `a1ecbd3`.

## Menjalankan

Butuh **Node.js >= 20** (dipakai untuk `--experimental-strip-types`, jadi tanpa langkah build).
Instalasi dependensi sekali di root:

```bash
npm install
```

**1. MCP server** — gateway yang memegang aturan, mandat, dan eksekusi:

```bash
npm start --workspace @dextra/mcp-server
# http://127.0.0.1:8765
```

**2. Dashboard** — SPA statis, tidak butuh server aplikasi:

```bash
cd apps/dashboard
python -m http.server 8899
# http://127.0.0.1:8899/index.html
```

Dashboard berjalan tanpa dependensi runtime dan tanpa CDN. Kalau MCP server mati, dashboard
turun ke mode demo dan **menyatakan** bahwa datanya demo. Peta rute lengkap ada di
`apps/dashboard/README.md`; peta monorepo (aktual vs target arsitektur) ada di
`docs/MONOREPO-MAP.md`.

## Model otorisasi

Wewenang ditentukan server, bukan persona di UI. Rantainya:

```
token → scope → capability → tool → (governance) → mandate → eksekusi
```

| Scope | Boleh |
| --- | --- |
| `agent` | Baca, susun rencana, validasi rencana |
| `ops` | Semua di atas, plus approve, terbitkan/cabut mandat, eksekusi, baca audit log |

Token diatur lewat environment, dibaca **saat panggilan** (bukan saat modul dimuat), sehingga
rotasi tidak butuh restart:

| Variabel | Default dev |
| --- | --- |
| `DEXTRA_AGENT_TOKEN` | `agent-dev-token` |
| `DEXTRA_OPS_TOKEN` | `ops-dev-token` |

Satu sumber kebenaran: `packages/contracts/src/authorization.ts`. Allowlist tool diturunkan
dari kontrak itu (`toolsForScope()`), tidak pernah ditulis tangan, dan otorisasi diperiksa
dua kali — di `handleRpc` dan sekali lagi di `handleTool`.

Beberapa capability ada di kosakata tapi tidak diberikan ke scope mana pun (`manage_users`,
`manage_integrations`, `edit_policy`). Dashboard menampilkannya sebagai **"belum tersedia"**,
bukan **"ditolak"** — karena memang belum ada keputusan yang dibuat.

Detail lengkap: `docs/IDENTITY_AUTHORIZATION_MODEL.md`.

## Status per rute

`sources.js` adalah kontrak rute → tool → modul, dan statusnya jujur per rute:

| Status | Jumlah | Arti |
| --- | --- | --- |
| `live` | 10 | Bisa menampilkan data server nyata |
| `partial` | 6 | Sebagian data nyata, sisanya demo (tidak ada endpoint daftar/agregat) |
| `demo` | 4 | Belum ada permukaan backend; data demo saja |
| `none` | 3 | Bukan rute data (login, error) |

Total 23 rute data. Halaman `/integrations` menampilkan tabel ini supaya klaim "terhubung"
bisa diperiksa sendiri.

## Tes

```bash
npm test          # seluruh workspace, terisolasi per paket — 171 tes
npm run test:inproc  # semua tes dalam satu proses — 171 tes
npm run test:http    # verifikasi batas HTTP (origin policy, token, tools/list) — 16 tes
```

## Batas Kepercayaan

AI menyusun rencana. Manusia menyetujui. Executor memvalidasi mandat secara independen.
Tidak ada jalur dari agen ke executor.

## Keamanan & Eksposur (klaim yang jujur)

- **Local-Only Service Exposure**: MCP server listen di `127.0.0.1`, tidak terbuka ke jaringan.
- **Scoped Execution Authorization**: pemisahan token `agent` vs `ops` ditegakkan di server,
  bukan di prompt. Token tidak membawa identitas orang — hanya kemampuan.
- **Origin/Host policy**: hanya origin loopback yang diizinkan, tanpa wildcard CORS,
  dengan kontrol DNS-rebinding. Request tanpa `Origin` (klien non-browser) tetap bisa
  melakukan `initialize`, tapi tidak mendapat keuntungan otorisasi apa pun.
- **Token disimpan di browser**: dashboard menyimpan token yang Anda masukkan saat login di
  `sessionStorage` (dan `localStorage` bila "ingat saya" dicentang). Artinya siapa pun yang
  memakai profil browser itu bisa bertindak dengan scope tersebut. Ini konsekuensi dari
  tidak adanya sistem identitas, bukan fitur.
- **Bukan "anti-eksfiltrasi absolut"**: respons error tidak membocorkan data sensitif, tapi
  pemegang token `ops` tetap bisa membaca seluruh workspace.

## Batasan yang diketahui (belum dikerjakan)

Ini didokumentasikan, bukan disembunyikan:

- **Tidak ada identitas per pengguna.** Token = himpunan kemampuan, bukan orang. `approver_id`
  adalah string dari klien dan tidak diverifikasi. Karena itu plan tidak punya field pemohon —
  menambahkannya hanya akan mencatat klaim yang tak bisa dibuktikan.
- **Resource scope belum ada.** Satu scope `ops` berlaku global: `execute_action` dan
  `revoke_mandate` menerima mandate apa pun tanpa memeriksa kepemilikan.
- **Token belum punya expiry/revocation.** Rotasi = ganti environment variable.
- **Halaman admin belum berotoritas.** `/users`, `/permissions`, `/integrations` terkunci
  karena capability-nya belum punya backend.
- **Workforce registry & specialist** masih demo: belum ada sumber data server, dan tidak
  dibangun dari prosa Markdown.
- **Migrasi stack** (Next.js/FastAPI/PostgreSQL) belum dimulai — lihat `docs/MONOREPO-MAP.md`.

## Dokumen rujukan

| Dokumen | Isi |
| --- | --- |
| `docs/PRD.md` | Spesifikasi produk lengkap |
| `docs/IDENTITY_AUTHORIZATION_MODEL.md` | Model identitas & otorisasi yang berlaku hari ini |
| `docs/AUTHORIZATION_AUDIT.md` | Temuan audit otorisasi, akar masalah, status perbaikan |
| `docs/AUTHORIZATION_TEST_MATRIX.md` | Kasus uji otorisasi: mana yang teruji, mana yang belum |
| `docs/CROSS_MODULE_CONSISTENCY.md` | Konsistensi Board ↔ Work Package ↔ Execution History |
| `docs/MONOREPO-MAP.md` | Struktur aktual vs target arsitektur |
