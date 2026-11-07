export default function Loading() {
  return (
    <div role="status" aria-label="Memuat">
      <div className="skeleton skeleton-line" style={{ width: "35%" }} />
      <div className="skeleton skeleton-line" style={{ width: "60%" }} />
      <div className="skeleton skeleton-line" style={{ width: "45%" }} />
      <p className="field__hint" style={{ marginTop: 8 }}>
        Memuat…
      </p>
    </div>
  );
}
