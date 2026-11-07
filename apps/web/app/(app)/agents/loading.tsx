/**
 * Kerangka muat untuk halaman agen: judul, baris ringkasan status, lalu grid
 * kartu profil. Bentuknya mengikuti layout akhir supaya tidak ada lompatan
 * tata letak saat data datang.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Memuat">
      <span className="sr-only">Memuat…</span>
      <div aria-hidden="true">
        <div className="skeleton skeleton-line" style={{ width: "26%" }} />
        <div className="skeleton skeleton-line" style={{ width: "58%" }} />

        <div className="statstrip" style={{ marginTop: "var(--s-5)" }}>
          {[0, 1, 2, 3, 4].map((index) => (
            <div className="statstrip__item" key={index}>
              <span className="skeleton skeleton-line" style={{ width: "55%", marginBottom: 0 }} />
              <span className="skeleton skeleton-line" style={{ width: "30%", marginBottom: 0 }} />
            </div>
          ))}
        </div>

        <div className="grid grid--3" style={{ marginTop: "var(--s-4)" }}>
          {[0, 1, 2].map((index) => (
            <div className="card card--pad" key={index}>
              <div className="row" style={{ marginBottom: "var(--s-3)" }}>
                <span className="skeleton" style={{ width: 30, height: 30, borderRadius: "var(--r-full)" }} />
                <span className="skeleton skeleton-line" style={{ width: "50%", marginBottom: 0 }} />
              </div>
              <div className="skeleton skeleton-line" style={{ width: "92%" }} />
              <div className="skeleton skeleton-line" style={{ width: "76%" }} />
              <div className="skeleton skeleton-line" style={{ width: "40%" }} />
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
