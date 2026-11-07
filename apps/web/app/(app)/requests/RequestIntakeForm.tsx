"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOfficePlanAction, type CreatePlanResult } from "@/app/(app)/office-agent/actions";

const ACTION_TYPES = [
  { value: "send_email", label: "Kirim email" },
  { value: "create_calendar_event", label: "Buat acara kalender" },
  { value: "create_task", label: "Buat tugas" },
  { value: "create_meeting_note", label: "Buat notulen" },
];

const ctrl = { minHeight: 44 } as const;

export default function RequestIntakeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CreatePlanResult | null>(null);
  const [requestId, setRequestId] = useState("");
  const [planId, setPlanId] = useState("");
  const [actionId, setActionId] = useState("");
  const [actionType, setActionType] = useState("send_email");
  const [intakeText, setIntakeText] = useState("");
  const [target, setTarget] = useState("");
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      const out = await createOfficePlanAction({
        request_id: requestId,
        plan_id: planId,
        source_title: "Permintaan web",
        intake_text: intakeText,
        action_id: actionId,
        action_type: actionType,
        target,
        subject,
        start,
      });
      setResult(out);
      if (out.ok) router.refresh();
    });
  };

  return (
    <section className="card" aria-labelledby="req-intake-h">
      <div className="card__head">
        <div>
          <h2 id="req-intake-h" style={{ fontSize: 15, margin: 0 }}>Buat request baru</h2>
          <p style={{ margin: "4px 0 0" }}>
            Kirim lewat jalur nyata ke backend (POST /office-agent/plans) dengan token
            agent. Request langsung muncul di daftar di bawah dan menunggu persetujuan.
          </p>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="card__body" style={{ display: "grid", gap: "var(--s-4)" }}>
          <div style={{ display: "grid", gap: "var(--s-4)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <div className="field">
              <label className="field__label" htmlFor="req-id">Request ID <span className="req" aria-hidden="true">*</span></label>
              <input
                className="input" id="req-id" style={ctrl}
                value={requestId} onChange={(e) => setRequestId(e.target.value)}
                placeholder="req-notulen-001" autoComplete="off" required minLength={4} maxLength={96}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="req-plan">Plan ID <span className="req" aria-hidden="true">*</span></label>
              <input
                className="input" id="req-plan" style={ctrl}
                value={planId} onChange={(e) => setPlanId(e.target.value)}
                placeholder="pln-notulen-001" autoComplete="off" required maxLength={96}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="req-action">Action ID <span className="req" aria-hidden="true">*</span></label>
              <input
                className="input" id="req-action" style={ctrl}
                value={actionId} onChange={(e) => setActionId(e.target.value)}
                placeholder="act-email-001" autoComplete="off" required maxLength={64}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="req-type">Tipe tindakan <span className="req" aria-hidden="true">*</span></label>
            <select className="select" id="req-type" style={ctrl} value={actionType} onChange={(e) => setActionType(e.target.value)}>
              {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.value})</option>)}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="req-text">Teks permintaan <span className="req" aria-hidden="true">*</span></label>
            <textarea
              className="textarea" id="req-text" rows={4} style={{ minHeight: 44 }}
              value={intakeText} onChange={(e) => setIntakeText(e.target.value)}
              placeholder="Contoh: Kirim notulen rapat koordinasi 30 Oktober 2026 ke tim operasional."
              maxLength={8000} required
            />
            <span className="tiny faint">{intakeText.length} / 8000 · minimal 20 karakter</span>
          </div>

          {actionType === "send_email" && (
            <div style={{ display: "grid", gap: "var(--s-4)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div className="field">
                <label className="field__label" htmlFor="req-target">Email tujuan <span className="req" aria-hidden="true">*</span></label>
                <input className="input" id="req-target" style={ctrl} type="email" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="budi@example.test" required autoComplete="off" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="req-subject">Subjek email <span className="req" aria-hidden="true">*</span></label>
                <input className="input" id="req-subject" style={ctrl} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Notulen rapat" required autoComplete="off" />
              </div>
            </div>
          )}
          {actionType !== "send_email" && (
            <div className="field">
              <label className="field__label" htmlFor="req-subject2">
                {actionType === "create_calendar_event" ? "Judul acara" : actionType === "create_task" ? "Judul tugas" : "Judul notulen"} <span className="req" aria-hidden="true">*</span>
              </label>
              <input className="input" id="req-subject2" style={ctrl} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Isi judul…" required autoComplete="off" />
            </div>
          )}
          {actionType === "create_calendar_event" && (
            <div className="field">
              <label className="field__label" htmlFor="req-start">Waktu mulai <span className="req" aria-hidden="true">*</span></label>
              <input className="input" id="req-start" style={ctrl} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
          )}

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <span className="spacer" />
            <button type="submit" className="btn btn--primary" style={ctrl} disabled={pending} aria-busy={pending}>
              <span className="material-symbols-outlined" aria-hidden="true">{pending ? "hourglass_top" : "send"}</span>
              {pending ? "Mengirim…" : "Kirim request"}
            </button>
          </div>

          {result && result.ok && (
            <div className="banner" role="status" style={{ borderColor: "var(--success-600)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <span>
                Request <span className="mono">{result.request_id}</span> / plan{" "}
                <span className="mono">{result.plan_id}</span> tersimpan (status: {result.status}).
                Lanjut ke <Link href={`/approvals?plan=${encodeURIComponent(result.plan_id)}`}>Approval Inbox</Link> untuk memutus.
              </span>
            </div>
          )}
          {result && !result.ok && (
            <div className="banner banner--warning" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">error</span>
              <span><strong>Server menolak kiriman.</strong> {result.error}{result.status ? ` (HTTP ${result.status})` : ""}</span>
            </div>
          )}
        </div>
      </form>
    </section>
  );
}
