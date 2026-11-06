"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createServiceAccountAction,
  createTokenAction,
  revokeServiceAccountAction,
  revokeTokenAction,
  rotateTokenAction,
} from "./actions";

/* Pemisahan client/server: nilai secret yang dikembalikan server action
 * hanya hidup di state komponen ini. Tidak ditulis ke localStorage,
 * tidak dikirim ke mana pun. Reload halaman = secret hilang. */

type SecretNotice = { secret: string; note: string; id: string } | null;

function SecretBox({ notice, onClose }: { notice: NonNullable<SecretNotice>; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="banner banner--warning" role="alert" style={{ marginTop: "var(--s-3)" }}>
      <span className="material-symbols-outlined" aria-hidden="true">key</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <strong>Token baru diterbitkan (ID {notice.id}).</strong> {notice.note}
        <span className="mono" style={{ display: "block", marginTop: 6, whiteSpace: "normal", overflowWrap: "anywhere" }}>
          {notice.secret}
        </span>
      </span>
      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ minHeight: 44 }}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(notice.secret);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
          {copied ? "Tersalin" : "Salin"}
        </button>
        <button type="button" className="btn btn--ghost btn--sm" style={{ minHeight: 44 }} onClick={onClose}>
          Tutup
        </button>
      </span>
    </div>
  );
}

function parseScopes(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CreateTokenForm({ serviceAccounts }: { serviceAccounts: { id: string; name: string }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SecretNotice>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card card--pad" style={{ marginTop: "var(--s-4)" }}>
      <h3 style={{ fontSize: 14 }}>Buat token</h3>
      <p className="field__hint" style={{ marginTop: 4 }}>
        Butuh sesi login manusia. Scope ditulis koma, contoh <code className="mono">view_all, view_audit</code>.
        Secret hanya tampil sekali di bawah.
      </p>
      <form
        style={{ display: "grid", gap: "var(--s-3)", marginTop: "var(--s-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const name = String(data.get("name") ?? "");
          const scopes = parseScopes(String(data.get("scopes") ?? ""));
          const serviceAccountId = String(data.get("service_account_id") ?? "");
          const expiresRaw = String(data.get("expires_in_days") ?? "").trim();
          const expiresInDays = expiresRaw ? Number(expiresRaw) : undefined;
          setError(null);
          setNotice(null);
          startTransition(async () => {
            const result = await createTokenAction({ name, scopes, serviceAccountId, expiresInDays });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setNotice({ secret: result.data.secret, note: result.data.note, id: result.data.id });
            event.currentTarget.reset();
            router.refresh();
          });
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="token-name">
            Nama token <span className="req" aria-hidden="true">*</span>
          </label>
          <input className="input" id="token-name" name="name" required maxLength={120} autoComplete="off" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="token-scopes">
            Scopes (koma) <span className="req" aria-hidden="true">*</span>
          </label>
          <input
            className="input"
            id="token-scopes"
            name="scopes"
            required
            autoComplete="off"
            placeholder="view_all, view_audit"
            aria-describedby="token-scopes-hint"
          />
          <span className="field__hint" id="token-scopes-hint">
            Scope tidak boleh melebihi capability pemilik. Server menolak yang lebih luas (422).
          </span>
        </div>
        {serviceAccounts.length > 0 && (
          <div className="field">
            <label className="field__label" htmlFor="token-service-account">
              Service account (opsional)
            </label>
            <select className="select" id="token-service-account" name="service_account_id" defaultValue="">
              <option value="">Token milik saya</option>
              {serviceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <span className="field__hint">
              Token milik service account menuntut capability manage_integrations.
            </span>
          </div>
        )}
        <div className="field">
          <label className="field__label" htmlFor="token-expires">
            Kadaluwarsa (hari, 1–365)
          </label>
          <input className="input" id="token-expires" name="expires_in_days" inputMode="numeric" type="number" min={1} max={365} />
        </div>
        {error && (
          <span className="field__error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            {error}
          </span>
        )}
        <div>
          <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }} disabled={pending} aria-busy={pending}>
            {pending ? "Membuat…" : "Buat token"}
          </button>
        </div>
      </form>
      {notice && <SecretBox notice={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}

export function TokenRowActions({ tokenId, status }: { tokenId: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<SecretNotice>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) return <span className="badge badge--outline">dicabut</span>;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ minHeight: 44 }}
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              setError(null);
              const result = await rotateTokenAction(tokenId);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setNotice({ secret: result.data.secret, note: result.data.note, id: result.data.id });
              router.refresh();
            });
          }}
        >
          {pending ? "Memutar…" : "Putar"}
        </button>
        {status === "active" && (
          <button
            type="button"
            className="btn btn--danger btn--sm"
            style={{ minHeight: 44 }}
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Alasan pencabutan (opsional):", "") ?? "";
              startTransition(async () => {
                setError(null);
                const result = await revokeTokenAction(tokenId, reason);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setDone(true);
                router.refresh();
              });
            }}
          >
            Cabut
          </button>
        )}
      </span>
      {error && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {error}
        </span>
      )}
      {notice && <SecretBox notice={notice} onClose={() => setNotice(null)} />}
    </span>
  );
}

export function CreateServiceAccountForm({ kinds }: { kinds: string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card card--pad" style={{ marginTop: "var(--s-4)" }}>
      <h3 style={{ fontSize: 14 }}>Buat service account</h3>
      <p className="field__hint" style={{ marginTop: 4 }}>
        Identitas mesin, bukan akun manusia. Butuh sesi dan capability manage_integrations.
        Kredensialnya diterbitkan lewat form token di atas.
      </p>
      <form
        style={{ display: "grid", gap: "var(--s-3)", marginTop: "var(--s-3)" }}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setError(null);
          setDone(null);
          startTransition(async () => {
            const result = await createServiceAccountAction({
              name: String(data.get("name") ?? ""),
              kind: String(data.get("kind") ?? ""),
              description: String(data.get("description") ?? ""),
              scopes: parseScopes(String(data.get("scopes") ?? "")),
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDone(result.data.id);
            event.currentTarget.reset();
            router.refresh();
          });
        }}
      >
        <div className="field">
          <label className="field__label" htmlFor="sa-name">
            Nama <span className="req" aria-hidden="true">*</span>
          </label>
          <input className="input" id="sa-name" name="name" required maxLength={120} autoComplete="off" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="sa-kind">
            Kind <span className="req" aria-hidden="true">*</span>
          </label>
          <select className="select" id="sa-kind" name="kind" required defaultValue="">
            <option value="" disabled>
              Pilih kind
            </option>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="sa-scopes">
            Scopes (koma) <span className="req" aria-hidden="true">*</span>
          </label>
          <input className="input" id="sa-scopes" name="scopes" required autoComplete="off" placeholder="view_all" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="sa-description">
            Deskripsi
          </label>
          <textarea className="textarea" id="sa-description" name="description" maxLength={500} />
        </div>
        {error && (
          <span className="field__error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            {error}
          </span>
        )}
        {done && (
          <span className="banner banner--success" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">check_circle</span>
            <span>Service account {done} dibuat.</span>
          </span>
        )}
        <div>
          <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }} disabled={pending} aria-busy={pending}>
            {pending ? "Membuat…" : "Buat"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ServiceAccountRevokeButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) return <span className="badge badge--outline">dicabut</span>;

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button
        type="button"
        className="btn btn--danger btn--sm"
        style={{ minHeight: 44 }}
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("Alasan pencabutan (opsional):", "") ?? "";
          startTransition(async () => {
            setError(null);
            const result = await revokeServiceAccountAction(accountId, reason);
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
