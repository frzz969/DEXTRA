"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/", label: "Overview", icon: "dashboard" },
  { href: "/board", label: "Papan", icon: "view_kanban" },
  { href: "/approvals", label: "Approval", icon: "fact_check" },
  { href: "/executions", label: "Executions", icon: "play_circle" },
  { href: "/audit", label: "Audit", icon: "receipt_long" },
  { href: "/agents", label: "Workforce", icon: "smart_toy" },
] as const;

export default function Tabsbar() {
  const pathname = usePathname();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setClosed(new Set()); }, [pathname]);

  // Navigasi keyboard: ←/→ berpindah fokus antar tab.
  // Handler di tiap link (bukan wadah) agar tidak bergantung pada
  // bubbling melewati handler keydown global lain.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const links = barRef.current?.querySelectorAll<HTMLAnchorElement>("[role='tab'] a");
    if (!links || links.length === 0) return;
    const idx = Array.from(links).indexOf(e.currentTarget as HTMLAnchorElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = e.key === "ArrowRight"
      ? links[(idx + 1) % links.length]
      : links[(idx - 1 + links.length) % links.length];
    next.focus();
  };

  return (
    <div
      className="tabsbar"
      role="tablist"
      aria-label="Halaman terbuka"
      ref={barRef}
    >
      {TABS.filter((t) => !closed.has(t.href)).map((t) => {
        const active = pathname === t.href || (t.href !== "/" && pathname.startsWith(t.href));
        return (
          <span key={t.href} role="tab" aria-selected={active} className={`tab${active ? " is-active" : ""}`}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 15 }}>{t.icon}</span>
            <Link href={t.href} onKeyDown={onKeyDown}>{t.label}</Link>
            {t.href !== "/" && (
              <button type="button" className="tab__x" aria-label={`Tutup tab ${t.label}`}
                onClick={() => setClosed((s) => new Set(s).add(t.href))}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
