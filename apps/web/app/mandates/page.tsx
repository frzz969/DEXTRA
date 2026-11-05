import { apiGet } from "@/lib/api";
import RevokeButton from "./RevokeButton";

export const dynamic = "force-dynamic";

type MandateItem = {
  id: string;
  plan_id: string;
  approval_id: string | null;
  action_id: string;
  action_type: string;
  resource_scope: string | null;
  recipient_scope: string | null;
  approver_id: string | null;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  usable: boolean;
};

const STATUS_TONE: Record<string, string> = {
  issued: "badge--success",
  approved: "badge--success",
  executing: "badge--info",
  revoked: "badge--danger",
  expired: "badge--outline"
};

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default async function MandatesPage() {
  const result = await apiGet<{ items: MandateItem[] }>("/mandates");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Mandates</h1>
          <p>Mandate terbit dan statusnya. Pencabutan tercatat di jejak audit.</p>
        </div>
      </header>

      {result.ok ? (
        result.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">verified</span>
            <span>Belum ada mandat terbit untuk tenant ini.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Aksi</th>
                  <th>Plan</th>
                  <th>Approver</th>
                  <th>Terbit</th>
                  <th>Kedaluwarsa</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cell-title">{m.action_type}</div>
                      <div className="cell-sub mono truncate" title={m.id} style={{ maxWidth: 180 }}>
                        {m.id}
                      </div>
                    </td>
                    <td className="mono truncate" title={m.plan_id} style={{ maxWidth: 160 }}>
                      {m.plan_id}
                    </td>
                    <td className="truncate" title={m.approver_id ?? ""} style={{ maxWidth: 140 }}>
                      {m.approver_id ?? "—"}
                    </td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(m.issued_at)}</td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtAt(m.expires_at)}</td>
                    <td>
                      <span className={`badge ${STATUS_TONE[m.status] ?? "badge--outline"}`}>{m.status}</span>
                      {m.usable && <div className="cell-sub">dapat dipakai</div>}
                    </td>
                    <td>
                      {m.revoked_at ? (
                        <span className="cell-sub">dicabut {fmtAt(m.revoked_at)}</span>
                      ) : m.status === "expired" ? (
                        <span className="cell-sub">kedaluwarsa</span>
                      ) : (
                        <RevokeButton mandateId={m.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Data tidak tersedia.</strong> {result.error}
          </span>
        </div>
      )}
    </>
  );
}
