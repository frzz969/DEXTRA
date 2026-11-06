# Setup Kanal — DEXTRA v2

Panduan menghubungkan kanal komunikasi (Telegram, WhatsApp) ke DEXTRA.

## Telegram

1. Buka @BotFather di Telegram, buat bot baru (`/newbot`), simpan token.
2. Set `TELEGRAM_BOT_TOKEN=<token>` di environment.
3. Jalankan dev telegram: `pnpm dev:telegram` (atau perintah setara di package.json).
4. Hubungkan identitas: setiap user Telegram harus ditautkan ke akun tenant DEXTRA (identity linkage). Tanpa tautan, pesan ditolak (fail-closed).
5. Verifikasi bot merespons perintah dan menampilkan challenge code di terminal (bukan di browser).

## WhatsApp

- Status: belum diimplementasikan (post-MVP). Belum tersedia untuk produksi.
- Rencana: adapter WhatsApp akan ditambahkan setelah MVP; saat ini gunakan Telegram/email/outbox file.

## Tautan Identitas (Identity Linkage)

- Setiap kanal eksternal (Telegram) harus dipetakan ke `(tenant_id, user_id)` DEXTRA.
- Pemetaan disimpan di tabel identity linkage; tanpa pemetaan, aksi ditolak.
- Admin mengelola tautan via halaman admin/identitas.

## Troubleshooting

- Bot tidak merespons: cek `TELEGRAM_BOT_TOKEN`, jaringan, dan log service.
- "AI belum dikonfigurasi": set `DEXTRA_AI_API_KEY/BASE_URL/MODEL`.
- Challenge code tidak muncul: pastikan terminal backend aktif; kode dicetak ke terminal, tidak ke browser.
- Tenant mismatch: pastikan `DEXTRA_LEGACY_TENANT` sesuai slug tenant user.
}