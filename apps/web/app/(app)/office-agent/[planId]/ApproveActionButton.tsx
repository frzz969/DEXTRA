"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOfficeAction, type ApproveActionResult } from "../actions";

export default function ApproveActionButton({
  planId,
  actionId,
  actionType,
}: {
  planId: string;
  actionId: string;
  actionType: string;
}) {
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ApproveActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const decide = (decision: "approved" | "rejected") => {
    startTransition(async () => {
      const out = await approveOfficeAction({ plan_id: planId, action_id: actionId, decision, reason: reason.trim() });
      setResult(out);
      if (out.ok) router.refresh();
    });
  };

  if (result?.ok) {
    return (
      <div role="status">
        <span className="badge badge--success">{result.decision}</span>
        <div className="cell-sub mono" title={result.approval_id}>approval: {result.approval_id}</div>
        {result.mandate_id && <div className="cell-sub mono" title={result.mandate_id}>mandate: {result.mandate_id}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <label className="sr-only" htmlFor={`reason-${actionId}`}>Alasan keputusan untuk {actionType}</label>
      <input
        className="input"
        id={`reason-${actionId}`}
        placeholder="Alasan (opsional, untuk audit)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={pending}
        maxLength={500}
        style={{ minHeight: 44 }}
      />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" className="btn btn--primary" style={{ minHeight: 44 }} onClick={() => decide("approved")} disabled={pending} aria-busy={pending}>
          <span className="material-symbols-outlined" aria-hidden="true">check</span>
          {pending ? "Mengirim…" : "Setujui"}
        </button>
        <button type="button" className="btn btn--danger" style={{ minHeight: 44 }} onClick={() => decide("rejected")} disabled={pending}>
          <span className="material-symbols-outlined" aria-hidden="true">block</span>
          Tolak
        </button>
      </div>
      {result && !result.ok && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {result.error}
        </span>
      )}
    </div>
  );
}
