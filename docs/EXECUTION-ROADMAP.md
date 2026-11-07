# DEXTRA — Execution Roadmap

## Track A — MVP Completion (Wajib)

| # | Item | Status |
| --- | --- | --- |
| A1 | Security D-02 (token logging) | CLOSED |
| A2 | Security D-04 (approval token enforcement) | CLOSED |
| A3 | Security D-05 (recipient scope) | CLOSED |
| A4 | Security D-03 (ops token in browser) | PARTIAL (full proxy = roadmap) |
| A5 | Demo dataset + seed/reset | DONE (pnpm run demo:reset) |
| A6 | TC-001 manual | PASS |
| A7 | TC-009 manual | PASS |
| A8 | Backend E2E + idempotency | VERIFIED (tests) |
| A9 | Wiring 99 tombol dashboard | IN PROGRESS (Pino) |
| A10 | Release freeze + git tag | PENDING (after A9) |

## Track B — Product Excellence (Nilai tambah)

| # | Item | Prioritas | Status |
| --- | --- | --- | --- |
| B1 | AI Assistant + provider adapter | P1 | ROADMAP (belum ada implementasi) |
| B2 | Workforce orchestration | P1 | SEBAGIAN (dispatcher ada, perlu hardening) |
| B3 | Explainable execution | P1 | SEBAGIAN (audit trail ada) |
| B4 | Approval experience | P1 | DONE (kotak-persetujuan) |
| B5 | Activity timeline | P1 | DONE (audit page) |
| B6 | Failure recovery | P2 | ROADMAP |
| B7 | Workforce analytics | P2 | ROADMAP |
| B8 | Provider switching | P2 | ROADMAP |
| B9 | Telegram integration | P3 | SKELETON (post-MVP) |

## Dependency Map
- A9 (button wiring) depends on Pino (UI).
- B1 (AI Assistant) depends on A1-A4 (security) + backend E2E.
- Release freeze depends on A9 + A10.

## Execution Plan
1. Security & blocker MVP (A1-A4) — DONE.
2. Demo dataset + TC (A5-A8) — DONE.
3. Dashboard button wiring (A9) — Pino, in progress.
4. Product enhancements feasible (B3, B4, B5) — done; B1, B6-B9 = roadmap.
5. Full regression + E2E.
6. Rehearsal + freeze + tag.

## Catatan
- Fitur baru tidak dipaksakan masuk MVP jika belum selesai & teruji.
- AI Assistant harus implementasi nyata, bukan kotak chat dekoratif.