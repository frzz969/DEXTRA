import Link from "next/link";

/** Satu-satunya copy pesan lintas-halaman. Pendek, konkret, tanpa angka contoh. */
export const COPY = {
  unavailable: "Data belum terhubung. Periksa backend :8000, lalu muat ulang.",
  empty: "Belum ada data.",
  loading: "Memuat…",
} as const;

export function EmptyState({ icon = "inbox", title, body, action }: {
  icon?: string;
  title: string;
  body?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="banner" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <span>
        <strong>{title}</strong>{body ? ` ${body}` : ""}
        {action ? <> · <Link href={action.href}>{action.label}</Link></> : null}
      </span>
    </div>
  );
}

export function Unavailable({ title, error }: { title: string; error: string }) {
  return (
    <div className="banner banner--warning" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
      <span><strong>{title} belum terhubung.</strong> {error} {COPY.unavailable}</span>
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card card--pad" role="status" aria-live="polite" aria-label={COPY.loading}>
      <span className="sr-only">{COPY.loading}</span>
      <span aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="skeleton skeleton-line" style={{ width: `${85 - i * 18}%`, display: "block" }} />
        ))}
      </span>
    </div>
  );
}
