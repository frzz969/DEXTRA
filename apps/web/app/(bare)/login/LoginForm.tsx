"use client";

import { useActionState } from "react";
import { signIn, verifyMfa, type AuthFormState } from "@/lib/auth-actions";
import { useT } from "@/lib/i18n/client";

const initialState: AuthFormState = {};

export default function LoginForm() {
  const t = useT();
  const [state, signInAction, signingIn] = useActionState(signIn, initialState);
  const [mfaState, verifyAction, verifying] = useActionState(verifyMfa, state.mfa ? state : initialState);

  if (state.mfa || mfaState.mfa) {
    const current = mfaState.mfa ? mfaState : state;
    const pending = verifying;
    return (
      <form action={verifyAction}>
        <input type="hidden" name="email" value={current.email ?? ""} />
        <div className="banner" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">phonelink_lock</span>
          <span>
            {t("Akun ini mengharuskan")} <strong>MFA</strong>.{" "}
            {t("Masukkan kode 6 digit dari aplikasi authenticator Anda.")}
          </span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="mfa-code">{t("Kode authenticator")}</label>
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
          {pending ? t("Memverifikasi…") : t("Verifikasi & masuk")}
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
    <form action={signInAction}>
      <div className="field">
        <label className="field__label" htmlFor="login-email">{t("Email")}</label>
        <input
          className="input"
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.email ?? ""}
          placeholder={t("nama@perusahaan.co.id")}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="login-password">{t("Password")}</label>
        <input
          className="input"
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder={t("Masukkan kata sandi")}
        />
      </div>
      <div className="field">
        <label className="field__label" htmlFor="login-tenant">
          {t("Tenant")} <span className="faint">{t("(opsional)")}</span>
        </label>
        <input
          className="input mono"
          id="login-tenant"
          name="tenant"
          autoComplete="organization"
          placeholder="dextra-demo"
        />
        <p className="field__hint">{t("Kosongkan untuk memakai tenant default Anda.")}</p>
      </div>
      <button className="btn btn--primary btn--block" type="submit" disabled={signingIn}>
        <span className="material-symbols-outlined" aria-hidden="true">{signingIn ? "hourglass_top" : "login"}</span>
        {signingIn ? t("Masuk…") : t("Masuk")}
      </button>
      {state.error && (
        <div className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          {state.error}
        </div>
      )}
    </form>
  );
}
