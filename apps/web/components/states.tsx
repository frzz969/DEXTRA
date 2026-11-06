export function EmptyState({ icon = "inbox", title, body }: { icon?: string; title: string; body?: string }) {
  return (
    <div className="banner" role="status">
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <span><strong>{title}</strong>{body ? ` ${body}` : ""}</span>
    </div>
  );
}

export function Unavailable({ title, error }: { title: string; error: string }) {
  return (
    <div className="banner banner--warning" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
      <span><strong>{title} belum terhubung.</strong> {error}</span>
    </div>
  );
}

export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card card--pad" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton skeleton-line" style={{ width: `${85 - i * 18}%` }} />
      ))}
    </div>
  );
}
