/*
 * Three implementations of the same rule must agree.
 *
 *   store/src/repository.ts   writes and verifies the live chain
 *   audit-export/canonical.ts hashes events for the exporter
 *   audit-export/verify.ts    hashes them again, independently
 *
 * The verifier deliberately does not import the writer's chain logic: a
 * verifier that shares the bug it is supposed to catch verifies nothing. The
 * price of that independence is this file. If someone changes the canonical
 * field list in one place, these tests fail — which is the only thing keeping
 * the three copies honest.
 */
import { rm } from 'node:fs/promises';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import type { AuditEvent } from '../../contracts/src/audit.ts';
import { auditHash as storeAuditHash, verifyAuditChain } from '../../store/src/repository.ts';
import { auditHash as exportAuditHash } from '../src/canonical.ts';
import { exportAuditLog } from '../src/export.ts';
import { bareEvent, chain, tempDir, writeEvents } from './helpers.ts';

const dirs: string[] = [];
after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

const corpus: Array<{ name: string; event: AuditEvent }> = [
  { name: 'minimal', event: bareEvent(1) },
  {
    name: 'every optional field',
    event: bareEvent(2, {
      plan_id: 'plan_a',
      mandate_id: 'mandate_a',
      action_id: 'action_a',
      plan_hash: 'sha256:' + 'a'.repeat(64),
      reason_code: 'AUDIT_WRITE_FAILED',
    } as Partial<AuditEvent>),
  },
  { name: 'empty detail', event: bareEvent(3, { detail: {} }) },
  {
    name: 'detail keys deliberately unsorted',
    event: bareEvent(4, { detail: { zeta: '1', alpha: '2', Mid: '3', _under: '4' } }),
  },
  { name: 'unicode detail', event: bareEvent(5, { detail: { note: 'Salat Jumat 11:30 — "wajib" ✅' } }) },
  {
    name: 'detail with nullish-looking strings',
    event: bareEvent(6, { detail: { a: '', b: 'null', c: '0' } }),
  },
];

test('canonical hash agrees with the store implementation', () => {
  for (const { name, event } of corpus) {
    for (const prev of [null, 'deadbeef']) {
      assert.equal(
        exportAuditHash(event, prev),
        storeAuditHash(event, prev),
        `hash differs for "${name}" with prev=${String(prev)}`,
      );
    }
  }
});

test('export verdict agrees with the store verifier', async () => {
  const dir = await tempDir();
  dirs.push(dir);
  const events = chain([bareEvent(1), bareEvent(2), bareEvent(3), bareEvent(4)]);
  const source = await writeEvents(dir, events);

  const result = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${dir}/out`,
    exportedBy: 'test',
  });

  const live = verifyAuditChain(events, null);
  assert.equal(result.manifest.integrity.verified, live.verified);
  assert.equal(result.manifest.integrity.unchained, live.unchained);
  assert.equal(result.manifest.integrity.broken_at, live.broken_at);
  assert.equal(result.manifest.integrity.broken_index, live.broken_index);
  assert.equal(result.manifest.integrity.checkpoint_status, live.checkpoint_status);
  assert.equal(result.manifest.integrity.ok, live.ok);
});

test('export verdict agrees with the store verifier on a broken chain', async () => {
  const dir = await tempDir();
  dirs.push(dir);
  const events = chain([bareEvent(1), bareEvent(2), bareEvent(3)]);
  /* Rewrite the middle event's detail without touching its hash: a break. */
  const tampered = events.map((event, index) =>
    index === 1 ? { ...event, detail: { n: 'tampered' } } : event,
  );
  const source = await writeEvents(dir, tampered);

  const result = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${dir}/out`,
    exportedBy: 'test',
  });

  const live = verifyAuditChain(tampered, null);
  assert.equal(result.manifest.integrity.verified, live.verified);
  assert.equal(result.manifest.integrity.broken_at, live.broken_at);
  assert.equal(result.manifest.integrity.broken_index, live.broken_index);
  assert.equal(result.manifest.integrity.ok, false);
});
