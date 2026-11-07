# Panduan Setup Assistant (AI)

## 1. Dapatkan API key OpenAI-compatible
Provider bebas: OpenAI, DeepSeek, Qwen, Gemini (mode OpenAI), atau self-hosted (Ollama/vLLM). Dapatkan `sk-...`.

## 2. Set env
- Web: salin `apps/web/.env.local.example` ke `apps/web/.env.local`, isi key.
- Root: pastikan blok `DEXTRA_AI_*` ada di `.env` (lihat `.env.example`).

Variabel:
- `DEXTRA_AI_API_KEY` (wajib)
- `DEXTRA_AI_BASE_URL` (opsional, default `https://api.openai.com/v1`)
- `DEXTRA_AI_MODEL` (opsional, default `gpt-4o-mini`)

## 3. Restart Next.js
`pnpm run dev` / `pnpm run start`.

## 4. Verifikasi
Banner "AI belum dikonfigurasi" hilang; ajukan pertanyaan sederhana, pastikan mendapat jawaban. Tanpa key, banner sengaja muncul — tidak ada jawaban pura-pura.
