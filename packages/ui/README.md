# @dextra/ui

Komponen UI DEXTRA: kartu, tabel, badge, drawer, empty state, banner demo.

## Sumber kanonik

`src/ui.js` adalah sumbernya. Dashboard **tidak** mengimpornya langsung — berkas
disalin ke `apps/dashboard/assets/js/ui.js` oleh `node scripts/sync-packages.mjs`,
karena dashboard harus tetap berjalan tanpa build step dan tanpa bundler.

`node scripts/verify-packages.mjs` gagal jika salinan berbeda dari sumbernya.
Jangan pernah menyunting berkas di `apps/dashboard/assets/` — sunting di sini,
lalu jalankan sync.
