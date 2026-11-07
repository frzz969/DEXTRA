/**
 * Kerangka muat untuk /account: kepala halaman, kartu ringkasan, baris tab.
 * Bentuknya mengikuti layout akhir supaya tidak ada lompatan tata letak.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Memuat akun">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "24%" }} />
        <div className="skeleton skeleton-line" style={{ width: "66%" }} />

        <div className="card" style={{ marginTop: "var(--s-4)" }}>
          <div className="card__head">
            <span className="skeleton skeleton-line" style={{ width: 160, marginBottom: 0 }} />
          </div>
          <div className="card__body">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <div key={index} className="row" style={{ gap: 14, marginBottom: 8 }}>
                <span className="skeleton skeleton-line" style={{ width: 120, marginBottom: 0 }} />
                <span className="skeleton skeleton-line" style={{ width: 220, marginBottom: 0 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="skeleton" style={{ width: 300, height: 32, margin: "var(--s-4) 0" }} />
        <div className="card card--pad">
          <span className="skeleton skeleton-line" style={{ width: "90%" }} />
          <span className="skeleton skeleton-line" style={{ width: "70%" }} />
          <span className="skeleton skeleton-line" style={{ width: "45%", marginBottom: 0 }} />
        </div>
      </div>
      <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
        Memuat…
      </p>
    </div>
  );
}
