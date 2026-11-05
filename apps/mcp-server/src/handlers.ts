import { join } from 'node:path';

import { getOrgRules, getPlan, savePlan, insertPlan, getMandate, saveMandate, getExecution, getApproval, saveApproval, appendAudit, listAudit, findPrecedents, getContactIds, listApprovals, listPlans, listMandates, listExecutions, listSpecialists, getPrincipal, summarizeExecutions, listAuditWithIntegrity, listAlertDeliveries, summarizeAlertDeliveries, getStorePaths } from '../../../packages/store/src/index.ts';
import { AuditExportError, exportAuditLog } from '../../../packages/audit-export/src/index.ts';
import { createPlan as buildPlan, validatePlan as runValidate } from '../../../packages/plan/src/index.ts';
import { issueMandate } from '../../../packages/mandate-engine/src/issue.ts';
import { revokeMandate } from '../../../packages/mandate-engine/src/revoke.ts';
import { executeAction } from '../../../packages/executor/src/execute.ts';
import { OrgSchema } from '../../../packages/contracts/src/index.ts';
import type { Plan, Approval, Mandate } from '../../../packages/contracts/src/index.ts';
import { isAllowed, callerContext, resolvePrincipal, type Scope } from './auth.ts';

/**
 * Batas halaman, ditegakkan di server.
 *
 * 500, bukan 100 seperti di desain: dashboard yang sudah ada meminta 200 untuk
 * daftar dan 500 untuk audit log. Batas yang lebih rendah akan memotong data
 * yang hari ini terlihat — perubahan perilaku yang tidak diminta siapa pun.
 * Explorer meminta 25 per halaman, jadi batas ini tidak pernah mendekat.
 *
 * Yang penting bukan angkanya, melainkan bahwa angkanya ada. Tanpa batas,
 * `limit` dari klien adalah cara memuat seluruh berkas ke memori server.
 *
 * Batas yang jujur: ini mencegah satu permintaan yang tak terbatas, bukan
 * mencegah klien berwenang mengambil 500 baris berulang kali. Yang terakhir
 * hanya bisa dibatasi oleh autentikasi, bukan oleh angka ini.
 */
const MAX_PAGE_LIMIT = 500;

/**
 * Batas panjang kata kunci.
 *
 * Bukan angka keramat — 200 karakter jauh melebihi id, nama, atau potongan
 * pesan yang masuk akal untuk dicari. Yang dicegah adalah satu permintaan yang
 * membawa string sepanjang beberapa megabyte lalu di-`toLowerCase()` dan
 * dicocokkan ke setiap baris: biayanya tumbuh sebanding dengan panjang kueri
 * dikali jumlah baris, dan tidak ada yang membatasinya sebelum ini.
 *
 * Dilebihkan berarti DITOLAK, bukan dipotong. Memotong kueri diam-diam
 * mengubah arti pencarian dan mengembalikan hasil yang bukan hasil.
 */
const MAX_QUERY_LENGTH = 200;

interface PageArgs {
  limit: number;
  offset: number;
  q: string | null;
}

interface ToolError {
  ok: false;
  error: { code: string; message: string };
}

function invalidArgument(message: string): ToolError {
  return { ok: false, error: { code: 'INVALID_ARGUMENT', message } };
}

/**
 * Validasi argumen baca sebelum satu baris pun disentuh.
 *
 * Sebelumnya argumen bertipe salah diabaikan diam-diam: `q: 123` menjadi "tanpa
 * filter", sehingga pemanggil menerima seluruh isi dan membacanya sebagai
 * "semuanya cocok". `limit: -1` bahkan berarti "semua baris" — jalan pintas
 * yang membatalkan batas halaman yang justru ditambahkan untuk mencegahnya.
 * Jawaban yang salah lebih berbahaya daripada galat yang jelas.
 */
function pageArgsError(args: any): ToolError | null {
  const q = args?.q;
  if (q !== undefined && q !== null) {
    if (typeof q !== 'string') return invalidArgument('q must be a string.');
    if (q.length > MAX_QUERY_LENGTH) {
      return invalidArgument(`q must be at most ${MAX_QUERY_LENGTH} characters (received ${q.length}).`);
    }
  }

  const limit = args?.limit;
  if (limit !== undefined && limit !== null) {
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      return invalidArgument('limit must be a finite number.');
    }
    /* `limit: -1` used to mean "everything". It no longer does: an unbounded
       read is the exact failure the page cap exists to prevent. */
    if (limit < 1) return invalidArgument('limit must be at least 1.');
  }

  const offset = args?.offset;
  if (offset !== undefined && offset !== null) {
    if (typeof offset !== 'number' || !Number.isFinite(offset)) {
      return invalidArgument('offset must be a finite number.');
    }
    if (offset < 0) return invalidArgument('offset must not be negative.');
  }

  return null;
}

function readPageArgs(args: any, defaultLimit: number): PageArgs {
  const rawLimit = typeof args?.limit === 'number' ? Math.floor(args.limit) : defaultLimit;
  const limit = Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT);
  const rawOffset = typeof args?.offset === 'number' ? Math.floor(args.offset) : 0;
  const offset = Math.max(rawOffset, 0);
  const rawQ = typeof args?.q === 'string' ? args.q.trim().toLowerCase() : '';
  return { limit, offset, q: rawQ === '' ? null : rawQ };
}

/** Pencocokan substring, case-insensitive, atas nilai yang benar-benar ada. */
function matchesQuery(q: string, values: Array<string | undefined | null>): boolean {
  for (const value of values) {
    if (typeof value === 'string' && value.toLowerCase().includes(q)) return true;
  }
  return false;
}


/**
 * Resource scope: a scope grants a *kind* of action, never a *record*.
 *
 * Before this, `execute_action` and `revoke_mandate` looked the mandate up by id
 * and acted on it. Any holder of the `ops` token could therefore execute or
 * revoke every mandate in the workspace — including mandates belonging to a
 * different principal. Authorization answered "may this token execute?" and
 * never "may it execute *this*?".
 *
 * The rule, deliberately narrow:
 *   - no principal bound to the token  -> refused (nothing is anonymous)
 *   - mandate has an owner             -> execute: owner only
 *                                         revoke : owner or issuer
 *   - mandate predates the field       -> issuer only
 *
 * Revocation is wider than execution on purpose: withdrawing authority is the
 * grantor's right, using it is not.
 */
async function mandateAccess(
  mandate: Mandate,
  scope: Scope,
  mode: 'execute' | 'revoke',
): Promise<{ ok: true; principalId: string } | { ok: false; error: { code: string; message: string } }> {
  const principal = await resolvePrincipal(scope);
  if (!principal) {
    return {
      ok: false,
      error: {
        code: 'MANDATE_NOT_OWNED',
        message: 'No principal is bound to this token. A mandate cannot be used anonymously.',
      },
    };
  }

  const owner = mandate.owner_principal_id;
  const isOwner = owner !== undefined && owner === principal.principal_id;
  const isIssuer = mandate.issued_by === principal.principal_id;
  const allowed = owner === undefined ? isIssuer : mode === 'revoke' ? isOwner || isIssuer : isOwner;

  if (!allowed) {
    return {
      ok: false,
      error: {
        code: 'MANDATE_NOT_OWNED',
        message:
          `Mandate ${mandate.mandate_id} belongs to ${owner ?? 'its issuer'}, ` +
          `not to ${principal.principal_id}. Scope "${scope}" does not grant access to another principal's record.`,
      },
    };
  }
  return { ok: true, principalId: principal.principal_id };
}

/**
 * Id event audit yang unik di dalam satu proses.
 *
 * `evt_${Date.now()}` saja bertabrakan bila dua event ditulis pada milidetik
 * yang sama — dan pembuatan plan beruntun memang melakukannya. `event_id`
 * adalah cara menemukan satu event; dua event berid sama membuat "temukan event
 * ini" tidak punya jawaban tunggal.
 */
let eventSequence = 0;
function nextEventId(): string {
  eventSequence += 1;
  return `evt_${Date.now()}_${eventSequence}`;
}

export async function handleTool(name: string, args: any, scope: string): Promise<any> {
  /*
   * Defense in depth. handleRpc already refuses a disallowed tool, but this
   * function is the only place that actually runs an operation, and until now
   * it accepted a `scope` argument it never read. Any future caller that reached
   * the handler directly (an internal job, a new transport, a test) would have
   * bypassed authorization completely. Re-asserting here makes the handler safe
   * on its own rather than safe only when called the expected way.
   */
  if (scope !== 'agent' && scope !== 'ops') {
    return { ok: false, error: { code: 'UNAUTHORIZED', message: 'No scope resolved for this call.' } };
  }
  if (!isAllowed(scope, name)) {
    return {
      ok: false,
      error: { code: 'ACTION_NOT_ALLOWED', message: `Tool ${name} is not available to scope ${scope}.` },
    };
  }

  switch (name) {
    case 'get_caller_context': {
      return { ok: true, data: await callerContext(scope as Scope) };
    }
    case 'get_org_rules': {
      const org = await getOrgRules();
      return { ok: true, data: org };
    }
    case 'find_precedent': {
      const result = await findPrecedents({ subject: args.subject, context: args.context ?? '' });
      return { ok: true, data: result };
    }
    case 'create_plan': {
      const org = await getOrgRules();
      const contactIds = await getContactIds();
      const principal = await resolvePrincipal(scope as Scope);
      const rawAssignee = typeof args?.assignee_id === 'string' ? String(args.assignee_id).trim() : '';
      let assigneeId: string | undefined;
      if (rawAssignee !== '') {
        if (!principal) {
          return { ok: false, error: { code: 'UNAUTHENTICATED', message: 'assignee_id requires an authenticated principal.' } };
        }
        const known = await getPrincipal(rawAssignee);
        if (!known) {
          return { ok: false, error: { code: 'UNKNOWN_PRINCIPAL', message: `Unknown assignee: ${rawAssignee}` } };
        }
        assigneeId = rawAssignee;
      }
      const plan = buildPlan({
        org_id: org.org_id,
        request_id: args.request_id,
        intent: args.intent,
        created_at: new Date().toISOString(),
        actions: args.actions ?? [],
        requester_id: principal?.principal_id,
        assignee_id: assigneeId ?? principal?.principal_id,
      });
      const validated = runValidate(plan, org, contactIds);
      /*
       * Insert-only, bukan save. `plan_id` diturunkan dari `request_id`
       * (`req_x` -> `plan_x`), jadi dua panggilan dengan request_id yang sama
       * menunjuk plan yang sama. `savePlan` akan menimpanya; di sini itu berarti
       * pemanggil kedua bisa mengganti plan yang mungkin sudah disetujui, dan
       * `plan_hash`-nya berubah sementara mandate masih menunjuk hash lama.
       */
      const inserted = await insertPlan(validated);

      if (!inserted.created) {
        /*
         * `request_id` adalah kunci idempotensi, dan itu memang artinya: satu
         * permintaan, satu plan. Retry dengan permintaan yang sama mengembalikan
         * plan yang sudah ada — bukan membuat plan kedua, dan bukan menimpanya.
         *
         * Perbandingannya memakai `intent` + `actions`, BUKAN `plan_hash`:
         * `created_at` dibuat server dan ikut masuk ke hash, jadi dua percobaan
         * atas permintaan yang sama selalu menghasilkan hash berbeda. Membandingkan
         * hash akan menolak setiap retry yang jujur.
         */
        const sameRequest =
          inserted.existing !== null &&
          inserted.existing.intent === validated.intent &&
          JSON.stringify(inserted.existing.actions) === JSON.stringify(validated.actions);

        if (sameRequest) {
          return { ok: true, data: { plan: inserted.existing, idempotent_replay: true } };
        }

        return {
          ok: false,
          error: {
            code: 'PLAN_ALREADY_EXISTS',
            message:
              `Plan ${validated.plan_id} already exists for request_id "${validated.request_id}" with different content. ` +
              'A request_id is an idempotency key, not an update channel; send a new request_id instead.',
          },
        };
      }

      /*
       * Ditulis SETELAH insert berhasil, dan hanya bila insert terjadi. Event
       * yang mendahului penulisan akan menyatakan plan ada padahal penulisannya
       * bisa gagal — jejak yang lebih buruk daripada tidak ada jejak, karena
       * terbaca sebagai bukti.
       *
       * Kegagalan menulis audit TIDAK boleh dilaporkan sebagai sukses. Plan-nya
       * sudah tersimpan dan tidak bisa dibatalkan, jadi jawabannya jujur:
       * gagal, dan sebutkan bahwa plan-nya ada. Mengembalikan `ok: true` di sini
       * akan menjadi "berhasil tanpa bukti" — persis yang dihindari di seluruh
       * sistem ini.
       */
      try {
        await appendAudit({
          event_id: nextEventId(),
          at: new Date().toISOString(),
          type: 'plan_created',
          /*
           * `actor` adalah kelas pemanggil yang diturunkan dari token, bukan orang.
           * Orangnya ada di `detail.requester`, yang berasal dari principal yang
           * terikat pada token — bukan dari argumen pemanggil.
           */
          actor: scope === 'agent' ? 'agent' : 'dashboard',
          plan_id: validated.plan_id,
          plan_hash: validated.plan_hash,
          detail: {
            request_id: validated.request_id,
            status: validated.status,
            actions: String(validated.actions.length),
            requester: validated.requester_id ?? 'unbound',
            assignee: validated.assignee_id ?? 'unassigned',
          },
        } as any);
      } catch (error) {
        return {
          ok: false,
          error: {
            code: 'AUDIT_WRITE_FAILED',
            message:
              `Plan ${validated.plan_id} was persisted, but its audit event could not be written: ` +
              `${error instanceof Error ? error.message : 'unknown error'}. The plan exists without a record of its creation.`,
          },
        };
      }

      return { ok: true, data: { plan: validated } };
    }
    case 'validate_plan': {
      const org = await getOrgRules();
      const contactIds = await getContactIds();
      const plan = args.plan;
      const validated = runValidate(plan, org, contactIds);
      await savePlan(validated);
      return { ok: true, data: { plan: validated } };
    }
    case 'get_plan': {
      const plan = await getPlan(args.plan_id);
      return { ok: true, data: { plan } };
    }
    case 'list_plans': {
      const bad = pageArgsError(args);
      if (bad) return bad;
      const all = await listPlans();
      const status = typeof args?.status === 'string' ? args.status : null;
      const requesterId = typeof args?.requester_id === 'string' ? args.requester_id : null;
      const assigneeId = typeof args?.assignee_id === 'string' ? args.assignee_id : null;
      const page = readPageArgs(args, 100);
      const filtered = (status ? all.filter((plan) => plan.status === status) : all)
        .filter((plan) => !requesterId || plan.requester_id === requesterId)
        .filter((plan) => !assigneeId || plan.assignee_id === assigneeId)
        .filter((plan) =>
          page.q === null
            ? true
            : matchesQuery(page.q, [
                plan.plan_id,
                plan.intent,
                plan.request_id,
                plan.status,
                plan.requester_id,
                plan.assignee_id,
                plan.org_id,
              ]),
        )
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      /*
       * Filter dulu, potong kemudian. Urutan sebaliknya adalah bug yang paling
       * sering terjadi di halaman pencarian: hasilnya hanya benar bila kata
       * kuncinya kebetulan ada di halaman pertama.
       */
      return {
        ok: true,
        data: {
          plans: filtered.slice(page.offset, page.offset + page.limit),
          total: filtered.length,
          offset: page.offset,
          limit: page.limit,
        },
      };
    }
    case 'submit_approval': {
      const plan = await getPlan(args.plan_id);
      if (!plan) return { ok: false, error: { code: 'INVALID_PLAN', message: 'Plan not found.' } };
      if (plan.plan_hash !== args.plan_hash) {
        return { ok: false, error: { code: 'PLAN_HASH_MISMATCH', message: 'Plan hash mismatch.' } };
      }
      const token = String(args.approval_token ?? '').trim();
      if (token.length < 8) {
        return { ok: false, error: { code: 'INVALID_PLAN', message: 'Approval token missing or too short.' } };
      }
      if (token.toLowerCase() === 'apt_demo') {
        return { ok: false, error: { code: 'INVALID_PLAN', message: 'Weak demo approval token is not accepted.' } };
      }
      // reuse check: same approval_token must not be used twice
      const existingApprovals = await listApprovals();
      if (existingApprovals.some((a) => a.approval_token === token)) {
        return { ok: false, error: { code: 'INVALID_PLAN', message: 'Approval token already used.' } };
      }
      const decision = args.decision;
      const principal = await resolvePrincipal(scope as Scope);
      /*
       * An approval is a human decision. Until now the fallback was
       * `args.approver_id`, which meant the audit trail recorded whatever the
       * client claimed. If the token binds no principal there is nobody to hold
       * responsible, so the approval is refused rather than attributed to a
       * string.
       */
      if (!principal) {
        return {
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'No principal is bound to this token; an approval must be attributable.' },
        };
      }
      const approverId = principal.principal_id;
      const approval: Approval = {
        approval_id: `appr_${Date.now()}` as any,
        plan_id: plan.plan_id,
        plan_hash: plan.plan_hash,
        decision,
        approver_id: approverId,
        approval_token: args.approval_token,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        status: decision === 'approve' ? 'granted' : decision === 'reject' ? 'rejected' : 'revision_requested',
      };
      await saveApproval(approval);

      if (decision === 'approve') {
        /* The mandate belongs to the plan's requester: it is authority to act on
           *their* request. `approver_id` is the server-resolved principal, not
           the client's claim — the previous version signed the client value into
           `issued_by` while recording the server value on the approval, so the
           two disagreed. */
        const mandate = issueMandate({
          plan,
          approval,
          approver_id: approverId,
          owner_principal_id: plan.requester_id,
          now: new Date().toISOString(),
        });
        await saveMandate(mandate);
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'approval_granted',
          actor: 'dashboard',
          plan_id: plan.plan_id,
          mandate_id: mandate.mandate_id,
          plan_hash: plan.plan_hash,
          detail: { approver: approverId },
        } as any);
        return { ok: true, data: { approval_id: approval.approval_id, status: 'granted', mandate_id: mandate.mandate_id } };
      }
      if (decision === 'reject') {
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'approval_rejected',
          actor: 'dashboard',
          plan_id: plan.plan_id,
          plan_hash: plan.plan_hash,
          detail: { approver: args.approver_id },
        } as any);
        return { ok: true, data: { approval_id: approval.approval_id, status: 'rejected' } };
      }
      return { ok: true, data: { approval_id: approval.approval_id, status: 'revision_requested' } };
    }
    case 'get_mandate': {
      const mandate = await getMandate(args.mandate_id);
      return { ok: true, data: { mandate } };
    }
    case 'list_mandates': {
      const bad = pageArgsError(args);
      if (bad) return bad;
      const all = await listMandates();
      const status = typeof args?.status === 'string' ? args.status : null;
      const page = readPageArgs(args, 100);
      const filtered = (status ? all.filter((mandate) => mandate.status === status) : all)
        .filter((mandate) =>
          page.q === null
            ? true
            : matchesQuery(page.q, [
                mandate.mandate_id,
                mandate.plan_id,
                mandate.status,
                mandate.issued_by,
                mandate.owner_principal_id,
              ]),
        )
        .slice()
        .sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));
      return {
        ok: true,
        data: {
          mandates: filtered.slice(page.offset, page.offset + page.limit),
          total: filtered.length,
          offset: page.offset,
          limit: page.limit,
        },
      };
    }
    case 'issue_mandate': {
      const plan = await getPlan(args.plan_id);
      const approval = await getApproval(args.approval_id);
      if (!plan || !approval) return { ok: false, error: { code: 'INVALID_PLAN', message: 'Plan or approval not found.' } };
      const mandate = issueMandate({ plan, approval, approver_id: approval.approver_id, now: new Date().toISOString() });
      await saveMandate(mandate);
      /* Minting authority is a governance event. submit_approval records one on
       * the approve path; this second issuance path must be equally traceable,
       * otherwise a mandate could exist with no audit record of who asked for it. */
      await appendAudit({
        event_id: `evt_${Date.now()}`,
        at: new Date().toISOString(),
        type: 'mandate_issued',
        actor: 'dashboard',
        plan_id: plan.plan_id,
        mandate_id: mandate.mandate_id,
        plan_hash: plan.plan_hash,
        detail: { via: 'issue_mandate', approval_id: approval.approval_id, scope },
      } as any);
      return { ok: true, data: { mandate } };
    }
    case 'execute_action': {
      const mandate = await getMandate(args.mandate_id);
      if (!mandate) return { ok: false, error: { code: 'MANDATE_NOT_FOUND', message: 'Mandate not found.' } };

      const access = await mandateAccess(mandate, scope as Scope, 'execute');
      if (!access.ok) {
        /* A refused attempt is a fact about the system, so it is recorded. An
           access denial that leaves no trace is indistinguishable from an
           attempt that never happened. */
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'mandate_rejected',
          actor: 'executor',
          plan_id: mandate.plan_id,
          mandate_id: mandate.mandate_id,
          detail: { reason: 'not_owner', principal: (await resolvePrincipal(scope as Scope))?.principal_id ?? 'unbound' },
        } as any);
        return access;
      }

      const result = await executeAction({ mandate_id: args.mandate_id, action_id: args.action_id, execution_key: args.execution_key, now: new Date().toISOString() });
      return { ok: true, data: { result } };
    }
    case 'revoke_mandate': {
      const mandate = await getMandate(args.mandate_id);
      if (!mandate) return { ok: false, error: { code: 'MANDATE_NOT_FOUND', message: 'Mandate not found.' } };

      const access = await mandateAccess(mandate, scope as Scope, 'revoke');
      if (!access.ok) {
        await appendAudit({
          event_id: `evt_${Date.now()}`,
          at: new Date().toISOString(),
          type: 'mandate_rejected',
          actor: 'dashboard',
          plan_id: mandate.plan_id,
          mandate_id: mandate.mandate_id,
          detail: { reason: 'not_owner_or_issuer', principal: (await resolvePrincipal(scope as Scope))?.principal_id ?? 'unbound' },
        } as any);
        return access;
      }

      const revoked = revokeMandate(mandate, new Date().toISOString());
      await saveMandate(revoked);
      await appendAudit({
        event_id: `evt_${Date.now()}`,
        at: new Date().toISOString(),
        type: 'mandate_revoked',
        actor: 'dashboard',
        mandate_id: mandate.mandate_id,
        detail: { by: access.principalId },
      } as any);
      return { ok: true, data: { mandate: revoked } };
    }
    case 'list_executions': {
      const bad = pageArgsError(args);
      if (bad) return bad;
      const all = await listExecutions();
      const mandateId = typeof args?.mandate_id === 'string' ? args.mandate_id : null;
      const page = readPageArgs(args, 100);
      const filtered = (mandateId ? all.filter((row) => row.mandate_id === mandateId) : all)
        .filter((row) =>
          page.q === null
            ? true
            : matchesQuery(page.q, [
                row.execution_id,
                row.mandate_id,
                row.action_id,
                row.result,
                row.reason_code,
                row.execution_key,
              ]),
        )
        .slice()
        .sort((a, b) => Date.parse(b.executed_at) - Date.parse(a.executed_at));
      /*
       * `summary` is computed over the whole filtered set, before `limit`.
       * Computing it over the page would make the totals depend on how many rows
       * the caller asked for — the classic dashboard bug where "success rate"
       * silently changes when you resize a table.
       */
      return {
        ok: true,
        data: {
          executions: filtered.slice(page.offset, page.offset + page.limit),
          total: filtered.length,
          offset: page.offset,
          limit: page.limit,
          summary: summarizeExecutions(filtered),
        },
      };
    }
    case 'get_status': {
      const ex = await getExecution(args.mandate_id, args.action_id);
      return { ok: true, data: { execution: ex } };
    }
    case 'get_audit_log': {
      const bad = pageArgsError(args);
      if (bad) return bad;
      const page = readPageArgs(args, 50);
      /*
       * One read pass returns the page, the verdict, and the checkpoint
       * comparison. The verdict covers the WHOLE log: a chain that verifies only
       * the last 50 events says nothing about the 51st from the end.
       */
      const { events: all, integrity } = await listAuditWithIntegrity();
      /*
       * Filter pertama, halaman kemudian — dan halaman dihitung dari ekor,
       * karena log ini ditampilkan terbaru-dulu. `offset` berarti "lewati
       * sekian event terakhir", sehingga halaman kedua adalah kejadian sebelum
       * yang sedang dilihat.
       */
      const filtered =
        page.q === null
          ? all
          : all.filter((event) =>
              matchesQuery(page.q as string, [
                event.event_id,
                event.type,
                event.actor,
                event.plan_id,
                event.mandate_id,
                event.action_id,
                event.reason_code,
                /*
                 * Kunci detail ikut dicari, bukan hanya nilainya: "cari semua
                 * event yang punya field `reason`" adalah pertanyaan yang wajar,
                 * dan kuncinya sudah dijamin bebas data sensitif oleh
                 * `assertNoSensitiveDetail` saat ditulis.
                 */
                ...Object.entries(event.detail).flatMap(([key, value]) => [key, value]),
              ]),
            );

      /*
       * `limit: -1` dulu berarti "seluruh log". Jalur itu dihapus: satu
       * permintaan yang memuat seluruh berkas adalah persis kegagalan yang
       * batas halaman ada untuk mencegah, dan pemanggil lama tetap mendapat
       * halaman terakhir yang lebih dari cukup.
       */
      const end = Math.max(0, filtered.length - page.offset);
      const start = Math.max(0, end - page.limit);
      return {
        ok: true,
        data: {
          events: filtered.slice(start, end),
          total: filtered.length,
          /* Berapa banyak event yang benar-benar dibaca. `total` adalah hasil
             filter; `scanned` adalah ukuran log. Dua angka, dua arti. */
          scanned: all.length,
          offset: page.offset,
          limit: page.limit,
          integrity,
        },
      };
    }
    case 'export_audit': {
      /*
       * Export writes a new artifact and never touches the log. The output
       * directory comes from the store's own layout, not from the caller, so a
       * caller cannot choose where the server writes.
       */
      const paths = getStorePaths();
      const principal = await resolvePrincipal(scope as Scope);
      try {
        const result = await exportAuditLog({
          sourcePath: paths.audit,
          checkpointPath: paths.auditCheckpoint,
          outDir: join(paths.dataDir, 'exports'),
          exportedBy: principal?.principal_id ?? `scope:${scope}`,
        });
        return {
          ok: true,
          data: {
            manifest: result.manifest,
            files: { jsonl: result.jsonlPath, manifest: result.manifestPath },
            /*
             * The command is part of the response because "verify it yourself"
             * is the point of the feature. The verifier needs neither this
             * server nor the dashboard nor the data directory.
             */
            verify_command: `node --experimental-strip-types packages/audit-export/src/cli.ts "${result.manifestPath}"`,
          },
        };
      } catch (error) {
        if (error instanceof AuditExportError) {
          return { ok: false, error: { code: error.code, message: error.message } };
        }
        throw error;
      }
    }
    case 'list_alerts': {
      /*
       * Read-only. There is deliberately no `send_alert` tool: dispatching is a
       * server-side consequence of something that already happened, not an
       * action a caller can request. A tool that sends arbitrary text to a chat
       * is a spam primitive with an audit trail attached.
       */
      const bad = pageArgsError(args);
      if (bad) return bad;
      /* Sama seperti daftar lain: batas halaman ditegakkan di sini, bukan
         diserahkan pada angka yang dikirim pemanggil. `limit: -1` sebelumnya
         mengembalikan seluruh berkas. */
      const page = readPageArgs(args, 50);
      const { deliveries, invalid } = await listAlertDeliveries();
      const filtered = deliveries.filter((d) => {
        if (typeof args?.kind === 'string' && d.alert.kind !== args.kind) return false;
        if (typeof args?.status === 'string' && d.status !== args.status) return false;
        return true;
      });
      /* Summary over the whole filtered set, before `limit`. Computing it from
         the page would make the counts change with page size, which reads as
         the system changing when only the query did. */
      const summary = summarizeAlertDeliveries(filtered);
      /* Halaman dihitung dari ekor dan urutannya dipertahankan seperti dulu:
         `offset: 0` mengembalikan `limit` pengiriman terakhir dalam urutan
         aslinya, sama seperti `slice(-limit)` sebelumnya. */
      const end = Math.max(0, filtered.length - page.offset);
      const start = Math.max(0, end - page.limit);
      return {
        ok: true,
        data: {
          alerts: filtered.slice(start, end),
          total: filtered.length,
          offset: page.offset,
          limit: page.limit,
          summary,
          invalid,
        },
      };
    }
    case 'list_specialists': {
      /* Read straight from workbuddy/agents/*.md. Nothing is added here: no
       * status, no version, no workload. Those were demo-data fields, and a
       * roster that reports them without a source is a roster that lies. */
      const specialists = await listSpecialists();
      return { ok: true, data: { specialists, total: specialists.length } };
    }
    default:
      return { ok: false, error: { code: 'INVALID_PLAN', message: `Unknown tool: ${name}` } };
  }
}
