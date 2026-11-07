import Link from "next/link";
import { SEARCH_PER_ENTITY_LIMIT, search, type SearchHit } from "@/lib/api";

export const dynamic = "force-dynamic";

/* Explorer memakai GET /api/v1/search?q= di server (server-side, bukan
 * filter client-side dari list). Hasil dikelompokkan per jenis entitas;
 * backend membatasi 20 baris per entitas — batas itu dicantumkan di sini. */

const ENTITY_LABEL: Record<string, string> = {
  work_package: "Paket kerja",
  task: "Tugas",
  agent: "Agen",
  mandate: "Mandat",
  execution: "Eksekusi",
  policy: "Kebijakan",
  skill: "Skill",
  plan: "Rencana"
};

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : Array.isArray(value) ? (value[0] ?? "") : "";
}

function statusTone(status: string): string {
  if (["succeeded", "active", "approved", "completed", "granted", "usable"].includes(status))
    return "badge--success";
  if (["failed", "blocked", "revoked", "rejected", "cancelled", "inactive", "not_configured"].includes(status))
    return "badge--danger";
  if (["pending", "draft", "running", "waiting_approval", "configured"].includes(status))
    return "badge--warning";
  return "badge--info";
}

function groupByEntity(items: SearchHit[]): Array<{ entity: string; label: string; rows: SearchHit[] }> {
  const map = new Map<string, SearchHit[]>();
  for (const item of items) {
    const list = map.get(item.entity) ?? [];
    list.push(item);
    map.set(item.entity, list);
  }
  return [...map.entries()].map(([entity, rows]) => ({
    entity,
    label: ENTITY_LABEL[entity] ?? entity,
    rows
  }));
}

export default async function ExplorerPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = str(sp.q).trim().slice(0, 200);
  const result = q ? await search(q) : null;

  const groups = result?.ok ? groupByEntity(result.data.items) : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Explorer</h1>
          <p>Cari lewat GET /api/v1/search di server. Hasil per jenis entitas, maks {SEARCH_PER_ENTITY_LIMIT} per entitas.</p>
        </div>
      </header>

      <form
        className="row"
        role="search"
        style={{ gap: 8, marginBottom: "var(--s-4)", alignItems: "center", flexWrap: "wrap" }}
        action="/explorer"
        method="get"
      >
        <input
          className="input mono"
          type="search"
          name="q"
          aria-label="Kata kunci pencarian"
          placeholder="Cari judul, id, slug, status… (min. 1 huruf)"
          defaultValue={q}
          minLength={1}
          maxLength={200}
          required
          style={{ flex: "1 1 260px", minHeight: 44, color: "var(--text)", background: "var(--surface)" }}
        />
        <button type="submit" className="btn btn--primary" style={{ minHeight: 44 }}>
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          Cari
        </button>
        {q ? (
          <Link className="btn btn--secondary" href="/explorer" style={{ minHeight: 44 }}>
            Bersihkan
          </Link>
        ) : null}
      </form>

      {!q ? (
        <div className="empty">
          <div className="empty__icon">
            <span className="material-symbols-outlined" aria-hidden="true">manage_search</span>
          </div>
          <h3>Tulis kata kunci</h3>
          <p>Endpoint /search butuh q minimal 1 huruf. Ketik lalu tekan Cari.</p>
        </div>
      ) : result && !result.ok ? (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
          <span>
            <strong>Pencarian tidak tersedia.</strong> {result.error} Tidak ada data contoh.
          </span>
        </div>
      ) : result?.ok && result.data.items.length === 0 ? (
        <div className="empty">
          <div className="empty__icon">
            <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
          </div>
          <h3>Tidak ada hasil</h3>
          <p>Tidak ada entitas cocok dengan <code className="mono">{q}</code>.</p>
        </div>
      ) : (
        <>
          <p className="field__hint" role="status" style={{ marginBottom: "var(--s-3)" }}>
            Hasil untuk <code className="mono">{q}</code>: <strong>{result?.data.count ?? 0}</strong> baris dari{" "}
            {groups.length} jenis entitas. Batas server: {SEARCH_PER_ENTITY_LIMIT} per entitas.
          </p>
          {groups.map((g) => (
            <section key={g.entity} aria-label={g.label} style={{ marginBottom: "var(--s-5)" }}>
              <h2 style={{ fontSize: 14, margin: "0 0 var(--s-2)" }}>
                {g.label} <span className="cell-sub">({g.rows.length}{g.rows.length >= SEARCH_PER_ENTITY_LIMIT ? `, batas ${SEARCH_PER_ENTITY_LIMIT}` : ""})</span>
              </h2>
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr><th>Judul</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={`${r.entity}-${r.id}`}>
                        <td>
                          <div className="cell-title">{r.title}</div>
                          <div className="cell-sub mono">{r.id}</div>
                        </td>
                        <td>
                          <span className={`badge ${statusTone(r.status)}`}>{r.status}</span>
                        </td>
                        <td>
                          <Link href={r.href} className="btn btn--soft btn--sm" style={{ minHeight: 44 }}>
                            Buka
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </>
  );
}
