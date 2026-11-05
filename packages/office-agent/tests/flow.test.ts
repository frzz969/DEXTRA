import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { makeDataDir, AMBIGUOUS_DOCUMENT, CLEAN_DOCUMENT, INJECTED_DOCUMENT } from './helpers.ts';

const dataDir = await makeDataDir('dextra-office-flow-');
process.env.DEXTRA_DATA_DIR = dataDir;

const store = await import('../../store/src/index.ts');
const { runOfficeAgent } = await import('../src/run.ts');
const { handleOfficeAgentTool, OFFICE_AGENT_CAPABILITY } = await import('../src/integration.ts');
const { handleTool } = await import('../../../apps/mcp-server/src/handlers.ts');

const NOW = new Date('2026-11-03T02:00:00.000Z');

let seq = 0;
function requestId(): string {
  seq += 1;
  return `req_flow${String(seq).padStart(2, '0')}`;
}

function doc(content: string, filename = 'notulen.md') {
  return { filename, content };
}

after(async () => {
  const { rm } = await import('node:fs/promises');
  await rm(dataDir, { recursive: true, force: true });
});

test('alur penuh: dokumen → klarifikasi → plan → persetujuan → mandate → eksekusi', async () => {
  await store.seed();

  /* 1. Penerima ambigu: tidak ada plan, hanya pertanyaan. */
  const first = await runOfficeAgent(
    { request_id: requestId(), instruction: 'Tindak lanjuti notulen rapat', requester_principal_id: 'usr_nadia', document: doc(AMBIGUOUS_DOCUMENT) },
    { now: NOW },
  );
  assert.equal(first.status, 'needs_clarification');
  assert.equal(first.plan, null, 'plan tidak boleh dibuat saat masih ambigu');
  assert.equal(first.session?.questions.length, 1);
  assert.equal(first.session?.questions[0]?.code, 'AMBIGUOUS_RECIPIENT');
  assert.equal(first.session?.questions[0]?.options.length, 2);

  const afterFirst = await store.listAuditWithIntegrity();
  const clarificationEvent = afterFirst.events.find((event) => event.detail.stage === 'clarification_requested');
  assert.ok(clarificationEvent, 'permintaan klarifikasi harus tercatat di audit');
  assert.equal(clarificationEvent?.type, 'plan_blocked');

  /* 2. Jawaban manusia: plan dibangun, divalidasi, disimpan, dan dicatat. */
  const requestIdValue = first.session?.request_id ?? '';
  const answered = await runOfficeAgent(
    { request_id: requestIdValue, instruction: 'Tindak lanjuti notulen rapat', requester_principal_id: 'usr_nadia', document: doc(AMBIGUOUS_DOCUMENT) },
    { now: NOW, answers: [{ question_id: 'clq_item_001_recipient', value: 'c_budi_fin' }] },
  );
  assert.equal(answered.status, 'plan_ready', JSON.stringify(answered.error));
  assert.equal(answered.validation.verdict, 'pass');
  assert.ok(answered.plan);

  const plan = answered.plan!;
  assert.equal(plan.actions[0]?.target.contact_id, 'c_budi_fin');
  assert.equal(plan.actions[0]?.schedule.start_at, '2026-11-06T10:00:00+07:00');

  const stored = await store.getPlan(plan.plan_id);
  assert.equal(stored?.plan_hash, plan.plan_hash);

  const createdEvents = (await store.listAuditWithIntegrity()).events.filter(
    (event) => event.type === 'plan_created' && event.plan_id === plan.plan_id,
  );
  assert.equal(createdEvents.length, 1, 'tepat satu plan_created');
  assert.equal(createdEvents[0]?.plan_hash, plan.plan_hash);
  assert.equal(createdEvents[0]?.detail.requester, 'usr_nadia');

  /* 3. Persetujuan manusia mengikat hash plan. */
  const approved = await handleTool(
    'submit_approval',
    { plan_id: plan.plan_id, plan_hash: plan.plan_hash, decision: 'approve', approval_token: 'apt_flow_test_1' },
    'ops',
  );
  assert.equal(approved.ok, true, JSON.stringify(approved));
  const mandateId = approved.data.mandate_id as string;

  /* 4. Eksekusi hanya lewat gateway, dan hasilnya jujur soal mock. */
  const executed = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: plan.actions[0]?.action_id, execution_key: 'exec_key_1' },
    'ops',
  );
  assert.equal(executed.ok, true, JSON.stringify(executed));
  const result = executed.data.result;
  assert.equal(result.result, 'sent');
  assert.ok(String(result.evidence.mock_message_id ?? '').length > 0, 'bukti mock harus menyebut id pesan');
  assert.equal(result.usage.provider, 'mock');
  assert.equal(result.usage.tokens_in, null, 'mock tidak mengukur token; null bukan 0');
  assert.equal(result.usage.cost_usd, null);

  /* 5. Eksekusi ganda tidak menggandakan efek. */
  const duplicate = await handleTool(
    'execute_action',
    { mandate_id: mandateId, action_id: plan.actions[0]?.action_id, execution_key: 'exec_key_2' },
    'ops',
  );
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.data.result.execution_id, result.execution_id, 'percobaan kedua mengembalikan hasil pertama, bukan mengirim ulang');

  /* 6. Rantai audit tetap utuh setelah seluruh alur. */
  const integrity = await store.listAuditWithIntegrity();
  assert.equal(integrity.integrity.ok, true, JSON.stringify(integrity.integrity));
});

test('plan tidak bisa ditimpa oleh request_id yang sama dengan isi berbeda', async () => {
  const id = requestId();
  const first = await runOfficeAgent(
    { request_id: id, instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  assert.equal(first.status, 'plan_ready');
  const before = await store.getPlan(first.plan!.plan_id);

  const second = await runOfficeAgent(
    {
      request_id: id,
      instruction: 'Tindak lanjuti notulen',
      requester_principal_id: 'usr_nadia',
      document: doc(INJECTED_DOCUMENT.replace('Budi bagian Keuangan', 'Sari bagian Sumber Daya Manusia')),
    },
    { now: NOW },
  );
  assert.equal(second.status, 'failed');
  assert.equal(second.error?.code, 'PLAN_ALREADY_EXISTS');

  const after = await store.getPlan(first.plan!.plan_id);
  assert.equal(after?.plan_hash, before?.plan_hash, 'plan lama tidak boleh berubah');
});

test('retry dengan isi sama tidak menggandakan plan maupun event', async () => {
  const id = requestId();
  const first = await runOfficeAgent(
    { request_id: id, instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  const second = await runOfficeAgent(
    { request_id: id, instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  assert.equal(second.status, 'plan_ready');
  assert.equal(second.plan?.plan_id, first.plan?.plan_id);
  assert.equal(second.audit_event_ids.length, 0, 'replay tidak menulis event baru');

  const events = (await store.listAuditWithIntegrity()).events.filter(
    (event) => event.type === 'plan_created' && event.plan_id === first.plan?.plan_id,
  );
  assert.equal(events.length, 1);
});

test('persetujuan untuk plan lain ditolak', async () => {
  const a = await runOfficeAgent(
    { request_id: requestId(), instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  const b = await runOfficeAgent(
    { request_id: requestId(), instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  const stale = await handleTool(
    'submit_approval',
    { plan_id: a.plan!.plan_id, plan_hash: b.plan!.plan_hash, decision: 'approve', approval_token: 'apt_stale_plan_1' },
    'ops',
  );
  assert.equal(stale.ok, false);
  assert.equal(stale.error.code, 'PLAN_HASH_MISMATCH');
});

test('eksekusi tanpa mandate ditolak', async () => {
  const denied = await handleTool(
    'execute_action',
    { mandate_id: 'mandate_tidak_ada', action_id: 'action_001', execution_key: 'exec_key_x' },
    'ops',
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'MANDATE_NOT_FOUND');
});

test('mandate kedaluwarsa tidak bisa dieksekusi', async () => {
  const plan = await runOfficeAgent(
    { request_id: requestId(), instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  const approval = {
    approval_id: 'appr_expired_1',
    plan_id: plan.plan!.plan_id,
    plan_hash: plan.plan!.plan_hash,
    decision: 'approve' as const,
    approver_id: 'usr_nadia',
    approval_token: 'apt_expired_flow_1',
    issued_at: '2026-11-03T02:00:00.000Z',
    expires_at: '2026-11-03T02:15:00.000Z',
    status: 'granted' as const,
  } as never;
  const { issueMandate } = await import('../../mandate-engine/src/issue.ts');
  const mandate = issueMandate({ plan: plan.plan!, approval, approver_id: 'usr_nadia', owner_principal_id: 'usr_nadia', ttl_seconds: 60, now: '2026-11-03T02:00:00.000Z' });
  await store.saveMandate(mandate);

  const { validateMandate } = await import('../../mandate-engine/src/validate.ts');
  const verdict = validateMandate({
    mandate,
    plan: plan.plan,
    action_id: plan.plan!.actions[0]!.action_id,
    action_type: plan.plan!.actions[0]!.action_type,
    now: '2026-11-03T03:00:00.000Z',
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.ok === false ? verdict.reason_code : null, 'MANDATE_EXPIRED');
});

test('eksekusi sebagian meninggalkan action lain tetap bisa dijalankan', async () => {
  const plan = await runOfficeAgent(
    { request_id: requestId(), instruction: 'Tindak lanjuti notulen', requester_principal_id: 'usr_nadia', document: doc(CLEAN_DOCUMENT) },
    { now: NOW },
  );
  assert.equal(plan.plan?.actions.length, 2);

  const approved = await handleTool(
    'submit_approval',
    { plan_id: plan.plan!.plan_id, plan_hash: plan.plan!.plan_hash, decision: 'approve', approval_token: 'apt_partial_flow_1' },
    'ops',
  );
  assert.equal(approved.ok, true);
  const mandateId = approved.data.mandate_id as string;

  const first = await handleTool('execute_action', { mandate_id: mandateId, action_id: 'action_001', execution_key: 'k1' }, 'ops');
  assert.equal(first.ok, true);
  const second = await handleTool('execute_action', { mandate_id: mandateId, action_id: 'action_002', execution_key: 'k2' }, 'ops');
  assert.equal(second.ok, true, 'action kedua tidak boleh ikut terkunci');

  const executions = await store.listExecutions();
  const forMandate = executions.filter((row) => row.mandate_id === mandateId);
  assert.equal(forMandate.length, 2);
  assert.ok(forMandate.every((row) => row.result === 'sent'));
});

test('office agent tidak punya jalan memanggil adapter secara langsung', async () => {
  const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
  const files = await readdir(srcDir);
  for (const file of files.filter((name) => name.endsWith('.ts'))) {
    const source = await readFile(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), 'utf8');
    assert.ok(!/from '.*executor/.test(source), `${file} mengimpor executor`);
    assert.ok(!/from '.*adapters?\//.test(source), `${file} mengimpor adapter`);
    assert.ok(!/sendEmail\s*\(|createCalendarEvent\s*\(/.test(source), `${file} memanggil adapter`);
    /* Menyebut nama tool di dokumentasi tidak apa-apa; memanggilnya tidak. */
    assert.ok(!/executeAction\s*\(|handleTool\(\s*'execute_action'/.test(source), `${file} memanggil eksekusi`);
  }
  assert.equal(OFFICE_AGENT_CAPABILITY, 'create_plan');
});

test('handler integrasi menolak permintaan tanpa principal terikat', async () => {
  const denied = await handleOfficeAgentTool(
    { request_id: 'req_no_principal' },
    { scope: 'agent', principal_id: null, org_id: 'org_kenari' },
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.ok === false ? denied.error.code : null, 'UNAUTHORIZED');
});

test('handler integrasi mengembalikan klarifikasi, bukan plan, saat ambigu', async () => {
  const result = await handleOfficeAgentTool(
    { request_id: 'req_tool_ambiguous', instruction: 'Tindak lanjuti', document: doc(AMBIGUOUS_DOCUMENT) },
    { scope: 'ops', principal_id: 'usr_nadia', org_id: 'org_kenari' },
  );
  assert.equal(result.ok, true);
  assert.equal(result.ok === true ? result.data.status : null, 'needs_clarification');
  assert.equal(result.ok === true ? result.data.plan : 'x', null);
});

test('permintaan yang sudah dijawab tetap terbaca terjawab pada panggilan berikutnya', async () => {
  const id = requestId();
  const ambiguous = { request_id: id, instruction: 'Tindak lanjuti notulen rapat', requester_principal_id: 'usr_nadia', document: doc(AMBIGUOUS_DOCUMENT) };

  const first = await runOfficeAgent(ambiguous, { now: NOW });
  assert.equal(first.status, 'needs_clarification');

  const answered = await runOfficeAgent(ambiguous, {
    now: NOW,
    answers: [{ question_id: 'clq_item_001_recipient', value: 'c_budi_fin' }],
  });
  assert.equal(answered.status, 'plan_ready', JSON.stringify(answered.error));

  /* Panggilan ketiga tanpa jawaban baru: sesi tersimpan sudah terjawab, dan
   * resolusi penerima dihitung ulang. Kalau jawaban hanya dipakai pada
   * panggilan yang membawanya, permintaan ini akan kembali "ambigu" padahal
   * jawabannya sudah ada. */
  const again = await runOfficeAgent(ambiguous, { now: NOW });
  assert.equal(again.status, 'plan_ready', JSON.stringify(again.error));
  assert.equal(again.plan?.plan_id, answered.plan?.plan_id);
});
