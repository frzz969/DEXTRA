import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appendAudit, auditHash, listAudit, verifyAuditChain } from '../src/repository.ts';
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
