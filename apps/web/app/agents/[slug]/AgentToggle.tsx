"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAgentEnabled, type AgentToggleResult } from "./actions";

export default function AgentToggle({
  slug,
  isEnabled
}: {
  slug: string;
  isEnabled: boolean;
}) {
  const [result, setResult] = useState<AgentToggleResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (result?.ok) {
    return (
      <span className="badge badge--success" role="status">
        {result.is_enabled ? "Diaktifkan" : "Dinonaktifkan"}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className={`btn ${isEnabled ? "btn--danger-soft" : "btn--primary"}`}
        style={{ minHeight: 44 }}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const out = await setAgentEnabled(slug, !isEnabled);
            setResult(out);
            if (out.ok) router.refresh();
          })
        }
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {isEnabled ? "pause_circle" : "play_circle"}
        </span>
        {pending ? "Mengirim…" : isEnabled ? "Nonaktifkan" : "Aktifkan"}
      </button>
      {result && !result.ok && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          {result.error}
        </span>
      )}
    </div>
  );
}
