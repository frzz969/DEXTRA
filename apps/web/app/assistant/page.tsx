import Link from "next/link";
import { apiGet } from "@/lib/api";
import AssistantChat from "./AssistantChat";

export const dynamic = "force-dynamic";

type PolicyItem = { id: string; slug: string; title: string; scope: string; is_active: boolean; versions: number };
type Permissions = { scope: string; principal: Record<string, unknown> | null };

export default async function AssistantPage() {
  const [policies, permissions] = await Promise.all([
    apiGet<{ items: PolicyItem[] }>("/policies"),
    apiGet<Permissions>("/permissions")
  ]);

  const activePolicies = policies.ok ? policies.data.items.filter((p) => p.is_active).slice(0, 5) : [];

  return (
    <>
      <header className="page-head" style={{ marginBottom: "var(--s-4)" }}>
        <div className="page-head__text">
          <h1>AI Assistant</h1>
          <p>Asisten menyusun draf dan menjelaskan alur governance. Tidak mengirim, tidak menyetujui, tidak mengeksekusi — semua berhenti di manusia.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/office-agent">
            <span className="material-symbols-outlined" aria-hidden="true">list_alt</span>
            Office Agent
          </Link>
        </div>
      </header>

      <div className="chat-grid" style={{ height: "auto", minHeight: 480 }}>
      <AssistantChat
        aiConfigured={Boolean(process.env.DEXTRA_AI_API_KEY)}
        model={process.env.DEXTRA_AI_MODEL ?? "gpt-4o-mini"}
      />

      <aside className="chat-rail" aria-label="Batas dan konteks">
        <div className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }}>
          <h2 style={{ fontSize: 13, margin: 0 }}>Batas yang berlaku</h2>
          {policies.ok ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)", marginTop: "var(--s-3)" }}>
              {activePolicies.length === 0 ? (
                <p className="field__hint">Tidak ada kebijakan aktif yang terlihat.</p>
              ) : (
                activePolicies.map((policy) => (
                  <div className="row" key={policy.id} style={{ alignItems: "flex-start", gap: 8 }}>
                    <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 15, color: "var(--warning-600)", marginTop: 2 }}>policy</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="tiny strong">{policy.title}</div>
                      <div className="tiny muted">{policy.slug} · ruang lingkup {policy.scope} · {policy.versions} versi</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <p className="field__hint" role="status" style={{ marginTop: "var(--s-3)" }}>Kebijakan tidak tersedia: {policies.error}</p>
          )}
        </div>

        <div className="card" style={{ padding: "var(--s-4)", marginBottom: "var(--s-4)" }}>
          <h2 style={{ fontSize: 13, margin: 0 }}>Alur persetujuan</h2>
          <ol className="small" style={{ margin: "var(--s-3) 0 0", paddingLeft: "var(--s-4)", lineHeight: 1.9 }}>
            <li>Draf dibuat (Anda &amp; AI)</li>
            <li>Plan dinilai validator</li>
            <li>Manusia memutus: setujui / tolak</li>
            <li>Mandat diterbitkan dari approval</li>
            <li>Eksekusi hanya lewat mandat</li>
          </ol>
        </div>

        <div className="card" style={{ padding: "var(--s-4)" }}>
          <h2 style={{ fontSize: 13, margin: 0 }}>Sesi &amp; jalur data</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)", marginTop: "var(--s-3)" }} className="small">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Caller</span>
              <span className="mono">{permissions.ok ? permissions.data.scope : "tidak tersedia"}</span>
            </div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">Identitas</span>
              <span>{permissions.ok && permissions.data.principal === null ? "token gateway (tanpa nama)" : "sesi/pengguna"}</span>
            </div>
            <p className="field__hint" style={{ marginTop: 4 }}>
              Pesan Anda diproses oleh AI provider yang dikonfigurasi di server; riwayat tidak disimpan ke database. Tidak ada tindakan yang berjalan tanpa persetujuan manusia.
            </p>
          </div>
        </div>
      </aside>
      </div>
    </>
  );
}