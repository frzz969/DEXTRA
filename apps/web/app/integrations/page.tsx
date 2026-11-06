import Link from "next/link";
import { getExecutions } from "@/lib/api";

export const dynamic = "force-dynamic";

type ExecutionItem = {
  id: string;
  status: string;
  adapter: string | null;
  started_at: string | null;
};

type ChannelCard = {
  name: string;
  icon: string;
  claim: string;
  setup: string;
  href?: string;
};

/* Status konektor tidak punya endpoint. Yang ditulis di bawah ini adalah
 * fakta dari kode backend dan docs/CHANNEL-SETUP.md, bukan status koneksi.
 * Tidak ada badge "terhubung" tanpa pembuktian dari API. */

const CHANNELS: ChannelCard[] = [
  {
    name: "Telegram",
    icon: "send",
    claim: "Bot terpisah lewat TELEGRAM_BOT_TOKEN di environment. Bukan konektor lewat API :8000.",
    setup: "Buat bot di @BotFather, isi TELEGRAM_BOT_TOKEN, jalankan dev telegram. Setiap user harus ditautkan ke akun tenant; tanpa tautan pesan ditolak.",
  },
  {
    name: "WhatsApp",
    icon: "chat",
    claim: "Belum diimplementasikan. Tidak ada adapter dan tidak ada endpoint.",
    setup: "Status resmi di docs/CHANNEL-SETUP.md: post-MVP. Jangan anggap tersedia.",
  },
  {
    name: "Email",
    icon: "mail",
    claim: "Adapter lokal menulis file .eml ke data/outbox lewat execution service. Tidak ada server email eksternal yang dihubungi.",
    setup: "Action send_email di office-agent menghasilkan file outbox. Bukti nyata ada di daftar eksekusi.",
    href: "/executions",
  },
  {
    name: "Kalender",
    icon: "calendar_month",
    claim: "Adapter lokal menulis file .ics ke data/outbox. Sama seperti email: file lokal.",
    setup: "Action calendar di execution service menghasilkan file .ics.",
    href: "/executions",
  },
  {
    name: "Dokumen",
    icon: "description",
    claim: "Tidak ada konektor dokumen. Tidak ada endpoint upload atau sinkronisasi dokumen.",
    setup: "Perlu endpoint dan adapter resmi sebelum UI bisa menampilkan status.",
  },
];

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default async function IntegrationsPage() {
  const executions = await getExecutions(20);
  const recent: ExecutionItem[] = executions.ok ? executions.data.items : [];
  const succeeded = recent.filter((item) => item.status === "succeeded" || item.status === "completed").length;

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Integrations</h1>
          <p>Kanal yang dipakai DEXTRA lewat integration layer. Status di bawah ini fakta dari kode, bukan klaim koneksi.</p>
        </div>
      </header>

      <div className="banner banner--warning" role="alert" style={{ marginBottom: "var(--s-4)" }}>
        <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
        <span>
          <strong>Status konektor belum terhubung.</strong> Backend tidak menyediakan endpoint status konektor,
          jadi halaman ini tidak menampilkan badge terhubung untuk kanal mana pun. Menampilkan “terhubung”
          tanpa endpoint hanya akan menipu.
        </span>
      </div>

      <div className="card" style={{ marginBottom: "var(--s-4)" }}>
        <div className="card__head">
          <div>
            <h2>Kanal</h2>
            <p>Apa yang benar-benar ada di backend hari ini</p>
          </div>
        </div>
        <div className="card__body card__body--flush">
          {CHANNELS.map((channel) => (
            <div key={channel.name} className="int-row">
              <span className="spec-avatar spec-avatar--engine" aria-hidden="true">
                <span className="material-symbols-outlined">{channel.icon}</span>
              </span>
              <div className="int-row__main">
                <span className="small strong">{channel.name}</span>
                <p className="int-row__desc">{channel.claim}</p>
                <p className="int-row__desc">{channel.setup}</p>
              </div>
              <div className="int-row__side">
                {channel.href ? (
                  <Link className="btn btn--secondary btn--sm" href={channel.href} style={{ minHeight: 44 }}>
                    Lihat eksekusi
                  </Link>
                ) : (
                  <span className="badge badge--outline">belum tersedia</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Bukti integration layer (eksekusi nyata)</h2>
      {executions.ok ? (
        recent.length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">play_circle</span>
            <span>Belum ada eksekusi. Adapter email dan kalender belum pernah dipanggil.</span>
          </div>
        ) : (
          <>
            <div className="banner" role="status" style={{ marginBottom: "var(--s-3)" }}>
              <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
              <span>
                {recent.length} eksekusi terakhir dari <code className="mono">GET /executions</code>, adapter{" "}
                <span className="mono">{recent[0]?.adapter ?? "—"}</span>. {succeeded} selesai.
              </span>
            </div>
            <div className="table-wrap">
              <table className="table table--compact">
                <caption className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  Eksekusi terakhir lewat integration layer.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Eksekusi</th>
                    <th scope="col">Status</th>
                    <th scope="col">Adapter</th>
                    <th scope="col">Mulai</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item) => (
                    <tr key={item.id}>
                      <td className="mono truncate" style={{ maxWidth: 220 }} title={item.id}>
                        {item.id}
                      </td>
                      <td>
                        <span className="badge badge--outline">{item.status}</span>
                      </td>
                      <td className="mono">{item.adapter ?? "—"}</td>
                      <td className="mono">{fmtAt(item.started_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : (
        <div className="banner banner--warning" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span>
            <strong>Daftar eksekusi tidak tersedia.</strong> {executions.error}
          </span>
        </div>
      )}

      <p className="field__hint" style={{ marginTop: "var(--s-4)" }}>
        Setup Telegram resmi ada di <code className="mono">docs/CHANNEL-SETUP.md</code> di repo.
        Pengelolaan token dan service account ada di <Link href="/tokens">Token &amp; Identitas Mesin</Link>.
      </p>
    </>
  );
}
