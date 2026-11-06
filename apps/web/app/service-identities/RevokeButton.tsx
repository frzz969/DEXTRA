"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeServiceAccountAction, type RevokeResult } from "./actions";

export default function RevokeButton({ id, name, status }: { id: string; name: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<RevokeResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "revoked") {
    return <p className="field__hint" role="status">Sudah dicabut. Identitas tidak bisa dipakai lagi.</p>;
  }

  const revoke = () => {
    startTransition(async () => {
      const out = await revokeServiceAccountAction({ id, reason });
      setResult(out);
      if (out.ok) router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="field">
        <label className="field__label" htmlFor={`revoke-reason`}>Alasan pencabutan</label>
        <input
          className="input" id="revoke-reason" style={{ minHeight: 44 }}
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="mis. rotasi token" maxLength={200} disabled={pending}
        />
        <p className="field__hint">Mencabut identitas ini mencabut semua token miliknya. Tindakan ini tercatat di audit dan tidak bisa dibatalkan.</p>
      </div>
      <button type="button" className="btn btn--danger" style={{ minHeight: 44 }} onClick={revoke} disabled={pending} aria-busy={pending}>
        <span className="material-symbols-outlined" aria-hidden="true">{pending ? "hourglass_top" : "block"}</span>
        {pending ? "Mencabut…" : `Cabut ${name}`}
      </button>
      {result && result.ok && (
        <p className="banner" role="status" style={{ margin: 0 }}>
          <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
          Dicabut. {result.tokens_revoked} token ikut dicabut.
        </p>
      )}
      {result && !result.ok && (
        <p className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>{result.error}
        </p>
      )}
    </div>
  );
}
