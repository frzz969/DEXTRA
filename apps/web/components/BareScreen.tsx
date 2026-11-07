"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Pembungkus layar error supaya memakai tata letak "bare" design system:
 * sidebar, topbar, dan tabsbar disembunyikan (`body.is-bare`,
 * app/dextra-design-system.css:931-937), konten selebar layar.
 *
 * Kenapa ada MutationObserver di sini: kelas `is-bare` dipasang oleh
 * `components/BareRoute.tsx`, yang berada di luar lingkup perubahan ini dan
 * hanya mengenali `/login`. Untuk rute ini ia selalu menghapus kelas tersebut
 * pada commit yang sama (dan untuk 404 ia memang tidak bisa mengenali alamat
 * apa pun). Menambahkannya sekali dari `useEffect` — atau menundanya dengan
 * setTimeout — kalah balapan: sudah dicoba dan `document.body.className`
 * berakhir kosong. Jadi kelas ditegakkan ulang setiap kali ada yang
 * menghapusnya. Ini satu mekanisme (kelas yang sama dengan design system),
 * bukan tata letak paralel.
 *
 * Dipakai oleh app/not-found.tsx, app/(bare)/forbidden/page.tsx, dan
 * app/(bare)/unavailable/page.tsx. Ketiganya berada di luar grup rute
 * aplikasi (app/(app)), jadi komponen bersama ini diletakkan di components/
 * — bukan di dalam salah satu direktori rute.
 */
export default function BareScreen({ children }: { children: ReactNode }) {
  useEffect(() => {
    const body = document.body;
    const enforce = () => {
      if (!body.classList.contains("is-bare")) body.classList.add("is-bare");
    };

    enforce();
    const observer = new MutationObserver(enforce);
    observer.observe(body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      body.classList.remove("is-bare");
    };
  }, []);

  return <>{children}</>;
}
