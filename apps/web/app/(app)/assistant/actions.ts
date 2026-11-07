"use server";

import { aiChat, type AiChatMessage } from "@/lib/ai";

/**
 * System prompt yang sama untuk Assistant dan Copilot: satu AI, satu batas.
 * AI tidak mengeksekusi, tidak menyetujui, tidak menerbitkan — berhenti di
 * manusia. Apa pun yang dijawab, tindakan nyata tetap harus lewat alur
 * plan → approval → mandate → eksekusi.
 */
const SYSTEM_PROMPT = [
  "Kamu adalah DEXTRA Assistant, asisten kantor internal di lingkungan kerja terkontrol dengan tata kelola ketat.",
  "Aturan yang tidak boleh kamu langgar:",
  "- Kamu TIDAK mengirim pesan, mengubah jadwal, menyetujui, menerbitkan mandat, atau mengeksekusi apa pun.",
  "- Setiap tindakan operatif hanya terjadi lewat alur: rencana (plan) → persetujuan manusia → mandat → eksekusi, dan semua tercatat di audit.",
  "- Kamu boleh membantu menyusun DRAF (pesan, jadwal, daftar tugas, notulen) dan menjelaskan alur governance, risiko, serta kebijakan yang relevan.",
  "- Jangan mengarang data, nama, atau angka; bila tidak tahu, katakan dan tunjukkan apa yang perlu diperiksa manusia.",
  "Jawab dalam Bahasa Indonesia, singkat dan langsung. Gunakan paragraf pendek atau daftar bila membantu."
].join("\n");

export type SendMessageResult =
  | { ok: true; reply: string; model: string }
  | { ok: false; error: string; notConfigured?: boolean };

export async function sendAssistantMessage(input: {
  history: AiChatMessage[];
  message: string;
}): Promise<SendMessageResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, error: "Pesan kosong." };
  if (message.length > 8000) return { ok: false, error: "Pesan terlalu panjang (maks 8000 karakter)." };

  // Batasi riwayat agar konteks tetap kecil; AI tidak butuh transkrip penuh.
  const history = (input.history ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));

  const result = await aiChat([
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: message }
  ]);

  if (!result.ok) {
    return { ok: false, error: result.error, notConfigured: result.notConfigured };
  }
  return { ok: true, reply: result.text, model: result.model };
}
