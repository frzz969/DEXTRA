"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword } from "./actions";

/**
 * Ganti kata sandi (acuan apps/dashboard/assets/js/views/account.js:273-275).
 *
 * Aturan yang ditegakkan server dan ditampilkan di sini:
 * - `ChangePasswordRequest`: new_password minimal 12 karakter
 *   (backend/dextra/modules/auth/router.py:76-78, core/passwords.py:36);
 * - password baru tidak boleh sama dengan yang lama (422);
 * - password lama diverifikasi, salah → 401;
 * - sesi lain dicabut dan sesi ini dirotasi (auth/router.py:798-826).
 *
 * Tidak ada tombol "berhasil" palsu: pesan sukses hanya muncul setelah server
 * menjawab 200.
 */

export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const mismatch = repeat !== "" && repeat !== next;
  const tooShort = next !== "" && next.length < 12;
  const disabled = pending || current === "" || next === "" || repeat === "" || mismatch || tooShort;

  function submit() {
    if (disabled) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await changePassword(current, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCurrent("");
      setNext("");
      setRepeat("");
      setSuccess(
        `Password diubah. ${result.sessionsRevoked} sesi lain dicabut. ` +
          (result.sessionRotated
            ? "Server merotasi sesi ini dan cookie baru sudah disimpan."
            : "Server merotasi sesi ini tetapi cookie baru tidak diterima — masuk ulang lewat /login bila halaman berikutnya menolak.")
      );
      router.refresh();
    });
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {error ? (
        <div className="banner banner--danger" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          <span>{error}</span>
        </div>
      ) : null}
      {success ? (
        <div className="banner banner--success" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">
            check_circle
          </span>
          <span>{success}</span>
        </div>
      ) : null}

      <div className="row row--wrap" style={{ gap: 12, alignItems: "flex-start" }}>
        <label className="field" htmlFor="pw-current" style={{ minWidth: 220, flex: "1 1 220px" }}>
          <span className="field__label">Password saat ini</span>
          <input
            id="pw-current"
            type="password"
            className="input"
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            autoComplete="current-password"
            disabled={pending}
            style={{ minHeight: 44 }}
          />
        </label>

        <label className="field" htmlFor="pw-new" style={{ minWidth: 220, flex: "1 1 220px" }}>
          <span className="field__label">Password baru</span>
          <input
            id="pw-new"
            type="password"
            className="input"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            disabled={pending}
            style={{ minHeight: 44 }}
            aria-describedby="pw-new-hint"
          />
          <span id="pw-new-hint" className="field__hint">
            Minimal 12 karakter. Tidak boleh sama dengan password lama.
          </span>
        </label>

        <label className="field" htmlFor="pw-repeat" style={{ minWidth: 220, flex: "1 1 220px" }}>
          <span className="field__label">Ulangi password baru</span>
          <input
            id="pw-repeat"
            type="password"
            className="input"
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
            autoComplete="new-password"
            disabled={pending}
            style={{ minHeight: 44 }}
          />
          {mismatch ? (
            <span className="field__error" role="alert">
              <span className="material-symbols-outlined" aria-hidden="true">
                error
              </span>
              Kedua isian belum sama.
            </span>
          ) : null}
        </label>
      </div>

      <div className="row row--wrap" style={{ gap: 10, alignItems: "center" }}>
        <button
          type="button"
          className="btn btn--primary"
          style={{ minHeight: 44 }}
          disabled={disabled}
          aria-disabled={disabled}
          onClick={submit}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {pending ? "hourglass_top" : "password"}
          </span>
          {pending ? "Menyimpan…" : "Ganti password"}
        </button>
        <span className="field__hint" style={{ flex: 1, minWidth: 220 }}>
          Memanggil <code className="mono">POST /api/v1/auth/password</code>. Server mencabut sesi lain dan merotasi
          sesi ini; keduanya tercatat di audit.
        </span>
      </div>
    </div>
  );
}
