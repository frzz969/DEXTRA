# DEXTRA — The Governed AI Workforce

**Specialized AI workers. Human-defined authority. Accountable execution.**

Tencent Cloud Hackathon Indonesia 2026 — Challenge B: The Office Agent

An office agent that acts only on human-approved mandates.

## Prinsip

> Baca boleh otomatis, tulis harus lewat mandat.

## Struktur

```
dextra/
├── apps/
│   ├── dashboard/      # Approval dashboard + mock inbox + audit
│   └── mcp-server/     # MCP server: rules, plan, mandate, executor
├── packages/
│   ├── contracts/      # Skema Plan, Mandate, ActionResult
│   ├── policy-engine/
│   ├── mandate-engine/
│   ├── audit/
│   ├── mock-services/
│   └── shared/
├── workbuddy/          # Agent manifest, skills, knowledge, mcp.json
└── docs/
    └── PRD.md          # Spesifikasi produk lengkap
```

## Status

Minggu 1 — Hackathon MVP. Lihat `docs/PRD.md` §27 untuk timeline dan §32 untuk Definition of Done.

## Batas Kepercayaan

AI menyusun rencana. Manusia menyetujui. Executor memvalidasi mandat secara independen.
Tidak ada jalur dari agen ke executor.
