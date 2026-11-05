import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Masuk — DEXTRA"
};

export default function LoginPage() {
  return (
    <>
      <header className="page-head" style={{ marginBottom: "var(--s-5)" }}>
        <div className="page-head__text">
          <h1>Masuk</h1>
          <p>Identitas Anda menentukan apa yang boleh dilakukan. Tanpa login, aplikasi berjalan dengan token server (mode demo).</p>
        </div>
      </header>

      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div className="card" style={{ padding: "var(--s-5)" }}>
          <LoginForm />
        </div>
        <div className="banner banner--warning" role="note" style={{ marginTop: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <span>
            Login belum mengunci halaman lain (mode demo). Sesi Anda tetap dipakai untuk setiap aksi yang Anda lakukan setelah masuk.
            Pembatasan penuh diterapkan pada cutover (Phase&nbsp;9).
          </span>
        </div>
      </div>
    </>
  );
}
