import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/states";
import { UnavailableBanner, fmtDateTime } from "@/components/p1";
import {
  getAuditEventsForPlan,
  getExecutionsForPlan,
  getMandatesForPlan,
  getOfficePlan,
  type ExecutionItem,
  type MandateItem
} from "@/lib/api";
import ApproveActionButton from "./ApproveActionButton";
import {
  actionScope,
  buildTimeline,
  executionIcon,
  executionTone,
  findingCode,
  findingIcon,
  findingMessage,
  groupFindings,
  summarizeResult,
  usesOfMandate
} from "./view-model";

export const dynamic = "force-dynamic";

const PLAN_STATUS_TONE: Record<string, string> = {
  received: "badge--info",
  partially_approved: "badge--warning",
  approved: "badge--success",
  rejected: "badge--danger",
  completed: "badge--success"
};

const MANDATE_STATUS_TONE: Record<string, string> = {
  issued: "badge--info",
  active: "badge--success",
  executing: "badge--warning",
  consumed: "badge--outline",
  expired: "badge--danger",
  revoked: "badge--danger"
};

const BODY_STYLE = {
  margin: 0,
  padding: "var(--s-3)",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-md)",
  color: "var(--text-2)",
  fontFamily: "var(--font-sans)",
  fontSize: 12.5,
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  maxHeight: 220,
  overflow: "auto"
} as const;

function Panel({
  title,
  desc,
  badge,
  children
}: {
  title: string;
  desc?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="card" aria-label={title}>
      <div className="card__head">
        <div>
          <h2>{title}</h2>
          {desc ? <p>{desc}</p> : null}
        </div>
        {badge ? (
          <>
            <div className="spacer" />
            <span className="badge badge--outline">{badge}</span>
          </>
        ) : null}
      </div>
      <div className="card__body">{children}</div>
    </section>
  );
}

/**
 * Empat keadaan sebuah wilayah data: tersedia, kosong, ditolak server (status
 * ada), dan tidak terhubung (tidak ada status — fetch gagal). Pesannya menyebut
 * apa yang gagal, bukan "terjadi kesalahan".
 */
function RegionFailure({
  title,
  error,
  status
}: {
  title: string;
  error: string;
  status?: number;
}) {
  if (status === undefined) return <UnavailableBanner title={title} error={error} />;
  const explanation =
    status === 400
      ? "Endpoint ini menuntut identitas yang terikat tenant. Token gateway tanpa DEXTRA_LEGACY_TENANT ditolak — bukan datanya yang hilang."
      : status === 403
        ? "Sesi ini tidak memegang capability yang dibutuhkan endpoint tersebut."
        : status === 404
          ? "Endpoint tidak ada pada API ini."
          : "Server menolak permintaan; isinya tidak ditampilkan agar tidak dikarang.";
  return (
    <div className="banner banner--danger" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">
        error
      </span>
      <span>
        <strong>{title} tidak bisa dibaca.</strong> {error}
        <span className="tiny" style={{ display: "block", marginTop: 4 }}>
          {explanation}
        </span>
      </span>
    </div>
  );
}

function MandateCard({
  mandate,
  executions
}: {
  mandate: MandateItem;
  executions: ExecutionItem[];
}) {
  const uses = usesOfMandate(mandate.id, executions);
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10
      }}
    >
      <dl className="def-list">
        <dt>ID</dt>
        <dd className="mono mono--wrap">{mandate.id}</dd>
        <dt>Status</dt>
        <dd>
          <span className={`badge ${MANDATE_STATUS_TONE[mandate.status] ?? "badge--outline"}`}>
            {mandate.status}
          </span>
        </dd>
        <dt>Tindakan</dt>
        <dd className="mono">{mandate.action_id}</dd>
        <dt>Lingkup</dt>
        <dd>
          {mandate.resource_scope?.trim() ? mandate.resource_scope : "—"}
          {mandate.recipient_scope?.trim() ? ` · penerima: ${mandate.recipient_scope}` : ""}
        </dd>
        <dt>Diterbitkan</dt>
        <dd>{fmtDateTime(mandate.issued_at)}</dd>
        <dt>Berlaku s.d.</dt>
        <dd>{fmtDateTime(mandate.expires_at)}</dd>
        <dt>Pemakaian</dt>
        <dd>
          {uses} eksekusi tercatat
          {mandate.usable ? "" : " · tidak dapat dipakai lagi"}
        </dd>
        {mandate.revoked_at ? (
          <>
            <dt>Dicabut</dt>
            <dd>{fmtDateTime(mandate.revoked_at)}</dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

export default async function OfficePlanDetailPage({
  params
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  const planResult = await getOfficePlan(planId);

  const breadcrumbs = (
    <nav className="breadcrumbs" aria-label="breadcrumb">
      <Link href="/office-agent">Office Agent</Link>
      <span className="sep">›</span>
      <span className="current mono">{planId}</span>
    </nav>
  );

  /* ---- Rencana tidak dikenal: 404, bukan "tidak tersedia" ---- */
  if (!planResult.ok && planResult.status === 404) {
    return (
      <>
        <header className="page-head">
          <div className="page-head__text">
            {breadcrumbs}
            <h1>Rencana tidak ditemukan</h1>
            <p>Tidak ada rencana dengan id ini di tenant pemanggil.</p>
          </div>
        </header>
        <div className="card card--pad">
          <EmptyState
            icon="search_off"
            title={`Rencana ${planId} tidak ada.`}
            body="Periksa tautan atau kembali ke daftar rencana."
            action={{ href: "/office-agent", label: "Office Agent" }}
          />
        </div>
      </>
    );
  }

  /* ---- Rencana tidak bisa dibaca: 400/403/5xx, atau API tidak terhubung ---- */
  if (!planResult.ok) {
    return (
      <>
        <header className="page-head">
          <div className="page-head__text">
            {breadcrumbs}
            <h1>Tinjau rencana</h1>
            <p>Lingkup tindakan, temuan validator, bukti eksekusi, dan jejak audit.</p>
          </div>
        </header>
        <RegionFailure
          title="Rencana"
          error={planResult.error}
          status={planResult.status}
        />
        <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
          Tidak ada panel yang dirender dengan data contoh: tanpa respons API, halaman ini hanya
          melaporkan apa yang gagal.
        </p>
      </>
    );
  }

  const plan = planResult.data;
  const actions = plan.actions ?? [];
  const findings = plan.findings ?? [];

  /* Wilayah turunan diambil paralel; masing-masing punya keadaan sendiri. */
  const [executionsResult, mandatesResult, auditResult] = await Promise.all([
    getExecutionsForPlan(planId),
    getMandatesForPlan(planId),
    getAuditEventsForPlan(planId)
  ]);

  const executions = executionsResult.ok ? executionsResult.data.items : [];
  const mandates = mandatesResult.ok ? mandatesResult.data.items : [];
  const findingsByTone = groupFindings(findings);
  const timeline = auditResult.ok ? buildTimeline(auditResult.data.items) : [];

  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          {breadcrumbs}
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
            <span className={`badge ${PLAN_STATUS_TONE[plan.status] ?? "badge--outline"}`}>
              {plan.status}
            </span>
            <span className="badge badge--outline">{actions.length} tindakan</span>
            <span className="badge badge--outline">{findings.length} temuan</span>
            <span className="badge badge--outline">
              {executionsResult.ok ? executions.length : "?"} eksekusi
            </span>
          </div>
          <h1 className="mono" style={{ wordBreak: "break-all" }}>
            {plan.plan_id}
          </h1>
          <p style={{ marginTop: 4 }}>
            Tinjau tindakan yang diusulkan. Persetujuan manusia menerbitkan mandat lewat engine —
            tidak ada tindakan yang berjalan tanpa itu.
          </p>
        </div>
      </header>

      <div className="grid grid--sidebar">
        <div className="stack">
          {/* 1. Lingkup tindakan */}
          <Panel
            title="Lingkup tindakan"
            desc="Persetujuan berlaku persis untuk tindakan di bawah ini, bukan untuk intent secara umum."
            badge={`${actions.length} tindakan`}
          >
            {actions.length === 0 ? (
              <EmptyState
                icon="inventory_2"
                title="Rencana ini tidak memuat tindakan."
                body="Tidak ada yang bisa disetujui atau dieksekusi."
              />
            ) : (
              <div className="stack" style={{ gap: "var(--s-3)" }}>
                {actions.map((action, index) => {
                  const scope = actionScope(action.params);
                  return (
                    <div
                      key={action.action_id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 14
                      }}
                    >
                      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                        <span className="badge badge--brand">Tindakan {index + 1}</span>
                        <span className="small strong">
                          {action.action_type.replace(/_/g, " ")}
                        </span>
                        <span className="spacer" />
                        <span className="mono tiny muted">{action.action_id}</span>
                      </div>

                      <dl className="def-list">
                        <dt>Penerima</dt>
                        <dd>
                          {scope.recipients.length > 0
                            ? scope.recipients.join(" · ")
                            : "tidak disebutkan"}
                        </dd>
                        <dt>Kanal</dt>
                        <dd>{scope.channel ?? "tidak disebutkan"}</dd>
                        <dt>Jadwal</dt>
                        <dd>{scope.schedule ?? "tidak disebutkan"}</dd>
                        <dt>Subjek</dt>
                        <dd>{scope.subject ?? "tidak disebutkan"}</dd>
                        <dt>Isi persis</dt>
                        <dd>
                          {scope.body ? (
                            <pre style={BODY_STYLE}>{scope.body}</pre>
                          ) : (
                            <span className="muted">
                              Isi tidak disertakan pada parameter tindakan ini.
                            </span>
                          )}
                        </dd>
                        {scope.extras.length > 0 ? (
                          <>
                            <dt>Parameter lain</dt>
                            <dd>
                              {scope.extras.map((extra) => (
                                <span key={extra.key} style={{ display: "block" }}>
                                  <span className="mono">{extra.key}</span>{" "}
                                  <span className="tiny muted">{extra.value}</span>
                                </span>
                              ))}
                            </dd>
                          </>
                        ) : null}
                      </dl>

                      <div className="divider" />
                      <ApproveActionButton
                        planId={plan.plan_id}
                        actionId={action.action_id}
                        actionType={action.action_type}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
              Penerima ditampilkan apa adanya seperti yang dikirim API — bentuk tersamarkan tidak
              dibuka di sini.
            </p>
          </Panel>

          {/* 2. Temuan validasi */}
          <Panel
            title="Temuan validasi"
            desc="Dari Adversarial Reviewer dan Policy Validator, dikelompokkan per tingkat."
            badge={`${findings.length} temuan`}
          >
            {findings.length === 0 ? (
              <div className="banner banner--success" role="status">
                <span className="material-symbols-outlined" aria-hidden="true">
                  fact_check
                </span>
                <span>
                  <strong>Validator tidak melaporkan temuan.</strong> Rencana ini tidak membawa
                  catatan dari pemeriksa adversarial maupun policy validator.
                </span>
              </div>
            ) : (
              <div className="stack" style={{ gap: "var(--s-4)" }}>
                {findingsByTone.map((group) => (
                  <div key={group.tone}>
                    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                      <span className={`badge badge--${group.tone}`}>
                        {group.label} · {group.items.length}
                      </span>
                      <span className="tiny muted">{group.hint}</span>
                    </div>
                    <div className="stack" style={{ gap: "var(--s-2)" }}>
                      {group.items.map((finding, index) => (
                        <div
                          key={`${findingCode(finding)}-${index}`}
                          className={`banner banner--${group.tone}`}
                          role={group.tone === "danger" ? "alert" : undefined}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">
                            {findingIcon(finding)}
                          </span>
                          <span>
                            <strong className="mono">{findingCode(finding)}</strong>{" "}
                            {finding.severity || finding.decision ? (
                              <span className="badge badge--outline">
                                {finding.severity ?? finding.decision}
                              </span>
                            ) : null}
                            <span style={{ display: "block", marginTop: 2 }}>
                              {findingMessage(finding)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* 3. Bukti eksekusi */}
          <Panel
            title="Bukti eksekusi"
            desc="Hanya ada jika mandat dipakai."
            badge={
              executionsResult.ok ? `${executions.length} eksekusi` : "tidak terbaca"
            }
          >
            {!executionsResult.ok ? (
              <RegionFailure
                title="Bukti eksekusi"
                error={executionsResult.error}
                status={executionsResult.status}
              />
            ) : executions.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="Belum ada eksekusi."
                body="Tidak ada yang dijalankan sebelum mandat terbit dan dipakai."
              />
            ) : (
              <div className="stack" style={{ gap: "var(--s-2)" }}>
                {executions.map((execution) => {
                  const summary = summarizeResult(execution.result);
                  const tone = executionTone(execution.status);
                  return (
                    <div key={execution.id} className={`banner banner--${tone}`}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {executionIcon(execution.status)}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <strong className="mono">{execution.id}</strong>{" "}
                        <span className="badge badge--outline">{execution.status}</span>
                        <span className="tiny" style={{ display: "block", marginTop: 2 }}>
                          adapter {execution.adapter ?? "—"} · {fmtDateTime(execution.started_at)}
                          {execution.duration_ms !== null
                            ? ` · ${execution.duration_ms} ms`
                            : ""}
                          {execution.action_id ? ` · aksi ${execution.action_id}` : ""}
                        </span>
                        <span
                          className="mono tiny mono--wrap"
                          style={{ display: "block", marginTop: 2 }}
                        >
                          {summary ?? "hasil tidak dicatat"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {executionsResult.ok && !executionsResult.data.complete ? (
              <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
                Hanya {executionsResult.data.scanned} eksekusi terbaru yang diperiksa; baris lebih
                lama tidak ikut disaring.
              </p>
            ) : null}
          </Panel>

          {/* 4. Jejak audit */}
          <Panel
            title="Jejak audit"
            desc="Append-only, terlama dulu."
            badge={auditResult.ok ? `${timeline.length} event` : "tidak terbaca"}
          >
            {!auditResult.ok ? (
              <RegionFailure
                title="Jejak audit"
                error={auditResult.error}
                status={auditResult.status}
              />
            ) : timeline.length === 0 ? (
              <EmptyState
                icon="history"
                title="Belum ada event audit untuk rencana ini."
                body="Event muncul setelah rencana diterima, disetujui, atau dieksekusi."
              />
            ) : (
              <div className="timeline">
                {timeline.map((entry) => (
                  <div key={entry.key} className={`tl-item ${entry.tone}`}>
                    <div className="tl-dot">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {entry.icon}
                      </span>
                    </div>
                    <div className="tl-body">
                      <div className="tl-title">{entry.label}</div>
                      <div className="tl-meta">
                        {entry.actor} · {fmtDateTime(entry.at)} ·{" "}
                        <span className="mono" title={entry.hash}>
                          {entry.hashShort}
                        </span>
                      </div>
                      {entry.detail ? (
                        <div
                          className="tiny muted"
                          style={{ marginTop: 2, overflowWrap: "anywhere" }}
                        >
                          {entry.detail}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {auditResult.ok && !auditResult.data.complete ? (
              <p className="field__hint" style={{ marginTop: "var(--s-2)" }}>
                Hanya {auditResult.data.scanned} event terbaru tenant ini yang diperiksa.
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="stack">
          {/* 5. Mandat */}
          <Panel
            title="Mandat"
            desc="Wewenang yang terbit dari persetujuan manusia."
            badge={mandatesResult.ok ? `${mandates.length} mandat` : "tidak terbaca"}
          >
            {!mandatesResult.ok ? (
              <RegionFailure
                title="Mandat"
                error={mandatesResult.error}
                status={mandatesResult.status}
              />
            ) : mandates.length === 0 ? (
              <EmptyState
                icon="verified_user"
                title="Belum ada mandat."
                body="Mandat hanya terbit setelah persetujuan manusia atas satu tindakan."
              />
            ) : (
              mandates.map((mandate) => (
                <MandateCard key={mandate.id} mandate={mandate} executions={executions} />
              ))
            )}
          </Panel>

          {/* 6. Metadata */}
          <Panel title="Metadata" desc="Identitas rencana yang bisa disalin ke tiket.">
            <dl className="def-list">
              <dt>Plan ID</dt>
              <dd className="mono mono--wrap">{plan.plan_id}</dd>
              <dt>Plan hash</dt>
              <dd className="mono mono--wrap">{plan.plan_hash || "—"}</dd>
              <dt>Dibuat</dt>
              <dd>{fmtDateTime(plan.created_at)}</dd>
              <dt>Request ID</dt>
              <dd className="mono mono--wrap">{plan.request_id}</dd>
              <dt>Status</dt>
              <dd>
                <span className={`badge ${PLAN_STATUS_TONE[plan.status] ?? "badge--outline"}`}>
                  {plan.status}
                </span>
              </dd>
              <dt>Pengaju</dt>
              <dd className="muted">tidak dicatat pada respons API</dd>
              <dt>Validasi</dt>
              <dd>
                {Object.keys(plan.validation ?? {}).length === 0
                  ? "tidak dilaporkan"
                  : `${Object.keys(plan.validation ?? {}).length} kunci dilaporkan`}
              </dd>
            </dl>
            <p className="field__hint" style={{ marginTop: "var(--s-3)" }}>
              <code className="mono">GET /office-agent/plans/{"{id}"}</code> tidak mengembalikan
              identitas pengaju, jadi baris itu dibiarkan kosong alih-alih diisi tebakan.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
