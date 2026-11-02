# TUGAS — Pino Suk Suk (UI/UX)

Halo Pino! Kamu pegang **seluruh UI/UX** DEXTRA. Backend, data, dan integrasi sudah ditangani tim lain. Fokusmu: tampilan, konsistensi visual, dan pengalaman pengguna.

## Referensi utama
- Stitch export terbaru: `stitch-ref/` (11 layar + `governed_intelligence/DESIGN.md`).
- Design tokens: `apps/dashboard/shared/dextra-ui.css`.
- Diff report: `docs/` (lihat audit Stitch vs implementasi).

## Yang sudah selesai (jangan diubah tanpa alasan)
- Sidebar Stitch (Menu Utama / AI Workforce / Tata Kelola + profil) di semua halaman.
- Design-token CSS di-link di semua halaman.
- Halaman yang sudah di-rewrite (lega, badge soft, jam live): overview, buat-permintaan, kotak-persetujuan, work-package, audit, kebijakan, pengaturan, masuk, direktori-workforce.
- Backend test hijau (42 pass).

## Tanggung jawabmu

### P0 — Visual polish & konsistensi
- Samakan spacing, warna, tipografi di semua halaman (gunakan token di `dextra-ui.css`: `d-card`, `d-badge--*`, `d-btn--*`, `d-page-header`, `d-empty`).
- Pastikan tidak ada elemen yang saling berhimpitan (whitespace cukup).
- Hapus badge berlebihan; gunakan warna sebagai penanda makna, bukan hiasan.
- Tipografi konsisten: heading Plus Jakarta Sans, body Inter.

### P1 — Layout per halaman
- **Overview**: pertahankan header, welcome banner, 4 KPI, 2 panel analitik, bagian bawah (WP terkini, audit, antrean, jadwal, tata kelola). Kartu/grafik yang masih ilustratif diberi banner jujur (sudah ada, jangan dihapus).
- **Kotak Persetujuan**: hierarki info: judul WP → status & ID → pemohon/spesialis/waktu → ringkasan masalah → rekomendasi → tindakan. Kasus ambiguitas penerima & instruksi berbahaya harus jelas tapi tidak memenuhi layar dengan merah.
- **Buat Permintaan**: textarea → template → submit. Jangan buat tombol palsu.
- **Work Package Detail**: timeline + audit list + bukti eksekusi.
- **Audit**: tabel log append-only.
- **Direktori Workforce**: kartu spesialis (EA, AO, Adversarial Reviewer, Policy Validator engine).

### P2 — Responsive
- Desktop 1440/1280/1024 prioritas. Tablet 768. Mobile 390/375.
- Sidebar collapse di mobile, tidak ada horizontal overflow, grafik tidak terpotong.

### P3 — Interaksi
- Semua tombol berfungsi (search, filter, tabs, modal, navigasi, approval).
- Tidak ada link `#` kosong, tidak ada form yang tidak mengirim data.
- Empty state & loading state jujur.

### P4 — Verifikasi
- Screenshot per halaman di 1920×1080, 1440×900, 1280×800, 390×844.
- Bandingkan dengan Stitch (`stitch-ref/`).
- Laporan: halaman yang diperbaiki, inkonsistensi yang ditemukan, yang masih tersisa.

## Aturan
- Jangan ubah API/MCP contract, permission, atau backend.
- Jangan hapus bagian bawah Overview.
- Jangan buat specialist baru (hanya 5 yang ada: Dispatcher, EA, AO, Adversarial Reviewer, Policy Validator engine).
- Jangan tampilkan "100% Secure/Compliance" — gunakan "Local-Only Service Exposure" / "Scoped Execution Authorization".
- Jangan ubah data nyata jadi dummy.
- Komponen reusable, hindari duplikasi styling.

## Koordinasi
- Backend & integrasi ditangani tim lain. Jika butuh data/endpoint baru, koordinasi dulu.
- Perubahan besar (layout baru) diskusikan sebelum merge.
- Commit dengan pesan natural (skill `commit-natural`).

## Definition of Done (UI)
- Semua halaman konsisten visual, lega, harmonis.
- Desktop optimal, mobile tidak rusak.
- Interaksi yang dijanjikan berfungsi.
- Tidak ada error runtime/typecheck/build.
- Screenshot comparison dengan Stitch dilampirkan.