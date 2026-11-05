"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeMandate } from "./actions";

export default function RevokeButton({ mandateId }: { mandateId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return <span className="badge badge--outline">dicabut</span>;
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--danger btn--sm" onClick={() => setOpen(true)}>
        <span className="material-symbols-outlined" aria-hidden="true">block</span>
        Cabut
      </button>
    );
  }

  return (
    <form
      className="field"
      style={{ margin: 0, minWidth: 260 }}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await revokeMandate(mandateId, reason.trim());
          if (!result.ok) {
            setError(result.error ?? "Gagal mencabut mandat.");
            return;
          }
          setDone(true);
          router.refresh();
        });
      }}
    >
      <label className="field__label" htmlFor={`revoke-${mandateId}`}>
        Alasan cabut <span className="req">*</span>
      </label>
      <textarea
        id={`revoke-${mandateId}`}
        className="textarea"
        required
        rows={2}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Alasan pencabutan, untuk jejak audit…"
      />
      {error && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {error}
        </span>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button type="submit" className="btn btn--danger btn--sm" disabled={pending || !reason.trim()}>
          {pending ? "Mencabut…" : "Konfirmasi cabut"}
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpen(false)}>
          Batal
        </button>
      </div>
    </form>
  );
}
