/* Sumber tunggal tautan shell pemasaran. Dipakai header (client, untuk menu
 * ponsel dan aria-current) dan footer (server, supaya navigasi tetap ada
 * tanpa JavaScript). Berkas ini sengaja tanpa "use client": nilainya harus
 * bisa dibaca dari komponen server maupun client.
 *
 * Halaman /about, /team, /how-it-works, dan /tutorial sudah dihapus: isinya
 * dilebur ke landing page "/" di app/(landing), yang memakai header dan footer
 * sendiri. Jangan menambah tautan ke rute yang belum ada. */
export type PublicLink = { href: string; label: string };

export const PUBLIC_NAV: PublicLink[] = [
  { href: "/", label: "Beranda" },
  { href: "/overview", label: "Dashboard" }
];

/* Tujuan di dalam workspace, dipakai footer. Semuanya rute yang sudah ada. */
export const PUBLIC_WORKSPACE: PublicLink[] = [
  { href: "/overview", label: "Dashboard" },
  { href: "/approvals", label: "Approval Inbox" },
  { href: "/mandates", label: "Mandates" },
  { href: "/audit", label: "Audit Trail" }
];

/* Beranda hanya aktif tepat di "/", bukan di setiap rute. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
