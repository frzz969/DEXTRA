import Link from "next/link";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} dtk`;
  return `${Math.floor(s / 60)} mnt ${Math.round(s % 60)} dtk`;
}

export const STATUS_TONE: Record<string, string> = {
  draft: "badge--outline", todo: "badge--outline", pending: "badge--outline", pending_approval: "badge--warning",
  assigned: "badge--info", approved: "badge--info", executing: "badge--info", running: "badge--info",
  in_progress: "badge--info", review: "badge--warning", completed: "badge--success", success: "badge--success",
  rejected: "badge--danger", revoked: "badge--danger", failed: "badge--danger", error: "badge--danger",
  cancelled: "badge--outline", idle: "badge--outline", active: "badge--success", busy: "badge--warning",
  disabled: "badge--danger", issued: "badge--info"
};
export const PRIORITY_TONE: Record<string, string> = { low: "badge--outline", normal: "badge--outline", high: "badge--warning", urgent: "badge--danger" };

export function Badge({ value, tone }: { value: string; tone?: string }) {
  return <span className={`badge ${tone ?? STATUS_TONE[value] ?? "badge--outline"}`}>{value}</span>;
}

export function UnavailableBanner({ title, error }: { title: string; error: string }) {
  return (
    <div className="banner banner--warning" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
      <span><strong>{title} belum terhubung.</strong> {error} Halaman ini tidak menampilkan angka contoh.</span>
    </div>
  );
}

export function FilterForm({ action, fields, submitLabel = "Terapkan" }: {
  action: string;
  fields: { name: string; label: string; value?: string; options?: { value: string; label: string }[]; type?: "text" | "select" }[];
  submitLabel?: string;
}) {
  return (
    <form method="get" action={action} className="card card--pad" style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-3)", alignItems: "flex-end", marginBottom: "var(--s-4)" }} aria-label="Filter">
      {fields.map((f) => (
        <label key={f.name} className="field" style={{ minWidth: 160, flex: "1 1 160px" }}>
          <span className="field__label">{f.label}</span>
          {f.type === "select" || f.options ? (
            <select name={f.name} defaultValue={f.value ?? ""} className="select" style={{ minHeight: 44 }}>
              <option value="">Semua</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input name={f.name} defaultValue={f.value ?? ""} className="input" style={{ minHeight: 44 }} placeholder={f.label} />
          )}
        </label>
      ))}
      <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>{submitLabel}</button>
      <Link href={action} className="btn btn--secondary" style={{ minHeight: 44 }}>Reset</Link>
    </form>
  );
}

export function Greeting() {
  const h = new Date().getHours();
  const s = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 19 ? "Selamat sore" : "Selamat malam";
  const date = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <>{s} · {date}</>;
}
