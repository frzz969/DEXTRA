import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

const REPO_ROOT = resolve(process.cwd(), "..", "..");
const DATA_DIR = join(REPO_ROOT, "data");

type VerifyResult = { ok: boolean; checked: number; broken_at_seq?: number; chain_versions?: number[] };
type AnyItems<T = unknown> = { items: T[] };

function legacyFiles(): { name: string; bytes: number; modified: string; lines: number | null }[] {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith(".json") || name.endsWith(".jsonl"))
    .sort()
    .map((name) => {
      const path = join(DATA_DIR, name);
      const stat = statSync(path);
      let lines: number | null = null;
      try {
        const raw = readFileSync(path, "utf8");
        lines = raw.trim().length === 0 ? 0 : raw.trim().split("\n").length;
      } catch {
        lines = null;
      }
      return {
        name,
        bytes: stat.size,
        modified: stat.mtime.toISOString(),
        lines
      };
    });
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DataManagementPage() {
  const [verify, packages, tasks] = await Promise.all([
    apiGet<VerifyResult>("/audit-events/verify"),
    apiGet<AnyItems>("/work-packages"),
    apiGet<AnyItems>("/tasks")
  ]);
  const files = legacyFiles();

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Data Management</h1>
          <p>Status migrasi data apa adanya: yang sudah di DB, yang masih artefak legacy, dan apa yang belum bisa diverifikasi.</p>
        </div>
      </header>

      <div className="banner banner--warning" role="status" style={{ marginBottom: "var(--s-4)" }}>
        <span className="material-symbols-outlined" aria-hidden="true">warning</span>
        <span>
          Backend v2 (FastAPI) sudah berjalan, tetapi <strong>data belum dimigrasikan</strong>: file di{" "}
          <code className="mono">data/</code> masih menjadi sumber tooling lama. Tidak ada endpoint untuk menelusuri
          tabel — verifikasi end-to-end hanya lewat audit chain di bawah ini.
        </span>
      </div>

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Integritas audit (satu-satunya bukti end-to-end)</h2>
      {verify.ok ? (
        <div className={`banner ${verify.data.ok ? "banner--success" : "banner--danger"}`} role="status">
          <span className="material-symbols-outlined" aria-hidden="true">{verify.data.ok ? "verified_user" : "gpp_bad"}</span>
          <span>
            Rantai audit {verify.data.ok ? "utuh" : "RUSAK"} — {verify.data.checked ?? 0} entri diperiksa
            {verify.data.broken_at_seq !== undefined && <> · terputus di seq #{verify.data.broken_at_seq}</>}.
          </span>
        </div>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Verifikasi rantai tidak tersedia.</strong> {verify.error}</span>
        </div>
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Konten kerja di database</h2>
      <section className="grid grid--2" aria-label="Isi database">
        <div className="card kpi"><div className="kpi__top"><span className="kpi__label">Work package</span></div><div className="kpi__value">{packages.ok ? packages.data.items.length : "?"}</div></div>
        <div className="card kpi"><div className="kpi__top"><span className="kpi__label">Task</span></div><div className="kpi__value">{tasks.ok ? tasks.data.items.length : "?"}</div></div>
      </section>

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Artefak legacy ({files.length})</h2>
      {files.length === 0 ? (
        <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><span>Tidak ada file data legacy di repo ini.</span></div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>File</th><th className="num">Ukuran</th><th className="num">Baris</th><th>Diubah</th></tr></thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name}>
                    <td className="mono">{file.name}</td>
                    <td className="num">{fmtBytes(file.bytes)}</td>
                    <td className="num">{file.lines ?? "—"}</td>
                    <td className="mono">{new Date(file.modified).toLocaleDateString("id-ID", { dateStyle: "medium" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
            Artefak ini dipakai tooling lama dan tidak dibaca aplikasi v2. Jangan dihapus sebelum cutover terverifikasi.
          </p>
        </>
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Yang belum, dan sengaja tidak disembunyikan</h2>
      <ul className="small muted" style={{ lineHeight: 1.8 }}>
        <li>PostgreSQL belum terverifikasi di mesin ini — development memakai SQLite; keduanya harus diuji sebelum cutover.</li>
        <li>Isi <code className="mono">data/*.json</code> belum diimpor ke database; tidak ada yang memigrasikannya otomatis.</li>
        <li>Tidak ada endpoint untuk mendaftar tabel atau menjalankan migrasi — migrasi lewat Alembic CLI, bukan UI.</li>
        <li>Konsistensi kontrak dibaca lewat audit chain dan <a href="/security">Security Center</a>, bukan lewat dump skema.</li>
      </ul>
    </>
  );
}
