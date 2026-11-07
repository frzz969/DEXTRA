# Manual Operator — DEXTRA v2

Panduan operasional harian untuk operator/admin DEXTRA.

## Alur Approval

- Setiap aksi sensitif memerlukan approval.
- Challenge code dicetak ke TERMINAL backend, TIDAK PERNAH ke browser. Operator membaca kode dari terminal dan memasukkannya.
- Approval terikat tenant (fail-closed): token tanpa tenant tidak melihat data.

## Alur Eksekusi

- Mandat: setiap eksekusi memerlukan mandate (scope yang diizinkan).
- Scope: aksi dibatasi sesuai scope mandate; di luar scope ditolak.
- Retry: eksekusi gagal dapat di-retry sesuai kebijakan; audit mencatat setiap percobaan.

## Verifikasi Audit

- Jalankan `audit:verify` (skrip pnpm) untuk memverifikasi hash chain audit utuh.
- Jika gagal: hentikan operasi, investigasi tampering, eskalasi.

## Monitoring

- Halaman monitoring menampilkan status sistem dan alert.
- Scan alert berkala (`alerts scan`) untuk mendeteksi anomali.
- Tindak lanjuti alert sesuai severity.

## Respons Insiden

- Kebocoran token: rotasi token segera, revoke token lama, audit akses, catat insiden.
- Tenant mismatch: cek `DEXTRA_LEGACY_TENANT`, verifikasi pemetaan token→tenant, jangan jalankan aksi sampai teratasi.
- Anomali audit: jalankan `audit:verify`, isolasi sistem, eskalasi ke tim keamanan.
}