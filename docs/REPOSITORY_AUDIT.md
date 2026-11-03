# REPOSITORY AUDIT — kondisi aktual setelah fondasi v2

Diperiksa: 3 November 2026, branch `main`, dari berkas yang benar-benar ada —
bukan dari laporan sebelumnya.

## 1. Struktur target §28 vs kenyataan

| Path target | Status | Isi nyata |
|---|---|---|
| `apps/web` | **ADA** | Next.js 16 + React 19, 2 halaman (Overview, Workforce), build lulus |
| `apps/api` | **ADA** | Entrypoint ASGI tipis → `backend/dextra/main.py` |
| `apps/worker` | **ADA** | Worker pemeliharaan: expire mandate, rekap eksekusi macet |
| `backend/dextra/` | **ADA** | core, database, models, repositories, governance, mcp, modules (9 domain), main.py |
| `database/` | **ADA** | `migrations/` (Alembic, 1 revisi) + `seeds/seed.py` |
| `tests/` | **ADA** | pytest: unit, integration, security (38 tes) |
| `infra/` | **ADA** | `docker/` compose + 2 Dockerfile + init SQL |
| `scripts/` | **ADA** | sync/verify paket, dev-api, dev-web, migrate, test-all |
| `packages/ui` | **ADA** | Sumber kanonik `ui.js` |
| `packages/design-system` | **ADA** | `tokens.json` + `dashboard.css` |
| `packages/api-client` | **ADA** | Klien JSON-RPC, 8 tes |
| `docker-compose.yml` | **ADA** | Root memakai `include:` ke `infra/docker/docker-compose.yml` — satu definisi, tidak disalin |
| `pnpm-workspace.yaml` | **ADA** | Deklaratif; npm tetap package manager yang berlaku |
| `pyproject.toml` | **ADA** | Metadata, dependency, konfigurasi pytest |

Tidak ada folder kosong yang dibuat sekadar untuk memenuhi daftar. Setiap path
di atas berisi kode yang dijalankan atau diuji.

## 2. Yang tidak bisa diverifikasi di mesin ini

| Hal | Sebab | Akibat |
|---|---|---|
| PostgreSQL | Tidak terpasang; Docker tidak tersedia | Migrasi & tes dijalankan di SQLite. Perilaku khas PostgreSQL (JSONB, constraint deferrable, locking) **belum terbukti**. |
| `docker compose up` | Docker tidak tersedia | `docker-compose.yml` dan Dockerfile belum pernah dijalankan. |
| LangGraph | Belum diimplementasikan | Orkestrasi masih WorkBuddy. |
| Tailwind + shadcn | Belum dipakai | `apps/web` memakai token CSS dari `packages/design-system`, bukan utility Tailwind. |

Klaim "PostgreSQL berjalan" tidak boleh dibuat sampai salah satu dari ini benar.

## 3. Keputusan teknis yang menyimpang dari target, dan alasannya

**`apps/web` tidak menjadi anggota npm workspace.**
`npm install` gagal dengan `EISDIR: illegal operation on a directory, symlink
apps/web -> node_modules/@dextra/web` di Windows. Solusinya: `apps/web` punya
`node_modules` sendiri. Konsekuensi: `npm install` di root tidak memasang
dependensi web; harus `cd apps/web && npm install`. Ini dicatat, bukan
disembunyikan.

**React sempat terpasang ganda** (root dan `apps/web`), menyebabkan
`Cannot read properties of null (reading 'useContext')` saat prerender. Root
`node_modules/{next,react,react-dom}` dihapus. Build sekarang lulus.

**`cache: "no-store"` pada fetch API.**
Versi pertama memakai `revalidate: 30`. Saat API dimatikan, halaman tetap
menampilkan angka lama sampai 30 detik — dashboard operasional yang menampilkan
data basi tanpa tanda lebih berbahaya daripada yang jujur bilang "tidak
tersedia". Sudah diverifikasi: API mati → halaman langsung menampilkan "Data
tidak tersedia".

**`verify-packages.mjs` sempat menyalin lebih dulu.**
Skrip verifikasi mengimpor `COPIES` dari `sync-packages.mjs`, dan modul itu
menjalankan `main()` saat diimpor — sehingga verifikasi selalu lulus karena
salinan baru saja dibuat. Ditambahkan penjaga `invokedDirectly`. Sudah diuji
dengan sengaja merusak salinan: verifikasi sekarang gagal (`exit 1`).

## 4. Bug yang ditemukan oleh tes, bukan oleh pembacaan kode

| Bug | Dampak | Perbaikan |
|---|---|---|
| `unwrap()` mengembalikan `undefined` saat respons tanpa konten | Pemanggil kena TypeError menyesatkan | Kembalikan `{}` |
| Kunci idempotensi tanpa hash parameter | Perubahan parameter mengembalikan hasil lama seolah sukses | Kunci menyertakan `params_hash` |
| Idempotensi diperiksa setelah validasi mandate | Permintaan ulang ditolak "expired" alih-alih mengembalikan hasil | Idempotensi diperiksa lebih dulu |
| Urutan validasi mandate | Perubahan parameter dilaporkan `MANDATE_EXPIRED`, bukan `PARAMS_CHANGED` | Aksi & parameter diperiksa sebelum status |
| Hash audit tidak cocok saat verifikasi | Rantai tampak rusak padahal utuh (SQLite kehilangan timezone) | `_canonical_at()` menormalkan waktu |
| ID approval/eksekusi hanya berbasis waktu | Tabrakan primary key saat dua keputusan di detik sama | Suffix acak |
| `require_capability` memakai `get_caller` sebagai nilai default | `AttributeError` → 500, bukan 403 | `Depends(get_caller)` |

## 5. Yang masih terbuka

1. PostgreSQL belum dijalankan; belum ada bukti perilaku nyata di target DB.
2. Dashboard lama masih menjadi UI produksi; `apps/web` baru 2 halaman.
3. Belum ada SSE, belum ada LangGraph, belum ada Playwright.
4. Data `data/*.json` belum dimigrasikan ke PostgreSQL.
5. Belum ada parity test perilaku `policy-engine` TS vs Python (baru parity
   daftar capability).
