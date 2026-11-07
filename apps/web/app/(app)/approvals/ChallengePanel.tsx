"use client";

import { useState, useTransition } from "react";
import { submitApprovalChallenge, type ApprovalActionResult } from "./actions";

type Decision = "approved" | "rejected" | "revision";

const DECISION_OPTIONS: { value: Decision; label: string; hint: string; icon: string }[] = [
  { value: "approved", label: "Setujui", hint: "Terbitkan mandat eksekusi", icon: "check_circle" },
  { value: "rejected", label: "Tolak", hint: "Hentikan rencana ini", icon: "cancel" },
  { value: "revision", label: "Minta revisi", hint: "Kembalikan untuk diperbaiki", icon: "edit_note" }
];

export default function ChallengePanel() {
  const [planId, setPlanId] = useState("");
  const [actionId, setActionId] = useState("");
  const [actionType, setActionType] = useState("");
  const [paramsText, setParamsText] = useState("{}");
  const [planHash, setPlanHash] = useState("");
  const [decision, setDecision] = useState<Decision>("approved");
  const [reason, setReason] = useState("");
  const [ttlMinutes, setTtlMinutes] = useState(60);
  const [paramsError, setParamsError] = useState<string | null>(null);
  const [result, setResult] = useState<ApprovalActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const awaiting = pending;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    let params: Record<string, unknown>;
    try {
      const parsed = JSON.parse(paramsText || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("params harus berupa objek JSON");
      }
      params = parsed as Record<string, unknown>;
      setParamsError(null);
    } catch (error) {
      setParamsError(error instanceof Error ? error.message : "JSON tidak valid");
      return;
    }
    startTransition(async () => {
      const res = await submitApprovalChallenge({
        plan_id: planId.trim(),
        action_id: actionId.trim(),
        action_type: actionType.trim(),
        params,
        plan_hash: planHash.trim(),
        decision,
        reason: reason.trim(),
        ttl_minutes: ttlMinutes
      });
      setResult(res);
    });
  }

  return (
    <section className="card" aria-labelledby="challenge-title">
      <h2 id="challenge-title" style={{ marginTop: 0 }}>Challenge Persetujuan</h2>
      <p className="field__hint" style={{ marginTop: 0 }}>
        Tinjau rencana, lalu tetapkan keputusan. Keputusan "Setujui" menerbitkan mandat eksekusi.
      </p>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
        <div className="grid grid--4">
          <div className="field">
            <label className="field__label" htmlFor="plan_id">Plan ID <span className="req">*</span></label>
            <input id="plan_id" className="input mono" required value={planId} onChange={(e) => setPlanId(e.target.value)} placeholder="plan_…" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="action_id">Action ID <span className="req">*</span></label>
            <input id="action_id" className="input mono" required value={actionId} onChange={(e) => setActionId(e.target.value)} placeholder="act_…" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="action_type">Tipe Aksi <span className="req">*</span></label>
            <input id="action_type" className="input" required value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="deploy.production" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ttl_minutes">TTL Mandat (menit)</label>
            <input id="ttl_minutes" className="input" type="number" min={1} value={ttlMinutes} onChange={(e) => setTtlMinutes(Number(e.target.value) || 1)} />
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="plan_hash">Plan Hash <span className="req">*</span></label>
          <input id="plan_hash" className="input mono" required value={planHash} onChange={(e) => setPlanHash(e.target.value)} placeholder="sha256…" />
        </div>

        <div className={`field${paramsError ? " field--error" : ""}`}>
          <label className="field__label" htmlFor="params">Params (JSON)</label>
          <textarea id="params" className="textarea mono" value={paramsText} onChange={(e) => setParamsText(e.target.value)} spellCheck={false} />
          {paramsError && (
            <span className="field__error"><span className="material-symbols-outlined" aria-hidden="true">error</span>{paramsError}</span>
          )}
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label">Keputusan <span className="req">*</span></legend>
          <div className="btn-group" role="radiogroup" aria-label="Keputusan">
            {DECISION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`btn ${decision === opt.value ? "btn--primary" : "btn--secondary"}`}
                style={{ cursor: "pointer" }}
                title={opt.hint}
              >
                <input
                  type="radio"
                  name="decision"
                  value={opt.value}
                  checked={decision === opt.value}
                  onChange={() => setDecision(opt.value)}
                  style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                />
                <span className="material-symbols-outlined" aria-hidden="true">{opt.icon}</span>
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor="reason">Alasan <span className="req">*</span></label>
          <textarea id="reason" className="textarea" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan keputusan, untuk jejak audit…" />
        </div>

        <div>
          <button type="submit" className="btn btn--primary btn--lg" disabled={awaiting}>
            <span className="material-symbols-outlined" aria-hidden="true">{awaiting ? "hourglass_top" : "send"}</span>
            {awaiting ? "Mengirim…" : "Kirim Keputusan"}
          </button>
        </div>
      </form>

      {awaiting && (
        <div className="banner" role="status" style={{ marginTop: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">hourglass_top</span>
          <span>Menunggu respons API…</span>
        </div>
      )}

      {result?.ok && (
        <div className="banner banner--success" role="status" style={{ marginTop: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">verified</span>
          <span>
            Keputusan <strong>{result.decision}</strong> tercatat (id: <span className="mono">{result.id}</span>).
            {result.decision === "approved" && result.mandate_id && (
              <> Mandat terbit: <span className="mono">{result.mandate_id}</span>.</>
            )}
          </span>
        </div>
      )}

      {result && !result.ok && (
        <div className="banner banner--danger" role="alert" style={{ marginTop: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Gagal mengirim.</strong> {result.error}
            {result.status === 409 && " (konflik mandat — periksa status mandat aktif)."}
          </span>
        </div>
      )}
    </section>
  );
}
