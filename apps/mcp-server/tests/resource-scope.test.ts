/*
 * Resource scope: scope menjawab "jenis tindakan apa", bukan "catatan siapa".
 *
 * Sebelum ini `execute_action` dan `revoke_mandate` hanya mencari mandate
 * berdasarkan id lalu langsung bertindak. Siapa pun yang memegang token `ops`
 * bisa mengeksekusi atau mencabut SEMUA mandate di workspace — termasuk mandate
 * milik principal lain. Tes ini menjaga agar pemilik mandate benar-benar
 * diperiksa, dan agar penolakan itu tercatat.
 *
 * Dua principal disimulasikan lewat DEXTRA_OPS_PRINCIPAL, karena token `ops`
 * memang hanya satu; yang berbeda adalah siapa yang terikat padanya.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const dataDir = await mkdtemp(join(tmpdir(), 'dextra-resource-scope-'));
process.env.DEXTRA_DATA_DIR = dataDir;
process.env.DEXTRA_OPS_TOKEN = 'ops-dev-token';

const { seed, createApprovalChallenge } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');

const previousPrincipal = process.env.DEXTRA_OPS_PRINCIPAL;
after(async () => {
  if (previousPrincipal === undefined) delete process.env.DEXTRA_OPS_PRINCIPAL;
  else process.env.DEXTRA_OPS_PRINCIPAL = previousPrincipal;
  await rm(dataDir, { recursive: true, force: true });
});

/** Set who the ops token is bound to, then run a tool. */
function as(principalId: string, tool: string, args: any) {
  process.env.DEXTRA_OPS_PRINCIPAL = principalId;
  return handleTool(tool, args, 'ops');
}

const PLAN_ARGS = {
  org_id: 'org_kenari',
  request_id: 'req_scope01',
  intent: 'kirim notulen rapat ke Budi',
  actions: [
    {
      action_type: 'send_email',
      target: {
        contact_id: 'c_budi_fin',
        display_name: 'Budi Santoso',
        channel: 'email',
        masked_address: 'b***@kenari.co.id',
      },
      schedule: { start_at: '2026-11-04T09:00:00+07:00', timezone: 'Asia/Jakarta', all_day: false },
      content: { subject: 'Notulen Rapat', body: 'Halo Budi, berikut notulen rapat.', locale: 'id-ID' },
    },
  ],
};

async function planApprovedBy(requesterId: string, approverId: string) {
  await seed({ reset: true });

  const created = await as(requesterId, 'create_plan', PLAN_ARGS);
  assert.equal(created.ok, true, JSON.stringify(created));
  const plan = created.data.plan;
  assert.equal(plan.requester_id, requesterId, 'requester_id harus datang dari principal, bukan argumen klien');

  // D-04: the challenge is issued server-side and bound to the approver.
  const challenge = await createApprovalChallenge({
    planId: plan.plan_id,
    planHash: plan.plan_hash,
    approverPrincipalId: approverId,
  });
  const approved = await as(approverId, 'submit_approval', {
    plan_id: plan.plan_id,
    plan_hash: plan.plan_hash,
    decision: 'approve',
    approval_token: challenge.approval_token,
  });
  assert.equal(approved.ok, true, JSON.stringify(approved));

  const mandate = (await as(requesterId, 'get_mandate', { mandate_id: approved.data.mandate_id })).data.mandate;
  return { plan, mandate, mandateId: approved.data.mandate_id };
}

test('mandate mencatat pemilik dari pemohon dan penerbit dari approver', async () => {
  const { mandate } = await planApprovedBy('usr_sari', 'usr_nadia');
  assert.equal(mandate.owner_principal_id, 'usr_sari');
  assert.equal(mandate.issued_by, 'usr_nadia');
});

test('principal lain tidak dapat mengeksekusi mandate yang bukan miliknya', async () => {
  const { plan, mandateId } = await planApprovedBy('usr_sari', 'usr_nadia');

  const attempt = await as('usr_nadia', 'execute_action', {
    mandate_id: mandateId,
    action_id: plan.actions[0].action_id,
    execution_key: 'ek_scope_denied',
  });

  assert.equal(attempt.ok, false, 'approver tidak boleh mengeksekusi mandate milik orang lain');
  assert.equal(attempt.error.code, 'MANDATE_NOT_OWNED');
  assert.match(attempt.error.message, /usr_sari/, 'pesan harus menyebut pemilik sebenarnya');

  /* Tidak ada eksekusi yang tercatat: penolakan harus terjadi sebelum tindakan. */
  const executions = await as('usr_sari', 'list_executions', { mandate_id: mandateId });
  assert.equal(executions.data.total, 0, 'penolakan tidak boleh menyisakan eksekusi');
});

test('penolakan resource-scope tercatat di audit', async () => {
  const { plan, mandateId } = await planApprovedBy('usr_sari', 'usr_nadia');
  await as('usr_nadia', 'execute_action', {
    mandate_id: mandateId,
    action_id: plan.actions[0].action_id,
    execution_key: 'ek_scope_audit',
  });

  const audit = await as('usr_sari', 'get_audit_log', { limit: 100 });
  const rejected = audit.data.events.filter((e: any) => e.type === 'mandate_rejected' && e.mandate_id === mandateId);
  assert.equal(rejected.length, 1, 'percobaan yang ditolak harus meninggalkan jejak');
  assert.equal(rejected[0].detail.reason, 'not_owner');
  assert.equal(rejected[0].detail.principal, 'usr_nadia');
});

test('pemilik mandate boleh mengeksekusi mandate-nya sendiri', async () => {
  const { plan, mandateId } = await planApprovedBy('usr_sari', 'usr_nadia');

  const attempt = await as('usr_sari', 'execute_action', {
    mandate_id: mandateId,
    action_id: plan.actions[0].action_id,
    execution_key: 'ek_scope_owner',
  });

  assert.equal(attempt.ok, true, JSON.stringify(attempt));
  assert.equal(attempt.data.result.result, 'sent');
});

test('penerbit boleh mencabut, tetapi bukan untuk mengeksekusi', async () => {
  const { plan, mandateId } = await planApprovedBy('usr_sari', 'usr_nadia');

  /* Eksekusi ditolak (diuji di atas); pencabutan justru hak pemberi wewenang. */
  const revoked = await as('usr_nadia', 'revoke_mandate', { mandate_id: mandateId });
  assert.equal(revoked.ok, true, 'issuer harus boleh mencabut mandate yang ia terbitkan');
  assert.equal(revoked.data.mandate.status, 'revoked');

  /* Setelah dicabut, pemilik pun tidak bisa mengeksekusi. */
  const afterRevoke = await as('usr_sari', 'execute_action', {
    mandate_id: mandateId,
    action_id: plan.actions[0].action_id,
    execution_key: 'ek_scope_after_revoke',
  });
  assert.equal(afterRevoke.data.result.result, 'blocked');
  assert.equal(afterRevoke.data.result.reason_code, 'MANDATE_REVOKED');
});

test('kepemilikan tidak dapat dipalsukan dengan menyunting berkas', async () => {
  const { plan, mandateId } = await planApprovedBy('usr_sari', 'usr_nadia');

  /* Ini serangan yang nyata: berkas mandate dapat ditulis siapa pun yang punya
     akses ke data/. Kalau owner tidak ikut ditandatangani, penegakan di atas
     hanya hiasan. */
  const file = join(dataDir, 'mandates.json');
  const rows = JSON.parse(await readFile(file, 'utf8'));
  const row = rows.find((m: any) => m.mandate_id === mandateId);
  assert.equal(row.owner_principal_id, 'usr_sari');
  row.owner_principal_id = 'usr_nadia';
  await writeFile(file, JSON.stringify(rows, null, 2), 'utf8');

  const attempt = await as('usr_nadia', 'execute_action', {
    mandate_id: mandateId,
    action_id: plan.actions[0].action_id,
    execution_key: 'ek_scope_tampered',
  });

  assert.equal(attempt.ok, true, 'handler meneruskan ke executor');
  assert.equal(attempt.data.result.result, 'blocked', 'tanda tangan tidak valid harus memblokir');
  assert.equal(attempt.data.result.reason_code, 'MANDATE_NOT_FOUND');
});

test('tanpa principal terikat, mandate tidak dapat dieksekusi', async () => {
  const { plan, mandateId } = await planApprovedBy('usr_sari', 'usr_nadia');

  process.env.DEXTRA_OPS_PRINCIPAL = '';
  const attempt = await handleTool('execute_action', {
    mandate_id: mandateId,
    action_id: plan.actions[0].action_id,
    execution_key: 'ek_scope_anonymous',
  }, 'ops');

  assert.equal(attempt.ok, false);
  assert.equal(attempt.error.code, 'MANDATE_NOT_OWNED');
  assert.match(attempt.error.message, /anonymous/i);
});
