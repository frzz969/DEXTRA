/**
 * Potongan UI bersama untuk halaman agen.
 *
 * Sumber kebenaran warna status ada di satu tempat: `AGENT_STATUS_TONE`.
 * Ringkasan status (`.statstrip`) memakai peta turunan `STRIP_TONE`, jadi
 * badge dan angka ringkasan tidak pernah berbeda warna.
 *
 * `disabled` sengaja bukan `badge--danger`: agen yang dimatikan dengan sengaja
 * bukan agen yang gagal. Peta global `components/p1.tsx` tetap dipakai apa
 * adanya untuk entitas lain — di sini statusnya punya arti sendiri.
 */
import type { CSSProperties } from "react";
import { agentAvatar } from "@/lib/agents-media";

/** Status yang dikenal API (`backend: AGENT_STATUSES`). Urutan ini dipakai ringkasan. */
export const AGENT_STATUSES = ["active", "idle", "busy", "disabled", "error"] as const;

export const AGENT_STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  idle: "badge--info",
  busy: "badge--warning",
  disabled: "badge--outline",
  error: "badge--danger"
};

/** tone badge → tone statstrip. Kelas yang tidak punya padanan tetap default. */
export const STRIP_TONE: Record<string, string> = {
  "badge--success": "statstrip__value--success",
  "badge--info": "statstrip__value--info",
  "badge--warning": "statstrip__value--warning",
  "badge--danger": "statstrip__value--danger",
  "badge--outline": ""
};

export function agentStatusTone(status: string): string {
  return AGENT_STATUS_TONE[status] ?? "badge--outline";
}

export function agentStripTone(status: string): string {
  return STRIP_TONE[agentStatusTone(status)] ?? "";
}

/** Dua huruf dari nama; dipakai hanya ketika `agentAvatar` tidak punya berkas. */
function initials(name: string, slug: string): string {
  const source = (name.trim() || slug.trim()).replace(/[_-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Avatar agen. Gambar hanya berasal dari `agentAvatar(slug)`; kalau modul itu
 * mengembalikan null, yang tampil adalah inisial di atas kelas `.avatar`.
 * Tidak ada ikon pengganti dan tidak ada gambar karangan.
 *
 * `xl` sengaja tidak punya kelas di design-system (berkas itu hasil generate),
 * jadi pemakainya wajib mendefinisikan `.avatar--xl` sendiri. Saat ini hanya
 * `office-agent/worker-picker.css`.
 */
export function AgentAvatar({
  slug,
  name,
  size = "md"
}: {
  slug: string;
  name: string;
  size?: "md" | "lg" | "xl";
}) {
  const src = agentAvatar(slug);
  const className =
    size === "xl" ? "avatar avatar--xl" : size === "lg" ? "avatar avatar--lg" : "avatar";
  const px = size === "xl" ? 56 : size === "lg" ? 44 : 30;
  if (src) {
    return <img className={className} src={src} alt="" width={px} height={px} decoding="async" />;
  }
  return (
    <span className={className} aria-hidden="true">
      {initials(name, slug)}
    </span>
  );
}

const CLAMP_2: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden"
};

/** Deskripsi kartu: maksimal dua baris, sisanya elipsis. */
export function ClampedDescription({ text, fallback }: { text: string | null; fallback: string }) {
  if (!text) return <p className="spec-card__desc muted">{fallback}</p>;
  return (
    <p className="spec-card__desc" style={CLAMP_2} title={text}>
      {text}
    </p>
  );
}

/**
 * Kapabilitas sebagai chip. `max` memotong daftar dan menambahkan chip `+N`;
 * daftar lengkapnya tetap terbaca lewat `title`.
 */
export function CapabilityChips({
  capabilities,
  max
}: {
  capabilities: string[];
  max?: number;
}) {
  const shown = typeof max === "number" ? capabilities.slice(0, max) : capabilities;
  const rest = capabilities.length - shown.length;
  return (
    <span className="tag-row" title={capabilities.join(", ") || "tanpa kapabilitas tercatat"}>
      {shown.map((capability) => (
        <span key={capability} className="chip" style={{ cursor: "default" }}>
          {capability}
        </span>
      ))}
      {rest > 0 ? (
        <span className="chip" style={{ cursor: "default" }}>
          +{rest}
        </span>
      ) : null}
      {shown.length === 0 ? <span className="tiny muted">tanpa kapabilitas tercatat</span> : null}
    </span>
  );
}
