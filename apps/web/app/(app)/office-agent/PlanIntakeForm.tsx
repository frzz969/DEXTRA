"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOfficePlanAction, type CreatePlanResult } from "./actions";
import type { Worker } from "@/lib/workers";
import { takeIntakeDraft } from "@/lib/intake-draft";

const ACTION_TYPES = [
  { value: "send_email", label: "Kirim email" },
  { value: "create_calendar_event", label: "Buat acara kalender" },
  { value: "create_task", label: "Buat tugas" },
  { value: "create_meeting_note", label: "Buat notulen" },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const ctrl = { minHeight: 44 } as const;

export default function PlanIntakeForm({ worker }: { worker?: Worker }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CreatePlanResult | null>(null);
  const [requestId, setRequestId] = useState("");
  const [planId, setPlanId] = useState("");
  const [actionId, setActionId] = useState("");
  const [actionType, setActionType] = useState<string>(worker?.defaultActionType ?? "send_email");
  const [sourceTitle, setSourceTitle] = useState("");
  const [intakeText, setIntakeText] = useState("");
  const [target, setTarget] = useState("");
  const [subject, setSubject] = useState("");
  const [start, setStart] = useState("");
  const [touched, setTouched] = useState(false);
  const [fromAssistant, setFromAssistant] = useState(false);

  /*
   * Draf dari AI Assistant dibaca sekali saat mount, lalu dihapus oleh
   * takeIntakeDraft(). Nilai yang sudah diketik pengguna tidak ditimpa.
   * Efek berjalan di klien saja; server tetap merender formulir kosong, jadi
   * tidak ada ketidakcocokan hidrasi.
   */
  useEffect(() => {
    const draft = takeIntakeDraft();
    if (!draft) return;
    setSourceTitle((prev) => prev || draft.title);
    setIntakeText((prev) => prev || draft.text);
    setFromAssistant(true);
  }, []);

  const clientError =
    touched && intakeText.trim().length > 0 && intakeText.trim().length < 20
      ? "Teks permintaan minimal 20 karakter."
      : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    setResult(null);
    startTransition(async () => {
      const out = await createOfficePlanAction({
        request_id: requestId,
        plan_id: planId,
        source_title: sourceTitle,
        intake_text: intakeText,
        action_id: actionId,
        action_type: actionType,
        target,
        subject,
        start,
        worker_slug: worker?.slug,
        worker_name: worker?.name,
        worker_type: worker?.type,
      });
      setResult(out);
      if (out.ok) router.refresh();
    });
  };

  return (
    <section className="card" aria-labelledby="intake-heading">
      <div className="card__head">
        <div>
          <h2 id="intake-heading" style={{ fontSize: 15, margin: 0 }}>Susun rencana baru</h2>
          <p style={{ margin: "4px 0 0" }}>Isi permintaan, kirim ke server, lalu periksa hasilnya sebelum Anda putuskan.</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="card__body" style={{ display: "grid", gap: "var(--s-4)" }}>
          {fromAssistant && (
            <div className="banner" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
              <span>
                <strong>Diisi dari percakapan AI Assistant.</strong> Periksa dan sunting dulu — draf AI belum tentu
                benar, dan hanya yang Anda kirim yang dinilai validator.
              </span>
            </div>
          )}
          <div style={{ display: "grid", gap: "var(--s-4)", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="field">
              <label className="field__label" htmlFor="oa-request-id">Request ID <span className="req" aria-hidden="true">*</span></label>
              <input
                className="input" id="oa-request-id" name="request_id" style={ctrl}
                value={requestId} onChange={(e) => setRequestId(e.target.value)}
                placeholder="req-notulen-001" autoComplete="off" required minLength={4} maxLength={96}
                aria-describedby="oa-request-hint"
              />
              <p className="field__hint" id="oa-request-hint">4–96 karakter. Sama dengan sebelumnya = rencana lama dikembalikan.</p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="oa-plan-id">Plan ID <span className="req" aria-hidden="true">*</span></label>
              <input
                className="input" id="oa-plan-id" name="plan_id" style={ctrl}
                value={planId} onChange={(e) => setPlanId(e.target.value)}
                placeholder="pln-notulen-001" autoComplete="off" required maxLength={96}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="oa-source-title">Judul sumber</label>
              <input
                className="input" id="oa-source-title" name="source_title" style={ctrl}
                value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)}
                placeholder="Notulen rapat operasional" autoComplete="off" maxLength={200}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="oa-intake-text">Teks permintaan <span className="req" aria-hidden="true">*</span></label>
            <textarea
              className="textarea" id="oa-intake-text" name="intake_text" rows={5}
              style={{ minHeight: 44 }}
              value={intakeText} onChange={(e) => setIntakeText(e.target.value)}
              placeholder="Contoh: Buatkan ringkasan notulen rapat koordinasi 30 Oktober 2026 dan siapkan tindak lanjutnya."
              maxLength={8000} required aria-invalid={clientError ? "true" : undefined}
              aria-describedby="oa-intake-count oa-intake-err"
            />
            <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <span className="tiny faint" id="oa-intake-count">{intakeText.length} / 8000</span>
              <span className="tiny faint">Minimal 20 karakter</span>
            </div>
            {clientError && (
              <p className="field__error" id="oa-intake-err" role="alert">
                <span className="material-symbols-outlined" aria-hidden="true">error</span>{clientError}
              </p>
            )}
          </div>

          <fieldset style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "var(--s-4)", margin: 0 }}>
            <legend className="field__label" style={{ padding: "0 6px" }}>Satu tindakan untuk rencana ini</legend>
            <div style={{ display: "grid", gap: "var(--s-4)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div className="field">
                <label className="field__label" htmlFor="oa-action-id">Action ID <span className="req" aria-hidden="true">*</span></label>
                <input className="input" id="oa-action-id" style={ctrl} value={actionId} onChange={(e) => setActionId(e.target.value)} placeholder="act-email-budi" autoComplete="off" required maxLength={64} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="oa-action-type">Tipe tindakan <span className="req" aria-hidden="true">*</span></label>
                <select className="select" id="oa-action-type" style={ctrl} value={actionType} onChange={(e) => setActionType(e.target.value)}>
                  {ACTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.value})</option>)}
                </select>
              </div>
              {actionType === "send_email" && (
                <div className="field">
                  <label className="field__label" htmlFor="oa-target">Email tujuan <span className="req" aria-hidden="true">*</span></label>
                  <input className="input" id="oa-target" style={ctrl} type="email" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="budi@example.test" required autoComplete="off" />
                </div>
              )}
              {(actionType === "create_calendar_event" || actionType === "create_task" || actionType === "create_meeting_note") && (
                <div className="field">
                  <label className="field__label" htmlFor="oa-subject">{actionType === "create_calendar_event" ? "Judul acara" : actionType === "create_task" ? "Judul tugas" : "Judul notulen"} <span className="req" aria-hidden="true">*</span></label>
                  <input className="input" id="oa-subject" style={ctrl} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={actionType === "create_calendar_event" ? "Rapat tindak lanjut" : actionType === "create_task" ? "Kirim laporan Q4" : "Notulen rapat"} required autoComplete="off" />
                </div>
              )}
              {actionType === "send_email" && (
                <div className="field">
                  <label className="field__label" htmlFor="oa-subject">Subjek email <span className="req" aria-hidden="true">*</span></label>
                  <input className="input" id="oa-subject" style={ctrl} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Notulen rapat" required autoComplete="off" />
                </div>
              )}
              {actionType === "create_calendar_event" && (
                <div className="field">
                  <label className="field__label" htmlFor="oa-start">Waktu mulai <span className="req" aria-hidden="true">*</span></label>
                  <input className="input" id="oa-start" style={ctrl} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required />
                </div>
              )}
            </div>
            <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>Satu kiriman membawa satu tindakan. Tambah tindakan lain lewat kiriman baru dengan Plan ID yang sama tidak bisa. Pakai Plan ID baru.</p>
          </fieldset>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn--secondary" style={ctrl} onClick={() => { setRequestId(uid("req")); setPlanId(uid("pln")); setActionId(uid("act")); }}>
              <span className="material-symbols-outlined" aria-hidden="true">refresh</span>Isi ID otomatis
            </button>
            <span className="spacer" />
            <button type="submit" className="btn btn--primary" style={ctrl} disabled={pending} aria-busy={pending}>
              <span className="material-symbols-outlined" aria-hidden="true">{pending ? "hourglass_top" : "send"}</span>
              {pending ? "Mengirim…" : "Kirim rencana"}
            </button>
          </div>

          {result && result.ok && (
            <div className="banner" role="status" style={{ borderColor: "var(--success-600)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
              <span>
                Rencana <Link href={`/office-agent/${encodeURIComponent(result.plan_id)}`} className="mono">{result.plan_id}</Link> tersimpan (status: {result.status}).
                Buka detail untuk memeriksa tindakan dan temuan sebelum Anda putuskan.
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
