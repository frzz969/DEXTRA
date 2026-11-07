"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/* Nav item dengan status aktif mengikuti rute saat ini (statis menandai
 * item lewat paintActive). Overview ("/overview") aktif juga di sub-rutenya. */
export default function NavItem({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: string;
  label: string;
  count?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && (pathname ?? "").startsWith(`${href}/`));
  return (
    <Link
      className={`nav-item${active ? " is-active" : ""}`}
      href={href}
      {...(active ? { "aria-current": "page" as const } : {})}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <span className="nav-item__label">{label}</span>
      {count ? <span className="nav-item__count">{count}</span> : null}
    </Link>
  );
}
