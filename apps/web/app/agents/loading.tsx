export default function Loading() {
  return (
    <div role="status" aria-label="Memuat">
      <div className="skeleton skeleton-line" style={{ width: "40%" }} />
      <div className="skeleton skeleton-line" style={{ width: "70%" }} />
      <div className="skeleton skeleton-line" style={{ width: "55%" }} />
      <p className="field__hint" style={{ marginTop: 8 }}>
        Memuat…
      </p>
    </div>
  );
}
