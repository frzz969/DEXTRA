import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appendAudit, auditHash, listAudit, listAuditWithIntegrity, verifyAuditChain } from '../src/repository.ts';
import type { AuditEvent } from '../../contracts/src/index.ts';

let dataDir = '';

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'dextra-audit-chain-'));
  process.env.DEXTRA_DATA_DIR = dataDir;
});

afterEach(async () => {
  delete process.env.DEXTRA_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

function event(id: string, detail: Record<string, string> = { a: '1' }): AuditEvent {
  return {
    event_id: id as AuditEvent['event_id'],
    at: '2026-11-03T10:00:00.000Z',
    type: 'action_executed',
    actor: 'executor',
    detail,
  };
}

describe('rantai hash audit', () => {
  test('setiap event terikat ke hash event sebelumnya', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));
    await appendAudit(event('evt_3'));

    const events = await listAudit();
    assert.equal(events.length, 3);
    assert.equal(events[0]!.prev_hash, null, 'event pertama tidak punya pendahulu');
    assert.equal(events[1]!.prev_hash, events[0]!.hash);
    assert.equal(events[2]!.prev_hash, events[1]!.hash);

    const integrity = verifyAuditChain(events);
    assert.equal(integrity.ok, true);
    assert.equal(integrity.verified, 3);
    assert.equal(integrity.unchained, 0);
  });

  test('menyunting satu event memutus rantai di titik itu', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));
    await appendAudit(event('evt_3'));

    const file = join(dataDir, 'audit.jsonl');
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    const tampered = JSON.parse(lines[1]!);
    tampered.detail = { a: '999' }; // isi diubah, hash dibiarkan
    lines[1] = JSON.stringify(tampered);
    await writeFile(file, lines.join('\n') + '\n', 'utf8');

    const integrity = verifyAuditChain(await listAudit());
    assert.equal(integrity.ok, false);
    assert.equal(integrity.broken_at, 'evt_2');
    assert.equal(integrity.broken_index, 1);
    assert.equal(integrity.verified, 1, 'hanya event sebelum titik rusak yang terverifikasi');
  });

  test('menghapus satu baris juga terdeteksi', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));
    await appendAudit(event('evt_3'));

    const file = join(dataDir, 'audit.jsonl');
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    await writeFile(file, [lines[0], lines[2]].join('\n') + '\n', 'utf8');

    const integrity = verifyAuditChain(await listAudit());
    assert.equal(integrity.ok, false, 'event tanpa pendahulu yang benar tidak boleh lolos');
  });

  test('event lama tanpa hash dilaporkan unchained, bukan sah', async () => {
    const legacy = { event_id: 'evt_old', at: '2026-11-01T00:00:00.000Z', type: 'action_executed', actor: 'executor', detail: { a: '1' } };
    await writeFile(join(dataDir, 'audit.jsonl'), JSON.stringify(legacy) + '\n', 'utf8');
    await appendAudit(event('evt_new'));

    const integrity = verifyAuditChain(await listAudit());
    assert.equal(integrity.ok, true, 'tidak ada bukti pemalsuan pada bagian yang dirantai');
    assert.equal(integrity.unchained, 1, 'event lama tidak boleh dihitung sebagai terverifikasi');
    assert.equal(integrity.verified, 1);
  });

  test('urutan kunci detail tidak mengubah hash', async () => {
    const a = event('evt_x', { satu: '1', dua: '2' });
    const b = event('evt_x', { dua: '2', satu: '1' });
    assert.equal(auditHash(a, null), auditHash(b, null));
  });

  test('isi berbeda menghasilkan hash berbeda', async () => {
    assert.notEqual(auditHash(event('evt_x', { a: '1' }), null), auditHash(event('evt_x', { a: '2' }), null));
  });
});

describe('checkpoint dan ketahanan berkas', () => {
  test('checkpoint mencatat jumlah dan kepala rantai', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));

    const { integrity } = await listAuditWithIntegrity();
    assert.equal(integrity.checkpoint_status, 'matches');
    assert.equal(integrity.checkpoint?.event_count, 2);
    assert.equal(integrity.ok, true);
  });

  test('menghapus event TERAKHIR kini terdeteksi', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));
    await appendAudit(event('evt_3'));

    const file = join(dataDir, 'audit.jsonl');
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    await writeFile(file, lines.slice(0, -1).join('\n') + '\n', 'utf8');

    const { integrity } = await listAuditWithIntegrity();
    assert.equal(integrity.ok, false, 'rantai lebih pendek dari checkpoint harus ditolak');
    assert.equal(integrity.checkpoint_status, 'truncated');
  });

  test('mengosongkan berkas tidak lagi terbaca sehat', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));

    await writeFile(join(dataDir, 'audit.jsonl'), '', 'utf8');

    const { integrity } = await listAuditWithIntegrity();
    assert.equal(integrity.ok, false, 'ok=true dengan nol event adalah verdict paling berbahaya');
    assert.equal(integrity.checkpoint_status, 'truncated');
  });

  test('baris terpotong tidak mematikan seluruh audit', async () => {
    await appendAudit(event('evt_1'));
    await appendAudit(event('evt_2'));

    const file = join(dataDir, 'audit.jsonl');
    const lines = (await readFile(file, 'utf8')).trim().split('\n');
    await writeFile(file, lines[0] + '\n' + lines[1]!.slice(0, 25), 'utf8');

    const { events, integrity } = await listAuditWithIntegrity();
    assert.equal(events.length, 1, 'event sebelum baris rusak tetap terbaca');
    assert.equal(integrity.malformed_at, 1);
    assert.equal(integrity.ok, false, 'baris rusak bukan keadaan sehat');
  });

  test('tanpa checkpoint: dilaporkan missing, bukan dianggap cocok', async () => {
    await appendAudit(event('evt_1'));
    await rm(join(dataDir, 'audit.checkpoint.json'), { force: true });

    const { integrity } = await listAuditWithIntegrity();
    assert.equal(integrity.checkpoint_status, 'missing');
    assert.equal(integrity.ok, true, 'tanpa pembanding, tidak ada bukti pemalsuan — tapi juga tidak terjamin');
  });
});

describe('penulisan dari beberapa proses', () => {
  /*
   * The bug this guards: `withFileLock` is an in-process promise queue. Two
   * processes appending at once both read the same predecessor and chain to it,
   * forking the log. The verifier then reported a legitimate write as tampering
   * — a false alarm, which is worse than no alarm.
   *
   * This test spawns real processes because the bug only exists across them. An
   * in-process simulation would have passed against the broken code.
   */
  test('dua proses menulis bersamaan tidak mencabangkan rantai', async () => {
    const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const workerPath = join(dataDir, 'worker.mjs');
    const repoUrl = pathToFileURL(join(repoRoot, 'packages/store/src/repository.ts')).href;

    await writeFile(workerPath, [
      `import { appendAudit } from ${JSON.stringify(repoUrl)};`,
      'const tag = process.argv[2];',
      'for (let i = 0; i < 5; i += 1) {',
      '  await appendAudit({ event_id: `evt_${tag}_${i}`, at: new Date().toISOString(), type: "action_executed", actor: "executor", detail: { i: String(i) } });',
      '}',
    ].join('\n'), 'utf8');

    const runWorker = (tag: string) => new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-strip-types', workerPath, tag], {
        cwd: repoRoot,
        env: { ...process.env, DEXTRA_DATA_DIR: dataDir },
        stdio: 'ignore',
      });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${tag} exit ${code}`))));
    });

    await Promise.all([runWorker('a'), runWorker('b')]);

    const { events, integrity } = await listAuditWithIntegrity();
    assert.equal(events.length, 10, 'semua event dari kedua proses harus tersimpan');
    assert.equal(integrity.ok, true, `rantai bercabang: broken_at=${integrity.broken_at}`);
    assert.equal(integrity.verified, 10);
  });
});
