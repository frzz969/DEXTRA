/** Kerangka muat profil agen: header (avatar besar + nama), lalu tiga kartu bagian. */
export default function Loading() {
  return (
    <div role="status" aria-label="Memuat profil agen">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "22%" }} />

        <div className="row" style={{ gap: "var(--s-3)", margin: "var(--s-3) 0" }}>
          <span className="skeleton" style={{ width: 44, height: 44, borderRadius: "var(--r-full)" }} />
          <span className="skeleton skeleton-line" style={{ width: "38%", marginBottom: 0 }} />
        </div>
        <div className="skeleton skeleton-line" style={{ width: "64%" }} />

        <div className="stack" style={{ marginTop: "var(--s-5)" }}>
          {[0, 1, 2].map((index) => (
            <div className="card card--pad" key={index}>
              <div className="skeleton skeleton-line" style={{ width: "28%" }} />
              <div className="skeleton skeleton-line" style={{ width: "88%" }} />
              <div className="skeleton skeleton-line" style={{ width: "70%" }} />
            </div>
          ))}
        </div>
      </div>
      <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
        Memuat…
      </p>
    </div>
  );
}
