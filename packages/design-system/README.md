# @dextra/design-system

Token dan stylesheet tunggal DEXTRA. Light dan dark memakai kontrak token yang sama.

| Berkas | Isi |
|---|---|
| `tokens.json` | Token inti yang bisa dibaca mesin (brand, status, neutral, semantic, elevation, font, z, radius, space, layout) |
| `src/dashboard.css` | Stylesheet kanonik; satu-satunya tempat token dideklarasikan |

## Verifikasi

`node scripts/verify-packages.mjs` memeriksa dua hal:

1. Setiap token di `tokens.json` benar-benar dideklarasikan dengan nilai yang sama
   di `src/dashboard.css`. Token yang tidak dipakai akan menggagalkan pemeriksaan —
   supaya daftar token tidak berubah menjadi dokumen aspirasi.
2. Salinan di `apps/dashboard/assets/css/dashboard.css` identik dengan sumbernya.

Jalankan `node scripts/sync-packages.mjs` setelah menyunting CSS.
