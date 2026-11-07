import Link from "next/link";
import { apiGet } from "@/lib/api";
import { AgentAvatar } from "@/components/agents";
import { WORKERS, findWorker, type Worker } from "@/lib/workers";
import AssistantChat from "./AssistantChat";
import "./assistant.css";

export const dynamic = "force-dynamic";

type PolicyItem = { id: string; slug: string; title: string; scope: string; is_active: boolean; versions: number };
type Permissions = { scope: string; principal: Record<string, unknown> | null };

export default async function AssistantPage({
  searchParams,
}: {
  searchParams?: Promise<{ worker?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const workerSlug = (params.worker ?? "").trim();
  const worker = workerSlug ? findWorker(workerSlug) : undefined;

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
          <p>
            {worker
              ? `${worker.name} (${worker.role}) memimpin percakapan ini. Ia menyusun draf dan menilai risiko — tidak mengirim, tidak menyetujui, tidak mengeksekusi.`
              : "Asisten menyusun draf dan menjelaskan alur governance. Tidak mengirim, tidak menyetujui, tidak mengeksekusi — semua berhenti di manusia."}
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/office-agent">
            <span className="material-symbols-outlined" aria-hidden="true">list_alt</span>
            Office Agent
          </Link>
        </div>
      </header>

      {workerSlug && !worker ? (
        <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Worker tidak dikenal.</strong> Tidak ada worker dengan slug{" "}
            <code className="mono mono--wrap">{workerSlug}</code>. Percakapan berjalan sebagai asisten biasa.
          </span>
        </div>
      ) : null}

      <section className="card spawn" aria-labelledby="spawn-heading" style={{ marginBottom: "var(--s-4)" }}>
        <div className="card__head">
          <div>
            <h2 id="spawn-heading" style={{ fontSize: 15, margin: 0 }}>Spawn worker</h2>
            <p style={{ margin: "4px 0 0" }}>
              {worker ? `Aktif: ${worker.name}. Ganti kapan saja tanpa kehilangan batas governance.` : "Pilih satu worker untuk memimpin percakapan ini."}
            </p>
          </div>
          {worker && (
            <Link className="btn btn--ghost" href="/assistant" style={{ minHeight: 44 }}>
              <span className="material-symbols-outlined" aria-hidden="true">close</span>
              Keluar
            </Link>
          )}
        </div>
        <div className="card__body">
          <div className="spawn__grid">
            {WORKERS.map((option: Worker) => {
              const active = option.slug === worker?.slug;
              return (
                <Link
                  key={option.slug}
                  href={`/assistant?worker=${encodeURIComponent(option.slug)}`}
                  className={`spawn__card${active ? " spawn__card--active" : ""}`}
                  aria-current={active ? "true" : undefined}
                >
                  <AgentAvatar slug={option.slug} name={option.name} size="md" />
                  <span className="spawn__text">
                    <span className="spawn__name">{option.name}</span>
                    <span className="spawn__role">{option.role}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="field__hint" style={{ margin: 0 }}>
            Keempat worker berjalan di <strong>model AI yang sama</strong> — yang berbeda hanya instruksi perannya.
            Tidak ada worker yang boleh bertindak tanpa mandat dan persetujuan manusia.
          </p>
        </div>
      </section>

      <div className="chat-grid" style={{ height: "auto", minHeight: 480 }}>
      <AssistantChat
        aiConfigured={Boolean(process.env.DEXTRA_AI_API_KEY)}
        model={process.env.DEXTRA_AI_MODEL ?? "gpt-4o-mini"}
        worker={worker}
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
