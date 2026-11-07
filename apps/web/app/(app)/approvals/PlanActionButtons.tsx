"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approvePlanAction } from "./actions";

export default function PlanActionButtons({
  planId,
  actionId,
}: {
  planId: string;
  actionId: string;
}) {
  const [open, setOpen] = useState<"approved" | "rejected" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (done) {
    return <span className="badge badge--success" role="status">{done}</span>;
  }

  if (!open) {
    return (
      <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          style={{ minHeight: 44 }}
          onClick={() => setOpen("approved")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">check</span>
          Setujui
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ minHeight: 44 }}
          onClick={() => setOpen("rejected")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
          Tolak
        </button>
      </span>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!reason.trim()) {
          setError("Alasan wajib diisi.");
          return;
        }
        setError(null);
        startTransition(async () => {
          const result = await approvePlanAction(planId, actionId, open, reason.trim());
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setDone(open === "approved" ? "disetujui" : "ditolak");
          router.refresh();
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 260 }}
    >
      <label className="field__label" htmlFor={`reason-${planId}-${actionId}`}>
        Alasan ({open === "approved" ? "setujui" : "tolak"}) <span className="req">*</span>
      </label>
      <input
        id={`reason-${planId}-${actionId}`}
        className="input"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Alasan untuk jejak audit…"
      />
      {error && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {error}
        </span>
      )}
      <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="submit"
          className={open === "approved" ? "btn btn--primary btn--sm" : "btn btn--danger btn--sm"}
          style={{ minHeight: 44 }}
          disabled={pending}
        >
          {pending ? "Mengirim…" : "Konfirmasi"}
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ minHeight: 44 }}
          onClick={() => setOpen(null)}
        >
          Batal
        </button>
      </span>
    </form>
  );
}
