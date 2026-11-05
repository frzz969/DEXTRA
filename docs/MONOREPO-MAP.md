# Monorepo Map — aktual vs target

Dokumen ini memetakan struktur repo **yang benar-benar ada** terhadap target di PRD v2.0.0 §11 (Complete Monorepo Structure).
Tujuannya mencegah dua kesalahan: mengira fitur sudah ada karena tertulis di target, dan
membuat folder kosong supaya struktur "terlihat" sesuai spesifikasi.

Diperiksa pada: 3 November 2026, commit `beba8ec` (branch `main`). Angka di dokumen ini
dihitung dari kode, bukan disalin dari dokumen lain.

## 0. Mana yang benar-benar berjalan (jawaban singkat)

Status resmi (A6-A9): **v1 TypeScript = PRODUCTION**; **v2 Python (`apps/web` + `apps/api` + `apps/worker` + `backend/dextra` + `database`/`tests`) = fondasi NON-PROD**
(16 router `main.py:67-85`, 33 tabel, 9 revisi Alembic head `g6a3b4c5d6e7` via `27ba08c94572`, PostgreSQL **belum diverifikasi ulang di sesi ini**, tetapi dashboard v1
tidak memanggilnya; belum ada cutover). Modul non-prod eksplisit: `apps/telegram-adapter` (TODO/post-MVP), `apps/worker` (pemeliharaan, bukan queue), mock executor
(`packages/executor/src/mocks.ts`, `backend/dextra/modules/execution/service.py` `provider:'mock'`), 8 rute demo
dashboard, dan Google OAuth (dicabut 503, A15).

**PRODUCTION (A6-A9, ditetapkan) — yang melayani dashboard hari ini:**
- `apps/dashboard` (SPA, 24 rute) → `apps/mcp-server` (JSON-RPC 127.0.0.1:8765, 19 tool) →
  `packages/{contracts,store,policy-engine,plan,mandate-engine,executor,replay,ui,design-system,api-client,office-agent}`.
- State disimpan di `data/*.json` (JSON file store). Tidak ada PostgreSQL, tidak ada Docker.

**Referensi / fondasi v2 (NON-PROD, A6-A9) — ada, lulus tes, tapi TIDAK dipakai produk:**
- `backend/dextra/**` (FastAPI, 16 router `main.py:67-85`) + `apps/api` + `database/` (Alembic, 33 tabel, 9 revisi head `g6a3b4c5d6e7` via `27ba08c94572`; PostgreSQL **belum diverifikasi ulang di sesi ini**) + `tests/` (pytest).
- `apps/web` (Next.js 16, hanya 2 dari 24 rute).
- `apps/worker` (pemeliharaan berkala — expire mandate + rekap eksekusi macet; **bukan queue**).

Dashboard **tidak** memanggil Python. Python adalah target migrasi, bukan backend produksi saat ini.
Dua jalur berbagi *kontrak* (`packages/contracts`), bukan implementasi — lihat §5.

Yang **belum terbukti**: Docker (tidak terpasang),
migrasi data `data/*.json` → PostgreSQL, 21/24 rute `apps/web` yang belum ada, LangGraph (belum dipakai).

---

## 1. Ringkasan

| Area | Status | Catatan |
|---|---|---|
| TypeScript monorepo (npm workspaces) | ADA | `package.json` → `["packages/*", "apps/mcp-server", "apps/telegram-adapter"]`. `apps/web` sengaja di luar workspace: symlink gagal di Windows. |
| Domain packages (15) | ADA | contracts, store, policy-engine, plan, mandate-engine, executor, replay, ui, design-system, api-client, workflow, skill-registry, alerts, audit-export, **office-agent** |
| MCP gateway | ADA | `apps/mcp-server`, JSON-RPC di `127.0.0.1:8765`, 19 tool |
| Dashboard | ADA | `apps/dashboard` (SPA tanpa build step, 24 rute) |
| WorkBuddy config | ADA | `workbuddy/` — manifest, 4 agen, 5 knowledge |
| Channel adapter | SEBAGIAN | `apps/telegram-adapter` — post-MVP, satu file `index.ts` |
| Next.js + Tailwind + shadcn | **SEBAGIAN** | `apps/web` Next.js 16 berjalan (2 halaman: `/`, `/agents`). Tailwind/shadcn belum dipakai; styling memakai token `packages/design-system`. |
| FastAPI + Pydantic | **ADA** | `backend/dextra` + `apps/api`, 16 router di `/api/v1`, Pydantic untuk validasi |
| PostgreSQL + SQLAlchemy + Alembic | **SEBAGIAN** | Skema + migrasi Alembic ada (33 tabel, 9 revisi head `g6a3b4c5d6e7` via `27ba08c94572`); PostgreSQL **belum diverifikasi ulang di sesi ini**; suite SQLite dijalankan di sesi ini |
| LangGraph | **BELUM** | Orkestrasi dipegang WorkBuddy, bukan LangGraph |
| Worker | **ADA** | `apps/worker` — expire mandate + rekap eksekusi macet |
| Tests Python | **ADA** | `tests/` pytest (unit, integration, security); PostgreSQL-only dilewati bila `DEXTRA_TEST_DATABASE_URL` tidak diset |

**Kesimpulan:** ada dua jalur yang berjalan berdampingan. Jalur v1 (TypeScript: `apps/dashboard`,
`apps/mcp-server`, 15 package termasuk `office-agent`) adalah yang dipakai sekarang (**PRODUCTION**); jalur v2 (`apps/web`, `apps/api`,
`apps/worker`, `backend/dextra`, `database/`, `tests/`) sudah berdiri dan lulus tesnya, tetapi
merupakan **fondasi NON-PROD** — belum ada cutover, dan PostgreSQL **belum diverifikasi ulang di sesi ini**.
Keduanya berbagi kontrak yang sama, bukan dua salinan logika yang berbeda (lihat §5).


---

## 2. Struktur aktual

```text
dextra/
├── apps/
│   ├── dashboard/          SPA v1: 24 rute, tanpa dependency (masih jalur produksi)
│   ├── web/                Next.js 16 (v2): Overview + Workforce
│   ├── api/                entrypoint ASGI -> backend/dextra/main.py
│   ├── worker/             worker pemeliharaan
│   ├── mcp-server/         gateway JSON-RPC + auth + origin policy (v1)
│   └── telegram-adapter/   channel adapter (post-MVP)
├── backend/dextra/         FastAPI: core, database, models, repositories,
│                           governance, mcp, modules (16 domain), main.py
├── database/               migrations (Alembic, 9 revisi) + seeds
├── tests/                  pytest: unit, integration, security
├── infra/docker/           compose + Dockerfile.api + Dockerfile.web + init SQL audit
├── packages/
│   ├── contracts/          skema Plan, Mandate, Approval, Audit, Execution, Risk
│   ├── store/              repository + JSON file store + masking + seed
│   ├── policy-engine/      rules, risk, time window, validator
│   ├── plan/               builder, hash, validate
│   ├── mandate-engine/     validate (siklus + scope)
│   ├── executor/           eksekusi terkontrol
│   ├── replay/             rekonstruksi jejak
│   ├── alerts/             deteksi, retry, dedup notifikasi (transport palsu)
│   ├── skill-registry/     validasi manifest skill (metadata; belum tersambung)
│   ├── workflow/           registry definisi workflow + catatan run
│   ├── ui/                 komponen reusable (kanonik; disalin ke dashboard)
│   ├── design-system/      token warna/ruang/radius (kanonik; disalin ke dashboard)
│   ├── api-client/         bridge JSON-RPC (kanonik; disalin ke dashboard)
│   └── office-agent/       Office Agent (v2 NON-PROD): rencana rute kantor
├── workbuddy/              agents/, knowledge/, mcp.json, connector-meta.json
├── data/                   state runtime: plans, mandates, approvals, audit.jsonl, …
├── docs/                   PRD + audit + verifikasi
├── scripts/                dev-api.sh, dev-web.sh, migrate.sh, test-all.sh,
│                           sync-packages.mjs, verify-packages.mjs
├── package-lock.json       lockfile npm workspaces
├── pyproject.toml          metadata Python (pytest, ruff) — bukan build backend
├── pnpm-workspace.yaml     deklarasi paritas; package manager nyata tetap npm
├── tsconfig.base.json      basis TypeScript untuk semua workspace
└── package.json            npm workspaces, script typecheck/test/demo
```

---

## 3. Target §11 → aktual

| Target | Aktual | Verdict |
|---|---|---|
| `apps/web` (Next.js) | `apps/web` (Next.js 16, 2 halaman) **dan** `apps/dashboard` (SPA v1) | **ADA, SEBAGIAN** — jalur v2 berdiri tetapi baru 2 dari 24 rute; dashboard lama tetap jalur produksi |
| `apps/api` (FastAPI) | `apps/api` → `backend/dextra/main.py` | **ADA** — `/api/v1`, 16 router, Pydantic (NON-PROD) |
| `apps/worker` | `apps/worker` | **ADA** — expire mandate + rekap eksekusi macet |
| `packages/ui` | `packages/ui` (kanonik) → disalin ke `apps/dashboard/assets/js/ui.js` | **SESUAI** — satu sumber, diverifikasi `scripts/verify-packages.mjs` |
| `packages/design-system` | `packages/design-system` (token CSS + `tokens.json`) → disalin ke dashboard | **SESUAI** — 44 token, satu kontrak, light + dark |
| `packages/api-client` | `packages/api-client` (kanonik) → disalin ke `apps/dashboard/assets/js/core.js` | **SESUAI** — satu bridge JSON-RPC |
| `packages/contracts` | `packages/contracts` | **SESUAI** |
| `backend/dextra/modules/*` | `backend/dextra/modules/` — 16 domain | **SESUAI** — approvals, audit, auth, execution, identity, mandates, office_agent, overview, policies, security_center, service_accounts, skills, tasks, tokens, workforce, workflows |
| `backend/dextra/governance` | `backend/dextra/governance/` + `policy-engine` + `mandate-engine` | **SETARA** — TS dan Python berbagi kontrak, bukan logika yang disalin |
| `backend/dextra/mcp` | `backend/dextra/mcp/` + `apps/mcp-server` | **SETARA** — registry Python dibandingkan ke `authorization.ts` oleh `tests/security/test_authorization_parity.py` |
| `database/migrations` | `database/migrations/` (Alembic, 33 tabel, 9 revisi head `g6a3b4c5d6e7` via `27ba08c94572`) + `database/seeds/seed.py` | **ADA** — PostgreSQL **belum diverifikasi ulang di sesi ini** |
| `tests/` (pytest) | `tests/` pytest **dan** `packages/*/tests`, `apps/mcp-server/tests` (node:test) | **ADA** — dua runner, keduanya dijalankan `scripts/test-all.sh` |
| `infra/docker` | `infra/docker/` — compose, Dockerfile.api, Dockerfile.web, init SQL | **ADA** — belum pernah di-build; Docker tidak tersedia di mesin ini |
| `pnpm-workspace.yaml` + Turborepo + uv (§11.3) | `pnpm-workspace.yaml` (deklarasi) + npm + pip | **BERBEDA** — package manager yang benar-benar dipakai tetap npm; belum ada Turborepo; Python memakai pip, bukan uv |
| `pyproject.toml` | `pyproject.toml` | **ADA** — metadata pytest/ruff, bukan build backend |

Satu hal yang tetap **tidak** dikerjakan: tidak ada folder kosong yang dibuat hanya agar
struktur "terlihat" sesuai spesifikasi. Setiap direktori di atas punya isi yang bisa dijalankan
atau diuji.

---

## 4. Rute dashboard → modul repo

Sumber kebenaran ada di kode, bukan di dokumen ini:
`apps/dashboard/assets/js/sources.js`. Setiap rute mendeklarasikan domain, status, tool MCP
yang dipakai, dan modul yang menopangnya. Dokumen ini hanya ringkasannya.

| Status | Arti | Jumlah |
|---|---|---|
| `live` | Bisa menampilkan data server nyata saat MCP hidup | 18 |
| `partial` | Sebagian nyata, sisanya demo (tidak ada endpoint list/agregat) | 3 |
| `demo` | Backend v2 ada, dashboard v1 tidak memanggilnya; fixture berlabel jelas | 8 |
| `none` | Bukan rute data (login, forbidden, not-found) | 3 |

Angka di atas dihitung ulang pada 2026-11-04:

```
grep -c "route: '" apps/dashboard/assets/js/sources.js        # 24
grep -o "state: '[a-z]*'" apps/dashboard/assets/js/sources.js | sort | uniq -c
```

Tool MCP yang dipakai dashboard (16): `create_plan`, `execute_action`, `find_precedent`,
`get_audit_log`, `get_caller_context`, `get_mandate`, `get_org_rules`, `get_plan`,
`get_status`, `list_executions`, `list_mandates`, `list_plans`, `revoke_mandate`,
`submit_approval`, `validate_plan`, dan `list_specialists`.

Dari 19 tool yang ada, **16 dipakai** oleh rute dashboard. Tiga sisanya tidak punya
tombol, dan alasannya berbeda-beda:

- `issue_mandate` diterbitkan setelah approval, bukan oleh tombol.
- `export_audit` dipanggil dari CLI/console; halaman `/security` belum punya tombol ekspor.
- `list_alerts` sudah ada di server tetapi belum ada rute yang menampilkannya.

Ini tercatat sebagai kesenjangan, bukan disembunyikan.

`get_caller_context` menopang tiga rute: `/permissions`, `/integrations`, dan `/login`.
`/permissions` berstatus `live` karena server memang menyatakan kapabilitas dan tool untuk
token yang sedang dipakai — bukan karena ada matriks per peran. Matriks per peran sudah
dihapus: model identitas tidak punya peran per pengguna, dan matriksnya berasal dari data
contoh.

Eksekusi dipicu dari drawer mandat (`execute_action`), dan AI Assistant memakai
`find_precedent` untuk mencari penerima — termasuk berhenti dan bertanya saat hasilnya seri,
alih-alih memilih salah satu. Rantai approve → mandat → eksekusi → audit bisa dijalankan utuh
dari UI.

Kesenjangan yang terlihat dari pemetaan itu, dan tidak disembunyikan:

- **Kepemilikan & pemakaian tidak dilaporkan.** `list_plans` tidak menyimpan pemilik per
  pengguna, dan mandat tidak melaporkan berapa kali dipakai. Rute yang butuh data itu tetap
  `partial`, dan kolomnya menampilkan `—` alih-alih angka karangan.
- **Workforce & Specialist Directory** tidak punya API. Isinya data demo di `data.js`, dan
  keduanya menampilkan banner demo. Registri agen **tidak** dibangun dari `workbuddy/agents/*.md`:
  SPA statis tidak bisa membaca berkas Markdown, dan mem-parse prosa menjadi "registri" berarti
  mengarang field yang tidak pernah ada di server.
- **Board** mengelompokkan kolom di klien; server tidak menyimpan status papan.
- **Users/Permissions** belum punya tool identitas. `/permissions` hanya bisa menampilkan
  kapabilitas scope token lewat `get_caller_context`; matriks peran per pengguna tetap demo.

Halaman **Administration → Integrations** menampilkan tabel ini secara langsung, sehingga
klaim "terhubung" bisa diperiksa di UI, bukan hanya di README.

---

## 5. Dua jalur berdampingan — dan mengapa itu bukan duplikasi

PRD v2.0.0 §11: *"Struktur berikut adalah struktur target arsitektur DEXTRA. Folder tidak
wajib dibuat sekaligus. Setiap direktori hanya boleh dibuat ketika tanggung jawab dan
implementasinya memang diperlukan."* Dan §22: *"Jangan menghapus fitur yang sudah berjalan
tanpa analisis"* serta *"Jangan melakukan migrasi besar tanpa rollback dan parity tests."*

Aturan itu dipakai untuk memutuskan apa yang dibangun dan apa yang **tidak**:

- Jalur v1 (`apps/dashboard`, `apps/mcp-server`, `packages/*`) tetap utuh. Tidak ada satu baris
  pun di sana yang dihapus. Dashboard masih memakai 24 rute yang sama.
- Jalur v2 (`apps/web`, `apps/api`, `backend/dextra`, `database/`, `tests/`) dibangun di
  sampingnya, **bukan** dengan menyalin logika v1 ke Python.
- Yang dipakai bersama adalah **kontrak**, bukan implementasi: `packages/contracts` memuat
  skema Plan/Mandate/Approval/Audit/Execution, dan `tests/security/test_authorization_parity.py`
  membandingkan `packages/contracts/src/authorization.ts` dengan
  `backend/dextra/mcp/registry.py` supaya keduanya tidak bisa menyimpang diam-diam.

Yang masih **belum** benar, dan tidak disembunyikan:

| Belum | Akibatnya |
|---|---|
| PostgreSQL **belum diverifikasi ulang di sesi ini**; suite SQLite dijalankan di sini | Skema + migrasi Alembic ada (33 tabel, 9 revisi); klaim verifikasi PG lama tidak dipertahankan tanpa bukti sesi ini; PG di CI dilewati bila `DEXTRA_TEST_DATABASE_URL` tidak diset. |
| Docker belum tersedia | `infra/docker/*` belum pernah di-build. Berkasnya ada, tapi belum dieksekusi. |
| Data `data/*.json` belum dimigrasi | Jalur v2 mulai dari `database/seeds/seed.py`. Tidak ada jalur impor dari state v1. |
| `apps/web` baru 2 dari 24 rute | Dashboard lama tetap satu-satunya UI lengkap. |
| LangGraph belum dipakai | Orkestrasi masih dipegang WorkBuddy. |

Urutan cutover yang benar, bila migrasi dilanjutkan:

1. ~~Audit + inventory + baseline test~~ — sudah: `docs/VERIFICATION-REPORT.md`.
2. Parity test perilaku untuk `policy-engine`, `mandate-engine`, `executor` — **belum**.
   Parity kontrak sudah ada; parity perilaku belum.
3. PostgreSQL berjalan + migrasi data dari `data/*.json` — **belum**.
4. Cutover `apps/web` rute per rute sampai 23/23 — **2/23**.
5. Baru jalur v1 boleh dipensiunkan, dan hanya setelah parity lulus.

Sampai langkah 2 dan 3 selesai, jalur v1 tetap yang dipakai. Menukar sekarang berarti memindahkan
pengguna ke jalur yang belum punya data dan yang belum terverifikasi di PostgreSQL pada sesi ini.

---

## 6. Cara memverifikasi dokumen ini

```bash
# struktur & paket
ls apps packages
node -e "console.log(require('./package.json').workspaces.join(', '))"

# 19 tool MCP yang diklaim
grep -o "case '[a-z_]*'" apps/mcp-server/src/handlers.ts | sort -u | wc -l

# rute dan sebaran statusnya (24 rute)
grep -c "route: '" apps/dashboard/assets/js/sources.js
grep -o "state: '[a-z]*'" apps/dashboard/assets/js/sources.js | sort | uniq -c

# tes migrasi (SQLite terverifikasi sesi ini; PostgreSQL-only dilewati bila DEX…
python -m pytest tests/integration/test_migrations.py -q --tb=short
npm run lint   # typecheck + node --check seluruh JS

# salinan package tidak menyimpang dari sumber kanonik (gagal = exit 1)
node scripts/verify-packages.mjs

# keadaan runtime tidak ikut ter-commit (harus mengembalikan sebuah baris ignore)
git check-ignore -v data/audit.checkpoint.json data/*.lock
```

Kalau salah satu perintah di atas hasilnya berbeda dari tabel di dokumen ini, dokumen ini
yang salah dan harus diperbarui — bukan sebaliknya.
