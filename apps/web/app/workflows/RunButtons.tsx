"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startRun, resumeRun, type RunActionResult } from "./actions";

export function StartRunButton({ workflowId }: { workflowId: string }) {
  const [result, setResult] = useState<RunActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (result?.ok) {
    return (
      <span className="badge badge--success" role="status">
        Run {result.id} · {result.status}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        style={{ minHeight: 44 }}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const out = await startRun(workflowId);
            setResult(out);
            if (out.ok) router.refresh();
          })
        }
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          play_circle
        </span>
        {pending ? "Mengirim…" : "Jalankan"}
      </button>
      {result && !result.ok && (
        <span className="field__error" role="alert">
          {result.error}
        </span>
      )}
    </span>
  );
}

export function ResumeRunButton({ runId }: { runId: string }) {
  const [result, setResult] = useState<RunActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (result?.ok) {
    return (
      <span className="badge badge--success" role="status">
        Lanjut · {result.status}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn btn--secondary btn--sm"
        style={{ minHeight: 44 }}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const out = await resumeRun(runId);
            setResult(out);
            if (out.ok) router.refresh();
          })
        }
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          play_arrow
        </span>
        {pending ? "Mengirim…" : "Lanjutkan"}
      </button>
      {result && !result.ok && (
        <span className="field__error" role="alert">
          {result.error}
        </span>
      )}
    </span>
  );
}
