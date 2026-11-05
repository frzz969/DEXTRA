# DEXTRA — Product Enhancements

## Status Fitur

| Fitur | Status | Catatan |
| --- | --- | --- |
| AI Assistant + tool calling | ROADMAP | Belum ada implementasi di repo. WorkBuddy eksternal. Kandidat: OpenAI Responses API / Gemini. Buat adapter `AIProvider`. |
| Workforce orchestration | IMPLEMENTED (partial) | Dispatcher + 4 specialist. Perlu hardening timeout/retry. |
| Explainable execution | IMPLEMENTED | Audit trail + mandate + status. |
| Approval center | IMPLEMENTED | kotak-persetujuan.html dengan full scope inspector. |
| Activity timeline | IMPLEMENTED | audit.html append-only. |
| Failure recovery | ROADMAP | Belum ada retry mechanism. |
| Workforce analytics | ROADMAP | Illustrative numbers di overview dengan banner. |
| Provider switching | ROADMAP | Belum ada adapter. |
| Telegram integration | SKELETON | apps/telegram-adapter/ (post-MVP). |

## AI Provider Abstraction (Rancangan)

```ts
interface AIProvider {
  chat(messages, tools): Promise<Response>;
  stream(messages, tools): AsyncIterable<Chunk>;
}
```

Implementasi: OpenAIProvider, GeminiProvider. API key hanya di env server.

## Governance (tetap berlaku)
- AI berperan sebagai orchestrator, bukan pemegang otoritas.
- Tidak ada akses langsung yang melewati MCP, policy, approval, backend.
- Semua aksi tulis tetap lewat mandat.