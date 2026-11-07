import Link from "next/link";
import { PUBLIC_NAV, PUBLIC_WORKSPACE } from "./publicNavLinks";

/* Footer pemasaran. Server component: seluruh tautan ada di HTML, termasuk
 * saat JavaScript mati dan panel menu ponsel tidak bisa dibuka.
 *
 * Dua kelompok tautan saja (produk dan workspace), keduanya berisi rute yang
 * benar-benar ada. Tidak ada tautan sosial, tidak ada tautan legal: keduanya
 * belum ada di produk ini, dan tautan mati lebih buruk daripada tidak ada. */
export default function PublicFooter() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer__inner">
        <div className="mkt-footer__brand">
          <span className="mkt-brand">
            <span className="brand-mark" aria-hidden="true">
              D
            </span>
            <span className="brand-text">
              <b>DEXTRA</b>
              <span>Governed AI Workforce</span>
            </span>
          </span>
          <p>
            Governed Enterprise AI Workforce &amp; Operations Platform. Specialized AI workers.
            Human-defined authority. Accountable execution.
          </p>
        </div>

        <nav className="mkt-footer__col" aria-label="Tentang produk">
          <h2 className="mkt-footer__title">Produk</h2>
          <ul>
            {PUBLIC_NAV.map((link) => (
              <li key={link.href}>
                <Link className="mkt-footer__link" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="mkt-footer__col" aria-label="Workspace">
          <h2 className="mkt-footer__title">Workspace</h2>
          <ul>
            {PUBLIC_WORKSPACE.map((link) => (
              <li key={link.href}>
                <Link className="mkt-footer__link" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mkt-footer__rule" />
      <p className="mkt-footer__note">
        <span>Instans lokal · 127.0.0.1</span>
        <span>Font dan ikon di-host sendiri, tanpa permintaan ke pihak ketiga</span>
      </p>
    </footer>
  );
}
