# DEXTRA — Test Results

## Ringkasan
- Total tests: 138
- Pass: 138
- Fail: 0
- Skipped: 0

## Suite
- contracts, store, policy-engine, plan, mandate-engine, executor, replay, mcp-server (origin-policy, auth, http-verification).

## TC-001 (manual, live build)
- Status: BELUM DIJALANKAN (menunggu verifikasi manual).

## TC-009 (manual, live build)
- Status: BELUM DIJALANKAN (menunggu verifikasi manual).

## Security tests
- D-01: 20 tests pass.
- D-02–D-05: code fix verified via typecheck + existing suite. Dedicated negatif tests TBD.

## Idempotency
- Store-level dedup (mandate_id, action_id) verified by executor tests.

## Catatan
- `npm test` gagal di sandbox (spawn EPERM); gunakan `npm run test:inproc`.