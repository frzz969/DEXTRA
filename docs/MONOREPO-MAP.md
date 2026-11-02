# Monorepo Map — aktual vs target

Dokumen ini memetakan struktur repo **yang benar-benar ada** terhadap target di PRD v2 §28.
Tujuannya mencegah dua kesalahan: mengira fitur sudah ada karena tertulis di target, dan
membuat folder kosong supaya struktur "terlihat" sesuai spesifikasi.

Diperiksa pada: 2 November 2026, worktree `main-dce9c1a5`.

---

## 1. Ringkasan

| Area | Status | Catatan |
|---|---|---|
| TypeScript monorepo (npm workspaces) | ADA | `package.json` → `workspaces: ["packages/*", "apps/*"]` |
| Domain packages (7) | ADA | contracts, store, policy-engine, plan, mandate-engine, executor, replay |
| MCP gateway | ADA | `apps/mcp-server`, JSON-RPC di `127.0.0.1:8765`, 12 tool |
| Dashboard | ADA | `apps/dashboard` (SPA tanpa build step, 23 rute) |
| WorkBuddy config | ADA | `workbuddy/` — manifest, 4 agen, 5 knowledge |
| Channel adapter | SEBAGIAN | `apps/telegram-adapter` — post-MVP, satu file `index.ts` |
| Next.js + Tailwind + shadcn | **BELUM** | Frontend saat ini vanilla JS, tanpa dependency |
| FastAPI + Pydantic | **BELUM** | Backend saat ini Node + TypeScript |
| PostgreSQL + SQLAlchemy + Alembic | **BELUM** | Persistensi saat ini file JSON di `data/` |
| LangGraph | **BELUM** | Orkestrasi dipegang WorkBuddy, bukan LangGraph |

**Kesimpulan:** repo ini adalah monolith TypeScript yang berjalan, bukan kerangka kosong.
Migrasi ke stack target adalah pekerjaan terpisah dan belum dimulai — dan sengaja tidak
di-scaffold sekarang (lihat §5).

---

## 2. Struktur aktual

```text
dextra/
├── apps/
│   ├── dashboard/          SPA: 23 rute, 1 stylesheet, tanpa dependency
│   ├── dashboard-legacy/   14 halaman HTML lama — di-ignore Git, arsip lokal
│   ├── mcp-server/         gateway JSON-RPC + auth + origin policy
│   └── telegram-adapter/   channel adapter (post-MVP)
├── packages/
│   ├── contracts/          skema Plan, Mandate, Approval, Audit, Execution, Risk
│   ├── store/              repository + JSON file store + masking + seed
│   ├── policy-engine/      rules, risk, time window, validator
│   ├── plan/               builder, hash, validate
│   ├── mandate-engine/     validate (siklus + scope)
│   ├── executor/           eksekusi terkontrol
│   └── replay/             rekonstruksi jejak
├── workbuddy/              agents/, knowledge/, mcp.json, connector-meta.json
├── data/                   state runtime: plans, mandates, approvals, audit.jsonl, …
├── docs/                   PRD + audit + verifikasi
├── stitch-ref/             referensi visual
├── scripts/                (belum ada)
└── package.json            npm workspaces, script typecheck/test/demo
```

---

## 3. Target §28 → aktual

| Target | Aktual | Verdict |
|---|---|---|
| `apps/web` (Next.js) | `apps/dashboard` (vanilla SPA) | **BERBEDA** — fungsi setara, teknologi belum |
| `apps/api` (FastAPI) | `apps/mcp-server` (Node, JSON-RPC) | **BERBEDA** — API ada, bukan REST/FastAPI |
| `apps/worker` | — | **BELUM ADA** — belum dibutuhkan; eksekusi sinkron |
| `packages/ui` | `apps/dashboard/assets/js/ui.js` | **SETARA** — komponen reusable, satu tempat |
| `packages/design-system` | `apps/dashboard/assets/css/dashboard.css` | **SETARA** — satu kontrak token, light + dark |
| `packages/api-client` | `apps/dashboard/assets/js/core.js` → `D.api` | **SETARA** — satu bridge JSON-RPC |
| `packages/contracts` | `packages/contracts` | **SESUAI** |
| `backend/dextra/modules/*` | `packages/*` (7 domain) | **SETARA** — domain terpisah, bahasa beda |
| `backend/dextra/governance` | `policy-engine` + `mandate-engine` | **SETARA** |
| `backend/dextra/mcp` | `apps/mcp-server` | **SETARA** |
| `database/migrations` | `data/*.json` + `store/json-file.ts` | **BELUM** — belum ada migrasi DB |
| `tests/` (pytest) | `packages/*/tests`, `apps/mcp-server/tests` (node:test) | **SETARA** — runner beda |
| `infra/docker` | — | **BELUM ADA** |
| `pnpm-workspace.yaml` | `package.json` workspaces (npm) | **SETARA** — package manager beda |
| `pyproject.toml` | — | **BELUM ADA** |

Tidak ada satu pun baris di atas yang saya buat sebagai folder kosong. Folder target yang
belum punya isi nyata **tidak dibuat**, karena folder kosong menyiratkan kemampuan yang
tidak ada.

---

## 4. Rute dashboard → modul repo

Sumber kebenaran ada di kode, bukan di dokumen ini:
`apps/dashboard/assets/js/sources.js`. Setiap rute mendeklarasikan domain, status, tool MCP
yang dipakai, dan modul yang menopangnya. Dokumen ini hanya ringkasannya.

| Status | Arti | Jumlah |
|---|---|---|
| `live` | Bisa menampilkan data server nyata saat MCP hidup | 5 |
| `partial` | Sebagian nyata, sisanya demo (tidak ada endpoint list/agregat) | 10 |
| `demo` | Belum ada permukaan backend; data contoh | 5 |
| `none` | Bukan rute data (login, forbidden, not-found) | 3 |

Tool MCP yang dipakai dashboard (12): `create_plan`, `execute_action`, `find_precedent`,
`get_audit_log`, `get_mandate`, `get_org_rules`, `get_plan`, `get_status`, `issue_mandate`,
`revoke_mandate`, `submit_approval`, `validate_plan`.

Kesenjangan yang terlihat dari pemetaan itu, dan tidak disembunyikan:

- **Tidak ada tool daftar.** `get_plan`/`get_mandate` hanya per id, jadi daftar disusun dari
  audit. Ini sumber utama status `partial`.
- **Workforce & Specialist Directory** tidak punya API; isinya dari `workbuddy/agents/*.md`.
- **Board** mengelompokkan kolom di klien; server tidak menyimpan status papan.
- **Users/Permissions** belum punya tool identitas sama sekali.

Halaman **Administration → Integrations** menampilkan tabel ini secara langsung, sehingga
klaim "terhubung" bisa diperiksa di UI, bukan hanya di README.

---

## 5. Mengapa stack target belum di-scaffold

PRD §28: *"Sesuaikan struktur berdasarkan audit. Jangan membuat duplicate package atau folder
hanya untuk meniru contoh ini."* dan §33.10: *"Jangan menghapus package lama sebelum parity
test."*

Menambahkan `apps/web` (Next.js), `apps/api` (FastAPI), dan `database/` sekarang akan
menghasilkan dua implementasi paralel untuk domain yang sama, tanpa parity test, tanpa
PostgreSQL berjalan, dan tanpa jalur cutover. Itu persis yang dilarang spesifikasi.

Urutan yang benar, bila migrasi stack memang dilanjutkan:

1. Audit + inventory + baseline test (sebagian sudah: lihat `docs/VERIFICATION-REPORT.md`).
2. Parity test untuk `policy-engine`, `mandate-engine`, `executor` — perilaku harus identik
   sebelum ada implementasi kedua.
3. PostgreSQL + Alembic, dengan migrasi data dari `data/*.json`.
4. FastAPI sebagai adapter di atas domain yang sudah punya parity.
5. Baru frontend baru, memakai kontrak API yang sama.

Sampai langkah 2 lulus, menambah stack baru hanya menambah risiko, bukan kemampuan.

---

## 6. Cara memverifikasi dokumen ini

```bash
# struktur & paket
ls apps packages
node -e "console.log(Object.keys(require('./package.json').workspaces))"

# 12 tool MCP yang diklaim
grep -o "case '[a-z_]*'" apps/mcp-server/src/handlers.ts

# rute dan statusnya
grep -c "route: '" apps/dashboard/assets/js/sources.js

# legacy benar-benar diabaikan Git
git check-ignore -v apps/dashboard-legacy/README.md
```

Kalau salah satu perintah di atas hasilnya berbeda dari tabel di dokumen ini, dokumen ini
yang salah dan harus diperbarui — bukan sebaliknya.
