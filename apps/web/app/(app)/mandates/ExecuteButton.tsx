"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { executeMandate } from "./actions";

export default function ExecuteButton({
  mandateId,
  actionId,
  actionType,
  params,
}: {
  mandateId: string;
  actionId: string;
  actionType: string;
  params: Record<string, unknown>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return (
      <span role="status" className="cell-sub">
        dieksekusi: <span className="mono">{done}</span> ·{" "}
        <Link href="/executions">lihat</Link>
      </span>
    );
  }

  if (!confirm) {
    return (
      <button type="button" className="btn btn--primary btn--sm" onClick={() => setConfirm(true)}>
        <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
        Eksekusi
      </button>
    );
  }

  return (
    <form
      className="field"
      style={{ margin: 0, minWidth: 220 }}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await executeMandate({ mandate_id: mandateId, action_id: actionId, action_type: actionType, params });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(result.execution_id);
          router.refresh();
        });
      }}
    >
      <p className="field__hint" style={{ margin: 0 }}>
        Jalankan <span className="mono">{actionType}</span> dengan mandate ini? Mandat sekali-pakai.
      </p>
      {error && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {error}
        </span>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={pending}>
          {pending ? "Mengeksekusi…" : "Konfirmasi eksekusi"}
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setConfirm(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
