import type { Plan } from '../../contracts/src/index.ts';

import { OfficeAgentError } from './errors.ts';
import { runOfficeAgent } from './run.ts';
import type { ClarificationAnswer } from './types.ts';

/**
 * Adapter integrasi ke MCP.
 *
 * Kenapa bentuknya seperti ini: `apps/mcp-server/src/handlers.ts`,
 * `server.ts`, `contracts/authorization.ts`, dan `registry.py` sedang disentuh
 * pekerjaan P4 dan tidak boleh diubah dari sini. Jadi Office Agent
 * mengekspor handler yang SUDAH jadi — satu pemanggilan, tanpa logika bisnis —
 * sehingga pendaftarannya nanti hanya menambah satu `case` dan satu entri
 * schema, bukan memindahkan logika.
 *
 * Sampai pendaftaran itu terjadi, tool ini TIDAK bisa dipanggil dari MCP.
 * Jangan menganggapnya tersedia.
 */
export const OFFICE_AGENT_TOOL = 'office_agent_run';

/**
 * Kapabilitas yang dibutuhkan untuk mendaftarkan tool ini.
 *
 * `create_request`, bukan kapabilitas baru: Office Agent pada akhirnya membuat
 * plan lewat create_request, dan plan adalah wewenang `create_request`.
 * Menambah kapabilitas berarti mengubah model otorisasi — hal yang dilarang
 * untuk tugas ini.
 */
export const OFFICE_AGENT_CAPABILITY = 'create_request';

export interface OfficeToolContext {
  scope: 'agent' | 'ops';
  /** Principal yang diresolusi server-side dari token. Tidak pernah dari args. */
  principal_id: string | null;
  org_id: string;
}

export interface OfficeToolArgs {
  request_id: string;
  /**
   * Kunci percakapan dari channel (mis. id chat Telegram). Bila diisi, server
   * memetakan kunci ini ke request pertama chat tersebut; pesan susulan
   * melanjutkan request yang sama alih-alih membuat request baru.
   */
  chat_id?: string;
  instruction?: string;
  document?: { filename: string; content: string };
  answers?: Array<{ question_id: string; value: string }>;
  assumptions?: { time_of_day?: string; duration_minutes?: number; timezone?: string };
}

export type OfficeToolResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string } };

export const OFFICE_AGENT_INPUT_SCHEMA = {
  type: 'object',
  required: ['request_id'],
  properties: {
    request_id: { type: 'string', pattern: '^req_[a-z0-9_]+$' },
    chat_id: { type: 'string', description: 'Stable chat key; the server keeps one request per chat.' },
    instruction: { type: 'string', maxLength: 20000 },
    document: {
      type: 'object',
      required: ['filename', 'content'],
      properties: {
        filename: { type: 'string' },
        content: { type: 'string' },
      },
    },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question_id', 'value'],
        properties: { question_id: { type: 'string' }, value: { type: 'string' } },
      },
    },
    assumptions: {
      type: 'object',
      properties: {
        time_of_day: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
        duration_minutes: { type: 'number', minimum: 5, maximum: 480 },
        timezone: { type: 'string' },
      },
    },
  },
} as const;

export const OFFICE_AGENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['needs_clarification', 'plan_ready', 'blocked', 'failed'] },
    plan: { type: ['object', 'null'] },
    session: { type: ['object', 'null'] },
    validation: { type: 'object' },
  },
} as const;

/**
 * Handler yang siap didaftarkan.
 *
 * Perhatikan yang TIDAK dibaca dari `args`: `requester_principal_id`. Kalau
 * principal diambil dari badan permintaan, siapa pun bisa mengaku siapa pun,
 * dan seluruh rantai pertanggungjawaban runtuh di titik itu.
 */
export async function handleOfficeAgentTool(args: OfficeToolArgs, context: OfficeToolContext): Promise<OfficeToolResult> {
  if (context.principal_id === null || context.principal_id.trim() === '') {
    return {
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No principal is bound to this token; an office request must be attributable.',
      },
    };
  }
  if (context.scope !== 'agent' && context.scope !== 'ops') {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'No scope resolved for this call.' } };
  }
  if (typeof args?.request_id !== 'string' || args.request_id.trim() === '') {
    return { ok: false, error: { code: 'INVALID_ARGUMENT', message: 'request_id is required.' } };
  }

  try {
    const result = await runOfficeAgent(
      {
        request_id: args.request_id,
        instruction: args.instruction ?? '',
        requester_principal_id: context.principal_id,
        ...(args.document === undefined ? {} : { document: args.document }),
      },
      {
        ...(args.answers === undefined ? {} : { answers: args.answers as ClarificationAnswer[] }),
        ...(args.assumptions === undefined ? {} : { assumptions: args.assumptions }),
      },
    );

    if (result.status === 'failed') {
      return {
        ok: false,
        error: { code: result.error?.code ?? 'EXECUTOR_FAILURE', message: result.error?.message ?? 'Office Agent failed.' },
      };
    }

    return {
      ok: true,
      data: {
        status: result.status,
        plan: result.plan,
        session: result.session,
        validation: result.validation,
        policy_findings: result.policy_findings,
        resolved_actions: result.resolved_actions,
        assumptions: result.assumptions,
        audit_event_ids: result.audit_event_ids,
      },
    };
  } catch (error) {
    if (error instanceof OfficeAgentError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }
    throw error;
  }
}

/**
 * Argumen yang dibutuhkan `submit_approval` untuk plan ini.
 *
 * Office Agent tidak menyetujui dan tidak mengeksekusi. Ia menyerahkan plan
 * beserta hash-nya; persetujuan tetap milik manusia lewat Approval Engine, dan
 * eksekusi tetap milik Execution Gateway.
 */
export function toApprovalRequest(plan: Plan): { plan_id: string; plan_hash: string } {
  return { plan_id: plan.plan_id, plan_hash: plan.plan_hash };
}

export const P4_FROZEN_FILES = [
  'packages/contracts/src/authorization.ts',
  'apps/mcp-server/src/handlers.ts',
  'apps/mcp-server/src/server.ts',
  'backend/dextra/mcp/registry.py',
  'packages/audit-export/**',
] as const;

export const INTEGRATION_STEPS = [
  `1. Daftarkan "${OFFICE_AGENT_TOOL}" di contracts/authorization.ts dengan kapabilitas ${OFFICE_AGENT_CAPABILITY}.`,
  `2. Tambahkan entri tool + schema di apps/mcp-server/src/server.ts (schema: OFFICE_AGENT_INPUT_SCHEMA).`,
  `3. Tambahkan case "${OFFICE_AGENT_TOOL}" di handlers.ts yang memanggil handleOfficeAgentTool(args, {scope, principal_id, org_id}).`,
  '4. Cerminkan entri yang sama di backend/dextra/mcp/registry.py supaya uji paritas TS↔Python tetap lulus.',
  '5. Persetujuan memakai submit_approval yang sudah ada; eksekusi memakai execute_action yang sudah ada.',
] as const;

export const INTEGRATION_BLOCKERS = [
  'Tool belum terdaftar di MCP; sampai langkah 1–4 dikerjakan, office_agent_run tidak bisa dipanggil lewat JSON-RPC.',
  'Kontrak audit belum punya tipe clarification_requested; saat ini dilaporkan sebagai plan_blocked dengan detail.stage.',
  'Office Agent memakai principal dari adapter, bukan dari sesi login: P8 (autentikasi manusia) belum ada.',
] as const;

/**
 * Peta nama tool yang diminta dashboard ke permukaan backend yang nyata.
 *
 * Dashboard Office Agent (dibuat terpisah, tidak diubah dari sini) meminta
 * tujuh tool `office_*`. Dua di antaranya — `office_approve` dan
 * `office_execute` — TIDAK boleh menjadi pintu kedua: persetujuan dan eksekusi
 * sudah punya engine, dan menyalinnya di sini akan menciptakan gateway kedua
 * yang justru dilarang. Keduanya dipetakan ke tool yang sudah ada.
 *
 * `office_get_request` dan `office_get_audit` belum punya fungsi paket ini:
 * status permintaan hidup di sesi klarifikasi + store plan, dan audit dibaca
 * lewat `get_audit_log` yang sudah ada. Memetakannya ke sana jujur; membuat
 * implementasi tiruan tidak.
 */
export interface FrontendToolMapping {
  /** Nama yang dipakai dashboard. */
  name: string;
  /** Permukaan backend yang menjawabnya. */
  backend: string;
  status: 'implemented' | 'delegates-to-existing-tool' | 'requires-registration';
  note: string;
}

export const FRONTEND_TOOL_MAP: readonly FrontendToolMapping[] = [
  {
    name: 'office_create_request',
    backend: `handleOfficeAgentTool (paket ini) sebagai "${OFFICE_AGENT_TOOL}"`,
    status: 'requires-registration',
    note: 'Intake + normalisasi + dekomposisi + klarifikasi + plan. Satu panggilan.',
  },
  {
    name: 'office_get_request',
    backend: 'loadSession + getPlan (paket ini dan @dextra/store)',
    status: 'requires-registration',
    note: 'Belum ada fungsi pembungkus; datanya ada, permukaannya belum.',
  },
  {
    name: 'office_clarify',
    backend: `handleOfficeAgentTool dengan field answers`,
    status: 'requires-registration',
    note: 'Jawaban divalidasi terhadap pertanyaan yang benar-benar ada, lalu plan divalidasi ulang.',
  },
  {
    name: 'office_get_plan',
    backend: 'getPlan (@dextra/store)',
    status: 'delegates-to-existing-tool',
    note: 'Plan yang sama dengan yang dilihat dashboard governance; tidak ada salinan.',
  },
  {
    name: 'office_approve',
    backend: 'submit_approval',
    status: 'delegates-to-existing-tool',
    note: 'Wajib lewat Approval Engine. Alias di backend akan menjadi gateway kedua.',
  },
  {
    name: 'office_execute',
    backend: 'execute_action',
    status: 'delegates-to-existing-tool',
    note: 'Wajib lewat Execution Gateway dengan mandate. Tidak ada jalur eksekusi dari paket ini.',
  },
  {
    name: 'office_get_audit',
    backend: 'get_audit_log',
    status: 'delegates-to-existing-tool',
    note: 'Audit Office Agent menulis ke rantai yang sama, jadi tidak perlu pembaca kedua.',
  },
];

/** Argumen `execute_action` untuk satu action plan. Tidak mengeksekusi apa pun. */
export function toExecuteRequest(
  mandateId: string,
  actionId: string,
  executionKey: string,
): { mandate_id: string; action_id: string; execution_key: string } {
  return { mandate_id: mandateId, action_id: actionId, execution_key: executionKey };
}
