"use client";

import { useActionState } from "react";
import { signIn, verifyMfa, type AuthFormState } from "./actions";

const initialState: AuthFormState = {};

export default function LoginForm() {
  const [state, signInAction, signingIn] = useActionState(signIn, initialState);
  const [mfaState, verifyAction, verifying] = useActionState(verifyMfa, state.mfa ? state : initialState);

  if (state.mfa || mfaState.mfa) {
    const current = mfaState.mfa ? mfaState : state;
    const pending = verifying;
    return (
      <form action={verifyAction} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
        <input type="hidden" name="email" value={current.email ?? ""} />
        <div className="banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">phonelink_lock</span>
          <span>Akun ini mengharuskan <strong>MFA</strong>. Masukkan kode 6 digit dari aplikasi authenticator Anda.</span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="mfa-code">Kode authenticator</label>
          <input
            className="input mono"
            id="mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6,10}"
            maxLength={10}
            required
            autoFocus
            placeholder="______"
          />
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={pending}>
          <span className="material-symbols-outlined" aria-hidden="true">{pending ? "hourglass_top" : "verified_user"}</span>
          {pending ? "Memverifikasi…" : "Verifikasi & masuk"}
        </button>
        {current.error && (
          <div className="field__error" role="alert">
            <span className="material-symbols-outlined" aria-hidden="true">error</span>
            {current.error}
          </div>
        )}
      </form>
    );
  }

  return (
    <form action={signInAction} style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div className="field">
        <label className="field__label" htmlFor="login-email">Email</label>
        <input
          className="input"
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.email ?? ""}
          placeholder="nama@perusahaan.co.id"
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="login-password">Password</label>
        <input
          className="input"
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••••••"
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="login-tenant">
          Tenant <span className="faint">(opsional)</span>
        </label>
        <input
          className="input mono"
          id="login-tenant"
          name="tenant"
          autoComplete="organization"
          placeholder="dextra-demo"
        />
        <p className="field__hint">Kosongkan untuk memakai tenant default Anda.</p>
      </div>
      <button className="btn btn--primary btn--block" type="submit" disabled={signingIn}>
        <span className="material-symbols-outlined" aria-hidden="true">{signingIn ? "hourglass_top" : "login"}</span>
        {signingIn ? "Masuk…" : "Masuk"}
      </button>
      {state.error && (
        <div className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {state.error}
        </div>
      )}
      <p className="field__hint" style={{ textAlign: "center", marginTop: 4 }}>
        Lupa kata sandi? Hubungi administrator tenant Anda — tidak ada reset mandiri di aplikasi ini.
      </p>
    </form>
  );
}
