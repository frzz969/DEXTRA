/*
 * `plan_created` — menutup kontrak tanpa produsen.
 *
 * `plan_created` ada di `AuditEventTypeSchema` sejak awal, tetapi tidak ada satu
 * pun kode yang menghasilkannya. Akibatnya plan bisa lahir tanpa satu baris pun
 * di audit trail — dan audit adalah fondasi produk ini, bukan pelengkap.
 *
 * Yang dijaga tes ini, berurutan dari yang paling mudah salah:
 *   1. event ditulis SETELAH insert berhasil, bukan sebelum;
 *   2. insert yang gagal tidak meninggalkan event sukses;
 *   3. retry dengan request_id yang sama tidak menggandakan event;
 *   4. request_id yang sama dengan isi berbeda ditolak, bukan menimpa plan;
 *   5. rantai hash tetap utuh setelah event baru masuk.
 */
import { mkdir, mkdtemp, readFile, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const dataDir = await mkdtemp(join(tmpdir(), 'dextra-plan-audit-'));
process.env.DEXTRA_DATA_DIR = dataDir;

const { seed, listAuditWithIntegrity, getPlan } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');

const plansFile = join(dataDir, 'plans.json');

function planArgs(requestId: string, body = 'Halo Budi, berikut notulen rapat.') {
  return {
    org_id: 'org_kenari',
    request_id: requestId,
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
        content: { subject: 'Notulen Rapat', body, locale: 'id-ID' },
      },
    ],
  };
}

async function createdEvents(planId?: string) {
  const { events } = await listAuditWithIntegrity();
  return events.filter((event) => event.type === 'plan_created' && (!planId || event.plan_id === planId));
}

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

test('plan yang berhasil dibuat menghasilkan tepat satu plan_created', async () => {
  await seed();
  const result = await handleTool('create_plan', planArgs('req_audit01'), 'ops');
  assert.equal(result.ok, true, JSON.stringify(result));

  const events = await createdEvents(result.data.plan.plan_id);
  assert.equal(events.length, 1, 'harus tepat satu event untuk satu plan');

  const [event] = events;
  assert.equal(event!.plan_id, result.data.plan.plan_id);
  assert.equal(event!.plan_hash, result.data.plan.plan_hash, 'hash event harus sama dengan hash plan yang tersimpan');
  assert.equal(event!.detail.request_id, 'req_audit01');
  assert.equal(event!.detail.status, result.data.plan.status);
  assert.equal(event!.detail.actions, '1');
  assert.ok(event!.detail.requester, 'aktor yang tersedia harus tercatat');
});

test('plan_created ikut rantai hash, bukan event lepas', async () => {
  const { events, integrity } = await listAuditWithIntegrity();
  const chained = events.filter((event) => event.type === 'plan_created');
  assert.ok(chained.length > 0);
  for (const event of chained) {
    assert.ok(event.hash, 'event harus punya hash');
    assert.ok(event.prev_hash !== undefined, 'event harus menunjuk pendahulunya');
  }
  assert.equal(integrity.ok, true, `rantai rusak: ${integrity.broken_at ?? integrity.checkpoint_status}`);
  assert.equal(integrity.unchained, 0);
});

test('retry dengan request_id yang sama tidak menambah event', async () => {
  const before = await createdEvents('plan_audit02');

  const first = await handleTool('create_plan', planArgs('req_audit02'), 'ops');
  assert.equal(first.ok, true, JSON.stringify(first));
  const second = await handleTool('create_plan', planArgs('req_audit02'), 'ops');
  assert.equal(second.ok, true, 'retry yang jujur harus berhasil');
  assert.equal(second.data.idempotent_replay, true, 'retry harus ditandai sebagai pemutaran ulang');
  assert.equal(second.data.plan.plan_id, first.data.plan.plan_id);
  assert.equal(second.data.plan.created_at, first.data.plan.created_at, 'retry mengembalikan plan yang SUDAH ada');

  const after = await createdEvents('plan_audit02');
  assert.equal(after.length, 1, `satu plan, satu event (sebelum ${before.length}, sesudah ${after.length})`);
});

test('request_id yang sama dengan isi berbeda ditolak dan tidak menimpa plan', async () => {
  const first = await handleTool('create_plan', planArgs('req_audit03', 'isi pertama'), 'ops');
  assert.equal(first.ok, true);
  const originalHash = first.data.plan.plan_hash;

  const conflict = await handleTool('create_plan', planArgs('req_audit03', 'isi kedua'), 'ops');
  assert.equal(conflict.ok, false, 'isi berbeda tidak boleh menimpa plan yang ada');
  assert.equal(conflict.error.code, 'PLAN_ALREADY_EXISTS');

  const stored = await getPlan(first.data.plan.plan_id);
  assert.equal(stored?.plan_hash, originalHash, 'plan tersimpan tidak boleh berubah');

  const events = await createdEvents(first.data.plan.plan_id);
  assert.equal(events.length, 1, 'penolakan tidak boleh menghasilkan event plan_created kedua');
});

test('persistence gagal tidak menghasilkan plan_created', async () => {
  /*
   * Kegagalan nyata, bukan tiruan: `plans.json` dirusak sehingga pembacaan
   * store melempar. Kalau event ditulis sebelum insert, event itu akan ada
   * padahal plan tidak pernah tersimpan — bukti yang menyesatkan, lebih buruk
   * daripada tidak ada bukti.
   */
  const original = await readFile(plansFile, 'utf8');
  await writeFile(plansFile, '{ ini bukan json', 'utf8');
  try {
    await assert.rejects(
      () => handleTool('create_plan', planArgs('req_audit04'), 'ops'),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return true;
      },
      'create_plan harus gagal ketika store tidak terbaca',
    );
  } finally {
    await writeFile(plansFile, original, 'utf8');
  }

  const events = await createdEvents('plan_audit04');
  assert.equal(events.length, 0, 'tidak boleh ada event untuk plan yang gagal disimpan');
});

test('dua plan beruntun tidak berbagi event_id', async () => {
  const a = await handleTool('create_plan', planArgs('req_audit05'), 'ops');
  const b = await handleTool('create_plan', planArgs('req_audit06'), 'ops');
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);

  const events = await createdEvents();
  const ids = events.map((event) => event.event_id);
  assert.equal(new Set(ids).size, ids.length, `event_id duplikat: ${ids.join(', ')}`);
});

test('aktor diturunkan dari token, bukan dari argumen', async () => {
  const asAgent = await handleTool('create_plan', planArgs('req_audit07'), 'agent');
  assert.equal(asAgent.ok, true, JSON.stringify(asAgent));
  const [agentEvent] = await createdEvents(asAgent.data.plan.plan_id);
  assert.equal(agentEvent!.actor, 'agent');

  const asOps = await handleTool('create_plan', planArgs('req_audit08'), 'ops');
  assert.equal(asOps.ok, true);
  const [opsEvent] = await createdEvents(asOps.data.plan.plan_id);
  assert.equal(opsEvent!.actor, 'dashboard');
});

test('plan_created dapat ditemukan lewat get_audit_log', async () => {
  const byType = await handleTool('get_audit_log', { q: 'plan_created', limit: 500 }, 'ops');
  assert.equal(byType.ok, true);
  assert.ok(byType.data.total > 0, 'pencarian tipe harus menemukan event');
  for (const event of byType.data.events) assert.equal(event.type, 'plan_created');

  const byPlanId = await handleTool('get_audit_log', { q: 'plan_audit01', limit: 50 }, 'ops');
  assert.equal(byPlanId.ok, true);
  assert.ok(
    byPlanId.data.events.some((event: any) => event.type === 'plan_created' && event.plan_id === 'plan_audit01'),
    'plan_created harus dapat ditemukan lewat plan_id',
  );
});

test('audit gagal ditulis: plan tetap ada, tetapi jawabannya bukan sukses', async () => {
  /*
   * Kegagalan yang paling mudah ditutupi: plan berhasil disimpan, lalu audit
   * gagal ditulis. Mengembalikan `ok: true` di sini berarti "berhasil tanpa
   * bukti" — plan yang tidak punya catatan siapa yang membuatnya dan kapan.
   *
   * Kegagalannya nyata: `audit.jsonl` diganti direktori, sehingga append gagal.
   */
  const auditFile = join(dataDir, 'audit.jsonl');
  const backup = join(dataDir, 'audit.jsonl.bak');
  await rename(auditFile, backup);
  await mkdir(auditFile);
  try {
    const result = await handleTool('create_plan', planArgs('req_audit09'), 'ops');
    assert.equal(result.ok, false, 'penulisan audit yang gagal tidak boleh dilaporkan sebagai sukses');
    assert.equal(result.error.code, 'AUDIT_WRITE_FAILED');
    assert.ok(result.error.message.includes('plan_audit09'), 'pesan harus menyebut plan yang sudah tersimpan');

    const stored = await getPlan('plan_audit09' as never);
    assert.ok(stored, 'plan memang tersimpan — itulah sebabnya jawabannya menyebutkannya');
  } finally {
    await rmdir(auditFile);
    await rename(backup, auditFile);
    await rm(join(dataDir, 'audit.jsonl.lock'), { force: true });
  }
});
