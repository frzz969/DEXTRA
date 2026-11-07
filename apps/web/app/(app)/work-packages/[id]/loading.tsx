export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Memuat detail work package">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "20%", height: 8, marginBottom: 12 }} />
        <div className="skeleton skeleton-line" style={{ width: "16%", height: 18, marginBottom: 10 }} />
        <div className="skeleton skeleton-line" style={{ width: "58%", height: 24, marginBottom: 6 }} />
        <div className="skeleton skeleton-line" style={{ width: "26%", height: 8 }} />

        <div className="grid grid--sidebar" style={{ marginTop: "var(--s-5)" }}>
          <div className="stack">
            {[0, 1].map((card) => (
              <div className="card" key={card}>
                <div className="card__head">
                  <div style={{ width: "100%" }}>
                    <div className="skeleton skeleton-line" style={{ width: "26%", height: 12 }} />
                    <div className="skeleton skeleton-line" style={{ width: "46%", height: 8 }} />
                  </div>
                </div>
                <div className="card__body">
                  {[0, 1, 2, 3].map((i) => (
                    <div className="skeleton skeleton-line" key={i} style={{ width: `${90 - i * 9}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="stack">
            {[0, 1, 2].map((card) => (
              <div className="card" key={card}>
                <div className="card__head">
                  <div className="skeleton skeleton-line" style={{ width: "55%", height: 12 }} />
                </div>
                <div className="card__body">
                  {[0, 1, 2].map((i) => (
                    <div className="skeleton skeleton-line" key={i} style={{ width: `${85 - i * 14}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
