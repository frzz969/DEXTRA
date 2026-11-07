import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Masuk — DEXTRA"
};

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand__head">
            <span className="brand-mark brand-mark--light" aria-hidden="true">D</span>
            <span>
              <b>DEXTRA</b>
              <span>Governed AI Workforce</span>
            </span>
          </div>
          <h2>Simplify management with our dashboard</h2>
          <p>Specialized AI workers, human-defined authority, accountable execution — setiap tindakan tulis melewati mandat dan tercatat.</p>
          <ul className="login-badges">
            <li><span className="material-symbols-outlined" aria-hidden="true">verified_user</span>Mandat eksplisit</li>
            <li><span className="material-symbols-outlined" aria-hidden="true">receipt_long</span>Audit append-only</li>
            <li><span className="material-symbols-outlined" aria-hidden="true">lock</span>Tanpa jalur agen ke executor</li>
          </ul>
          <p className="login-brand__foot">Instans lokal · 127.0.0.1 · Asia/Jakarta</p>
        </div>
        <div className="login-form">
          <div className="login-form__head">
            <span className="brand-mark" aria-hidden="true">D</span>
            <b>DEXTRA</b>
          </div>
          <h1>Selamat datang kembali</h1>
          <p className="muted small">Masuk untuk melanjutkan ke workspace</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
