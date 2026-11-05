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
│   ├── dashboard/          # SPA operasional v1 (produksi): 24 rute, tanpa build step
│   ├── web/                # Next.js 16 (v2): Overview + Workforce, data dari /api/v1
│   ├── api/                # Entrypoint ASGI -> backend/dextra/main.py
│   ├── worker/             # Pemeliharaan: expire mandate, rekap eksekusi macet
│   ├── mcp-server/         # Gateway JSON-RPC v1 di 127.0.0.1:8765
│   └── telegram-adapter/   # Channel adapter (post-MVP)
├── backend/
│   └── dextra/             # FastAPI (NON-PROD): core, database, models, repositories,
│                           # governance, mcp, modules (16 domain), main.py
├── packages/
│   ├── contracts/          # Skema Plan, Mandate, ActionResult + kontrak otorisasi
│   ├── store/              # Persistensi JSON, repository, audit log (v1)
│   ├── policy-engine/      # Aturan deterministik + reason code (v1)
│   ├── plan/               # Penyusunan rencana + hash parameter
│   ├── mandate-engine/     # Validasi siklus mandat (v1)
│   ├── executor/           # Eksekusi terkontrol + idempotensi (v1)
│   ├── replay/             # Rekonstruksi jejak eksekusi
│   ├── alerts/             # Deteksi, retry, dedup notifikasi (transport palsu)
│   ├── audit-export/       # Ekspor audit JSONL + verifier independen
│   ├── skill-registry/     # Validasi manifest skill (metadata, belum tersambung)
│   ├── workflow/           # Registry definisi workflow + catatan run
│   ├── ui/                 # Komponen UI — sumber kanonik
│   ├── design-system/      # tokens.json + dashboard.css — sumber kanonik
│   └── api-client/         # Klien JSON-RPC — sumber kanonik
│   ├── office-agent/       # Office Agent (v2 NON-PROD): rencana rute kantor
├── database/
│   ├── migrations/         # Alembic (9 revisi, head g6a3b4c5d6e7 via 27ba08c94572, 33 tabel)
│   └── seeds/              # Seed idempoten: 4 spesialis, role, policy
├── tests/                  # pytest: unit, integration, security
├── infra/docker/           # compose + Dockerfile api/web + init SQL audit
├── scripts/                # sync/verify paket, dev-api, dev-web, migrate, test-all
├── workbuddy/              # Manifest agen, skills, knowledge, mcp.json
└── docs/                   # PRD, audit, model otorisasi, skema DB, peta migrasi
```

## Stack produksi (A6-A9 — ditetapkan tanpa refactor besar)

| Jalur | Status | Bukti |
| --- | --- | --- |
| **v1 TypeScript** (`apps/dashboard` + `apps/mcp-server`, JSON-RPC 127.0.0.1:8765, `data/*.json`) | **PRODUCTION** — yang melayani dashboard hari ini | `npm run typecheck`, `npm run lint`, `node scripts/check-syntax.mjs` |
| **v2 Python** (`backend/dextra`, FastAPI `/api/v1`, 16 router di `backend/dextra/main.py:67-85`, 33 tabel, 9 revisi Alembic head `g6a3b4c5d6e7` via `27ba08c94572`) | **FONDASI NON-PROD** — ada, dashboard v1 TIDAK memanggilnya; belum ada cutover. PostgreSQL **belum diverifikasi ulang di sesi ini** (klaim PG 16.2 / 206 tes lama tidak disertakan tanpa bukti sesi ini; suite SQLite dijalankan di sini) | `py -m pytest tests/integration/test_migrations.py -q`, `grep __tablename__ backend/dextra/models`, `docs/DATABASE_SCHEMA.md` |

Klaim basi yang diperbaiki (A6-A9): FastAPI **16 router** (`main.py:67-85`, bukan 9);
skema **33 tabel** (`grep __tablename__ backend/dextra/models`, bukan 21); Alembic
**9 revisi, head `g6a3b4c5d6e7`** (rantai: `d9cd32b89961 → b1f7c2a9d4e6 → c4d8e1f6a2b3 → d2a6b8c41f07 → e7b3c9d51a84 → f5a2d7e93c18 → a8c1e5f70b92 → 27ba08c94572 → g6a3b4c5d6e7`,
bukan 1 revisi / head lama `27ba08c94572`); PostgreSQL: **belum diverifikasi ulang di
sesi ini** — tidak ada klaim "PG 16.2 terverifikasi" atau "206 tes lulus di PostgreSQL"
tanpa bukti sesi ini. `packages/office-agent` kini masuk daftar package (baris di atas).

### Modul non-prod eksplisit (jangan dianggap produksi)

- `apps/telegram-adapter/` — TODO/post-MVP: channel adapter belum lengkap (1 file `index.ts`).
- `apps/worker/` — bukan queue (bukan antrean job): hanya pemeliharaan berkala (expire mandate, rekap eksekusi macet).
- Mock executor: `packages/executor/src/mocks.ts` + `backend/dextra/modules/execution/service.py`
  adapter `provider:'mock'` — tidak memanggil sistem eksternal; UI wajib label mock.
- `apps/dashboard` rute demo (8): `/account`, `/access`, `/tokens`,
  `/data-management`, `/service-identities`, `/security-center`, `/skills`,
  `/workflow` — `sources.js state:'demo'`, fixture berlabel jelas; backend v2
  untuk semuanya SUDAH ada (`/api/v1/auth/*`, `/users`, `/roles`, `/tokens`,
  `/service-accounts`, `/security/*`, `/skills`, `/workflows`) tetapi dashboard
  v1 tidak memanggilnya.
- Google OAuth (`/api/v1/auth/google*`) — dicabut eksplisit, 503 jujur (A15),
  sampai sesi bisa diterbitkan dengan validasi state/exp/email_verified.

## Stack produksi (A6-A9 — ditetapkan tanpa refactor besar)

| Jalur | Status | Bukti |
| --- | --- | --- |
| **v1 TypeScript** (`apps/dashboard` + `apps/mcp-server`, JSON-RPC 127.0.0.1:8765, `data/*.json`) | **PRODUCTION** — yang melayani dashboard hari ini | `npm run typecheck`, `npm run lint`, `node scripts/check-syntax.mjs` |
| **v2 Python** (`backend/dextra`, FastAPI `/api/v1`, 16 router di `backend/dextra/main.py:67-85`, 33 tabel, 9 revisi Alembic head `g6a3b4c5d6e7` via `27ba08c94572`) | **FONDASI NON-PROD** — ada, dashboard v1 TIDAK memanggilnya; belum ada cutover. PostgreSQL **belum diverifikasi ulang di sesi ini** (klaim PG 16.2 / 206 tes lama tidak disertakan tanpa bukti sesi ini; suite SQLite dijalankan di sini) | `py -m pytest tests/integration/test_migrations.py -q`, `grep __tablename__ backend/dextra/models`, `docs/DATABASE_SCHEMA.md` |

Klaim basi yang diperbaiki (A6-A9): FastAPI **16 router** (`main.py:67-85`, bukan 9);
skema **33 tabel** (`grep __tablename__ backend/dextra/models`, bukan 21); Alembic
**9 revisi, head `g6a3b4c5d6e7`** (rantai: `d9cd32b89961 → b1f7c2a9d4e6 → c4d8e1f6a2b3 → d2a6b8c41f07 → e7b3c9d51a84 → f5a2d7e93c18 → a8c1e5f70b92 → 27ba08c94572 → g6a3b4c5d6e7`,
bukan 1 revisi / head lama `27ba08c94572`); PostgreSQL: **belum diverifikasi ulang di
sesi ini** — tidak ada klaim "PG 16.2 terverifikasi" atau "206 tes lulus di PostgreSQL"
tanpa bukti sesi ini. `packages/office-agent` kini masuk daftar package (baris di atas).

### Modul non-prod eksplisit (jangan dianggap produksi)

- `apps/telegram-adapter/` — TODO/post-MVP: channel adapter belum lengkap (1 file `index.ts`).
- `apps/worker/` — bukan queue (bukan antrean job): hanya pemeliharaan berkala (expire mandate, rekap eksekusi macet).
- Mock executor: `packages/executor/src/mocks.ts` + `backend/dextra/modules/execution/service.py`
  adapter `provider:'mock'` — tidak memanggil sistem eksternal; UI wajib label mock.
- `apps/dashboard` rute demo (8): `/account`, `/access`, `/tokens`,
  `/data-management`, `/service-identities`, `/security-center`, `/skills`,
  `/workflow` — `sources.js state:'demo'`, fixture berlabel jelas; backend v2
  untuk semuanya SUDAH ada (`/api/v1/auth/*`, `/users`, `/roles`, `/tokens`,
  `/service-accounts`, `/security/*`, `/skills`, `/workflows`) tetapi dashboard
  v1 tidak memanggilnya.
- Google OAuth (`/api/v1/auth/google*`) — dicabut eksplisit, 503 jujur (A15),
  sampai sesi bisa diterbitkan dengan validasi state/exp/email_verified.

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

## Menjalankan DEXTRA v2 (FastAPI + PostgreSQL + Next.js)

Fondasi v2 berdampingan dengan v1: gateway MCP dan dashboard lama tetap jalan
sampai parity tercapai. Yang tersedia sekarang: API REST, skema database dengan
migrasi Alembic, seed idempoten, worker pemeliharaan, dan dua halaman Next.js.

```bash
# 1. Database — PostgreSQL adalah target, SQLite hanya untuk pengembangan
export DATABASE_URL=sqlite+pysqlite:///./data/dextra-v2.db
python -m alembic -c database/alembic.ini upgrade head
python database/seeds/seed.py

# 2. API
./scripts/dev-api.sh            # http://127.0.0.1:8000/docs

# 3. Web (butuh npm install di apps/web, lihat catatan di bawah)
./scripts/dev-web.sh            # http://127.0.0.1:3000

# 4. Pemeriksaan
./scripts/test-all.sh
```

`apps/web` **tidak** ikut npm workspace root: pembuatan symlink workspace gagal
di Windows (`EISDIR`), jadi dependensinya dipasang sendiri:

```bash
cd apps/web && npm install
```

Catatan jujur: PostgreSQL belum berjalan di mesin pengembangan (tidak terpasang,
Docker tidak tersedia), sehingga migrasi dan tes dijalankan di SQLite. Perilaku
khas PostgreSQL belum terbukti. Lihat `docs/REPOSITORY_AUDIT.md`.

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
| `live` | 18 | Bisa menampilkan data server nyata |
| `partial` | 3 | Sebagian data nyata, sisanya demo (tidak ada endpoint daftar/agregat) |
| `demo` | 8 | Halaman demo berlabel jelas (backend v2 ada, dashboard tidak memanggilnya) |
| `none` | 3 | Bukan rute data (login, error) |

Total 32 rute. Halaman `/integrations` menampilkan tabel ini supaya klaim "terhubung"
bisa diperiksa sendiri. Angka ini dihitung dari `sources.js`, bukan dari ingatan:
`grep -c "route: '" apps/dashboard/assets/js/sources.js`.

## Tes

```bash
npm test          # seluruh workspace, terisolasi per paket — 349 tes
npm run test:inproc  # semua tes dalam satu proses — 349 tes
npm run test:http    # verifikasi batas HTTP (origin policy, token, tools/list) — 16 tes
npm run lint          # typecheck semua workspace + node --check seluruh JS (66 berkas)
npm run test:e2e      # e2e dashboard via Chrome headless + CDP (tanpa dependensi)
```

E2E (`npm run test:e2e`, `apps/dashboard/tests/e2e/run.mjs`): butuh Chrome/Chromium
terpasang; tanpa Chrome ia mencetak `LEWATI` dan exit 0. Set `DEXTRA_CHROME` untuk
path eksplisit. Ia menjalankan MCP server sendiri di direktori data sementara,
port 8765/8899/9333 — hentikan proses lain di port itu dulu. Lihat header run.mjs.

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

- **Identitas per pengguna baru sebagian.** Token kini terikat ke principal server-side
  (`data/principals.json` → `DEXTRA_OPS_PRINCIPAL`/`DEXTRA_AGENT_PRINCIPAL`), dan `create_plan`
  merekam `requester_id`/`assignee_id` dari principal itu (bukan dari klien). Tetapi token
  masih tidak punya expiry/revocation, dan resource-scope (mandat milik siapa) belum ditegakkan
  — `execute_action`/`revoke_mandate` menerima mandate apa pun. Satu token = satu orang,
  tapi pencabutan rotasi masih manual (ganti env var).
- **Resource scope belum ada.** Satu scope `ops` berlaku global: `execute_action` dan
  `revoke_mandate` menerima mandate apa pun tanpa memeriksa kepemilikan.
- **Token belum punya expiry/revocation.** Rotasi = ganti environment variable.
- **Halaman admin belum berotoritas.** `/users`, `/permissions`, `/integrations` terkunci
  karena capability-nya belum punya backend.
- **Workforce registry & specialist** masih demo: belum ada sumber data server, dan tidak
  dibangun dari prosa Markdown.
- **Status produksi** (A6-A9): v1 TS = production; v2 Python (16 router, 33 tabel,
  9 revisi Alembic head `g6a3b4c5d6e7` via `27ba08c94572`) = fondasi non-prod, belum cutover.
  PostgreSQL **belum diverifikasi ulang di sesi ini**. Data lama
  `data/*.json` belum dimigrasi — lihat `docs/MIGRATION_MAP.md`.

## Dokumen rujukan

| Dokumen | Isi |
| --- | --- |
| `docs/PRD.md` | PRD v2.0.0 — spesifikasi produk lengkap (dokumen target) |
| `docs/IDENTITY_AUTHORIZATION_MODEL.md` | Model identitas & otorisasi yang berlaku hari ini |
| `docs/AUTHORIZATION_AUDIT.md` | Temuan audit otorisasi, akar masalah, status perbaikan |
| `design/AUDIT-EXPORT.md` | Format ekspor audit, apa yang diperiksa verifier, dan batasnya |
| `docs/AUTHORIZATION_TEST_MATRIX.md` | Kasus uji otorisasi: mana yang teruji, mana yang belum |
| `docs/CROSS_MODULE_CONSISTENCY.md` | Konsistensi Board ↔ Work Package ↔ Execution History |
| `docs/MONOREPO-MAP.md` | Struktur aktual vs target arsitektur |
| `docs/REPOSITORY_AUDIT.md` | Audit kondisi aktual, penyimpangan, dan bug yang ditemukan |
| `docs/MIGRATION_MAP.md` | Peta v1 → v2 per domain: strategi, risiko, verifikasi |
| `docs/DATABASE_SCHEMA.md` | Skema 33 tabel (9 revisi, head `g6a3b4c5d6e7`; PG belum diverifikasi ulang sesi ini), index, batas transaksi, yang belum ada |
