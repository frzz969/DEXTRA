import Link from "next/link";

import LoginForm from "./LoginForm";
import "./login.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Masuk — DEXTRA"
};

/* Layar masuk bare: tanpa sidebar, topbar, atau footer pemasaran.
 *
 * Satu kartu lembut di tengah latar bergradasi, dua kolom di dalamnya. Tinggi
 * kartu mengikuti isi dan dibatasi max-height, jadi selalu muat satu layar
 * tanpa menggulir. Panel brand murni dekoratif (aria-hidden) karena kalimatnya
 * mengulang hal yang sama dengan judul di kolom form. */
export default function LoginPage() {
  return (
    <div className="lg">
      <div className="lg-card">
        <aside className="lg-brand" aria-hidden="true">
          <div className="lg-brand__top">
            <span className="lg-brand__mark">D</span>
            <span className="lg-brand__name">
              <b>DEXTRA</b>
              <span>Governed AI Workforce</span>
            </span>
          </div>

          <div className="lg-brand__body">
            <div className="lg-brand__pitch">
              <h2>Kendali penuh atas tenaga kerja AI Anda.</h2>
              <p>
                Empat worker spesialis, wewenang yang Anda tetapkan sendiri, dan setiap tindakan
                tulis yang tercatat.
              </p>
            </div>

            <ul className="lg-brand__points">
              <li>
                <span className="material-symbols-outlined">verified_user</span>
                Mandat eksplisit sebelum eksekusi
              </li>
              <li>
                <span className="material-symbols-outlined">receipt_long</span>
                Audit append-only yang bisa ditelusuri
              </li>
              <li>
                <span className="material-symbols-outlined">lock</span>
                Tidak ada jalur langsung agen ke executor
              </li>
            </ul>
          </div>

          <p className="lg-brand__foot">
            <i aria-hidden="true" />
            Instans lokal · 127.0.0.1 · Asia/Jakarta
          </p>
        </aside>

        <main className="lg-panel">
          <div className="lg-panel__inner">
            <div className="lg-mobile-brand">
              <span className="lg-mobile-brand__mark" aria-hidden="true">
                D
              </span>
              <span className="lg-mobile-brand__name">
                <b>DEXTRA</b>
                <span>Governed AI Workforce</span>
              </span>
            </div>

            <Link className="lg-back" href="/">
              <span className="material-symbols-outlined" aria-hidden="true">
                arrow_back
              </span>
              Kembali ke beranda
            </Link>

            <h1 className="lg-title">Selamat datang kembali</h1>
            <p className="lg-sub">Masuk untuk melanjutkan ke workspace.</p>

            <div className="lg-form">
              <LoginForm />
            </div>

            <div className="lg-demo">
              <div className="lg-demo__head">
                <span className="material-symbols-outlined" aria-hidden="true">
                  key
                </span>
                Akun demo
              </div>
              <dl>
                <div>
                  <dt>Email</dt>
                  <dd>
                    <code>budi.santoso@dextra.local</code>
                  </dd>
                </div>
                <div>
                  <dt>Password</dt>
                  <dd>
                    <code>E2E-DevOnly-Password-2026</code>
                  </dd>
                </div>
              </dl>
            </div>

            <p className="lg-legal">
              Akses dicatat pada audit trail tenant. Tidak ada reset kata sandi mandiri di aplikasi
              ini.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
