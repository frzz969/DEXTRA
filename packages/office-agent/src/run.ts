import type { Org, Plan } from '../../contracts/src/index.ts';
import { findContactsByHint, getContactById, getContactIds, getOrgRules, insertPlan, listCalendarEvents } from '../../store/src/index.ts';

import { nextOfficeEventId, recordOfficeAudit } from './audit.ts';
import { buildOfficePlan } from './build.ts';
import { answerValue, applyAnswers, buildClarificationSession, openQuestions } from './clarify.ts';
import type { ContactByIdLookup, ContactLookup } from './resolve.ts';
import { applyRecipientAnswers, resolveRecipients } from './resolve.ts';
import { decompose } from './decompose.ts';
import { detectTimezoneHint, isValidTimezone } from './dates.ts';
import { normalizeDocument } from './document.ts';
import { OfficeAgentError } from './errors.ts';
import { acceptRequest } from './intake.ts';
import type { CalendarEventView } from './policy.ts';
import { loadSession, saveSession } from './state.ts';
import type {
  ClarificationAnswer,
  Decomposition,
  NormalizedDocument,
  OfficeAgentRunInput,
  OfficeAgentRunOptions,
  OfficeAgentRunResult,
  OfficeRequest,
  ValidationReport,
} from './types.ts';
import { validateOfficeOutput } from './validator.ts';

export interface OfficeAgentDeps {
  org: Org;
  calendar: ReadonlyArray<CalendarEventView> | null;
  knownContactIds: Iterable<string>;
  lookup: ContactLookup;
  lookupById: ContactByIdLookup;
  insertPlan: (plan: Plan) => Promise<{ created: boolean; existing: Plan | null }>;
  audit: (input: Parameters<typeof recordOfficeAudit>[0]) => Promise<string>;
  saveSession: (session: NonNullable<OfficeAgentRunResult['session']>) => Promise<void>;
  loadSession: (requestId: string) => Promise<NonNullable<OfficeAgentRunResult['session']> | null>;
  now: Date;
}

const EMPTY_DECOMPOSITION: Decomposition = {
  goal: '',
  decisions: [],
  action_items: [],
  unresolved: [],
  method: 'deterministic',
};

const EMPTY_VALIDATION: ValidationReport = { verdict: 'warn', checks: [] };

function emptyResult(error: { code: string; message: string }): OfficeAgentRunResult {
  return {
    status: 'failed',
    plan: null,
    decomposition: EMPTY_DECOMPOSITION,
    session: null,
    resolved_actions: [],
    policy_findings: [],
    validation: EMPTY_VALIDATION,
    audit_event_ids: [],
    assumptions: [],
    error,
  };
}

function sameRequestContent(a: Plan, b: Plan): boolean {
  if (a.intent !== b.intent) return false;
  if (a.actions.length !== b.actions.length) return false;
  return a.actions.every((action, index) => {
    const other = b.actions[index];
    if (other === undefined) return false;
    return (
      action.action_type === other.action_type &&
      action.target.contact_id === other.target.contact_id &&
      action.schedule.start_at === other.schedule.start_at &&
      action.content.body === other.content.body
    );
  });
}

function resolveTimeZone(request: OfficeRequest, document: NormalizedDocument | null, options: OfficeAgentRunOptions): string {
  const haystack = `${request.instruction} ${document?.blocks.map((block) => block.text).join(' ') ?? ''}`;
  const fromText = detectTimezoneHint(haystack);
  const candidate = fromText ?? options.assumptions?.timezone ?? null;

  if (candidate !== null) {
    if (!isValidTimezone(candidate)) {
      throw new OfficeAgentError('INVALID_TIMEZONE', `Zona waktu "${candidate}" tidak dikenali.`);
    }
    return candidate;
  }
  if (options.org.timezones.length === 1) return options.org.timezones[0] as string;
  throw new OfficeAgentError(
    'MISSING_REQUIRED_INFO',
    'Zona waktu tidak disebutkan dan organisasi memiliki lebih dari satu zona; klarifikasi diperlukan.',
  );
}

/**
 * Vertical slice Meeting to Action.
 *
 * Urutannya sengaja: intake → normalisasi → dekomposisi → klarifikasi → policy →
 * plan → validasi → simpan → audit. Dua hal yang tidak boleh dibalik:
 * plan disimpan SETELAH validator menyatakan lulus, dan event `plan_created`
 * ditulis SETELAH insert berhasil. Membalik salah satunya menghasilkan bukti
 * untuk sesuatu yang belum terjadi.
 */
export async function runOfficeAgentWithDeps(
  input: OfficeAgentRunInput,
  options: OfficeAgentRunOptions,
  deps: OfficeAgentDeps,
): Promise<OfficeAgentRunResult> {
  const request = acceptRequest({
    request_id: input.request_id,
    org_id: options.org.org_id,
    requester_principal_id: input.requester_principal_id,
    instruction: input.instruction,
    ...(input.document === undefined ? {} : { document: input.document }),
    ...(input.received_at === undefined ? {} : { received_at: input.received_at }),
  });

  const document = request.document === null ? null : normalizeDocument(request.document);
  const timeZone = resolveTimeZone(request, document, options);
  const decomposition = decompose({ request, document, now: deps.now, timeZone });

  const assumptions: string[] = [];
  const anyItemWithoutTime = decomposition.action_items.some((item) => item.schedule_hint.time === null);
  if (options.assumptions?.time_of_day !== undefined && anyItemWithoutTime) {
    assumptions.push(`Jam default ${options.assumptions.time_of_day} dipakai untuk action yang tidak menyebut jam.`);
  }
  if (options.assumptions?.duration_minutes !== undefined) {
    assumptions.push(`Durasi ${options.assumptions.duration_minutes} menit dipakai untuk acara kalender.`);
  }
  if (detectTimezoneHint(request.instruction) === null) {
    assumptions.push(`Zona waktu ${timeZone} dipakai dari konfigurasi organisasi.`);
  }

  let recipients = await resolveRecipients(decomposition.action_items, deps.lookup);

  let session = await deps.loadSession(request.request_id);
  if (session === null) {
    session = buildClarificationSession({
      request,
      document,
      items: decomposition.action_items,
      recipients,
      assumptions: options.assumptions ?? {},
      timeZone,
      now: deps.now,
    });
  }

  const answers: ClarificationAnswer[] | ReadonlyArray<{ question_id: string; value: string }> =
    options.answers !== undefined && options.answers.length > 0 ? options.answers : [];
  if (session !== null && answers.length > 0) {
    session = applyAnswers(session, answers, request.requester_principal_id, deps.now);
    await deps.saveSession(session);
  }

  /*
   * Jawaban diterapkan pada SETIAP panggilan, bukan hanya panggilan yang
   * membawa jawaban baru. Sesi tersimpan bisa sudah terjawab dari panggilan
   * sebelumnya, dan resolusi penerima dihitung ulang dari nol setiap kali —
   * tanpa langkah ini, permintaan yang sudah dijawab akan tetap terlihat ambigu
   * pada panggilan berikutnya. Validasi ulang setelah klarifikasi terjadi di
   * sini: plan dibangun dari resolusi yang sudah memakai jawaban.
   */
  if (session !== null) {
    recipients = await applyRecipientAnswers(
      recipients,
      decomposition.action_items,
      (itemId) => answerValue(session, `clq_${itemId}_recipient`),
      deps.lookup,
      deps.lookupById,
    );
  }

  const auditIds: string[] = [];

  if (session !== null && openQuestions(session).length > 0) {
    await deps.saveSession(session);
    /*
     * Belum ada plan, jadi tidak ada `plan_created`. Yang dicatat adalah
     * fakta yang benar-benar terjadi: permintaan berhenti menunggu klarifikasi.
     * Kontrak audit tidak punya tipe `clarification_requested`, jadi bentuknya
     * `plan_blocked` dengan `detail.stage`. Menambah tipe baru berarti
     * mengubah shared core yang sedang disentuh P4 — dicatat sebagai kebutuhan
     * integrasi, bukan dikerjakan diam-diam.
     */
    auditIds.push(
      await deps.audit({
        type: 'plan_blocked',
        actor: 'agent',
        at: deps.now.toISOString(),
        plan_id: `plan_${request.request_id.replace(/^req_/, '')}`,
        reason_code: 'AMBIGUOUS_RECIPIENT',
        detail: {
          stage: 'clarification_requested',
          request_id: request.request_id,
          requester: request.requester_principal_id,
          questions: String(openQuestions(session).length),
          document_id: document?.document_id ?? '',
        },
      }),
    );

    return {
      status: 'needs_clarification',
      plan: null,
      decomposition,
      session,
      resolved_actions: [],
      policy_findings: [],
      validation: validateOfficeOutput({
        request,
        document,
        decomposition,
        session,
        plan: null,
        resolved: [],
        policy_findings: [],
      }),
      audit_event_ids: auditIds,
      assumptions,
      error: null,
    };
  }

  const build = buildOfficePlan({
    request,
    document,
    decomposition,
    recipients,
    session,
    org: options.org,
    calendar: deps.calendar,
    knownContactIds: deps.knownContactIds,
    assumptions: options.assumptions ?? {},
    timeZone,
    now: deps.now,
  });

  const validation = validateOfficeOutput({
    request,
    document,
    decomposition,
    session,
    plan: build.plan,
    resolved: build.resolved,
    policy_findings: build.policy_findings,
  });

  if (build.plan === null) {
    auditIds.push(
      await deps.audit({
        type: 'plan_blocked',
        actor: 'agent',
        at: deps.now.toISOString(),
        plan_id: `plan_${request.request_id.replace(/^req_/, '')}`,
        reason_code: 'INVALID_PLAN',
        detail: {
          stage: 'construction',
          request_id: request.request_id,
          reason: build.blocked_reason ?? 'unknown',
        },
      }),
    );
    return {
      status: 'blocked',
      plan: null,
      decomposition,
      session,
      resolved_actions: build.resolved,
      policy_findings: build.policy_findings,
      validation,
      audit_event_ids: auditIds,
      assumptions,
      error: { code: 'MISSING_REQUIRED_INFO', message: build.blocked_reason ?? 'Plan belum dapat dibentuk.' },
    };
  }

  if (validation.verdict === 'fail') {
    /*
     * Validator gagal berarti plan TIDAK disimpan. Ini bukan kehati-hatian
     * berlebihan: plan yang tersimpan akan bisa disetujui, dan persetujuan atas
     * plan yang tidak setia kepada permintaan adalah persis kegagalan yang
     * ingin dicegah.
     */
    auditIds.push(
      await deps.audit({
        type: 'plan_blocked',
        actor: 'agent',
        at: deps.now.toISOString(),
        plan_id: build.plan.plan_id,
        plan_hash: build.plan.plan_hash,
        reason_code: 'INVALID_PLAN',
        detail: {
          stage: 'validation',
          request_id: request.request_id,
          failed_checks: validation.checks.filter((entry) => entry.status === 'fail').map((entry) => entry.id).join(','),
        },
      }),
    );
    return {
      status: 'blocked',
      plan: build.plan,
      decomposition,
      session,
      resolved_actions: build.resolved,
      policy_findings: build.policy_findings,
      validation,
      audit_event_ids: auditIds,
      assumptions,
      error: { code: 'INVALID_PLAN', message: 'Validasi independen menolak plan ini.' },
    };
  }

  const inserted = await deps.insertPlan(build.plan);
  if (!inserted.created) {
    if (inserted.existing !== null && sameRequestContent(inserted.existing, build.plan)) {
      return {
        status: inserted.existing.status === 'BLOCKED' ? 'blocked' : 'plan_ready',
        plan: inserted.existing,
        decomposition,
        session,
        resolved_actions: build.resolved,
        policy_findings: build.policy_findings,
        validation,
        audit_event_ids: [],
        assumptions,
        error: null,
      };
    }
    throw new OfficeAgentError(
      'PLAN_ALREADY_EXISTS',
      `Plan untuk ${request.request_id} sudah ada dengan isi berbeda; plan lama tidak ditimpa.`,
      { request_id: request.request_id },
    );
  }

  auditIds.push(
    await deps.audit({
      type: 'plan_created',
      actor: 'agent',
      at: deps.now.toISOString(),
      plan_id: build.plan.plan_id,
      plan_hash: build.plan.plan_hash,
      detail: {
        request_id: request.request_id,
        status: build.plan.status,
        actions: String(build.plan.actions.length),
        requester: request.requester_principal_id,
        document_id: document?.document_id ?? '',
        decomposition: decomposition.method,
      },
    }),
  );

  const blocked = build.plan.status === 'BLOCKED';
  auditIds.push(
    await deps.audit({
      type: blocked ? 'plan_blocked' : 'plan_validated',
      actor: 'agent',
      at: deps.now.toISOString(),
      plan_id: build.plan.plan_id,
      plan_hash: build.plan.plan_hash,
      ...(blocked ? { reason_code: 'POLICY_NOT_FOUND' as const } : {}),
      detail: {
        stage: 'policy',
        request_id: request.request_id,
        findings: build.plan.findings.map((finding) => finding.code).join(',') || 'none',
        validation: validation.verdict,
      },
    }),
  );

  return {
    status: blocked ? 'blocked' : 'plan_ready',
    plan: build.plan,
    decomposition,
    session,
    resolved_actions: build.resolved,
    policy_findings: build.policy_findings,
    validation,
    audit_event_ids: auditIds,
    assumptions,
    error: null,
  };
}

/**
 * Jalur produksi: mengikat store dan audit yang sudah ada.
 *
 * Tidak ada adapter email/kalender/tugas yang diimpor di sini. Office Agent
 * berhenti pada plan; eksekusi tetap milik Execution Gateway, dan itu bukan
 * konvensi — paket ini memang tidak punya jalan untuk memanggil adapter.
 */
export async function runOfficeAgent(
  input: OfficeAgentRunInput,
  options?: Partial<OfficeAgentRunOptions>,
): Promise<OfficeAgentRunResult> {
  try {
    const org = options?.org ?? (await getOrgRules());
    const calendar = options?.calendar ?? (await listCalendarEvents());
    const knownContactIds = await getContactIds();

    return await runOfficeAgentWithDeps(
      input,
      {
        org,
        calendar,
        now: options?.now ?? new Date(),
        ...(options?.assumptions === undefined ? {} : { assumptions: options.assumptions }),
        ...(options?.answers === undefined ? {} : { answers: options.answers }),
      },
      {
        org,
        calendar,
        knownContactIds,
        lookup: async (hint, limit) =>
          (await findContactsByHint(hint, limit)).map((contact) => ({
            contact_id: contact.contact_id,
            display_name: contact.display_name,
            masked_address: contact.masked_address,
            department: contact.department,
          })),
        lookupById: async (contactId) => {
          const contact = await getContactById(contactId as never);
          return contact === null
            ? null
            : {
                contact_id: contact.contact_id,
                display_name: contact.display_name,
                masked_address: contact.masked_address,
                department: contact.department,
              };
        },
        insertPlan,
        audit: recordOfficeAudit,
        saveSession,
        loadSession,
        now: options?.now ?? new Date(),
      },
    );
  } catch (error) {
    if (error instanceof OfficeAgentError) {
      return emptyResult({ code: error.code, message: error.message });
    }
    throw error;
  }
}

export { nextOfficeEventId };
