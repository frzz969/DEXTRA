/**
 * Matriks capability × peran untuk halaman /access.
 *
 * Seluruh isinya diturunkan dari respons `GET /roles` — tidak ada nama
 * capability atau nama peran yang ditulis di sini. Baris = gabungan capability
 * dari semua peran, kolom = peran (peran sistem lebih dulu, lalu alfabetis).
 */

type MatrixRole = {
  id: string;
  name: string;
  is_system: boolean;
  capabilities: string[];
};

const COLLATOR = new Intl.Collator("id", { sensitivity: "base" });

/** Gaya untuk sel kepala baris: `.table th` dirancang untuk header kolom. */
const ROW_HEAD_STYLE = {
  textAlign: "left" as const,
  textTransform: "none" as const,
  letterSpacing: 0,
  fontWeight: 400,
  fontSize: 11.5,
  whiteSpace: "normal" as const,
  background: "transparent",
  color: "var(--text)",
  position: "static" as const,
  padding: "7px 12px",
  borderBottom: "1px solid var(--border)",
  maxWidth: 260
};

export function CapabilityMatrix({ roles }: { roles: MatrixRole[] }) {
  const capabilitySet = new Set<string>();
  const held = new Map<string, Set<string>>();

  for (const role of roles) {
    const owned = new Set<string>();
    for (const raw of role.capabilities ?? []) {
      const capability = raw.trim();
      if (!capability) continue;
      owned.add(capability);
      capabilitySet.add(capability);
    }
    held.set(role.id, owned);
  }

  const capabilities = [...capabilitySet].sort(COLLATOR.compare);
  const columns = [...roles].sort((a, b) => {
    if (a.is_system !== b.is_system) return a.is_system ? -1 : 1;
    return COLLATOR.compare(a.name, b.name);
  });

  if (capabilities.length === 0) {
    return (
      <p className="field__hint">
        Tidak ada capability yang tercatat pada peran mana pun, jadi matriks belum bisa digambar.
        Daftar ini sengaja tidak diisi contoh.
      </p>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table table--compact">
          <caption className="sr-only">
            Matriks capability per peran. Setiap baris adalah satu capability, setiap kolom adalah
            satu peran. Tanda centang berarti peran tersebut memiliki capability itu; tanda pisah
            berarti tidak.
          </caption>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              {columns.map((role) => (
                <th key={role.id} scope="col">
                  {role.name}
                  {role.is_system ? <span className="sr-only"> (peran sistem)</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((capability) => (
              <tr key={capability}>
                <th scope="row" className="mono mono--wrap" style={ROW_HEAD_STYLE}>
                  {capability}
                </th>
                {columns.map((role) => {
                  const has = held.get(role.id)?.has(capability) ?? false;
                  return (
                    <td key={role.id} style={{ textAlign: "center" }}>
                      {has ? (
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                          style={{ fontSize: 18, color: "var(--success-600)" }}
                        >
                          check
                        </span>
                      ) : (
                        <span aria-hidden="true" style={{ color: "var(--faint)" }}>
                          –
                        </span>
                      )}
                      <span className="sr-only">{has ? "tersedia" : "tidak"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
        Centang = peran memiliki capability tersebut. Diturunkan langsung dari{" "}
        <code className="mono">GET /roles</code>; tidak ada capability yang ditambahkan di UI.
      </p>
    </>
  );
}
