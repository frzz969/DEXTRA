# Monorepo Map — aktual vs target

Dokumen ini memetakan struktur repo **yang benar-benar ada** terhadap target di PRD v2 §28.
Tujuannya mencegah dua kesalahan: mengira fitur sudah ada karena tertulis di target, dan
membuat folder kosong supaya struktur "terlihat" sesuai spesifikasi.

Diperiksa pada: 3 November 2026, commit `fe4f8ef` (branch `main`). Angka di dokumen ini
dihitung dari kode, bukan disalin dari dokumen lain.

---

## 1. Ringkasan

| Area | Status | Catatan |
|---|---|---|
| TypeScript monorepo (npm workspaces) | ADA | `package.json` → `["packages/*", "apps/mcp-server", "apps/telegram-adapter"]`. `apps/web` sengaja di luar workspace: symlink gagal di Windows. |
| Domain packages (10) | ADA | contracts, store, policy-engine, plan, mandate-engine, executor, replay, ui, design-system, api-client |
| MCP gateway | ADA | `apps/mcp-server`, JSON-RPC di `127.0.0.1:8765`, 16 tool |
| Dashboard | ADA | `apps/dashboard` (SPA tanpa build step, 23 rute) |
| WorkBuddy config | ADA | `workbuddy/` — manifest, 4 agen, 5 knowledge |
| Channel adapter | SEBAGIAN | `apps/telegram-adapter` — post-MVP, satu file `index.ts` |
| Next.js + Tailwind + shadcn | **SEBAGIAN** | `apps/web` Next.js 16 berjalan (2 halaman). Tailwind/shadcn belum dipakai; styling memakai token `packages/design-system`. |
| FastAPI + Pydantic | **ADA** | `backend/dextra` + `apps/api`, 9 router di `/api/v1`, Pydantic untuk validasi |
| PostgreSQL + SQLAlchemy + Alembic | **SEBAGIAN** | Skema + migrasi Alembic ada (21 tabel); PostgreSQL belum dijalankan di mesin ini, tes memakai SQLite |
| LangGraph | **BELUM** | Orkestrasi dipegang WorkBuddy, bukan LangGraph |
| Worker | **ADA** | `apps/worker` — expire mandate + rekap eksekusi macet |
| Tests Python | **ADA** | `tests/` pytest, 38 tes (unit, integration, security) |

**Kesimpulan:** repo ini adalah monolith TypeScript yang berjalan, bukan kerangka kosong.
Migrasi ke stack target adalah pekerjaan terpisah dan belum dimulai — dan sengaja tidak
di-scaffold sekarang (lihat §5).

---

## 2. Struktur aktual

```text
dextra/
├── apps/
│   ├── dashboard/          SPA v1: 23 rute, tanpa dependency (masih produksi)
│   ├── web/                Next.js 16 (v2): Overview + Workforce
│   ├── api/                entrypoint ASGI -> backend/dextra/main.py
│   ├── worker/             worker pemeliharaan
│   ├── mcp-server/         gateway JSON-RPC + auth + origin policy (v1)
│   └── telegram-adapter/   channel adapter (post-MVP)
├── backend/dextra/         FastAPI: core, database, models, repositories,
│                           governance, mcp, modules (9 domain), main.py
├── database/               migrations (Alembic) + seeds
├── tests/                  pytest: unit, integration, security
├── infra/docker/           compose + Dockerfile + init SQL audit
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
├── package-lock.json       lockfile npm workspaces
├── tsconfig.base.json      basis TypeScript untuk semua workspace
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
| `live` | Bisa menampilkan data server nyata saat MCP hidup | 10 |
| `partial` | Sebagian nyata, sisanya demo (tidak ada endpoint list/agregat) | 6 |
| `demo` | Belum ada permukaan backend; data contoh | 4 |
| `none` | Bukan rute data (login, forbidden, not-found) | 3 |

Tool MCP yang dipakai dashboard (15): `create_plan`, `execute_action`, `find_precedent`,
`get_audit_log`, `get_caller_context`, `get_mandate`, `get_org_rules`, `get_plan`,
`get_status`, `list_executions`, `list_mandates`, `list_plans`, `revoke_mandate`,
`submit_approval`, `validate_plan`.

Dari 16 tool yang ada, **15 dipakai** oleh rute dashboard. Satu sisanya hanya dipanggil server:
`issue_mandate` diterbitkan setelah approval, bukan oleh tombol. Ini tercatat sebagai
kesenjangan, bukan disembunyikan.

`get_caller_context` dipakai tiga rute yang sebelumnya tidak punya sumber data:
`/permissions`, `/integrations`, dan `/login`. Efeknya `/permissions` pindah dari `live` ke
`demo` — karena yang bisa ditampilkan hanyalah kapabilitas scope token, sedangkan matriks
peran per pengguna tetap model demo.

Eksekusi kini dipicu dari drawer mandat (`execute_action`), dan AI Assistant memakai
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
node -e "console.log(require('./package.json').workspaces.join(', '))"

# 16 tool MCP yang diklaim
grep -o "case '[a-z_]*'" apps/mcp-server/src/handlers.ts | sort -u | wc -l

# rute dan sebaran statusnya (23 rute)
grep -c "route: '" apps/dashboard/assets/js/sources.js
grep -o "state: '[a-z]*'" apps/dashboard/assets/js/sources.js | sort | uniq -c

# legacy benar-benar diabaikan Git (harus mengembalikan sebuah baris ignore, bukan kosong)
git check-ignore -v apps/dashboard-legacy/README.md
```

Kalau salah satu perintah di atas hasilnya berbeda dari tabel di dokumen ini, dokumen ini
yang salah dan harus diperbarui — bukan sebaliknya.
