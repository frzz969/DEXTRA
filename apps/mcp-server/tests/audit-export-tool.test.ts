/*
 * `export_audit` di permukaan tool.
 *
 * Dua hal yang dijaga di sini dan tidak bisa dijaga oleh tes paket:
 *   1. kewenangannya. Ekspor memuat SELURUH log, jadi scope yang hanya boleh
 *      "membaca sebagian data" tidak boleh mendapatkannya;
 *   2. efek sampingnya. Ekspor menulis artefak baru dan tidak boleh mengubah
 *      satu byte pun di `audit.jsonl`.
 */
import { readFile, readdir, rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const dataDir = await mkdtemp(join(tmpdir(), 'dextra-export-tool-'));
process.env.DEXTRA_DATA_DIR = dataDir;

const { seed, appendAudit } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');
const { toolsForScope } = await import('../../../packages/contracts/src/authorization.ts');
const { verifyExport } = await import('../../../packages/audit-export/src/index.ts');

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const auditPath = join(dataDir, 'audit.jsonl');

/** `seed()` leaves the log empty, so the fixture writes its own events. */
async function writeEvents(count: number): Promise<void> {
  for (let index = 1; index <= count; index += 1) {
    await appendAudit({
      event_id: `evt_export_${Date.now()}_${index}` as unknown as import('../../../packages/contracts/src/ids.ts').EventId,
      at: new Date().toISOString(),
      type: 'audit_integrity_checked',
      actor: 'service',
      detail: { n: String(index) },
    });
  }
}

test('ops boleh mengekspor, dan hasilnya lolos verifier independen', async () => {
  await seed();
  await writeEvents(3);
  const result = await handleTool('export_audit', {}, 'ops');
  assert.equal(result.ok, true, JSON.stringify(result));

  const { manifest, files } = result.data;
  assert.ok(manifest.event_count > 0, 'seed harus meninggalkan event audit');
  assert.equal(manifest.exported_by, 'usr_nadia');

  const verdict = await verifyExport(files.jsonl, files.manifest);
  assert.deepEqual(verdict.failures, [], `verifier menolak ekspor sendiri: ${verdict.failures.join(', ')}`);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.integrity?.verified, manifest.event_count);
});

test('ekspor tidak mengubah audit asli', async () => {
  const before = await readFile(auditPath);
  const result = await handleTool('export_audit', {}, 'ops');
  assert.equal(result.ok, true, JSON.stringify(result));
  const after_ = await readFile(auditPath);
  assert.deepEqual(after_, before, 'audit.jsonl tidak boleh berubah karena ekspor');
});

test('scope agent ditolak, bukan diberi ekspor sebagian', async () => {
  const result = await handleTool('export_audit', {}, 'agent');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'ACTION_NOT_ALLOWED');

  /*
   * Alasan penolakan bukan "agent tidak punya tool ini", melainkan capability:
   * `view_all` yang dimiliki agent tidak sama dengan `view_audit`.
   */
  assert.equal(toolsForScope('agent').includes('export_audit'), false);
  assert.equal(toolsForScope('ops').includes('export_audit'), true);
});

test('dua ekspor menghasilkan dua artefak berbeda, keduanya sah', async () => {
  const exportDir = join(dataDir, 'exports');
  const countManifests = async () =>
    (await readdir(exportDir)).filter((name) => name.endsWith('.manifest.json')).length;
  const before = await countManifests();

  const first = await handleTool('export_audit', {}, 'ops');
  const second = await handleTool('export_audit', {}, 'ops');
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.notEqual(first.data.manifest.export_id, second.data.manifest.export_id);

  assert.equal(await countManifests(), before + 2, 'setiap ekspor meninggalkan satu manifest');

  for (const result of [first, second]) {
    const verdict = await verifyExport(result.data.files.jsonl, result.data.files.manifest);
    assert.equal(verdict.ok, true);
  }
});

test('ekspor tanpa audit log melaporkan SOURCE_NOT_FOUND, bukan ekspor kosong yang tampak sah', async () => {
  const empty = await mkdtemp(join(tmpdir(), 'dextra-export-empty-'));
  const previous = process.env.DEXTRA_DATA_DIR;
  process.env.DEXTRA_DATA_DIR = empty;
  try {
    const result = await handleTool('export_audit', {}, 'ops');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'SOURCE_NOT_FOUND');
  } finally {
    process.env.DEXTRA_DATA_DIR = previous;
    await rm(empty, { recursive: true, force: true });
  }
});
