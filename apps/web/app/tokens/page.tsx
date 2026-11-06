import { getMeta, getPermissions, getServiceAccounts, getTokens } from "@/lib/api";
import { CreateServiceAccountForm, CreateTokenForm, ServiceAccountRevokeButton, TokenRowActions } from "./TokenForms";

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
  expired: "badge--outline",
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
  const [tokens, serviceAccounts, permissions, meta] = await Promise.all([
    getTokens(),
    getServiceAccounts(),
    getPermissions(),
    getMeta(),
  ]);

  const canManage = permissions.ok && permissions.data.capabilities.includes("manage_integrations");
  const isSession = meta.ok && meta.data.auth_kind === "session";
  const canCreateToken = isSession;
  const serviceAccountKinds =
    serviceAccounts.ok && serviceAccounts.data.kinds && serviceAccounts.data.kinds.length > 0
      ? serviceAccounts.data.kinds
      : ["worker", "mcp", "agent", "integration"];
  const accountsForSelect: { id: string; name: string }[] = serviceAccounts.ok
    ? (serviceAccounts.data.items as ServiceAccount[]).map((a) => ({ id: a.id, name: a.name }))
    : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Token &amp; Identitas Mesin</h1>
          <p>Token API (prefix saja, secret tidak ditampilkan) dan service account. Secret hanya muncul sekali, saat buat atau putar.</p>
        </div>
      </header>

      {permissions.ok ? (
        <div className="banner" role="status" style={{ marginBottom: "var(--s-4)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">key</span>
          <span>
            Capability Anda: {permissions.data.capabilities.length > 0 ? (
              <span className="mono">{permissions.data.capabilities.join(", ")}</span>
            ) : (
              "tidak ada capability administratif"
            )}
            {meta.ok && <> · jalur masuk: <span className="mono">{meta.data.auth_kind}</span></>}
          </span>
        </div>
      ) : (
        <SectionUnavailable title="Konteks capability" error={permissions.error} />
      )}

      <h2 style={{ fontSize: 15, margin: "0 0 var(--s-3)" }}>Token API</h2>
      {tokens.ok ? (
        (tokens.data.items as TokenItem[]).length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">vpn_key</span>
            <span>Tidak ada token yang bisa dilihat caller ini.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <caption className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                Daftar token API tenant ini. Secret tidak pernah ditampilkan.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  <th scope="col">Prefix</th>
                  <th scope="col">Owner</th>
                  <th scope="col">Scopes</th>
                  <th scope="col">Status</th>
                  <th scope="col">Kadaluwarsa</th>
                  <th scope="col">Terakhir dipakai</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(tokens.data.items as TokenItem[]).map((token) => (
                  <tr key={token.id}>
                    <td>{token.name}</td>
                    <td className="mono">{token.prefix}…</td>
                    <td>
                      <span className="badge badge--outline">{token.owner}</span>
                    </td>
                    <td className="truncate" style={{ maxWidth: 200 }} title={token.scopes.join(", ")}>
                      {token.scopes.join(", ")}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_TONE[token.status] ?? "badge--outline"}`}>{token.status}</span>
                    </td>
                    <td className="mono">{fmtAt(token.expires_at)}</td>
                    <td className="mono">{fmtAt(token.last_used_at)}</td>
                    <td>
                      <TokenRowActions tokenId={token.id} status={token.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <SectionUnavailable title="Daftar token" error={tokens.error} />
      )}

      {tokens.ok && canCreateToken ? (
        <CreateTokenForm serviceAccounts={accountsForSelect} />
      ) : tokens.ok ? (
        <div className="banner banner--warning" role="status" style={{ marginTop: "var(--s-3)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <span>
            Membuat token butuh sesi login manusia{meta.ok ? <> — jalur masuk saat ini <span className="mono">{meta.data.auth_kind}</span></> : null}.
            Masuk lewat halaman login, lalu kembali ke sini.
          </span>
        </div>
      ) : null}

      <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Service account</h2>
      {serviceAccounts.ok ? (
        (serviceAccounts.data.items as ServiceAccount[]).length === 0 ? (
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">smart_toy</span>
            <span>Tidak ada service account.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <caption className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                Daftar service account tenant ini.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Token</th>
                  <th scope="col">Dibuat</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(serviceAccounts.data.items as ServiceAccount[]).map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td className="mono">{account.kind}</td>
                    <td>
                      <span className={`badge ${account.status === "active" ? "badge--success" : "badge--outline"}`}>
                        {account.status}
                      </span>
                    </td>
                    <td className="num">{account.token_count}</td>
                    <td className="mono">{fmtAt(account.created_at)}</td>
                    <td>
                      {account.status === "active" ? (
                        <ServiceAccountRevokeButton accountId={account.id} />
                      ) : (
                        <span className="cell-sub">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <SectionUnavailable title="Service account" error={serviceAccounts.error} />
      )}

      {serviceAccounts.ok && canManage && isSession ? (
        <CreateServiceAccountForm kinds={serviceAccountKinds} />
      ) : serviceAccounts.ok ? (
        <div className="banner" role="status" style={{ marginTop: "var(--s-3)" }}>
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <span>
            Membuat service account butuh sesi login dan capability manage_integrations.
            {canManage ? "" : " Capability Anda tidak mencakupnya."}
            {isSession ? "" : " Jalur masuk saat ini bukan sesi."}
          </span>
        </div>
      ) : null}
    </>
  );
}
