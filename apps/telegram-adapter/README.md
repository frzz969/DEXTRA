# Telegram Adapter — DEXTRA (Integration, post-MVP)

> **Status: OPTIONAL / post-MVP.** Tidak termasuk MVP hackathon (PRD mengecualikan WhatsApp/Telegram dari MVP). Adapter ini adalah fondasi untuk customer-ops roadmap. Semua aksi tetap lewat MCP server (governance & mandat tetap berlaku).

## Konsep
Telegram bot sebagai **channel adapter** yang:
- Menerima pesan dari user via Telegram.
- Meneruskan ke MCP server DEXTRA (http://127.0.0.1:8765) via JSON-RPC.
- Menampilkan hasil (status, work package, approval) ke user.
- **Tidak** bypass mandat: aksi tulis tetap memerlukan approval manusia lewat dashboard/MCP.

## Alur
1. User kirim pesan → bot.
2. Bot panggil MCP tool (mis. `get_status`, `get_plan`, `get_audit_log`).
3. Bot balas ringkasan.
4. Untuk aksi tulis (kirim email, dll.), bot **tidak** eksekusi langsung; ia buat plan via `create_plan` + `validate_plan`, lalu minta user approve via dashboard (link). Bot hanya menampilkan status.

## Konfigurasi (env)
```
TELEGRAM_BOT_TOKEN=...        # dari @BotFather
DEXTRA_MCP_URL=http://127.0.0.1:8765
DEXTRA_OPS_TOKEN=ops-dev-token
DEXTRA_AGENT_TOKEN=agent-dev-token
```

## Perintah bot (rencana)
- `/start` — sapaan + identitas.
- `/status` — ringkasan Work Package (via `get_status` + audit).
- `/plans` — daftar plan (via `get_audit_log`).
- `/approve <plan_id>` — **tidak langsung eksekusi**; arahkan ke dashboard untuk approval (mandat tetap di backend).
- `/help` — daftar perintah.

## Implementasi (TODO)
- [ ] Scaffold `apps/telegram-adapter/` (Node + telegraf atau node-telegram-bot-api).
- [ ] MCP client helper (JSON-RPC POST ke `DEXTRA_MCP_URL` dengan Bearer token).
- [ ] Handler perintah di atas.
- [ ] Mapping Telegram user → DEXTRA user (ops token scoping).
- [ ] Rate limiting & logging.
- [ ] Test end-to-end dengan mock MCP server.

## Keamanan
- Bot token di env, bukan di repo.
- Jangan log token.
- Semua aksi tulis tetap lewat mandat (D-04 recipient scope, D-05 approval token).
- Adapter ini **tidak** boleh memanggil `execute_action` / `submit_approval` langsung tanpa approval manusia.

## Status
Fondasi dokumentasi. Implementasi penuh = post-MVP (roadmap customer-ops).