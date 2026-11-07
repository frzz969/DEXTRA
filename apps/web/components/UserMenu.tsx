"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-actions";
import { useT } from "@/lib/i18n/client";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/* Menu akun persis statis (shell.js userMenu): header nama+kontak, lalu
 * Akun & Keamanan, Ganti password, Profil & preferensi, Ganti tema, Keluar.
 * placement "up" dipakai di kaki sidebar (menu terbuka ke atas),
 * "down" di topbar. Keluar memanggil server action logout yang sudah ada. */
export default function UserMenu({
  userName,
  userSubtitle,
  placement = "down",
  id,
}: {
  userName: string;
  userSubtitle: string;
  placement?: "up" | "down";
  /** Design system menargetkan #topbar-user untuk meringkas chip di layar kecil
   *  (dashboard.css, @media max-width 640px). Tanpa id ini aturan itu tidak
   *  pernah berlaku dan topbar kehabisan ruang sampai tombol menu terpotong. */
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("dextra-theme", next ? "dark" : "light"); } catch { /* abaikan */ }
    setOpen(false);
    router.refresh();
  };

  const logout = async () => {
    if (busy) return;
    setBusy(true);
    try { await signOut(); } catch { setBusy(false); }
  };

  return (
    <div ref={ref} className="user-menu" style={{ position: "relative" }}>
      {open && (
        <div
          className="menu user-menu__list"
          role="menu"
          aria-label={t("Menu akun")}
          style={
            placement === "up"
              ? { bottom: "calc(100% + 6px)", left: 0, right: 0, minWidth: 220 }
              : { top: "calc(100% + 6px)", right: 0, minWidth: 240 }
          }
        >
          <div className="menu__head">
            <div className="small strong">{userName}</div>
            <div className="tiny muted">{userSubtitle}</div>
          </div>
          <Link className="menu__item" role="menuitem" href="/account" onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined" aria-hidden="true">manage_accounts</span>
            {t("Akun & Keamanan")}
          </Link>
          <Link className="menu__item" role="menuitem" href="/account" onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined" aria-hidden="true">lock_reset</span>
            {t("Ganti password")}
          </Link>
          <Link className="menu__item" role="menuitem" href="/settings" onClick={() => setOpen(false)}>
            <span className="material-symbols-outlined" aria-hidden="true">person</span>
            {t("Profil & preferensi")}
          </Link>
          <button type="button" className="menu__item" role="menuitem" onClick={toggleTheme}>
            <span className="material-symbols-outlined" aria-hidden="true">contrast</span>
            {t("Ganti tema")}
          </button>
          <div className="menu__sep" role="separator" />
          <button
            type="button"
            className="menu__item menu__item--danger"
            role="menuitem"
            disabled={busy}
            onClick={logout}
          >
            <span className="material-symbols-outlined" aria-hidden="true">{busy ? "hourglass_top" : "logout"}</span>
            {busy ? t("Keluar…") : t("Keluar")}
          </button>
        </div>
      )}
      <button
        type="button"
        id={id}
        className="user-chip"
        data-user-menu
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t("Akun")} ${userName}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">{initials(userName)}</span>
        <span className="user-chip__meta">
          <b>{userName}</b>
          <span>{userSubtitle}</span>
        </span>
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: 16, color: "var(--faint)", marginLeft: "auto" }}
        >
          {placement === "up" ? "unfold_more" : "expand_more"}
        </span>
      </button>
    </div>
  );
}
