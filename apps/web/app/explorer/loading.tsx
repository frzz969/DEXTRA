export default function Loading() {
  return (
    <div role="status" aria-label="Memuat">
      <div className="skeleton skeleton-line" style={{ width: "30%" }} />
      <div className="skeleton skeleton-line" style={{ width: "65%" }} />
      <div className="skeleton skeleton-line" style={{ width: "50%" }} />
      <p className="field__hint" style={{ marginTop: 8 }}>
        Memuat…
      </p>
    </div>
  );
}
