"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendAssistantMessage } from "./actions";
import type { AiChatMessage } from "@/lib/ai";
import type { Worker } from "@/lib/workers";
import { writeIntakeDraft } from "@/lib/intake-draft";

type ChatMessage = AiChatMessage & { id: number; model?: string };

const DEFAULT_SUGGESTIONS = [
  "Siapkan draf pemberitahuan rapat dewan",
  "Ringkas langkah pengiriman surat ke vendor Q4",
  "Buat checklist audit internal",
  "Susun alur persetujuan pengadaan"
];

/** Saran awal mengikuti peran worker, supaya spawn langsung terasa bedanya. */
const SUGGESTIONS_BY_WORKER: Record<string, string[]> = {
  "workforce-dispatcher": [
    "Pecah permintaan rapat besok menjadi langkah kerja",
    "Worker mana yang cocok untuk pengadaan Q4?",
    "Susun urutan kerja untuk menyiapkan laporan bulanan"
  ],
  "executive-assistant": [
    "Susun agenda rapat koordinasi besok pukul 10.00",
    "Buat draf undangan rapat dengan vendor Q4",
    "Bantu cari waktu kosong untuk rapat pimpinan"
  ],
  "administrative-officer": [
    "Rapikan format laporan bulanan Oktober",
    "Buat catatan permintaan pengadaan dari tim operasi",
    "Susun kerangka laporan mingguan"
  ],
  "adversarial-reviewer": [
    "Periksa rencana pengiriman email ke vendor Q4",
    "Apa risiko menjadwalkan rapat tanpa konfirmasi peserta?",
    "Tandai kelemahan draf undangan ini"
  ]
};

const LIMITATIONS = [
  "Tidak mengirim pesan",
  "Tidak membuat/mengubah jadwal",
  "Tidak menyetujui apa pun",
  "Tidak menerbitkan mandat",
  "Tidak mengubah data pelanggan"
];

export default function AssistantChat({
  aiConfigured,
  model,
  worker
}: {
  aiConfigured: boolean;
  model: string;
  worker?: Worker;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(!aiConfigured);
  const [sending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const suggestions = (worker && SUGGESTIONS_BY_WORKER[worker.slug]) || DEFAULT_SUGGESTIONS;

  const send = (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    const history = messages.map(({ role, content }) => ({ role, content }));
    const userMessage: ChatMessage = { id: ++idRef.current, role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    startTransition(async () => {
      const result = await sendAssistantMessage({ history, message, worker: worker?.slug });
      if (result.ok) {
        setNotConfigured(false);
        setMessages((prev) => [
          ...prev,
          { id: ++idRef.current, role: "assistant", content: result.reply, model: result.model }
        ]);
      } else {
        if (result.notConfigured) setNotConfigured(true);
        setError(result.error);
      }
    });
  };

  /**
   * Membawa percakapan ke formulir intake /office-agent.
   *
   * Draf ditulis ke sessionStorage, bukan ke query string: teks percakapan bisa
   * ribuan karakter dan akan memotong URL. Formulir intake membaca kunci yang
   * sama lalu menghapusnya, jadi draf hanya terpakai sekali.
   */
  const sendToOfficeAgent = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastUser) return;
    const parts = [lastUser.content.trim()];
    if (lastAssistant) parts.push("", "Draf usulan asisten:", lastAssistant.content.trim());
    const written = writeIntakeDraft({
      title: lastUser.content.trim().slice(0, 80),
      text: parts.join("\n").slice(0, 8000)
    });
    // Bila storage diblokir, jangan berpindah halaman dengan formulir kosong
    // tanpa penjelasan; pengguna tetap bisa mengisi manual dari sini.
    if (!written) return;
    router.push(worker ? `/office-agent?worker=${encodeURIComponent(worker.slug)}` : "/office-agent");
  };

  return (
    <div className="card chat-card">
      <div className="card__head">
        <div>
          <h2>Percakapan</h2>
          <p>
            {worker
              ? `${worker.name} · ${worker.role} · model yang sama, instruksi berbeda`
              : "Riwayat hanya hidup di tab ini · tidak disimpan ke server"}
          </p>
        </div>
        <div className="spacer" />
        <span className="badge badge--outline" title="Menunjuk model dikonfigurasi di server, bukan di browser">
          <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 13 }}>memory</span>
          {model}
        </span>
      </div>

      <div className="assistant-scroll" ref={scrollRef} role="log" aria-live="polite" aria-label="Riwayat percakapan">
        {notConfigured ? (
          <div className="banner banner--warning" role="alert" style={{ margin: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
            <div>
              <strong>AI belum dikonfigurasi.</strong>
              <p style={{ marginTop: 6 }}>
                Asisten dan Copilot memakai provider AI yang sama, hanya diaktifkan lewat env di server —
                bukan dari browser. Isi di <code className="mono">.env</code>:
              </p>
              <pre className="mono" style={{ background: "var(--surface-2)", padding: "var(--s-2) var(--s-3)", borderRadius: 6, overflowX: "auto" }}>
DEXTRA_AI_API_KEY=sk-…        # wajib
DEXTRA_AI_BASE_URL=https://api.openai.com/v1   # opsional
DEXTRA_AI_MODEL=gpt-4o-mini                     # opsional</pre>
              <p style={{ marginTop: 6 }}>lalu restart server (<code className="mono">pnpm run dev</code> / <code className="mono">pnpm run start</code>). Sampai itu, tidak ada jawaban pura-pura.</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty" style={{ margin: "var(--s-6) auto" }}>
            <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span></div>
            <h3>{worker ? `${worker.name} siap` : "Mulai percakapan"}</h3>
            <p>
              {worker
                ? `${worker.role} — ${worker.summary} Semua tindakan nyata tetap berhenti di persetujuan manusia.`
                : "Tanya apa pun — draf, alur, kebijakan. Semua tindakan nyata berhenti di persetujuan manusia."}
            </p>
          </div>
        ) : (
          messages.map((msg) =>
            msg.role === "user" ? (
              <div className="msg msg--user" key={msg.id}>
                <div className="msg__bubble">{msg.content}</div>
              </div>
            ) : (
              <div className="msg" key={msg.id}>
                <span className="avatar avatar--sm" aria-hidden="true" style={{ background: "var(--brand-100)", color: "var(--brand-700)", display: "grid", placeItems: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="msg__bubble">{msg.content}</div>
                  {msg.model && (
                    <div className="tiny faint mono" style={{ marginTop: 4 }}>
                      {msg.model}{worker ? ` · ${worker.role}` : ""}
                    </div>
                  )}
                </div>
              </div>
            )
          )
        )}
        {sending && (
          <div className="msg" role="status" aria-label="Asisten sedang berpikir">
            <span className="avatar avatar--sm" aria-hidden="true" style={{ background: "var(--brand-100)", color: "var(--brand-700)", display: "grid", placeItems: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span>
            </span>
            <div className="msg__bubble">Menyusun jawaban…</div>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 9 }} aria-label="Saran pertanyaan">
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" className="chip" style={{ minHeight: 44 }} onClick={() => send(suggestion)} disabled={sending || notConfigured}>
              {suggestion}
            </button>
          ))}
        </div>
        <form
          className="row"
          style={{ gap: 8, alignItems: "flex-end" }}
          onSubmit={(event) => { event.preventDefault(); send(input); }}
        >
          <label className="sr-only" htmlFor="assistant-composer">Pesan untuk asisten</label>
          <textarea
            className="textarea"
            id="assistant-composer"
            rows={2}
            placeholder={notConfigured ? "AI belum dikonfigurasi — pengiriman dinonaktifkan" : "Tulis permintaan dalam bahasa biasa…"}
            style={{ minHeight: 44, maxHeight: 120, flex: 1 }}
            value={input}
            disabled={notConfigured}
            maxLength={8000}
            aria-describedby="assistant-composer-hint"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
          />
          <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }} disabled={sending || notConfigured || !input.trim()} aria-busy={sending}>
            <span className="material-symbols-outlined" aria-hidden="true">{sending ? "hourglass_top" : "send"}</span>
            {sending ? "Mengirim…" : "Kirim"}
          </button>
        </form>
        {error && (
          <div className="field__error" role="alert" style={{ marginTop: 8 }}>
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            {error}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginTop: 7, flexWrap: "wrap" }}>
          <span className="tiny faint" id="assistant-composer-hint" style={{ flex: "1 1 220px", minWidth: 0 }}>
            Enter mengirim · Shift+Enter baris baru · Maks 8000 karakter · Rencana tetap berhenti di persetujuan manusia.
          </span>
          {messages.length > 0 && (
            <button type="button" className="btn btn--secondary" style={{ minHeight: 44 }} onClick={sendToOfficeAgent}>
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
              Susun rencana dari percakapan
            </button>
          )}
        </div>
        {messages.length > 0 && (
          <button type="button" className="btn btn--ghost" style={{ minHeight: 44, marginTop: 6 }} onClick={() => { setMessages([]); setError(null); }} disabled={sending}>
            <span className="material-symbols-outlined" aria-hidden="true">delete</span>Hapus percakapan di tab ini
          </button>
        )}
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        <details>
          <summary className="field__hint">Yang tidak dilakukan asisten</summary>
          <ul className="small muted" style={{ marginTop: 6 }}>
            {LIMITATIONS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
