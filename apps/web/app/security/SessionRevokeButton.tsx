"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeSession } from "./actions";

export default function SessionRevokeButton({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) return <span className="badge badge--outline">dicabut</span>;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className="btn btn--danger btn--sm"
        style={{ minHeight: 44 }}
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Cabut sesi ini?")) return;
          startTransition(async () => {
            const result = await revokeSession(sessionId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDone(true);
            router.refresh();
          });
        }}
      >
        {pending ? "Mencabut…" : "Cabut"}
      </button>
      {error && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {error}
        </span>
      )}
    </span>
  );
}
