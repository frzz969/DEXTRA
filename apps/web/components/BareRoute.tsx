"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Rute bare (login) menyembunyikan shell seperti body.is-bare di statis:
 * sidebar/topbar/tabsbar hilang, konten selebar layar. */
export default function BareRoute() {
  const pathname = usePathname();
  useEffect(() => {
    const bare = pathname === "/login";
    document.body.classList.toggle("is-bare", bare);
    return () => document.body.classList.remove("is-bare");
  }, [pathname]);
  return null;
}
