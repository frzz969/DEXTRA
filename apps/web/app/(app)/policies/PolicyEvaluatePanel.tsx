"use client";

import { useState, useTransition } from "react";
import { evaluatePolicy, type EvaluateResult } from "./actions";

export default function PolicyEvaluatePanel() {
  const [actionType, setActionType] = useState("");
  const [recipientCount, setRecipientCount] = useState(1);
  const [bulkThreshold, setBulkThreshold] = useState(25);
  const [isHoliday, setIsHoliday] = useState(false);
  const [containsInjection, setContainsInjection] = useState(false);
  const [policySlug, setPolicySlug] = useState("");
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className="card" aria-labelledby="evaluate-title" style={{ marginTop: "var(--s-5)" }}>
      <h2 id="evaluate-title" style={{ marginTop: 0 }}>Evaluasi Policy</h2>
      <p className="field__hint" style={{ marginTop: 0 }}>
        Uji aturan tanpa mengubah apa pun. Hasilnya dicatat backend.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setResult(null);
          startTransition(async () => {
            const res = await evaluatePolicy({
              action_type: actionType,
              recipient_count: recipientCount,
              bulk_threshold: bulkThreshold,
              is_holiday: isHoliday,
              contains_injection: containsInjection,
              policy_slug: policySlug,
            });
            setResult(res);
          });
        }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
      >
        <div className="grid grid--3">
          <div className="field">
            <label className="field__label" htmlFor="action_type">Tipe aksi <span className="req">*</span></label>
            <input id="action_type" className="input" required value={actionType} onChange={(e) => setActionType(e.target.value)} placeholder="send.message" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="recipient_count">Jumlah penerima</label>
            <input id="recipient_count" className="input" type="number" min={1} value={recipientCount} onChange={(e) => setRecipientCount(Number(e.target.value) || 1)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bulk_threshold">Batas bulk</label>
            <input id="bulk_threshold" className="input" type="number" min={1} value={bulkThreshold} onChange={(e) => setBulkThreshold(Number(e.target.value) || 25)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="policy_slug">Slug policy (opsional)</label>
            <input id="policy_slug" className="input mono" value={policySlug} onChange={(e) => setPolicySlug(e.target.value)} placeholder="recipient-scope" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="is_holiday">Hari libur</label>
            <select id="is_holiday" className="input" value={isHoliday ? "ya" : "tidak"} onChange={(e) => setIsHoliday(e.target.value === "ya")}>
              <option value="tidak">Tidak</option>
              <option value="ya">Ya</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="contains_injection">Ada injeksi</label>
            <select id="contains_injection" className="input" value={containsInjection ? "ya" : "tidak"} onChange={(e) => setContainsInjection(e.target.value === "ya")}>
              <option value="tidak">Tidak</option>
              <option value="ya">Ya</option>
            </select>
          </div>
        </div>
        <div>
          <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }} disabled={pending}>
            <span className="material-symbols-outlined" aria-hidden="true">{pending ? "hourglass_top" : "fact_check"}</span>
            {pending ? "Evaluasi…" : "Evaluasi"}
          </button>
        </div>
      </form>

      {pending && (
        <div className="banner" role="status" style={{ marginTop: "var(--s-3)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">hourglass_top</span>
          <span>Menunggu respons API…</span>
        </div>
      )}

      {result?.ok && (
        <div className="banner" role="status" style={{ marginTop: "var(--s-3)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">verified</span>
          <span>
            Keputusan: <strong>{result.decision}</strong> · Kode: <span className="mono">{result.reason_code}</span>
            {result.detail ? ` — ${result.detail}` : ""}
          </span>
        </div>
      )}
      {result && !result.ok && (
        <div className="banner banner--danger" role="alert" style={{ marginTop: "var(--s-3)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Gagal evaluasi.</strong> {result.error}</span>
        </div>
      )}
    </section>
  );
}
