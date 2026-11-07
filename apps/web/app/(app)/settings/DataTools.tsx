"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetConversations, type ResetOutcome } from "./actions";

/**
 * Dua aksi tab "Data & prototipe" (acuan apps/dashboard/assets/js/views/admin.js:309-326).
 *
 * Ekspor: tautan biasa ke ./export/route.ts yang meneruskan cookie/token
 * pemanggil ke `GET /api/v1/data/export`. Tidak ada data yang disimpan di
 * peramban, dan setiap ekspor tercatat di audit oleh backend.
 *
 * Reset: form dengan konfirmasi slug tenant. Tombol mati selama syarat belum
 * terpenuhi — bukan tombol yang mengirim lalu gagal diam-diam.
 */

export default function DataTools({ tenantSlug, canReset }: { tenantSlug: string; canReset: boolean }) {
  const [confirm, setConfirm] = useState("");
  const [outcome, setOutcome] = useState<ResetOutcome | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const slugKnown = tenantSlug !== "";
  const matches = slugKnown && confirm.trim() === tenantSlug;
  const disabled = !canReset || !matches || pending;

  function submit() {
    if (disabled) return;
    if (!window.confirm(`Hapus seluruh conversation tenant "${tenantSlug}"? Tindakan ini tercatat di audit.`)) {
      return;
    }
    setOutcome(null);
    startTransition(async () => {
      const result = await resetConversations(confirm.trim());
      setOutcome(result);
      if (result.ok) {
        setConfirm("");
        router.refresh();
      }
    });
  }

  return (
    <div className="stack" style={{ gap: "var(--s-4)" }}>
      <div>
        <div className="row row--wrap" style={{ gap: 8 }}>
          <a className="btn btn--secondary" href="/settings/export" style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              download
            </span>
            Ekspor seluruh data (JSON)
          </a>
          <span className="field__hint" style={{ flex: 1, minWidth: 220 }}>
            Berkas diunduh langsung dari <code className="mono">GET /api/v1/data/export</code> memakai wewenang
            pemanggil. Setiap ekspor menulis satu event audit <code className="mono">data_exported</code>.
          </span>
        </div>
      </div>

      <div className="divider" style={{ margin: 0 }} />

      <div>
        <h3 style={{ fontSize: 13, margin: "0 0 var(--s-2)" }}>Reset data prototipe</h3>

        {!canReset ? (
          <div className="banner banner--warning" role="status" style={{ marginBottom: "var(--s-3)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              lock
            </span>
            <span>
              <strong>Reset tidak tersedia untuk scope ini.</strong> Endpoint menuntut capability{" "}
              <code className="mono">manage_integrations</code>; tanpa itu server menjawab 403. Formulir tetap
              ditampilkan dalam keadaan mati supaya syaratnya jelas.
            </span>
          </div>
        ) : null}

        <div className="row row--wrap" style={{ gap: "var(--s-3)", alignItems: "flex-end" }}>
          <label className="field" htmlFor="reset-confirm" style={{ minWidth: 240, flex: "1 1 240px" }}>
            <span className="field__label">Ketik slug tenant untuk konfirmasi</span>
            <input
              id="reset-confirm"
              name="confirm"
              className="input mono"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={slugKnown ? tenantSlug : "slug tenant tidak terbaca"}
              autoComplete="off"
              disabled={!canReset || !slugKnown || pending}
              style={{ minHeight: 44 }}
              aria-describedby="reset-confirm-hint"
            />
            <span id="reset-confirm-hint" className="field__hint">
              {slugKnown
                ? `Harus sama persis dengan "${tenantSlug}". Scope yang dihapus: conversations + pesannya.`
                : "Slug tenant tidak terbaca (GET /settings gagal), jadi reset tidak bisa dikonfirmasi."}
            </span>
          </label>

          <button
            type="button"
            className="btn btn--danger-soft"
            style={{ minHeight: 44 }}
            disabled={disabled}
            aria-disabled={disabled}
            onClick={submit}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {pending ? "hourglass_top" : "restart_alt"}
            </span>
            {pending ? "Menghapus…" : "Reset conversation"}
          </button>
        </div>

        {outcome ? (
          outcome.ok ? (
            <div className="banner banner--success" role="status" style={{ marginTop: "var(--s-3)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">
                check_circle
              </span>
              <span>
                <strong>Reset selesai.</strong> {outcome.deleted_conversations} conversation dan{" "}
                {outcome.deleted_messages} pesan dihapus. Governance, audit, identitas, dan tenant tidak disentuh.
              </span>
            </div>
          ) : (
            <div className="banner banner--danger" role="alert" style={{ marginTop: "var(--s-3)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">
                error
              </span>
              <span>
                <strong>Reset gagal{outcome.status ? ` (HTTP ${outcome.status})` : ""}.</strong> {outcome.error}
              </span>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
