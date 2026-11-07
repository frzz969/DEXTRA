import Link from "next/link";
import { getMandate } from "@/lib/api";
import { Unavailable } from "@/components/states";
import RevokeButton from "../RevokeButton";

export const dynamic = "force-dynamic";

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <span className="mono" style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

export default async function MandateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getMandate(id);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Detail Mandate</h1>
          <p className="mono">{id}</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn" href="/mandates">Kembali</Link>
        </div>
      </header>

      {!result.ok ? (
        <Unavailable title="Mandate" error={result.error} />
      ) : (
        <div className="card" style={{ display: "grid", gap: "var(--s-4)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span className={`badge ${result.data.usable ? "badge--success" : "badge--outline"}`}>
              {result.data.status}
            </span>
            <span className="field__hint">{result.data.usable ? "Dapat dipakai untuk eksekusi." : "Tidak dapat dipakai."}</span>
          </div>

          <div className="grid grid--3">
            <Row label="Aksi" value={`${result.data.action_type} / ${result.data.action_id}`} />
            <Row label="Plan" value={result.data.plan_id} />
            <Row label="Approval" value={result.data.approval_id ?? "—"} />
            <Row label="Approver" value={result.data.approver_id ?? "—"} />
            <Row label="Resource scope" value={result.data.resource_scope ?? "—"} />
            <Row label="Recipient scope" value={result.data.recipient_scope ?? "—"} />
            <Row label="Terbit" value={fmtAt(result.data.issued_at)} />
            <Row label="Kedaluwarsa" value={fmtAt(result.data.expires_at)} />
            <Row label="Dicabut" value={fmtAt(result.data.revoked_at)} />
          </div>

          <div>
            {result.data.revoked_at ? (
              <div className="banner banner--danger" role="status">
                <span className="material-symbols-outlined" aria-hidden="true">block</span>
                <span>Mandate ini sudah dicabut pada {fmtAt(result.data.revoked_at)}.</span>
              </div>
            ) : result.data.status === "expired" ? (
              <div className="banner" role="status">
                <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                <span>Mandate ini sudah kedaluwarsa.</span>
              </div>
            ) : (
              <RevokeButton mandateId={result.data.id} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
