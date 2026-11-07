import type { Metadata } from "next";
import Link from "next/link";
import {
  getOfficePlan,
  getPermissions,
  getPolicies,
  type OfficePlan,
  type PolicyItem,
} from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";
import PlanActionButtons from "@/app/(app)/approvals/PlanActionButtons";

export const dynamic = "force-dynamic";

type Finding = OfficePlan["findings"][number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Review ${id} — DEXTRA` };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function fmtAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

/** Status akhir dari backend: `received`, `partially_approved`, `rejected`. */
function isDecided(status: string): boolean {
  return /approved|rejected|executed/i.test(status);
}

function isRejected(status: string): boolean {
  return /reject/i.test(status);
}

/**
 * Nada temuan. Policy engine menulis `decision` (allow|deny|review); plan yang
 * dikirim worker lain boleh memakai `severity` (blocking|warning). Keduanya
 * dibaca, tanpa menebak yang tidak ada.
 */
function findingTone(finding: Finding): "danger" | "warning" | "info" {
  const decision = str(finding.decision).toLowerCase();
  const severity = str(finding.severity).toLowerCase();
  if (decision === "deny" || severity === "blocking") return "danger";
  if (decision === "review" || severity === "warning") return "warning";
  return "info";
}

function findingIcon(finding: Finding): string {
  const tone = findingTone(finding);
  return tone === "danger" ? "block" : tone === "warning" ? "warning" : "info";
}

/**
 * Policy yang tersentuh temuan.
 *
 * API tidak memberi atribusi temuan → policy: `POST /policies/evaluate`
 * mengembalikan `findings[].code` saja, tanpa slug policy. Jadi pencocokan di
 * sini heuristik dan disebut apa adanya di UI: `policy_slug` eksplisit bila ada,
 * selain itu token slug policy (≥4 huruf) yang muncul di code/pesan temuan.
 */
function findingsForPolicy(policy: PolicyItem, findings: Finding[]): Finding[] {
  const slug = policy.slug.toLowerCase();
  const tokens = slug.split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  return findings.filter((finding) => {
    const declared = str(finding.policy_slug).toLowerCase();
    if (declared && declared === slug) return true;
    const haystack = `${str(finding.code)} ${str(finding.message)}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");
    return tokens.some((token) => haystack.includes(token));
  });
}

function Breadcrumbs({ planId }: { planId: string }) {
  return (
    <nav className="breadcrumbs" style={{ marginBottom: 10 }} aria-label="Breadcrumb">
      <Link href="/review">Review &amp; Validation</Link>
      <span className="sep">/</span>
      <span className="current mono">{planId}</span>
    </nav>
  );
}

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [planResult, policiesResult, permissionsResult] = await Promise.all([
    getOfficePlan(id),
    getPolicies(),
    getPermissions(),
  ]);

  /* ---- Keadaan tidak ada data: plan tidak dikenal (HTTP 404) ---- */
  if (!planResult.ok && planResult.status === 404) {
    return (
      <>
        <Breadcrumbs planId={id} />
        <header className="page-head">
          <div className="page-head__text">
            <h1>Plan tidak ditemukan</h1>
            <p>Tidak ada rencana dengan id ini di tenant pemanggil.</p>
          </div>
        </header>
        <div className="card card--pad">
          <EmptyState
            icon="search_off"
            title={`Plan ${id} tidak ada.`}
            body="Periksa tautan atau kembali ke antrean review."
            action={{ href: "/review", label: "Review & Validation" }}
          />
        </div>
      </>
    );
  }

  /* ---- Keadaan tidak tersedia: backend tidak menjawab sama sekali ---- */
  if (!planResult.ok && planResult.status === undefined) {
    return (
      <>
        <Breadcrumbs planId={id} />
        <header className="page-head">
          <div className="page-head__text">
            <h1>Review plan</h1>
            <p>Ringkasan rencana, temuan, dan keputusan.</p>
          </div>
        </header>
        <Unavailable title="Plan" error={planResult.error} />
        <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
          <Link
            className="btn btn--secondary btn--sm"
            href={`/unavailable?reason=${encodeURIComponent(planResult.error)}&next=${encodeURIComponent(`/review/${id}`)}`}
            style={{ minHeight: 44 }}
          >
            Buka layar status layanan
          </Link>
        </p>
      </>
    );
  }

  /* ---- Keadaan galat: server menjawab, tetapi menolak permintaan ---- */
  if (!planResult.ok) {
    const forbidden = planResult.status === 403;
    return (
      <>
        <Breadcrumbs planId={id} />
        <header className="page-head">
          <div className="page-head__text">
            <h1>Review plan</h1>
            <p>Ringkasan rencana, temuan, dan keputusan.</p>
          </div>
        </header>
        <div className="banner banner--danger" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          <span>
            <strong>Plan tidak bisa dibaca.</strong> {planResult.error}
            <span className="tiny" style={{ display: "block", marginTop: 4 }}>
              {forbidden ? (
                <>
                  Server menolak atas nama peran Anda — lihat{" "}
                  <Link href="/forbidden?need=view_own">halaman wewenang</Link>.
                </>
              ) : (
                <>
                  Endpoint <code className="mono">GET /office-agent/plans/{"{id}"}</code>{" "}
                  membutuhkan identitas yang terikat tenant. Bila pesannya menyebut tenant,
                  itu sebabnya — bukan plan yang hilang.
                </>
              )}
            </span>
          </span>
        </div>
      </>
    );
  }

  /* ---- Ada data ---- */
  const plan = planResult.data;
  const actions = plan.actions ?? [];
  const findings = plan.findings ?? [];
  const decided = isDecided(plan.status ?? "");
  const canApprove = permissionsResult.ok
    ? permissionsResult.data.capabilities.includes("approve")
    : false;

  return (
    <>
      <Breadcrumbs planId={plan.plan_id} />

      <header className="page-head">
        <div className="page-head__text">
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span className={`badge ${decided ? (isRejected(plan.status) ? "badge--danger" : "badge--success") : "badge--outline"}`}>
              {plan.status}
            </span>
            <span className="badge badge--outline">{actions.length} tindakan</span>
            <span className="badge badge--outline">{findings.length} temuan</span>
          </div>
          <h1 className="mono" style={{ wordBreak: "break-all" }}>
            {plan.plan_id}
          </h1>
          <p style={{ marginTop: 4 }}>
            Diajukan {fmtAt(plan.created_at)} · request{" "}
            <span className="mono">{plan.request_id}</span>
          </p>
        </div>
        <div className="page-head__actions">
          <Link className="btn btn--secondary" href="/review" style={{ minHeight: 44 }}>
            <span className="material-symbols-outlined" aria-hidden="true">
              arrow_back
            </span>
            Antrean review
          </Link>
        </div>
      </header>

      <div className="grid grid--sidebar">
        <div className="stack">
          {/* Ringkasan rencana */}
          <section className="card" aria-label="Ringkasan rencana">
            <div className="card__head">
              <div>
                <h2>Ringkasan rencana</h2>
                <p>Yang dinilai sebelum keputusan dibuat</p>
              </div>
            </div>
            <div className="card__body">
              <dl className="def-list">
                <dt>Plan ID</dt>
                <dd className="mono">{plan.plan_id}</dd>
                <dt>Request ID</dt>
                <dd className="mono">{plan.request_id}</dd>
                <dt>Status</dt>
                <dd>{plan.status}</dd>
                <dt>Dibuat</dt>
                <dd>{fmtAt(plan.created_at)}</dd>
                <dt>Tindakan</dt>
                <dd>{actions.length}</dd>
                <dt>Temuan</dt>
                <dd>{findings.length}</dd>
                <dt>Validasi</dt>
                <dd>
                  {Object.keys(plan.validation ?? {}).length === 0
                    ? "tidak dilaporkan"
                    : `${Object.keys(plan.validation).length} kunci dilaporkan`}
                </dd>
                <dt>Sidik rencana</dt>
                <dd className="mono tiny">{plan.plan_hash || "—"}</dd>
              </dl>
            </div>
          </section>

          {/* Tindakan yang akan dijalankan */}
          <section className="card" aria-label="Tindakan pada rencana">
            <div className="card__head">
              <div>
                <h2>Tindakan yang akan dijalankan</h2>
                <p>Persetujuan mengikat pada isi persis di bawah ini</p>
              </div>
            </div>
            <div className="card__body">
              {actions.length === 0 ? (
                <EmptyState
                  icon="list_alt"
                  title="Rencana ini tidak memuat tindakan."
                  body="Tidak ada yang bisa disetujui."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table table--compact">
                    <caption className="sr-only">Tindakan pada rencana ini.</caption>
                    <thead>
                      <tr>
                        <th scope="col">Action ID</th>
                        <th scope="col">Tipe</th>
                        <th scope="col">Parameter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {actions.map((action) => (
                        <tr key={action.action_id}>
                          <td className="mono">{action.action_id}</td>
                          <td>{action.action_type}</td>
                          <td className="mono tiny truncate" style={{ maxWidth: 320 }} title={JSON.stringify(action.params ?? {})}>
                            {JSON.stringify(action.params ?? {})}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Temuan */}
          <section className="card" aria-label="Hasil validasi">
            <div className="card__head">
              <div>
                <h2>Hasil validasi</h2>
                <p>Adversarial Reviewer dan Policy Validator</p>
              </div>
            </div>
            <div className="card__body">
              {findings.length === 0 ? (
                <div className="banner banner--success">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    check_circle
                  </span>
                  <span>Semua pemeriksaan lulus. Tidak ada temuan.</span>
                </div>
              ) : (
                findings.map((finding, index) => (
                  <div
                    key={`${str(finding.code) || "finding"}-${index}`}
                    className={`banner banner--${findingTone(finding)}`}
                    style={{ marginBottom: 8 }}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {findingIcon(finding)}
                    </span>
                    <span>
                      <strong className="mono">{str(finding.code) || "tanpa kode"}</strong>{" "}
                      {(str(finding.decision) || str(finding.severity)) && (
                        <span className="badge badge--outline" style={{ marginLeft: 4 }}>
                          {str(finding.decision) || str(finding.severity)}
                        </span>
                      )}
                      <span style={{ display: "block", marginTop: 2 }}>
                        {str(finding.message) || "Temuan tanpa pesan."}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Keputusan */}
        <div className="stack">
          <section className="card" aria-label="Keputusan">
            <div className="card__head">
              <div>
                <h2>Keputusan Anda</h2>
                <p>Setiap keputusan tercatat atas nama Anda</p>
              </div>
            </div>
            <div className="card__body">
              {decided ? (
                <div
                  className={`banner banner--${isRejected(plan.status) ? "danger" : "success"}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {isRejected(plan.status) ? "cancel" : "verified"}
                  </span>
                  <span>
                    <strong>
                      {isRejected(plan.status)
                        ? "Rencana ditolak."
                        : "Keputusan sudah tercatat."}
                    </strong>{" "}
                    Status sekarang <code className="mono">{plan.status}</code>. Keputusan
                    berikutnya tercatat sebagai approval baru di Approval Inbox.
                  </span>
                </div>
              ) : (
                <>
                  <p className="small muted" style={{ marginBottom: 12, lineHeight: 1.55 }}>
                    Menyetujui menerbitkan mandat untuk tindakan persis di bawah. Mandat
                    terikat pada sidik rencana dan tidak bisa dipakai untuk versi lain.
                  </p>

                  {!canApprove && (
                    <div className="banner banner--warning" style={{ marginBottom: 12 }}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        lock
                      </span>
                      <span>
                        <strong>Peran Anda tidak dapat menyetujui.</strong> Capability{" "}
                        <code className="mono">approve</code> tidak ada pada sesi ini
                        {permissionsResult.ok ? "" : " (capability tidak bisa dibaca)"}. Lihat{" "}
                        <Link href="/access">Access Management</Link>.
                      </span>
                    </div>
                  )}

                  {actions.length === 0 ? (
                    <EmptyState
                      icon="block"
                      title="Tidak ada tindakan untuk diputuskan."
                      body="Keputusan hanya bisa diambil per tindakan."
                    />
                  ) : (
                    actions.map((action) => (
                      <div
                        key={action.action_id}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div className="mono small strong" style={{ wordBreak: "break-all" }}>
                          {action.action_id}
                        </div>
                        <div className="tiny muted" style={{ marginBottom: 8 }}>
                          {action.action_type}
                        </div>
                        {canApprove ? (
                          <PlanActionButtons
                            planId={plan.plan_id}
                            actionId={action.action_id}
                          />
                        ) : (
                          <div className="stack" style={{ gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              disabled
                              aria-describedby={`need-approve-${action.action_id}`}
                            >
                              <span className="material-symbols-outlined" aria-hidden="true">
                                lock
                              </span>
                              Setujui
                            </button>
                            <span
                              className="tiny muted"
                              id={`need-approve-${action.action_id}`}
                            >
                              Nonaktif: sesi ini tidak memegang capability{" "}
                              <code className="mono">approve</code>.
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  <div className="divider" />

                  <button
                    type="button"
                    className="btn btn--secondary btn--block"
                    disabled
                    aria-describedby="revisi-nonaktif"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      edit
                    </span>
                    Minta revisi
                  </button>
                  <p className="tiny muted" id="revisi-nonaktif" style={{ marginTop: 8, lineHeight: 1.5 }}>
                    Nonaktif karena belum ada endpoint-nya:{" "}
                    <code
                      className="mono"
                      style={{ whiteSpace: "normal", overflowWrap: "anywhere" }}
                    >
                      POST /office-agent/plans/{"{id}"}/actions/{"{action_id}"}/approve
                    </code>{" "}
                    hanya menerima <code className="mono">decision</code> bernilai{" "}
                    <code className="mono">approved</code> atau{" "}
                    <code className="mono">rejected</code>. Tombol ini tidak dipasang supaya
                    tidak ada tombol mati.
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Kebijakan yang dievaluasi */}
      <section className="card" style={{ marginTop: "var(--s-4)" }} aria-label="Kebijakan yang dievaluasi">
        <div className="card__head">
          <div>
            <h2>Kebijakan yang dievaluasi</h2>
            <p>Registry policy tenant ini, disandingkan dengan temuan rencana</p>
          </div>
          <div className="spacer" />
          <Link className="btn btn--ghost btn--sm" href="/policies">
            Kelola policy
          </Link>
        </div>
        <div className="card__body">
          {!policiesResult.ok ? (
            <div className="banner banner--warning" role="status">
              <span className="material-symbols-outlined" aria-hidden="true">
                cloud_off
              </span>
              <span>
                <strong>Registry policy tidak tersedia.</strong> {policiesResult.error}
              </span>
            </div>
          ) : policiesResult.data.items.length === 0 ? (
            <EmptyState
              icon="policy"
              title="Belum ada kebijakan terdaftar."
              body="Tanpa policy di registry, tidak ada aturan tenant yang dievaluasi."
              action={{ href: "/policies", label: "Buka Policies" }}
            />
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <caption className="sr-only">
                  Policy tenant dan temuan rencana yang tertaut padanya.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Kebijakan</th>
                    <th scope="col">Scope</th>
                    <th scope="col">Versi</th>
                    <th scope="col">Status</th>
                    <th scope="col">Temuan terkait</th>
                  </tr>
                </thead>
                <tbody>
                  {policiesResult.data.items.map((policy) => {
                    const matched = findingsForPolicy(policy, findings);
                    return (
                      <tr key={policy.id}>
                        <td>
                          <div className="cell-title">{policy.title}</div>
                          <div className="cell-sub mono">{policy.slug}</div>
                        </td>
                        <td>
                          <span className="badge badge--outline">{policy.scope}</span>
                        </td>
                        <td className="mono">{policy.versions}</td>
                        <td>
                          {!policy.is_active ? (
                            <span className="badge badge--outline">nonaktif</span>
                          ) : matched.length > 0 ? (
                            <span className="badge badge--danger">temuan</span>
                          ) : (
                            <span className="badge badge--success">tanpa temuan</span>
                          )}
                        </td>
                        <td className="mono tiny">
                          {matched.length === 0
                            ? "—"
                            : matched.map((finding) => str(finding.code) || "?").join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
                Tautan temuan → policy dicocokkan lewat <code className="mono">policy_slug</code>{" "}
                bila ada, selain itu lewat token slug policy di dalam kode atau pesan temuan.
                API tidak memberi atribusi eksplisit, jadi kolom terakhir adalah dugaan yang
                dinyatakan, bukan putusan.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
