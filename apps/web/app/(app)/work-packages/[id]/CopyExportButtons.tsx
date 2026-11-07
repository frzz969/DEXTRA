"use client";

import { useState } from "react";

/**
 * "Salin ID" dan "Ekspor JSON" — keduanya bekerja pada data yang benar-benar
 * dikembalikan `GET /api/v1/work-packages/{id}`, bukan pada objek contoh.
 * Tidak ada tombol yang tidak melakukan apa pun: kalau clipboard ditolak
 * browser (konteks non-HTTPS), pengguna diberi tahu lewat status, bukan
 * dibiarkan mengira ID sudah tersalin.
 */
export default function CopyExportButtons({
  id,
  payload,
  filename
}: {
  id: string;
  payload: unknown;
  filename: string;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");

  async function copy() {
    try {
      if (!navigator.clipboard) {
        setCopied("fail");
        return;
      }
      await navigator.clipboard.writeText(id);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied("idle"), 2500);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="btn-group">
      <button type="button" className="btn btn--secondary" onClick={copy} style={{ minHeight: 44 }}>
        <span className="material-symbols-outlined" aria-hidden="true">content_copy</span>
        Salin ID
      </button>
      <button type="button" className="btn btn--secondary" onClick={exportJson} style={{ minHeight: 44 }}>
        <span className="material-symbols-outlined" aria-hidden="true">download</span>
        Ekspor JSON
      </button>
      <span role="status" aria-live="polite" className="field__hint" style={{ alignSelf: "center" }}>
        {copied === "ok" ? "ID disalin." : copied === "fail" ? "Clipboard ditolak browser — salin manual dari ID di bawah." : ""}
      </span>
    </div>
  );
}
