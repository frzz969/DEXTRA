"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeOtherSessions, revokeOwnSession } from "./actions";

/**
 * Pencabutan sesi (acuan apps/dashboard/assets/js/views/account.js:210-261).
 *
 * Sesi yang sedang dipakai tidak ditawari tombol cabut: mencabutnya di server
 * membuat cookie di peramban langsung tidak sah, dan setiap halaman berikutnya
 * gagal tanpa penjelasan. Untuk keluar, tombol Keluar di atas sudah ada.
 */

export function RevokeButton({ sessionId, isCurrent }: { sessionId: string; isCurrent: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (isCurrent) {
    return (
      <span className="cell-sub" title="Sesi ini dipakai untuk permintaan halaman. Keluar lewat tombol Keluar.">
        sesi ini
      </span>
    );
  }

  if (done) return <span className="badge badge--outline">dicabut</span>;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className="btn btn--danger-soft btn--sm"
        style={{ minHeight: 44 }}
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Cabut sesi ini? Perangkat itu harus masuk ulang.")) return;
          startTransition(async () => {
            const result = await revokeOwnSession(sessionId);
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
      {error ? (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          {error}
        </span>
      ) : null}
    </span>
  );
}

export function RevokeOthersButton({ ids }: { ids: string[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const disabled = ids.length === 0 || pending;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <button
        type="button"
        className="btn btn--danger-soft"
        style={{ minHeight: 44 }}
        disabled={disabled}
        aria-disabled={disabled}
        title={ids.length === 0 ? "Tidak ada sesi lain yang bisa dicabut." : undefined}
        onClick={() => {
          if (disabled) return;
          if (!window.confirm(`Cabut ${ids.length} sesi lain? Setiap perangkat harus masuk ulang.`)) return;
          setMessage(null);
          setError(null);
          startTransition(async () => {
            const result = await revokeOtherSessions(ids);
            if (result.failed.length > 0) {
              setError(
                `${result.revoked} sesi dicabut, ${result.failed.length} gagal: ` +
                  result.failed.map((item) => `${item.id.slice(0, 8)}… (${item.error})`).join(" · ")
              );
            } else {
              setMessage(`${result.revoked} sesi dicabut.`);
            }
            router.refresh();
          });
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {pending ? "hourglass_top" : "no_accounts"}
        </span>
        {pending ? "Mencabut…" : `Cabut semua sesi lain${ids.length > 0 ? ` (${ids.length})` : ""}`}
      </button>
      {message ? (
        <span className="field__hint" role="status">
          {message}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          {error}
        </span>
      ) : null}
    </span>
  );
}
