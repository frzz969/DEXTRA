import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type TokenItem = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  owner: string;
  owner_id: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
};

type ServiceAccount = {
  id: string;
  name: string;
  kind: string;
  status: string;
  token_count: number;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  active: "badge--success",
  revoked: "badge--danger",
  expired: "badge--outline"
};

function SectionUnavailable({ title, error }: { title: string; error: string }) {
  return (
    <div className="banner banner--warning" role="status" style={{ marginTop: "var(--s-2)" }}>
      <span className="material-symbols-outlined" aria-hidden="true">lock</span>
      <span>
        <strong>{title} tidak tersedia.</strong> {error}
      </span>
    </div>
  );
}

function fmtAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

export default async function TokensPage() {
  const [tokens, serviceAccounts] = await Promise.all([
    apiGet<{ items: TokenItem[] }>("/tokens"),
    apiGet<{ items: ServiceAccount[] }>("/service-accounts")
  ]);

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Token &amp; Identitas Mesin</h1>
          <p>Inventaris token (prefix saja — secret tidak pernah ditampilkan) dan service account. Pembuatan/rotasi menuntut sesi manusia.</p>
        </div>
      </header>

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Token API</h2>
      {tokens.ok ? (
        tokens.data.items.length === 0 ? (
          <div className="banner">
            <span className="material-symbols-outlined" aria-hidden="true">vpn_key</span>
            <span>Tidak ada token yang bisa dilihat oleh caller ini (hanya milik Anda atau capability manage_integrations).</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Nama</th><th>Prefix</th><th>Owner</th><th>Scopes</th><th>Status</th><th>Kadaluwarsa</th></tr>
              </thead>
              <tbody>
                {tokens.data.items.map((token) => (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td className="mono">{token.prefix}…</td>
                    <td><span className="badge badge--outline">{token.owner}</span></td>
                    <td className="truncate" style={{ maxWidth: 200 }} title={token.scopes.join(", ")}>
                      {token.scopes.join(", ")}
                    </td>
                    <td><span className={`badge ${STATUS_TONE[token.status] ?? "badge--outline"}`}>{token.status}</span></td>
                    <td className="mono">{fmtAt(token.expires_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <SectionUnavailable title="Daftar token" error={tokens.error} />
      )}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Service account</h2>
      {serviceAccounts.ok ? (
        serviceAccounts.data.items.length === 0 ? (
          <div className="banner"><span className="material-symbols-outlined" aria-hidden="true">smart_toy</span><span>Tidak ada service account.</span></div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr><th>Nama</th><th>Kind</th><th>Status</th><th className="num">Token aktif</th><th>Dibuat</th></tr>
              </thead>
              <tbody>
                {serviceAccounts.data.items.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td className="mono">{account.kind}</td>
                    <td><span className={`badge ${account.status === "active" ? "badge--success" : "badge--outline"}`}>{account.status}</span></td>
                    <td className="num">{account.token_count}</td>
                    <td className="mono">{fmtAt(account.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <SectionUnavailable title="Service account" error={serviceAccounts.error} />
      )}

      <div className="banner" style={{ marginTop: "var(--s-4)" }}>
        <span className="material-symbols-outlined" aria-hidden="true">info</span>
        <span>Menerbitkan token baru menuntut sesi login manusia dan capability manage_integrations — caller ini tidak bisa melakukannya. Token yang bocor dicabut dari sini atau dari Security Center.</span>
      </div>
    </>
  );
}
