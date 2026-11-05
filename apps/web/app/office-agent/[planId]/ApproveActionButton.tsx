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
      const out = await approveOfficeAction({ plan_id: planId, action_id: actionId, decision, reason });
      setResult(out);
      if (out.ok) router.refresh();
    });
  };

  if (result?.ok) {
    return (
      <div role="status">
        <span className="badge badge--success">{result.decision}</span>
        <div className="cell-sub mono" title={result.approval_id}>approval: {result.approval_id}</div>
        {result.mandate_id && (
          <div className="cell-sub mono" title={result.mandate_id}>mandate: {result.mandate_id}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
      <input
        className="input"
        placeholder="Alasan (opsional, untuk audit)…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        aria-label={`Alasan keputusan untuk ${actionType}`}
      />
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => decide("approved")} disabled={pending}>
          <span className="material-symbols-outlined" aria-hidden="true">check</span>
          {pending ? "Mengirim…" : "Setujui"}
        </button>
        <button type="button" className="btn btn--danger btn--sm" onClick={() => decide("rejected")} disabled={pending}>
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
