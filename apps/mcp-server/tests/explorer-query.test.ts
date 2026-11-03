import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';

/*
 * Data Explorer memakai empat tool baca yang sudah ada, dengan parameter
 * tambahan `q` dan `offset`. Yang diuji di sini bukan tampilan, melainkan
 * urutannya: filter harus terjadi sebelum pemotongan halaman.
 *
 * Kalau urutannya terbalik, halaman pertama terlihat benar dan pencarian
 * diam-diam hanya mencari di antara baris yang kebetulan sudah tampil. Itu bug
 * yang tidak terlihat sampai ada yang mencari sesuatu yang tidak ada di layar —
 * karena itu tes di bawah sengaja mencari kata yang HANYA ada di halaman
 * terakhir.
 */

const dataDir = await mkdtemp(join(tmpdir(), 'dextra-explorer-'));
process.env.DEXTRA_DATA_DIR = dataDir;

const { seed, appendAudit } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');

const TOTAL_PLANS = 30;
const SEEDED_AUDIT_EVENTS = 24;

function planArgs(index: number) {
  return {
    org_id: 'org_kenari',
    request_id: `req_explorer_${String(index).padStart(2, '0')}`,
    intent: `eksplorasi data nomor ${index}`,
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
        content: { subject: `Subjek ${index}`, body: `Isi ${index}.`, locale: 'id-ID' },
      },
    ],
  };
}

before(async () => {
  await seed();
  for (let index = 0; index < TOTAL_PLANS; index += 1) {
    const created = await handleTool('create_plan', planArgs(index), 'ops');
    assert.equal(created.ok, true, `gagal membuat plan ${index}: ${JSON.stringify(created)}`);
  }

  /*
   * Event audit ditulis lewat `appendAudit`, bukan disuntik ke berkas: yang
   * diuji adalah jalur baca, jadi jalur tulisnya harus yang asli. Perhatikan
   * bahwa `create_plan` TIDAK menulis event apa pun — `plan_created` ada di enum
   * tetapi belum ada yang menghasilkannya. Itu dicatat sebagai temuan, bukan
   * ditutupi di sini.
   */
  for (let index = 0; index < SEEDED_AUDIT_EVENTS; index += 1) {
    await appendAudit({
      event_id: `evt_explorer_${String(index).padStart(2, '0')}`,
      at: new Date(Date.UTC(2026, 10, 3, 10, index, 0)).toISOString(),
      type: index % 3 === 0 ? 'plan_validated' : 'action_executed',
      actor: 'service',
      detail: { urutan: String(index) },
    } as never);
  }
});

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

async function listPlans(args: Record<string, unknown>) {
  const result = await handleTool('list_plans', args, 'ops');
  assert.equal(result.ok, true);
  return result.data as {
    plans: Array<{ plan_id: string; intent: string }>;
    total: number;
    offset: number;
    limit: number;
  };
}

test('total mencerminkan seluruh hasil, bukan panjang halaman', async () => {
  const page = await listPlans({ limit: 5 });
  assert.equal(page.plans.length, 5);
  assert.equal(page.total, TOTAL_PLANS, 'total harus jumlah seluruh plan');
});

test('offset mengambil halaman berikutnya tanpa tumpang tindih', async () => {
  const first = await listPlans({ limit: 10, offset: 0 });
  const second = await listPlans({ limit: 10, offset: 10 });

  assert.equal(first.plans.length, 10);
  assert.equal(second.plans.length, 10);
  assert.equal(second.offset, 10);

  const firstIds = new Set(first.plans.map((p) => p.plan_id));
  const overlap = second.plans.filter((p) => firstIds.has(p.plan_id));
  assert.equal(overlap.length, 0, 'halaman kedua tidak boleh memuat baris halaman pertama');
});

test('pencarian menemukan baris yang tidak ada di halaman pertama', async () => {
  /*
   * `nomor 0` hanya ada di plan pertama yang dibuat — plan tertua, jadi berada
   * di halaman TERAKHIR karena daftar diurutkan terbaru-dulu. Kalau server
   * memotong halaman dulu baru mencari, hasilnya kosong.
   */
  const search = await listPlans({ limit: 5, q: 'nomor 0' });
  assert.equal(search.total, 1, 'harus ketemu tepat satu plan');
  assert.match(search.plans[0]!.intent, /nomor 0$/);
});

test('pencarian dan paginasi bisa dipakai bersama', async () => {
  const all = await listPlans({ q: 'eksplorasi data', limit: 500 });
  assert.equal(all.total, TOTAL_PLANS, 'kata kunci ini ada di semua plan');

  const page = await listPlans({ q: 'eksplorasi data', limit: 7, offset: 7 });
  assert.equal(page.plans.length, 7);
  assert.equal(page.total, TOTAL_PLANS, 'total tetap jumlah hasil filter, bukan sisa halaman');
});

test('pencarian tidak peka huruf besar-kecil', async () => {
  const lower = await listPlans({ q: 'nomor 0' });
  const upper = await listPlans({ q: 'NOMOR 0' });
  assert.equal(upper.total, lower.total);
  assert.equal(upper.total, 1);
});

test('kata kunci tanpa hasil mengembalikan nol, bukan halaman penuh', async () => {
  const empty = await listPlans({ q: 'kata-yang-pasti-tidak-ada-xyz' });
  assert.equal(empty.total, 0);
  assert.equal(empty.plans.length, 0);
});

test('limit di atas batas dipotong server, bukan diterima apa adanya', async () => {
  const page = await listPlans({ limit: 100_000 });
  assert.equal(page.limit, 500, 'batas halaman ditegakkan di server');
  assert.ok(page.plans.length <= 500);
});

test('offset melewati akhir data menghasilkan halaman kosong, bukan galat', async () => {
  const page = await listPlans({ offset: 10_000 });
  assert.equal(page.plans.length, 0);
  assert.equal(page.total, TOTAL_PLANS, 'total tetap benar');
});

test('offset negatif ditolak, bukan diam-diam dianggap nol', async () => {
  /*
   * Sebelumnya nilai ini dijepit ke 0. Menjepit berarti pemanggil yang salah
   * menerima halaman pertama dan tidak pernah tahu offset-nya diabaikan — pada
   * halaman kedua itu berarti baris yang sama muncul lagi. Sekarang galat.
   */
  const page = await handleTool('list_plans', { offset: -50, limit: 3 }, 'ops');
  assert.equal(page.ok, false);
  assert.equal(page.error.code, 'INVALID_ARGUMENT');
});

test('audit log: pencarian mencakup tipe event dan isi detail', async () => {
  const result = await handleTool('get_audit_log', { q: 'plan_validated', limit: 500 }, 'ops');
  assert.equal(result.ok, true);
  const data = result.data as {
    events: Array<{ type: string }>;
    total: number;
    scanned: number;
    integrity: { ok: boolean };
  };

  assert.ok(data.total > 0, 'harus ada event plan_validated');
  assert.equal(data.total, data.events.length);
  for (const event of data.events) {
    assert.equal(event.type, 'plan_validated');
  }
  assert.ok(data.scanned >= data.total, 'scanned adalah ukuran seluruh log');

  /* Detail ikut dicari: `urutan` hanya ada di dalam `detail`, bukan di field atas. */
  const byDetail = await handleTool('get_audit_log', { q: 'urutan', limit: 500 }, 'ops');
  const detailData = byDetail.data as { total: number };
  assert.equal(detailData.total, SEEDED_AUDIT_EVENTS, 'pencarian harus menjangkau isi detail');
});

test('audit log: halaman dihitung dari ekor, jadi halaman kedua lebih tua', async () => {
  const newest = await handleTool('get_audit_log', { limit: 5, offset: 0 }, 'ops');
  const older = await handleTool('get_audit_log', { limit: 5, offset: 5 }, 'ops');
  assert.equal(newest.ok, true);
  assert.equal(older.ok, true);

  const a = (newest.data as { events: Array<{ at: string; event_id: string }> }).events;
  const b = (older.data as { events: Array<{ at: string; event_id: string }> }).events;

  assert.equal(a.length, 5);
  assert.equal(b.length, 5);
  const aIds = new Set(a.map((e) => e.event_id));
  assert.equal(b.filter((e) => aIds.has(e.event_id)).length, 0, 'halaman tidak boleh tumpang tindih');

  /* Log diurutkan lama→baru; halaman "kedua" harus berisi event yang lebih tua. */
  const oldestOnSecond = b[0]!.at;
  const newestOnFirst = a[a.length - 1]!.at;
  assert.ok(Date.parse(oldestOnSecond) <= Date.parse(newestOnFirst));
});

test('audit log: integritas tetap dihitung atas SELURUH log, bukan halaman', async () => {
  const page = await handleTool('get_audit_log', { limit: 2, offset: 0 }, 'ops');
  const data = page.data as { events: unknown[]; integrity: { verified: number; ok: boolean } };
  assert.equal(data.events.length, 2);
  assert.ok(
    data.integrity.verified > 2,
    'verdict harus mencakup seluruh rantai, bukan dua event yang ditampilkan',
  );
  assert.equal(data.integrity.ok, true);
});

test('mandat dan eksekusi menerima offset tanpa mengubah bentuk respons', async () => {
  const mandates = await handleTool('list_mandates', { limit: 2, offset: 0 }, 'ops');
  assert.equal(mandates.ok, true);
  const mandateData = mandates.data as { mandates: unknown[]; total: number; offset: number; limit: number };
  assert.equal(mandateData.offset, 0);
  assert.equal(mandateData.limit, 2);
  assert.ok(typeof mandateData.total === 'number');

  const executions = await handleTool('list_executions', { limit: 2, offset: 0 }, 'ops');
  assert.equal(executions.ok, true);
  const executionData = executions.data as {
    executions: unknown[];
    total: number;
    summary: { total: number };
  };
  assert.equal(executionData.summary.total, executionData.total, 'ringkasan tetap atas seluruh hasil');
});

/*
 * P6.1 — validasi argumen.
 *
 * Sebelum ini argumen bertipe salah diabaikan diam-diam, dan `limit: -1` berarti
 * "seluruh berkas". Keduanya menghasilkan jawaban yang terlihat sah: seluruh isi
 * dikembalikan, dan pemanggil membacanya sebagai "semuanya cocok" atau sebagai
 * halaman yang kebetulan penuh.
 */
test('q yang terlalu panjang ditolak, bukan dipotong', async () => {
  const long = 'a'.repeat(201);
  for (const tool of ['list_plans', 'list_mandates', 'list_executions', 'get_audit_log']) {
    const result = await handleTool(tool, { q: long }, 'ops');
    assert.equal(result.ok, false, `${tool} harus menolak q sepanjang 201 karakter`);
    assert.equal(result.error.code, 'INVALID_ARGUMENT');
    assert.ok(result.error.message.includes('200'), 'pesan harus menyebut batasnya');
  }
});

test('q tepat pada batas masih diterima', async () => {
  const atLimit = 'a'.repeat(200);
  const result = await handleTool('list_plans', { q: atLimit }, 'ops');
  assert.equal(result.ok, true, 'batas adalah 200, bukan 199');
  assert.equal(result.data.total, 0, 'tidak ada plan yang cocok, dan itu jawaban yang benar');
});

test('q bertipe salah ditolak, bukan diabaikan', async () => {
  const result = await handleTool('list_plans', { q: 123 }, 'ops');
  assert.equal(result.ok, false, 'q bukan string tidak boleh berarti "tanpa filter"');
  assert.equal(result.error.code, 'INVALID_ARGUMENT');
});

test('limit negatif tidak lagi berarti "semua"', async () => {
  const result = await handleTool('get_audit_log', { limit: -1 }, 'ops');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'INVALID_ARGUMENT');
});

test('limit nol dan limit bukan angka ditolak', async () => {
  for (const limit of [0, Number.POSITIVE_INFINITY, Number.NaN]) {
    const result = await handleTool('list_plans', { limit }, 'ops');
    assert.equal(result.ok, false, `limit ${String(limit)} harus ditolak`);
    assert.equal(result.error.code, 'INVALID_ARGUMENT');
  }
});

test('limit di atas batas dijepit, tidak ditolak', async () => {
  /* Menolak `limit: 100000` akan mematahkan klien yang hanya ingin "sebanyak
     mungkin". Menjepitnya menjawab permintaan itu tanpa memuat seluruh berkas. */
  const result = await handleTool('list_plans', { limit: 100000 }, 'ops');
  assert.equal(result.ok, true);
  assert.equal(result.data.limit, 500);
});

test('penolakan argumen tidak memotong otorisasi', async () => {
  /* Token agent tidak memegang `view_audit`. Penolakan harus datang dari
     otorisasi dan terjadi SEBELUM argumen diperiksa: kalau urutannya terbalik,
     pemanggil tanpa izin bisa membedakan "tool tidak ada untuk saya" dari
     "argumen Anda salah" — dan perbedaan itu sendiri sudah membocorkan bahwa
     tool-nya ada. */
  const result = await handleTool('get_audit_log', { limit: -1 }, 'agent');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'ACTION_NOT_ALLOWED');
  assert.ok(result.error.message.includes('not available'), 'penolakan otorisasi, bukan validasi argumen');
});
