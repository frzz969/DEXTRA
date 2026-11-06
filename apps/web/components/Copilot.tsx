"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { sendAssistantMessage } from "../app/assistant/actions";
import type { AiChatMessage } from "@/lib/ai";

type ChatMessage = AiChatMessage & { id: number; model?: string };

/**
 * DEXTRA Copilot — panel AI global. Satu AI dengan halaman /assistant:
 * tindakan yang sama (sendAssistantMessage), system prompt yang sama, dan
 * batas yang sama — tidak mengeksekusi, tidak menyetujui, tidak menerbitkan.
 * Semua berhenti di persetujuan manusia.
 */
export default function Copilot({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(!aiConfigured);
  const idRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [sending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  /* Pill Copilot di Topbar + pintasan Ctrl/Cmd+J (seperti panel statis). */
  useEffect(() => {
    const onToggle = () => setOpen((value) => !value);
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("dextra:copilot-toggle", onToggle);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("dextra:copilot-toggle", onToggle);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, sending, open]);

  const send = (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    setError(null);
    const history = messages.map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { id: ++idRef.current, role: "user", content: message }]);
    setInput("");
    startTransition(async () => {
      const result = await sendAssistantMessage({ history, message });
      if (result.ok) {
        setNotConfigured(false);
        setMessages((prev) => [...prev, { id: ++idRef.current, role: "assistant", content: result.reply, model: result.model }]);
      } else {
        if (result.notConfigured) setNotConfigured(true);
        setError(result.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        className="copilot-fab"
        aria-label={open ? "Tutup DEXTRA Copilot" : "Buka DEXTRA Copilot"}
        aria-expanded={open}
        aria-controls="copilot-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{open ? "close" : "auto_awesome"}</span>
      </button>

      {open && (
        <div
          id="copilot-panel"
          role="dialog"
          aria-label="DEXTRA Copilot"
          aria-modal="false"
          className="copilot-panel"
        >
          <div className="copilot-panel__head">
            <span className="avatar" aria-hidden="true" style={{ background: "var(--brand-100)", color: "var(--brand-700)", display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_awesome</span>
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.2 }}>DEXTRA Copilot</div>
              <div className="cell-sub">Satu AI dengan Assistant · berhenti di persetujuan manusia</div>
            </div>
            <button type="button" className="icon-btn" aria-label="Tutup Copilot" onClick={() => setOpen(false)}>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
            </button>
          </div>

          <div className="copilot-panel__body" ref={bodyRef} role="log" aria-live="polite" aria-label="Riwayat Copilot">
            {notConfigured ? (
              <div className="banner banner--warning" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
                <span>
                  <strong>AI belum dikonfigurasi.</strong>
                  <br />
                  Isi <code className="mono">DEXTRA_AI_API_KEY</code> (opsional <code className="mono">DEXTRA_AI_BASE_URL</code>, <code className="mono">DEXTRA_AI_MODEL</code>) di .env lalu restart. Assistant &amp; Copilot sama-sama memakai socket itu — tidak ada jawaban pura-pura.
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty" style={{ padding: "var(--s-5) var(--s-3)" }}>
                <div className="empty__icon"><span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span></div>
                <h3>Tanya apa pun</h3>
                <p>Draf pesan, alur governance, kebijakan — tanpa meninggalkan halaman Anda.</p>
              </div>
            ) : (
              messages.map((msg) =>
                msg.role === "user" ? (
                  <div className="msg msg--user" key={msg.id}><div className="msg__bubble">{msg.content}</div></div>
                ) : (
                  <div className="msg" key={msg.id}>
                    <span className="avatar avatar--sm" aria-hidden="true" style={{ background: "var(--brand-100)", color: "var(--brand-700)", display: "grid", placeItems: "center" }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="msg__bubble">{msg.content}</div>
                      {msg.model && <div className="tiny faint mono" style={{ marginTop: 4 }}>{msg.model}</div>}
                    </div>
                  </div>
                )
              )
            )}
            {sending && (
              <div className="msg" role="status" aria-label="Copilot berpikir">
                <span className="avatar avatar--sm" aria-hidden="true" style={{ background: "var(--brand-100)", color: "var(--brand-700)", display: "grid", placeItems: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span>
                </span>
                <div className="msg__bubble">Menyusun jawaban…</div>
              </div>
            )}
          </div>

          <div className="copilot-panel__foot">
            <form onSubmit={(event) => { event.preventDefault(); send(input); }}>
              <label className="sr-only" htmlFor="copilot-composer">Pesan untuk Copilot</label>
              <textarea
                className="textarea"
                id="copilot-composer"
                rows={1}
                placeholder={notConfigured ? "AI belum dikonfigurasi" : "Tanyakan apa pun… (Shift+Enter baris baru)"}
                style={{ minHeight: 44 }}
                disabled={notConfigured}
                maxLength={8000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
              />
              <button type="submit" className="btn btn--primary" style={{ minHeight: 44, minWidth: 44 }} disabled={sending || notConfigured || !input.trim()} aria-label="Kirim pesan" aria-busy={sending}>
                <span className="material-symbols-outlined" aria-hidden="true">{sending ? "hourglass_top" : "send"}</span>
              </button>
            </form>
            {error && (
              <div className="field__error" role="alert" style={{ marginTop: 6 }}>
                <span className="material-symbols-outlined" aria-hidden="true">error</span>
                {error}
              </div>
            )}
            <div className="tiny faint" style={{ marginTop: 6 }}>
              Riwayat hanya di tab ini · <Link href="/assistant" onClick={() => setOpen(false)}>Buka Assistant</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
