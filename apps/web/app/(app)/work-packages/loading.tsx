export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Memuat work package">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "30%", height: 22, marginBottom: 14 }} />
        <div className="skeleton skeleton-line" style={{ width: "62%" }} />

        <div className="statstrip" style={{ margin: "var(--s-5) 0 var(--s-4)" }}>
          {[0, 1, 2, 3].map((i) => (
            <div className="statstrip__item" key={i}>
              <div className="skeleton skeleton-line" style={{ width: "60%", height: 8 }} />
              <div className="skeleton skeleton-line" style={{ width: "35%", height: 18 }} />
              <div className="skeleton skeleton-line" style={{ width: "75%", height: 8 }} />
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card__head">
            <div style={{ width: "100%" }}>
              <div className="skeleton skeleton-line" style={{ width: "22%", height: 12 }} />
              <div className="skeleton skeleton-line" style={{ width: "14%", height: 8 }} />
            </div>
          </div>
          <div className="card__body">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div className="skeleton skeleton-line" key={i} style={{ width: `${92 - i * 7}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
