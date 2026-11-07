import Link from "next/link";

import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getT } from "@/lib/i18n/server";
import LoginForm from "./LoginForm";
import "./login.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — DEXTRA"
};

/* Layar masuk bare: tanpa sidebar, topbar, atau footer pemasaran.
 *
 * Satu kartu lembut di tengah latar bergradasi, dua kolom di dalamnya. Tinggi
 * kartu mengikuti isi dan dibatasi max-height, jadi selalu muat satu layar
 * tanpa menggulir. Panel brand murni dekoratif (aria-hidden) karena kalimatnya
 * mengulang hal yang sama dengan judul di kolom form. */
export default async function LoginPage() {
  const t = await getT();
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
              <h2>{t("Kendali penuh atas tenaga kerja AI Anda.")}</h2>
              <p>
                {t(
                  "Empat worker spesialis, wewenang yang Anda tetapkan sendiri, dan setiap tindakan tulis yang tercatat."
                )}
              </p>
            </div>

            <ul className="lg-brand__points">
              <li>
                <span className="material-symbols-outlined">verified_user</span>
                {t("Mandat eksplisit sebelum eksekusi")}
              </li>
              <li>
                <span className="material-symbols-outlined">receipt_long</span>
                {t("Audit append-only yang bisa ditelusuri")}
              </li>
              <li>
                <span className="material-symbols-outlined">lock</span>
                {t("Tidak ada jalur langsung agen ke executor")}
              </li>
            </ul>
          </div>

          <p className="lg-brand__foot">
            <i aria-hidden="true" />
            {t("Instans lokal · 127.0.0.1 · Asia/Jakarta")}
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

            <div className="lg-panel__head">
              <Link className="lg-back" href="/">
                <span className="material-symbols-outlined" aria-hidden="true">
                  arrow_back
                </span>
                {t("Kembali ke beranda")}
              </Link>
              <LanguageSwitcher compact />
            </div>

            <h1 className="lg-title">{t("Selamat datang kembali")}</h1>
            <p className="lg-sub">{t("Masuk untuk melanjutkan ke workspace.")}</p>

            <div className="lg-form">
              <LoginForm />
            </div>

            <div className="lg-demo">
              <div className="lg-demo__head">
                <span className="material-symbols-outlined" aria-hidden="true">
                  key
                </span>
                {t("Akun demo")}
              </div>
              <dl>
                <div>
                  <dt>{t("Email")}</dt>
                  <dd>
                    <code>budi.santoso@dextra.local</code>
                  </dd>
                </div>
                <div>
                  <dt>{t("Password")}</dt>
                  <dd>
                    <code>E2E-DevOnly-Password-2026</code>
                  </dd>
                </div>
              </dl>
            </div>

            <p className="lg-legal">
              {t(
                "Akses dicatat pada audit trail tenant. Tidak ada reset kata sandi mandiri di aplikasi ini."
              )}
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
