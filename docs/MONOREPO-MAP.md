# Monorepo Map — aktual vs target (post-cutover)

Dokumen ini memetakan struktur repo **yang benar-benar ada** setelah cutover frontend ke `apps/web`.
Tujuannya mencegah dua kesalahan: mengira fitur sudah ada karena tertulis di target, dan
membuat folder kosong supaya struktur "terlihat" sesuai spesifikasi.

Diperiksa pada: 6 November 2026. Angka di dokumen ini dihitung dari kode, bukan disalin dari dokumen lain.

## 0. Mana yang benar-benar berjalan (jawaban singkat)

Status resmi: **`apps/web` = PRODUCTION** (Next.js 16, 25 rute, terhubung FastAPI `/api/v1`, login sesi + CSRF, Explorer via MCP gateway). `apps/dashboard` (v1 SPA) telah dihapus. `apps/mcp-server` tetap dipakai `apps/web` (Explorer, audit). `backend/dextra` (FastAPI) adalah backend produksi.

**PRODUCTION:**
- `apps/web` (Next.js 16, 25 rute) → `backend/dextra` (FastAPI `/api/v1`, 16 router) + `apps/mcp-server` (JSON-RPC 127.0.0.1:8765, 19 tool untuk Explorer/audit).
- Login sesi (`/auth/login`, cookie httpOnly + CSRF) + mode demo (Bearer token env) bila tidak ada sesi.
- State disimpan di PostgreSQL/SQLite via Alembic; `data/*.json` masih ada sebagai artefak legacy (belum dimigrasi, lihat `/data-management`).

**Referensi / fondasi:**
- `backend/dextra/**` (FastAPI, 16 router) + `database/` (Alembic, 33 tabel, 9 revisi head `g6a3b4c5d6e7` via `27ba08c94572`; PostgreSQL **belum diverifikasi ulang di sesi ini**) + `tests/` (pytest).
- `apps/worker` (pemeliharaan berkala — expire mandate + rekap eksekusi macet; **bukan queue**).
- `apps/telegram-adapter` (post-MVP).

Yang **belum terbukti**: Docker, migrasi data `data/*.json` → PostgreSQL, LangGraph.

---

## 1. Ringkasan

| Area | Status | Catatan |
|---|---|---|
| TypeScript monorepo (pnpm workspaces) | ADA | `pnpm-workspace.yaml` → `["packages/*", "apps/*"]` (termasuk `apps/mcp-server`). `apps/web` ikut workspace: symlink berfungsi di NTFS drive `D:`. |
| Domain packages (15) | ADA | contracts, store, policy-engine, plan, mandate-engine, executor, replay, ui, design-system, api-client, workflow, skill-registry, alerts, audit-export, **office-agent** |
| MCP gateway | ADA | `apps/mcp-server`, JSON-RPC di `127.0.0.1:8765`, 19 tool |
| Dashboard v1 | **DIHAPUS** | `apps/dashboard` telah dihapus setelah cutover ke `apps/web`. |
| Next.js + design-system | ADA | `apps/web` Next.js 16, 25 rute, styling token `packages/design-system` (tanpa Tailwind/shadcn). |
| FastAPI + Pydantic | ADA | `backend/dextra` + `apps/api`, 16 router di `/api/v1`. |
| PostgreSQL + SQLAlchemy + Alembic | **SEBAGIAN** | Skema + migrasi Alembic ada (33 tabel, 9 revisi head `g6a3b4c5d6e7` via `27ba08c94572`); PostgreSQL **belum diverifikasi ulang di sesi ini**; suite SQLite dijalankan di sesi ini |
| LangGraph | **BELUM** | Orkestrasi dipegang WorkBuddy, bukan LangGraph |
| Worker | **ADA** | `apps/worker` — expire mandate + rekap eksekusi macet |
| Tests Python | **ADA** | `tests/` pytest (unit, integration, security); PostgreSQL-only dilewati bila `DEXTRA_TEST_DATABASE_URL` tidak diset |

**Kesimpulan:** satu jalur frontend (`apps/web`), satu backend (`backend/dextra` + `apps/mcp-server` untuk gateway Explorer). Tidak ada dua UI paralel.

---

## 2. Struktur aktual

```text
dextra/
├── apps/
│   ├── api/                entrypoint ASGI -> backend/dextra/main.py
│   ├── web/                Next.js 16 (frontend utama): 25 rute, login sesi, Copilot, Explorer
│   ├── worker/             worker pemeliharaan
│   ├── mcp-server/         gateway JSON-RPC + auth + origin policy
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
│   ├── ui/                 komponen reusable (kanonik)
│   ├── design-system/      token warna/ruang/radius (kanonik; disalin ke apps/web)
│   ├── api-client/         bridge JSON-RPC (kanonik)
│   └── office-agent/       Office Agent: rencana rute kantor
├── workbuddy/              agents/, knowledge/, mcp.json, connector-meta.json
├── data/                   state runtime: plans, mandates, approvals, audit.jsonl, … (artefak legacy)
├── docs/                   PRD + audit + verifikasi
├── scripts/                dev-api.sh, dev-web.sh, migrate.sh, test-all.sh,
│                           sync-packages.mjs, verify-packages.mjs
├── pnpm-lock.yaml          lockfile pnpm workspaces
├── pyproject.toml          metadata Python (pytest, ruff) — bukan build backend
├── pnpm-workspace.yaml     deklarasi workspace; package manager nyata adalah pnpm
├── tsconfig.base.json      basis TypeScript untuk semua workspace
└── package.json            skrip typecheck/test/demo (dijalankan lewat pnpm)
```

---

## 3. Target §11 → aktual

| Target | Aktual | Verdict |
|---|---|---|
| `apps/web` (Next.js) | `apps/web` (Next.js 16, 25 rute) | **ADA** — frontend utama, lulus `next build` + Playwright 26/26 |
| `apps/api` (FastAPI) | `apps/api` → `backend/dextra/main.py` | **ADA** — `/api/v1`, 16 router, Pydantic (production) |
| `apps/worker` | `apps/worker` | **ADA** — expire mandate + rekap eksekusi macet |
| `packages/ui` | `packages/ui` (kanonik) | **SESUAI** — satu sumber, diverifikasi `scripts/verify-packages.mjs` |
| `packages/design-system` | `packages/design-system` (token CSS + `tokens.json`) → disalin ke `apps/web` | **SESUAI** — 44 token, satu kontrak, light + dark |
| `packages/api-client` | `packages/api-client` (kanonik) | **SESUAI** — satu bridge JSON-RPC |
| `packages/contracts` | `packages/contracts` | **SESUAI** |
| `backend/dextra/modules/*` | `backend/dextra/modules/` — 16 domain | **SESUAI** — approvals, audit, auth, execution, identity, mandates, office_agent, overview, policies, security_center, service_accounts, skills, tasks, tokens, workforce, workflows |
| `backend/dextra/governance` | `backend/dextra/governance/` + `policy-engine` + `mandate-engine` | **SETARA** — TS dan Python berbagi kontrak, bukan logika yang disalin |
| `backend/dextra/mcp` | `backend/dextra/mcp/` + `apps/mcp-server` | **SETARA** — registry Python dibandingkan ke `authorization.ts` oleh `tests/security/test_authorization_parity.py` |
| `database/migrations` | `database/migrations/` (Alembic, 33 tabel, 9 revisi head `g6a3b4c5d6e7` via `27ba08c94572`) + `database/seeds/seed.py` | **ADA** — PostgreSQL **belum diverifikasi ulang di sesi ini** |
| `tests/` (pytest) | `tests/` pytest **dan** `packages/*/tests`, `apps/mcp-server/tests` (node:test) | **ADA** — dua runner, keduanya dijalankan `scripts/test-all.mjs` |
| `infra/docker` | `infra/docker/` — compose, Dockerfile.api, Dockerfile.web, init SQL | **ADA** — belum pernah di-build; Docker tidak tersedia di mesin ini |
| `pnpm-workspace.yaml` + Turborepo + uv (§11.3) | `pnpm-workspace.yaml` (deklarasi) + pnpm + pip | **BERBEDA** — package manager yang benar-benar dipakai sekarang pnpm; belum ada Turborepo; Python memakai pip, bukan uv |
| `pyproject.toml` | `pyproject.toml` | **ADA** — metadata pytest/ruff, bukan build backend |

Satu hal yang tetap **tidak** dikerjakan: tidak ada folder kosong yang dibuat hanya agar
struktur "terlihat" sesuai spesifikasi. Setiap direktori di atas punya isi yang bisa dijalankan
atau diuji.

---

## 4. Rute apps/web → modul backend

25 rute di `apps/web/app/` masing-masing memanggil backend nyata (`/api/v1` atau MCP gateway), tanpa data contoh:

`/`, `/account`, `/access`, `/admin`, `/agents`, `/analytics`, `/approvals`, `/assistant`, `/audit`, `/board`, `/data-management`, `/executions`, `/explorer`, `/login`, `/mandates`, `/office-agent`, `/office-agent/[planId]`, `/policies`, `/security`, `/skills`, `/skills/[slug]`, `/tokens`, `/work-packages`, `/workflows`, `/workflows/runs`, `/_not-found`.

Verifikasi: `cd apps/web && pnpm run build && pnpm run test:e2e` (Playwright, backend:8001 + MCP:8765).

---

## 5. Satu jalur, bukan dua

Sebelum cutover: jalur v1 (`apps/dashboard` + `apps/mcp-server`) sebagai production dan jalur v2 (`apps/web` + `backend/dextra`) sebagai fondasi non-prod berdampingan. Setelah cutover (6 November 2026): `apps/dashboard` dihapus, `apps/web` adalah satu-satunya frontend. `apps/mcp-server` tetap dipakai oleh `apps/web` (Explorer + audit) — bukan duplikasi, karena MCP gateway tetap satu proses yang dibagikan.

Yang masih **belum** benar, dan tidak disembunyikan:

| Belum | Akibatnya |
|---|---|
| PostgreSQL **belum diverifikasi ulang di sesi ini**; suite SQLite dijalankan di sini | Skema + migrasi Alembic ada (33 tabel, 9 revisi); klaim verifikasi PG lama tidak dipertahankan tanpa bukti sesi ini; PG di CI dilewati bila `DEXTRA_TEST_DATABASE_URL` tidak diset. |
| Docker belum tersedia | `infra/docker/*` belum pernah di-build. Berkasnya ada, tapi belum dieksekusi. |
| Data `data/*.json` belum dimigrasi | `apps/web` menampilkan artefak legacy sebagai informasi (`/data-management`), bukan sebagai sumber data utama. Tidak ada jalur impor dari state v1. |
| LangGraph belum dipakai | Orkestrasi masih dipegang WorkBuddy. |

---

## 6. Cara memverifikasi dokumen ini

```bash
# struktur & paket
ls apps packages
node -e "console.log(require('./package.json').workspaces.join(', '))"

# 19 tool MCP yang diklaim
grep -o "case '[a-z_]*'" apps/mcp-server/src/handlers.ts | sort -u | wc -l

# 25 rute Next.js + typecheck
cd apps/web && pnpm run build && pnpm run typecheck

# regresi per-rute (butuh backend:8001 + MCP:8765)
cd apps/web && pnpm run test:e2e

# salinan package tidak menyimpang dari sumber kanonik (gagal = exit 1)
node scripts/verify-packages.mjs

# tes migrasi (SQLite terverifikasi sesi ini; PostgreSQL-only dilewati bila DEX…)
python -m pytest tests/integration/test_migrations.py -q --tb=short
pnpm run lint   # typecheck + node --check seluruh JS

# keadaan runtime tidak ikut ter-commit (harus mengembalikan sebuah baris ignore)
git check-ignore -v data/audit.checkpoint.json data/*.lock
```

Kalau salah satu perintah di atas hasilnya berbeda dari tabel di dokumen ini, dokumen ini
yang salah dan harus diperbarui — bukan sebaliknya.
