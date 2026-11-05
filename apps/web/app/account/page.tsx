import Link from "next/link";
import { apiGet } from "@/lib/api";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

type Permissions = {
  scope: string;
  principal: Record<string, unknown> | null;
  capabilities: string[];
  enforced_capabilities: string[];
  unbacked_capabilities: string[];
  all_capabilities: string[];
  scope_capabilities: Record<string, string[]>;
  note: string;
};

function Chips({ items, tone }: { items: string[]; tone: string }) {
  if (items.length === 0) return <span className="cell-sub">tidak ada</span>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {items.map((cap) => (
        <span key={cap} className={`badge ${tone}`}>{cap}</span>
      ))}
    </div>
  );
}

export default async function AccountPage() {
  const result = await apiGet<Permissions>("/permissions");

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Akun &amp; Izin Saya</h1>
          <p>Wewenang caller ini apa adanya: token membawa wewenang, bukan nama.</p>
        </div>
      </header>

      {result.ok ? (
        <>
          <div className="banner" role="status">
            <span className="material-symbols-outlined" aria-hidden="true">badge</span>
            <span>
              Scope pemanggil: <strong>{result.data.scope}</strong>. Principal:{" "}
              {result.data.principal === null
                ? "tidak ada (token gateway legacy / mode demo)"
                : <span className="mono">{JSON.stringify(result.data.principal)}</span>}
            </span>
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: "var(--s-3)" }}>
            {result.data.principal === null ? (
              <Link className="btn btn--primary" href="/login">
                <span className="material-symbols-outlined" aria-hidden="true">login</span>
                Masuk
              </Link>
            ) : (
              <SignOutButton />
            )}
          </div>

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Capability untuk scope ini</h2>
          <div className="card" style={{ padding: "var(--s-4)" }}>
            <Chips items={result.data.capabilities} tone="badge--success" />
            <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
              Ditegakkan endpoint: {result.data.enforced_capabilities.length} dari {result.data.all_capabilities.length} capability yang dikenal sistem.
            </p>
          </div>

          <h2 style={{ fontSize: 15, margin: "var(--s-5) 0 var(--s-3)" }}>Capability yang BELUM punya penegak</h2>
          <div className="card" style={{ padding: "var(--s-4)" }}>
            <Chips items={result.data.unbacked_capabilities} tone="badge--warning" />
            <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
              Capability ini dikenal kontrak tapi belum dijaga endpoint mana pun — tidak diberikan ke scope mana pun secara efektif.
            </p>
          </div>

          <div className="banner" style={{ marginTop: "var(--s-4)" }}>
            <span className="material-symbols-outlined" aria-hidden="true">info</span>
            <span>{result.data.note}</span>
          </div>
        </>
      ) : (
        <div className="banner banner--warning" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">error</span>
          <span><strong>Izin tidak tersedia.</strong> {result.error}</span>
        </div>
      )}
    </>
  );
}
