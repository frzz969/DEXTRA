import type { ReactNode } from "react";
import AppShell from "@/components/AppShell";

/* Semua halaman aplikasi memakai shell yang sama (sidebar, topbar, tabsbar).
 * Halaman publik di app/(public) tidak lewat sini. */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
