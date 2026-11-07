/**
 * Kerangka muat untuk /settings. Bentuknya mengikuti layout akhir (kepala
 * halaman, baris tab, lalu satu kartu besar) supaya tidak ada lompatan tata
 * letak saat data datang.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Memuat settings">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "18%" }} />
        <div className="skeleton skeleton-line" style={{ width: "62%" }} />
        <div className="skeleton" style={{ width: 340, height: 32, margin: "var(--s-4) 0" }} />

        <div className="card">
          <div className="card__head">
            <span className="skeleton skeleton-line" style={{ width: 180, marginBottom: 0 }} />
          </div>
          <div className="card__body">
            <div className="grid grid--2" style={{ gap: 16 }}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <div key={index}>
                  <div className="skeleton skeleton-line" style={{ width: "35%" }} />
                  <div className="skeleton skeleton-line" style={{ width: "60%", marginBottom: 0 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
        Memuat…
      </p>
    </div>
  );
}
