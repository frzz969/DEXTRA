# TUGAS — Pembagian kerja WorkBuddy × opencode

Baseline: `main` = `e22ce5f`, working tree bersih, `npm run test:all` lulus.
Dua agen bekerja di repo yang sama, jadi yang pertama harus disepakati adalah
**siapa memegang berkas mana** — bukan siapa mengerjakan apa.

## Aturan koordinasi (wajib, jangan dilanggar)

1. **Satu berkas, satu pemilik.** Daftar kepemilikan di bawah. Kalau perubahan
   perlu di berkas milik pihak lain, tulis di pesan commit — jangan diedit.
2. **Awalan commit** menyebut stream: `[A1]`, `[B2]`, dst.
3. **Sebelum push:** `npm run test:all` harus lulus, lalu
   `git pull --rebase origin main`. Kalau rebase memunculkan konflik di berkas
   yang bukan milikmu, **berhenti** dan lapor — jangan diselesaikan sendiri.
4. **Satu yang push pada satu waktu.** Kalau push ditolak, rebase ulang; jangan
   `push --force`.
5. Kalau sebuah tugas ternyata menyentuh berkas milik pihak lain, tugas itu
   **dipecah**, bukan dikerjakan diam-diam.

### Kepemilikan berkas

| WorkBuddy | opencode |
|---|---|
| `apps/dashboard/**` (termasuk `tests/`, `README.md`) | `docs/**` |
| `apps/mcp-server/src/{handlers,server,index}.ts` | `README.md` (root) |
| `packages/contracts/src/plan.ts` | `packages/contracts/src/{authorization,identity}.ts` |
| `packages/plan/**` | `backend/**`, `database/**` |
| `packages/store/**` | `apps/web/**`, `apps/api/**`, `apps/worker/**` |
| `scripts/**`, `package.json` | `workbuddy/**` |
| `data/**` (artefak, tidak di-commit) | — |

---

# Bagian opencode

## B1 — Nyatakan mana produk, mana referensi

Ini pertanyaan yang akan menghabisi kita di depan juri: repo punya dua
implementasi domain yang sama.

- TypeScript: `packages/{policy-engine,mandate-engine,executor,store}` — inilah
  yang benar-benar melayani dashboard lewat `apps/mcp-server`.
- Python: `backend/dextra/**` — 38 tes lulus, **tidak dipakai produk**.
- Dua frontend: `apps/dashboard` (21 rute) vs `apps/web` (2 rute).

Berkas: `docs/MONOREPO-MAP.md`, `README.md` (root).

Selesai bila: satu halaman menjawab "mana yang jalan" tanpa perlu membaca kode,
dan memuat tabel **apa yang belum terbukti** (Postgres, Docker, migrasi data,
2/23 rute `apps/web`, LangGraph tidak dipakai). Jangan menyebut Python sebagai
"backend produksi" bila dashboard tidak memanggilnya.

## B2 — `/integrations`: putuskan `manage_integrations`

Halaman ini dijaga kapabilitas `manage_integrations` yang **tidak diberikan
scope mana pun** (`UNBACKED_CAPABILITIES`), sehingga selalu tampil
"Belum tersedia". Dua jalan, pilih satu dan tulis alasannya:

- tambah scope/role admin yang memegangnya, atau
- nyatakan di luar cakupan MVP dan hapus klaim "segera hadir".

Berkas: `packages/contracts/src/authorization.ts`,
`backend/dextra/mcp/registry.py`, `workbuddy/mcp.json`,
`docs/IDENTITY_AUTHORIZATION_MODEL.md`.

Selesai bila: tes paritas (`tests/security/test_authorization_parity.py`) dan
tes manifest `workbuddy/mcp.json` hijau. **Handler `manage_integrations` di
`apps/mcp-server/src/handlers.ts` bukan milikmu** — itu A5, dikerjakan WorkBuddy
setelah B2 mendarat.

## B3 — A-03: umur dan pencabutan token

Keadaan sekarang: satu token = satu orang, **tanpa masa berlaku, tanpa
pencabutan**. Siapa pun yang memegang `ops-dev-token` adalah Nadia Rahman.
Untuk lomba ini boleh diakui terbuka, tapi harus tertulis.

Berkas: `docs/AUTHORIZATION_AUDIT.md`, `docs/IDENTITY_AUTHORIZATION_MODEL.md`.

Selesai bila: dokumen menyatakan dengan tegas (a) apa yang ada, (b) apa yang
tidak ada, (c) apa rencananya, dan tidak ada kalimat yang mengklaim pencabutan
sudah tersedia. Jangan implementasi rotasi token di putaran ini — tulis
desainnya saja.

## B4 — Postgres/Docker: nyatakan status sebenarnya

`psql` dan `docker` tidak terpasang di mesin ini, jadi migrasi alembic **belum
pernah dijalankan di atas DB nyata**. Jangan biarkan dokumen menyiratkan
sebaliknya.

Berkas: `docs/MIGRATION_MAP.md`, `docs/DATABASE_SCHEMA.md`.

Selesai bila: dokumen menyebut bahwa skema dan migrasi ada tapi belum
diverifikasi terhadap Postgres hidup, dan menyebut apa yang dibutuhkan untuk
memverifikasinya. Kalau memilih menunda, tulis "ditunda" — bukan "selesai".

---

# Bagian WorkBuddy

## A1 — `/board`: kolom dan urutan kartu bertahan

Sekarang `liveMove` hanya di memori (`views/board.js:17`); begitu halaman
dimuat ulang, kartu kembali ke kolom menurut status. Pindahkan fakta itu ke
server, atau nyatakan terang-terangan bahwa papan tidak menyimpan urutan.

Berkas: `packages/contracts/src/plan.ts` (field baru, mis. `board_rank`),
`packages/store/**`, `apps/mcp-server/src/{handlers,server}.ts`,
`apps/dashboard/assets/js/views/board.js`, tes terkait.

Selesai bila: memindahkan kartu bertahan setelah reload; ada tes yang gagal
bila persistensi dilepas; plan lama tanpa field tetap valid.

## A2 — `/assistant`: putuskan, jangan menggantung

Catatan rute sendiri mengakui "penyusunan rencana masih aturan lokal, bukan
model". Pilih satu:

- sambungkan ke perencana server-side, atau
- nyatakan batasnya: asisten **menyusun draf** yang harus disetujui manusia,
  dan ia tidak memutuskan.

Berkas: `apps/dashboard/assets/js/views/assistant.js`, `copilot.js`,
`sources.js`.

Selesai bila: tidak ada kalimat di layar yang mengklaim kemampuan yang tidak
dimiliki, dan tidak ada jawaban yang mengarang data.

## A3 — E2E browser masuk repo

Verifikasi 17 rute selama ini dijalankan dengan skrip ad-hoc di folder Temp dan
**tidak pernah masuk repo** — jadi tidak ada yang mengulanginya.

Berkas: `apps/dashboard/tests/e2e/**`, `package.json`, `scripts/test-all.mjs`.

Selesai bila: `npm run test:e2e` menjalankan Chrome headless, memeriksa setiap
rute live di mode live, gagal bila ada galat konsol atau `#view-root` kosong.
Tes ini harus **gagal** pada `beba8ec` (dashboard kosong) — buktikan, jangan
diasumsikan.

## A4 — Inventaris rute jujur

`/requests` dan `/my-work` kini berfungsi penuh saat principal terikat, tapi
`state` masih `partial`. Pilih: biarkan `partial` (jujur soal degradasi tanpa
principal) atau naikkan ke `live` dengan catatan. Jangan biarkan label
bertentangan dengan perilaku.

Berkas: `apps/dashboard/assets/js/sources.js`, `apps/dashboard/README.md`.

Selesai bila: label, catatan, dan perilaku menyatakan hal yang sama.

## A5 — Handler `manage_integrations` (setelah B2)

Hanya dikerjakan bila B2 memilih menambah scope admin. Satu `case` di
`handlers.ts` + entri `server.ts` + hitungan tes auth, mengikuti pola
`list_specialists`.

---

# Urutan

| Putaran | WorkBuddy | opencode | Titik temu |
|---|---|---|---|
| 1 | A1 | B1 | tidak ada — berkas terpisah |
| 2 | A3 | B2 | A5 menunggu B2 |
| 3 | A2, A4 | B3, B4 | — |
| 4 | A5 | — | setelah B2 hijau |

Putaran 1 dan 2 sengaja tidak berbagi berkas sama sekali, supaya dua agen bisa
bekerja bersamaan tanpa rebase yang menyakitkan.

# Yang sengaja tidak dikerjakan putaran ini

- Memindahkan produk ke Python/Postgres (keputusan B1 dulu).
- Menambah rute ke `apps/web` sampai B1 menyatakan statusnya.
- LangGraph / LLM di copilot (A2 memilih "nyatakan batas" bila tidak ada waktu).
- Rotasi/pencabutan token (B3 hanya desain).
- Menghapus `apps/dashboard-legacy/` — tunggu keputusan B1.
