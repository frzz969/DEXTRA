# Deployment (Produksi) — DEXTRA v2

Panduan pemasangan DEXTRA v2 di lingkungan produksi. Bahasa operator.

## Prasyarat

- Node.js >= 20
- Python 3.11
- pnpm (manajer paket)
- PostgreSQL (target produksi; SQLite hanya dev lokal)

## Langkah Instalasi

1. Clone repository dan masuk ke folder proyek.
2. `pnpm install` — instal dependensi JS.
3. Python: buat virtualenv, `pip install -e .` (lihat pyproject.toml).
4. Siapkan database PostgreSQL dan set `DATABASE_URL`.
5. `alembic upgrade head` — jalankan migrasi skema.
6. Seed data awal (tenant demo, user, dll.) — lihat scripts seed.
7. Build web: `pnpm --filter web build`.
8. Jalankan service backend + web sesuai infra (systemd/pm2/docker).

## Variabel Lingkungan (Env)

| Variabel | Wajib | Keterangan |
|---|---|---|
| DEXTRA_ENV | ya | `production` di produksi |
| DATABASE_URL | ya | connection string PostgreSQL |
| DEXTRA_LEGACY_TENANT | ya | slug tenant (mis. `dextra-demo`) |
| DEXTRA_AI_API_KEY | opsional | key provider AI (OpenAI-compatible) |
| DEXTRA_AI_BASE_URL | opsional | base URL provider AI |
| DEXTRA_AI_MODEL | opsional | nama model |
| SMTP_HOST/PORT/USER/PASS/FROM | opsional | email; tanpa SMTP pakai outbox file |
| TELEGRAM_BOT_TOKEN | opsional | token bot Telegram |
| DEXTRA_MCP_PORT | ya | port gateway MCP lama |
| DEXTRA_ALLOWED_ORIGINS | ya | daftar origin eksplisit, tanpa wildcard |
| DEXTRA_AGENT_TOKEN | ya | token gateway agent (ganti default) |
| DEXTRA_OPS_TOKEN | ya | token gateway ops (ganti default) |
| DEXTRA_API_URL | ya | URL backend untuk web (server-side) |
| DEXTRA_API_TOKEN | ya | token untuk web (server-side) |

## Checklist Produksi

- [ ] Token gateway (`DEXTRA_AGENT_TOKEN`, `DEXTRA_OPS_TOKEN`) bukan nilai default dev.
- [ ] HTTPS aktif untuk semua endpoint publik.
- [ ] `DEXTRA_ALLOWED_ORIGINS` hanya origin produksi (tanpa localhost/wildcard).
- [ ] Backup database terjadwal dan teruji restore.
- [ ] `audit:verify` lulus (hash chain audit utuh).
- [ ] `DEXTRA_ENV=production`.
- [ ] Secret tidak di-commit; gunakan secret manager.
- [ ] Monitoring/alert aktif (halaman monitoring + scan alert).

## Rollback

1. Hentikan service baru.
2. Restore database dari backup terakhir (sebelum migrasi).
3. `alembic downgrade` ke revisi sebelumnya jika perlu.
4. Deploy artefak versi sebelumnya.
5. Verifikasi `audit:verify` dan smoke test endpoint.
6. Catat insiden dan tenant yang terdampak.
}