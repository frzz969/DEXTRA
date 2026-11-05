# Approval Policy

- Approval token wajib, min 8 karakter, tidak boleh placeholder `apt_demo`, tidak boleh dipakai ulang.
- Approval terikat pada plan_id + plan_hash.
- Perubahan payload setelah approval → PLAN_HASH_MISMATCH.
- Mandat TTL 15 menit (default), single-use, idempotency key (mandate_id, action_id).
- Critical risk → BLOCKED di MVP (wajib persetujuan kedua, tidak diimplementasikan).

## Sumber
- apps/mcp-server/src/handlers.ts (submit_approval)
- packages/mandate-engine/src/issue.ts, validate.ts