"use client";

/**
 * Ekspor CSV dari baris yang benar-benar dikembalikan API.
 *
 * Tidak ada kolom yang dikarang: setiap kolom di sini berasal dari
 * `GET /api/v1/work-packages` (id, title, status, priority, task_count, due_at)
 * ditambah nama agen yang diturunkan dari `GET /api/v1/tasks` + `/agents`.
 * Kolom Risiko, Mandat, dan "Diperbarui" tidak ada di payload — karena itu
 * tidak diekspor, bukan diisi nilai contoh.
 */

export type CsvRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  task_count: number;
  due_at: string | null;
  agents: string[];
};

const HEADER = ["ID", "Judul", "Status", "Prioritas", "Jumlah tugas", "Tenggat", "Agen pada tugas"];

function cell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /["\n\r,;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ExportCsvButton({
  rows,
  filename = "dextra-work-packages.csv"
}: {
  rows: CsvRow[];
  filename?: string;
}) {
  function download() {
    const lines: (string | number | null)[][] = [
      HEADER,
      ...rows.map((row) => [
        row.id,
        row.title,
        row.status,
        row.priority,
        row.task_count,
        row.due_at ?? "",
        row.agents.join(" | ")
      ])
    ];
    const csv = lines.map((line) => line.map(cell).join(",")).join("\r\n");
    // BOM supaya Excel membaca UTF-8 (huruf berdiakritik) dengan benar.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const disabled = rows.length === 0;
  return (
    <button
      type="button"
      className="btn btn--secondary"
      onClick={download}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={disabled ? "Tidak ada baris untuk diekspor" : `Ekspor ${rows.length} work package ke CSV`}
      title={disabled ? "Tidak ada baris untuk diekspor" : undefined}
      style={{ minHeight: 44 }}
    >
      <span className="material-symbols-outlined" aria-hidden="true">download</span>
      Ekspor CSV{disabled ? "" : ` (${rows.length})`}
    </button>
  );
}
