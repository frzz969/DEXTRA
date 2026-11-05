import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { AuditExportError, exportAuditLog } from '../src/export.ts';
import { bareEvent, chain, tempDir, writeCheckpoint, writeEvents, writeLog } from './helpers.ts';

const dirs: string[] = [];
after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function dir(): Promise<string> {
  const d = await tempDir();
  dirs.push(d);
  return d;
}

test('exports every event and leaves the source byte-identical', async () => {
  const d = await dir();
  const events = chain([bareEvent(1), bareEvent(2), bareEvent(3)]);
  const source = await writeEvents(d, events);
  const before = await readFile(source);

  const result = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'usr_nadia',
  });

  const after_ = await readFile(source);
  assert.deepEqual(after_, before, 'the live audit log must not change');

  const artifact = await readFile(result.jsonlPath, 'utf8');
  const lines = artifact.trimEnd().split('\n');
  assert.equal(lines.length, 3);
  /* Byte-for-byte copy: the stored hashes are the ones in the export. */
  assert.deepEqual(lines, events.map((event) => JSON.stringify(event)));
});

test('manifest describes the artifact it was written beside', async () => {
  const d = await dir();
  const events = chain([bareEvent(1), bareEvent(2)]);
  const source = await writeEvents(d, events);

  const { manifest, jsonlPath, manifestPath } = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'usr_nadia',
    now: new Date('2026-11-04T00:30:00.000Z'),
  });

  const bytes = await readFile(jsonlPath);
  assert.equal(manifest.artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(manifest.artifact.bytes, bytes.length);
  assert.equal(manifest.artifact.lines, 2);
  assert.equal(manifest.event_count, 2);
  assert.equal(manifest.exported_at, '2026-11-04T00:30:00.000Z');
  assert.equal(manifest.exported_by, 'usr_nadia');
  assert.equal(manifest.source.file, 'audit.jsonl');
  assert.match(manifest.export_id, /^exp_[a-f0-9]{12}$/);
  assert.equal(manifest.range.first?.event_id, 'evt_1');
  assert.equal(manifest.range.last?.event_id, 'evt_2');
  assert.equal(manifest.range.last?.hash, events[1]!.hash);

  /* The manifest on disk is the manifest that was returned. */
  const onDisk = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.deepEqual(onDisk, JSON.parse(JSON.stringify(manifest)));
});

test('no .partial file survives a successful export', async () => {
  const d = await dir();
  const source = await writeEvents(d, chain([bareEvent(1)]));
  await exportAuditLog({ sourcePath: source, checkpointPath: null, outDir: `${d}/out`, exportedBy: 'test' });
  const entries = await readdir(`${d}/out`);
  assert.equal(entries.filter((name) => name.endsWith('.partial')).length, 0);
});

test('an empty log exports as an empty artifact with a null range', async () => {
  const d = await dir();
  const source = await writeLog(d, []);
  const { manifest } = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'test',
  });
  assert.equal(manifest.event_count, 0);
  assert.equal(manifest.range.first, null);
  assert.equal(manifest.range.last, null);
  assert.equal(manifest.integrity.verified, 0);
  assert.equal(manifest.integrity.unchained, 0);
});

test('unhashed events are counted as unchained, never as verified', async () => {
  const d = await dir();
  /* Written before the chain existed: no prev_hash, no hash. */
  const source = await writeEvents(d, [bareEvent(1), bareEvent(2), bareEvent(3)]);
  const { manifest } = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'test',
  });
  assert.equal(manifest.integrity.unchained, 3);
  assert.equal(manifest.integrity.verified, 0);
  assert.equal(manifest.integrity.broken_at, null);
});

test('a malformed line ends the readable prefix and is reported', async () => {
  const d = await dir();
  const events = chain([bareEvent(1), bareEvent(2)]);
  const source = await writeLog(d, [JSON.stringify(events[0]), '{"event_id":', JSON.stringify(events[1])]);
  const { manifest, jsonlPath } = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'test',
  });
  assert.equal(manifest.event_count, 1, 'only the readable prefix is exported');
  assert.equal(manifest.integrity.malformed_at, 1);
  assert.equal(manifest.integrity.ok, false);
  const lines = (await readFile(jsonlPath, 'utf8')).trimEnd().split('\n');
  assert.equal(lines.length, 1);
});

test('checkpoint status: matches, ahead, truncated, head_mismatch, missing', async () => {
  const d = await dir();
  const events = chain([bareEvent(1), bareEvent(2), bareEvent(3)]);
  const source = await writeEvents(d, events);

  async function withCheckpoint(count: number, head: string) {
    const path = await writeCheckpoint(d, count, head);
    const { manifest } = await exportAuditLog({
      sourcePath: source,
      checkpointPath: path,
      outDir: `${d}/out-${count}-${head.slice(0, 6)}`,
      exportedBy: 'test',
    });
    return manifest.integrity;
  }

  const matches = await withCheckpoint(3, events[2]!.hash!);
  assert.equal(matches.checkpoint_status, 'matches');
  assert.equal(matches.ok, true);

  /* Events appended after the last checkpoint write: honest crash, not tampering. */
  const ahead = await withCheckpoint(2, events[1]!.hash!);
  assert.equal(ahead.checkpoint_status, 'ahead');
  assert.equal(ahead.ok, true, 'ahead must not be reported as tampering');

  const truncated = await withCheckpoint(4, events[2]!.hash!);
  assert.equal(truncated.checkpoint_status, 'truncated');
  assert.equal(truncated.ok, false);

  const headMismatch = await withCheckpoint(3, 'deadbeef');
  assert.equal(headMismatch.checkpoint_status, 'head_mismatch');
  assert.equal(headMismatch.ok, false);
});

test('missing source fails with SOURCE_NOT_FOUND and writes nothing', async () => {
  const d = await dir();
  await assert.rejects(
    exportAuditLog({ sourcePath: `${d}/nope.jsonl`, checkpointPath: null, outDir: `${d}/out`, exportedBy: 'test' }),
    (error: unknown) => error instanceof AuditExportError && error.code === 'SOURCE_NOT_FOUND',
  );
  await assert.rejects(stat(`${d}/out`), 'no output directory should be created for a failed export');
});

test('a source above the limit is refused, not truncated', async () => {
  const d = await dir();
  const source = await writeEvents(d, chain([bareEvent(1), bareEvent(2)]));
  await assert.rejects(
    exportAuditLog({
      sourcePath: source,
      checkpointPath: null,
      outDir: `${d}/out`,
      exportedBy: 'test',
      maxSourceBytes: 10,
    }),
    (error: unknown) => error instanceof AuditExportError && error.code === 'SOURCE_TOO_LARGE',
  );
});

test('export ids differ between runs', async () => {
  const d = await dir();
  const source = await writeEvents(d, chain([bareEvent(1)]));
  const a = await exportAuditLog({ sourcePath: source, checkpointPath: null, outDir: `${d}/a`, exportedBy: 'test' });
  const b = await exportAuditLog({ sourcePath: source, checkpointPath: null, outDir: `${d}/b`, exportedBy: 'test' });
  assert.notEqual(a.manifest.export_id, b.manifest.export_id);
});
