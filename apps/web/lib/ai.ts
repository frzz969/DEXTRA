/**
 * Klien AI DEXTRA — dipakai oleh AI Assistant dan (nanti) Copilot.
 *
 * Kontrak: OpenAI-compatible chat completions. Provider bebas — OpenAI, DeepSeek,
 * Qwen, Gemini-OpenAI, atau endpoint self-hosted — selama bentuk responsnya sama
 * (`choices[0].message.content`). Provider dipilih lewat env di SERVER, bukan di
 * browser; key tidak pernah dikirim ke klien.
 *
 * Bila `DEXTRA_AI_API_KEY` belum diisi, pemanggil menjawab dengan status
 * `notConfigured` apa adanya — tidak ada jawaban pura-pura.
 */
export type AiChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; notConfigured?: boolean };

const BASE_URL = (process.env.DEXTRA_AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const KEY = process.env.DEXTRA_AI_API_KEY ?? "";
const MODEL = process.env.DEXTRA_AI_MODEL ?? "gpt-4o-mini";

export function aiConfigured(): boolean {
  return KEY.length > 0;
}

export function aiModelName(): string {
  return MODEL;
}

export async function aiChat(messages: AiChatMessage[]): Promise<AiResult> {
  if (!KEY) {
    return {
      ok: false,
      notConfigured: true,
      error:
        "AI belum dikonfigurasi. Isi DEXTRA_AI_API_KEY (dan opsional DEXTRA_AI_BASE_URL, DEXTRA_AI_MODEL) di .env lalu restart server.",
    };
  }
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ model: MODEL, messages, temperature: 0.2, max_tokens: 1200 }),
      cache: "no-store"
    });
    const body = (await response.json().catch(() => null)) as
      | { choices?: { message?: { content?: string } }[]; error?: { message?: string } }
      | null;
    if (!response.ok) {
      return { ok: false, error: body?.error?.message ?? `AI provider menolak permintaan (HTTP ${response.status}).` };
    }
    const text = body?.choices?.[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: "Respon AI kosong — provider tidak mengembalikan teks." };
    return { ok: true, text, model: MODEL };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "gagal menghubungi AI provider" };
  }
}
