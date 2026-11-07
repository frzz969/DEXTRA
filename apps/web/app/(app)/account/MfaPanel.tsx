"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activateMfa, disableMfa, enrollMfa } from "./actions";

/**
 * MFA (acuan apps/dashboard/assets/js/views/account.js:262-272).
 *
 * Perbedaan dengan acuan, dan alasannya:
 *
 * - Acuan menampilkan status "Terverifikasi (DEMO)" dari fixture. Di sini status
 *   datang dari `GET /api/v1/auth/session` (`mfa_enabled`), dan hanya tersedia
 *   bila pemanggil memakai sesi pengguna.
 * - Acuan punya tombol "Daftarkan ulang". `POST /auth/mfa/enroll` menjawab 409
 *   "MFA sudah aktif" selama MFA aktif (auth/router.py:507-508), jadi tombol itu
 *   tidak dibuat; jalurnya adalah nonaktifkan lalu daftar lagi — dan itu
 *   ditulis di kartu, bukan disembunyikan.
 * - Tanggal pendaftaran tidak dikembalikan `/auth/session`, jadi tidak
 *   ditampilkan (acuan menampilkannya dari fixture).
 * - Secret TOTP yang tampil di sini berasal dari server saat pendaftaran dan
 *   hanya untuk akun pemanggil sendiri. Ia tidak pernah dicetak ulang setelah
 *   pendaftaran selesai.
 */

type Message = { tone: "success" | "danger" | "info"; text: string };

export default function MfaPanel({ mfaEnabled, email }: { mfaEnabled: boolean | null; email: string | null }) {
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauth_uri: string; note: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function startEnroll() {
    setMessage(null);
    startTransition(async () => {
      const result = await enrollMfa();
      if (!result.ok) {
        setMessage({ tone: "danger", text: result.error });
        return;
      }
      setEnrollment({ secret: result.secret, otpauth_uri: result.otpauth_uri, note: result.note });
      setMessage({ tone: "info", text: result.note || "Secret diterbitkan. Aktifkan dengan kode 6 digit." });
    });
  }

  function submitActivate() {
    setMessage(null);
    startTransition(async () => {
      const result = await activateMfa(code);
      if (!result.ok) {
        setMessage({ tone: "danger", text: result.error });
        return;
      }
      setEnrollment(null);
      setCode("");
      setMessage({
        tone: "success",
        text: result.sessionRotated
          ? "MFA aktif. Server merotasi sesi dan cookie baru sudah disimpan."
          : "MFA aktif. Server merotasi sesi — bila halaman ini menolak permintaan berikutnya, masuk ulang lewat /login."
      });
      router.refresh();
    });
  }

  function submitDisable() {
    setMessage(null);
    startTransition(async () => {
      const result = await disableMfa(password, code);
      if (!result.ok) {
        setMessage({ tone: "danger", text: result.error });
        return;
      }
      setPassword("");
      setCode("");
      setMessage({ tone: "success", text: "MFA dinonaktifkan. Password dan kode TOTP sudah diverifikasi server." });
      router.refresh();
    });
  }

  if (mfaEnabled === null) {
    return (
      <div className="banner banner--warning" role="status">
        <span className="material-symbols-outlined" aria-hidden="true">
          help
        </span>
        <span>
          <strong>Status MFA tidak tersedia.</strong> <code className="mono">GET /api/v1/auth/session</code> hanya
          mengembalikan <code className="mono">mfa_enabled</code> untuk pemanggil bersesi pengguna, dan pemanggil ini
          tidak. Status tidak dikarang dari asumsi.
        </span>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ color: mfaEnabled ? "var(--success-600)" : "var(--warning-600)" }}
        >
          {mfaEnabled ? "verified_user" : "gpp_maybe"}
        </span>
        <span>
          <strong>{mfaEnabled ? "MFA aktif" : "MFA belum aktif"}</strong>
          {email ? ` — ${email}` : ""}. Metode: TOTP (aplikasi authenticator). Status dibaca dari{" "}
          <code className="mono">GET /api/v1/auth/session</code>.
        </span>
      </div>

      <div className="banner banner--info" role="note">
        <span className="material-symbols-outlined" aria-hidden="true">
          info
        </span>
        <span>
          Secret hanya ditampilkan sekali saat pendaftaran dan tidak pernah dicetak ulang di halaman ini. Pendaftaran
          ulang selama MFA aktif ditolak server (409), jadi jalurnya: nonaktifkan, lalu daftar lagi.
        </span>
      </div>

      {message ? (
        <div
          className={`banner ${message.tone === "success" ? "banner--success" : message.tone === "danger" ? "banner--danger" : "banner--info"}`}
          role={message.tone === "danger" ? "alert" : "status"}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {message.tone === "success" ? "check_circle" : message.tone === "danger" ? "error" : "info"}
          </span>
          <span>{message.text}</span>
        </div>
      ) : null}

      {mfaEnabled ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row row--wrap" style={{ gap: 10, alignItems: "flex-end" }}>
            <label className="field" htmlFor="mfa-disable-password" style={{ minWidth: 220, flex: "1 1 220px" }}>
              <span className="field__label">Password</span>
              <input
                id="mfa-disable-password"
                type="password"
                className="input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={pending}
                style={{ minHeight: 44 }}
              />
            </label>
            <label className="field" htmlFor="mfa-disable-code" style={{ minWidth: 140, flex: "0 1 160px" }}>
              <span className="field__label">Kode 6 digit</span>
              <input
                id="mfa-disable-code"
                className="input mono"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                disabled={pending}
                style={{ minHeight: 44 }}
              />
            </label>
            <button
              type="button"
              className="btn btn--danger-soft"
              style={{ minHeight: 44 }}
              disabled={pending || password === "" || code.trim() === ""}
              onClick={submitDisable}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {pending ? "hourglass_top" : "gpp_bad"}
              </span>
              {pending ? "Menonaktifkan…" : "Nonaktifkan MFA"}
            </button>
          </div>
          <p className="field__hint">
            Server menuntut dua faktor sekaligus untuk mematikan MFA: password <em>dan</em> kode TOTP
            (<code className="mono">DisableMfaRequest</code>).
          </p>
        </div>
      ) : enrollment ? (
        <div className="stack" style={{ gap: 10 }}>
          <div className="field">
            <span className="field__label">Secret TOTP (dari server, tampil sekali)</span>
            <div className="mono mono--wrap" style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface-2)" }}>
              {enrollment.secret}
            </div>
          </div>
          <div className="field">
            <span className="field__label">URI otpauth</span>
            <div className="mono mono--wrap" style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface-2)" }}>
              {enrollment.otpauth_uri}
            </div>
            <span className="field__hint">
              Salin ke aplikasi authenticator, lalu masukkan kode yang muncul untuk mengaktifkan.
            </span>
          </div>
          <div className="row row--wrap" style={{ gap: 10, alignItems: "flex-end" }}>
            <label className="field" htmlFor="mfa-activate-code" style={{ minWidth: 160, flex: "0 1 200px" }}>
              <span className="field__label">Kode 6 digit</span>
              <input
                id="mfa-activate-code"
                className="input mono"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                disabled={pending}
                style={{ minHeight: 44 }}
              />
            </label>
            <button
              type="button"
              className="btn btn--primary"
              style={{ minHeight: 44 }}
              disabled={pending || code.trim() === ""}
              onClick={submitActivate}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {pending ? "hourglass_top" : "verified_user"}
              </span>
              {pending ? "Mengaktifkan…" : "Aktifkan MFA"}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              style={{ minHeight: 44 }}
              disabled={pending}
              onClick={() => {
                setEnrollment(null);
                setCode("");
                setMessage(null);
              }}
            >
              Batal
            </button>
          </div>
        </div>
      ) : (
        <div className="row row--wrap" style={{ gap: 10 }}>
          <button type="button" className="btn btn--primary" style={{ minHeight: 44 }} disabled={pending} onClick={startEnroll}>
            <span className="material-symbols-outlined" aria-hidden="true">
              {pending ? "hourglass_top" : "qr_code_2"}
            </span>
            {pending ? "Meminta secret…" : "Daftarkan MFA"}
          </button>
          <span className="field__hint" style={{ flex: 1, minWidth: 220 }}>
            Memanggil <code className="mono">POST /api/v1/auth/mfa/enroll</code>. MFA baru dianggap aktif setelah kode
            pertama diverifikasi.
          </span>
        </div>
      )}
    </div>
  );
}
