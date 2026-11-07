"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

/* `pinned` menandai tab yang tidak bisa ditutup. Sebelumnya penandanya adalah
 * href "/" — penanda itu hilang begitu Overview pindah ke /overview, dan tab
 * Overview jadi bisa ditutup tanpa ada yang meminta. */
const TABS = [
  { href: "/overview", label: "Overview", icon: "dashboard", pinned: true },
  { href: "/board", label: "Papan Tugas", icon: "view_kanban" },
  { href: "/approvals", label: "Kotak Persetujuan", icon: "fact_check" },
  { href: "/executions", label: "Riwayat Eksekusi", icon: "play_circle" },
  { href: "/audit", label: "Jejak Audit", icon: "receipt_long" },
  { href: "/agents", label: "Workforce", icon: "smart_toy" },
] as const;

export default function Tabsbar() {
  const t = useT();
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
      aria-label={t("Halaman terbuka")}
      ref={barRef}
    >
      {TABS.filter((tab) => !closed.has(tab.href)).map((tab) => {
        const pinned = "pinned" in tab && tab.pinned === true;
        const active = pathname === tab.href || (pathname ?? "").startsWith(`${tab.href}/`);
        return (
          <span key={tab.href} role="tab" aria-selected={active} className={`tab${active ? " is-active" : ""}`}>
            <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 15 }}>{tab.icon}</span>
            <Link href={tab.href} onKeyDown={onKeyDown}>{t(tab.label)}</Link>
            {!pinned && (
              <button type="button" className="tab__x" aria-label={`${t("Tutup tab")} ${t(tab.label)}`}
                onClick={() => setClosed((s) => new Set(s).add(tab.href))}>
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
