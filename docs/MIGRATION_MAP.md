# MIGRATION MAP — DEXTRA v1 (berjalan) → DEXTRA v2 (target)

Dokumen ini memetakan komponen yang **ada hari ini** ke target, dengan cara
migrasi, risiko, dan cara memverifikasinya. Tidak ada baris yang ditulis tanpa
memeriksa berkasnya lebih dulu.

Status per 3 November 2026. Commit acuan: `2f3daf2` + pekerjaan v2 di atasnya.

## 0. Ringkasan status

| Domain | v1 (berjalan) | v2 (target) | Status migrasi |
|---|---|---|---|
| Frontend | `apps/dashboard` (vanilla SPA, 23 rute) | `apps/web` (Next.js) | **Fondasi ada**, 2 halaman. Dashboard lama tetap produksi. |
| Backend API | `apps/mcp-server` (JSON-RPC) | `apps/api` (FastAPI REST) | **Fondasi ada**, 9 router. Gateway lama tetap produksi. |
| Persistensi | `data/*.json` + `packages/store` | PostgreSQL + SQLAlchemy | **Skema + migrasi ada**, data belum dipindahkan. |
| Governance | `packages/policy-engine`, `mandate-engine` | `backend/dextra/governance` | **Setara fungsional**, parity test sebagian. |
| Executor | `packages/executor` | `backend/dextra/modules/execution` | **Setara**, adapter masih mock di kedua sisi. |
| Audit | `packages/store` → `audit.jsonl` | tabel `audit_events` + hash chain | **Berbeda model**: file vs tabel. v2 punya hash chain. |
| Orchestration | WorkBuddy (markdown) | LangGraph | **Belum dimulai.** |
| Worker | — | `apps/worker` | **Ada**, pemeliharaan (expiry + stuck). Bukan antrean. |

## 1. Frontend

| Aspek | Isi |
|---|---|
| Implementasi existing | `apps/dashboard/index.html` + `assets/js/{core,sources,data,ui,shell,app}.js` + 10 view |
| Path | `apps/dashboard/` |
| Perilaku sekarang | 23 rute, 10 live / 6 partial / 4 demo / 3 none. Tanpa build step. |
| Perilaku target | `apps/web` Next.js + Tailwind + shadcn, data dari `/api/v1` |
| Strategi | Halaman per halaman, mulai dari Overview dan Workforce. Dashboard lama **tidak dihapus** sampai parity tercapai (§33.10). |
| Dependensi | `packages/design-system` (token), `packages/ui` (komponen), `packages/api-client` |
| Risiko | Dua UI paralel membingungkan penguji. Mitigasi: README menyatakan mana yang produksi. |
| Verifikasi | `next build` lulus; halaman menampilkan data API nyata; tanpa API menampilkan "tidak tersedia", bukan data contoh. |

Yang sudah dikerjakan: `packages/ui`, `packages/design-system`, `packages/api-client`
sekarang memegang sumber kanonik, dan dashboard memakainya lewat salinan yang
diverifikasi (`scripts/verify-packages.mjs`).

## 2. Backend API

| Aspek | Isi |
|---|---|
| Implementasi existing | `apps/mcp-server/src/{server,auth,handlers}.ts`, JSON-RPC di `127.0.0.1:8765` |
| Perilaku sekarang | 16 tool, otorisasi berbasis scope token, allowlist diturunkan dari kontrak |
| Perilaku target | FastAPI `/api/v1`, REST + SSE, Pydantic, dependency injection |
| Strategi | Endpoint REST ditulis per domain; gateway lama tetap melayani dashboard sampai `apps/web` lengkap |
| Dependensi | `packages/contracts/src/authorization.ts` (sumber kebenaran capability) |
| Risiko | **Duplikasi aturan otorisasi di dua bahasa.** Mitigasi: `tests/security/test_authorization_parity.py` membandingkan keduanya dan gagal bila menyimpang. |
| Verifikasi | 38 tes pytest; paritas tool→capability identik dengan TS |

Endpoint v2 yang sudah ada: `/overview`, `/agents`, `/work-packages`, `/tasks`,
`/executions`, `/approvals`, `/mandates`, `/policies`, `/audit-events`,
`/permissions`, `/users` (terkunci), `/health`, `/meta`.

## 3. Persistensi

| Aspek | Isi |
|---|---|
| Implementasi existing | `packages/store/src/json-file.ts`, `data/{plans,mandates,approvals,executions}.json`, `data/audit.jsonl` |
| Perilaku sekarang | Baca/tulis seluruh berkas; tidak ada transaksi; tidak ada constraint |
| Perilaku target | PostgreSQL, SQLAlchemy 2.x, Alembic, constraint di level database |
| Strategi | Skema ditulis dari domain, bukan dari bentuk JSON. Migrasi data dibuat **setelah** parity test. |
| Dependensi | `database/migrations`, `database/seeds` |
| Risiko | Bentuk data lama tidak punya kolom yang diwajibkan skema baru (`params_hash`, `nonce`, `idempotency_key`). Sebagian data lama **tidak akan bisa** dimigrasikan tanpa mengarang nilai. |
| Verifikasi | `alembic upgrade head` membuat 21 tabel; seed idempoten |

Data lama yang tidak bisa dimigrasikan tanpa mengarang: mandat lama tidak punya
`params_hash` maupun `nonce`, jadi tidak bisa dijadikan mandate v2 yang sah.
Rencana: mandat lama diarsipkan sebagai `legacy_mandate` (read-only), bukan
dipalsukan agar tampak sah.

## 4. Governance

| Aspek | Isi |
|---|---|
| Implementasi existing | `packages/policy-engine/src/rules.ts`, `packages/mandate-engine/src/validate.ts` |
| Perilaku sekarang | Reason code: `RECIPIENT_NOT_ALLOWED`, `AMBIGUOUS_RECIPIENT`, `OUTSIDE_OFFICE_HOURS`, `HOLIDAY_CONFLICT`, `FRIDAY_PRAYER_CONFLICT`, `BULK_EGRESS_SUSPECTED`, `INJECTION_QUARANTINED` |
| Perilaku target | `backend/dextra/governance/policy.py` (murni) + `mandate.py` (siklus) |
| Strategi | Port fungsi murni, pertahankan reason code identik, lalu uji determinisme |
| Dependensi | Tidak ada (fungsi murni, tanpa I/O) |
| Risiko | Perbedaan urutan evaluasi mengubah keputusan. Mitigasi: tes "deny mengalahkan review" dan tes determinisme. |
| Verifikasi | 8 tes unit policy; 6 tes siklus mandate (termasuk PARAMS_CHANGED dan REVOKED) |

## 5. Audit

| Aspek | Isi |
|---|---|
| Implementasi existing | `data/audit.jsonl`, ditulis `packages/store` |
| Perilaku sekarang | Append ke berkas, tanpa integritas |
| Perilaku target | Tabel `audit_events`, `seq` unik, `prev_hash`/`entry_hash`, izin DB append-only |
| Strategi | Tulis baru di v2; data lama diimpor sebagai rentetan awal dengan `prev_hash` kosong dan ditandai `imported: true` |
| Risiko | Mengimpor JSONL lama berarti hash-nya tidak bisa diverifikasi terhadap kejadian aslinya. Harus dinyatakan sebagai batas kepercayaan. |
| Verifikasi | `GET /api/v1/audit-events/verify` mengembalikan `{"ok": true, "checked": n}`; tes menyunting baris dan memastikan verifikasi gagal |

## 6. Executor

| Aspek | Isi |
|---|---|
| Implementasi existing | `packages/executor/src/*.ts` |
| Perilaku sekarang | Eksekusi dengan idempotensi; adapter mock |
| Perilaku target | `modules/execution/service.py` |
| Strategi | Port urutan: validasi mandate → cek idempotensi → jalankan → audit |
| Risiko | Urutan yang salah membuka celah. Sudah terjadi saat pengembangan: idempotensi diperiksa setelah validasi, sehingga permintaan ulang ditolak "expired" alih-alih mengembalikan hasil; dan kunci tanpa hash parameter membuat perubahan parameter lolos. Keduanya ditemukan oleh tes, bukan oleh pembacaan kode. |
| Verifikasi | 10 tes integrasi alur tata kelola |

## 7. Orchestration (WorkBuddy → LangGraph)

| Aspek | Isi |
|---|---|
| Implementasi existing | `workbuddy/agents/*.md` (4 spesialis), `workbuddy/mcp.json`, `workbuddy/skills/` |
| Perilaku sekarang | WorkBuddy Desktop sebagai klien orkestrasi; definisi agen berupa prosa |
| Perilaku target | LangGraph dengan checkpoint PostgreSQL |
| Strategi | **Belum dimulai.** Registri agen v2 diisi dari seed (4 spesialis), bukan hasil parsing Markdown — mem-parse prosa berarti mengarang field. |
| Risiko | Tinggi: LangGraph butuh state machine nyata, bukan sekadar definisi peran. |
| Verifikasi | Belum ada. |

## 8. Urutan yang disarankan

1. Selesaikan `apps/web` untuk Overview + Workforce + Approvals (data nyata).
2. Pindahkan approval/mandate/execution dashboard ke `/api/v1` lewat adapter.
3. Parity test `policy-engine` TS vs Python (reason code + keputusan).
4. PostgreSQL berjalan + migrasi data yang bisa dimigrasikan; arsipkan sisanya.
5. Baru pertimbangkan LangGraph.

Setiap langkah harus lulus tes sebelum langkah berikutnya dimulai. Tidak ada
penghapusan komponen lama sebelum parity lulus.
