# DEXTRA — Architecture Summary

## Komponen
1. WorkBuddy Desktop (interaksi AI, MCP client)
2. Local MCP Server (hub, port 8765, token-scoped)
3. Deterministic Governance Engine (policy-engine)
4. Approval Dashboard (localhost:3000)
5. Mock Executor (mock email/calendar/task)
6. Mock Services (kontak, kalender, dokumen)

## Alur
Instruction → Dispatcher → Specialists → Unified Work Package → Adversarial Reviewer → Policy Validator → Human Approval → Mandate → Mock Executor → Audit Log

## Keamanan
- Agent token: 7 tools (read/plan). Ops token: 12 tools (incl. approval/execute).
- `submit_approval`, `issue_mandate`, `execute_action` tidak pernah exposed ke LLM.
- Mandat: HMAC-signed, TTL 15 min, single-use, idempotency key (mandate_id, action_id).
- Origin allowlist + Host check (D-01). D-02–D-05: in progress.
- Fail closed. Audit append-only.

## Data
- JSON files di `data/`. Masking di repository layer. Seed deterministik & idempotent.