"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveGate, type GateResult } from "./actions";

export default function GateButton({ runId, stepId }: { runId: string; stepId: string }) {
  const [note, setNote] = useState("");
  const [result, setResult] = useState<GateResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (result?.ok) {
    return <span className="badge badge--success">gate disetujui</span>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        className="input"
        style={{ maxWidth: 160 }}
        placeholder="Catatan (opsional)…"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-label={`Catatan persetujuan gate ${stepId}`}
      />
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const out = await approveGate(runId, stepId, note);
            setResult(out);
            if (out.ok) router.refresh();
          })
        }
      >
        <span className="material-symbols-outlined" aria-hidden="true">check</span>
        {pending ? "Mengirim…" : "Setujui"}
      </button>
      {result && !result.ok && (
        <span className="field__error" role="alert">{result.error}</span>
      )}
    </div>
  );
}
