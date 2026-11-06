"use client";
import { useEffect } from "react";

/* Tombol ciut sidebar (statis: sidebar-toggle + localStorage dextra_sidebar)
 * dan pemulih status tersimpan saat pertama dimuat. */
export default function SidebarToggle() {
  useEffect(() => {
    try {
      if (localStorage.getItem("dextra_sidebar") === "collapsed" && window.innerWidth > 1080) {
        document.body.classList.add("is-collapsed");
      }
    } catch { /* penyimpanan tidak tersedia */ }
  }, []);
  return (
    <button
      type="button"
      className="sidebar-toggle"
      aria-label="Ciutkan sidebar"
      title="Ciutkan sidebar"
      onClick={() => {
        const collapsed = document.body.classList.toggle("is-collapsed");
        try { localStorage.setItem("dextra_sidebar", collapsed ? "collapsed" : "open"); } catch { /* abaikan */ }
      }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
    </button>
  );
}
