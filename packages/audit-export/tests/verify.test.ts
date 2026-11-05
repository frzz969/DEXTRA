/*
 * The verifier is the product here, so most of these tests are about refusal.
 *
 * A positive test says "a clean export verifies". That is necessary and almost
 * worthless on its own: an implementation that always returns `ok: true` passes
 * it. Each negative case below changes exactly one thing about a clean export
 * and asserts that a *specific* check fails — so disabling that check makes a
 * named test fail. The negative controls in the report were produced by doing
 * exactly that.
 */
import { readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import { exportAuditLog } from '../src/export.ts';
import { verifyExport } from '../src/verify.ts';
import { bareEvent, chain, tempDir, writeEvents } from './helpers.ts';

const dirs: string[] = [];
after(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

interface Fixture {
  jsonlPath: string;
  manifestPath: string;
}

async function cleanExport(eventCount = 4): Promise<Fixture> {
  const d = await tempDir();
  dirs.push(d);
  const events = chain(Array.from({ length: eventCount }, (_, index) => bareEvent(index + 1)));
  const source = await writeEvents(d, events);
  const result = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'usr_nadia',
  });
  return { jsonlPath: result.jsonlPath, manifestPath: result.manifestPath };
}

async function readLines(path: string): Promise<string[]> {
  const raw = await readFile(path, 'utf8');
  return raw === '' ? [] : raw.trimEnd().split('\n');
}

async function writeLines(path: string, lines: string[]): Promise<void> {
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8');
}

/**
 * Recomputes the artifact-level claims so that a semantic tamper is not caught
 * only by the checksum.
 *
 * Without this, every negative test would fail on `artifact.sha256` and prove
 * nothing about the check it names. Resyncing the checksum is exactly what a
 * careful attacker does, so the tests exercise the harder case.
 */
async function resyncArtifact(fixture: Fixture): Promise<void> {
  const bytes = await readFile(fixture.jsonlPath);
  const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
  manifest.artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
  manifest.artifact.bytes = bytes.length;
  manifest.artifact.lines = (await readLines(fixture.jsonlPath)).length;
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function editManifest(fixture: Fixture, edit: (manifest: any) => void): Promise<void> {
  const manifest = JSON.parse(await readFile(fixture.manifestPath, 'utf8'));
  edit(manifest);
  await writeFile(fixture.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function failing(result: { failures: string[] }): string[] {
  return result.failures;
}

test('an empty export is not a verified export', async () => {
  const d = await tempDir();
  dirs.push(d);
  const source = await writeEvents(d, []);
  const exported = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'test',
  });

  const result = await verifyExport(exported.jsonlPath, exported.manifestPath);
  assert.equal(result.ok, false);
  assert.deepEqual(failing(result), ['export.nonempty']);
  /*
   * The manifest still records `ok: true` because that is what the live chain
   * verdict says. The two are not contradictory: the manifest describes the
   * log, the verifier refuses to call an empty artifact verified.
   */
  assert.equal(exported.manifest.integrity.ok, true);
});

test('a clean export verifies', async () => {
  const fixture = await cleanExport();
  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.deepEqual(failing(result), []);
  assert.equal(result.ok, true);
  assert.equal(result.integrity?.verified, 4);
  assert.equal(result.integrity?.unchained, 0);
  /* Identity claims are reported as unverifiable, never as passed. */
  const unverifiable = result.checks.filter((c) => c.status === 'unverifiable').map((c) => c.id);
  assert.deepEqual(unverifiable.sort(), ['export.identity', 'export.principal', 'export.time']);
});

test('edited detail is rejected', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  const event = JSON.parse(lines[1]!);
  event.detail = { n: 'forged' };
  lines[1] = JSON.stringify(event);
  await writeLines(fixture.jsonlPath, lines);
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('chain.hash'), failing(result).join(','));
});

test('a deleted event is rejected', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  lines.splice(1, 1);
  await writeLines(fixture.jsonlPath, lines);
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('chain.linkage'), failing(result).join(','));
});

test('an inserted event is rejected', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  /* A copy of event 2 inserted after event 1: the chain no longer joins. */
  lines.splice(1, 0, lines[1]!);
  await writeLines(fixture.jsonlPath, lines);
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('chain.linkage'), failing(result).join(','));
});

test('reordered events are rejected', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  const swapped = [lines[2]!, lines[1]!];
  lines[1] = swapped[0]!;
  lines[2] = swapped[1]!;
  await writeLines(fixture.jsonlPath, lines);
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('chain.linkage'), failing(result).join(','));
});

test('a prev_hash that points at the wrong event is rejected', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  const event = JSON.parse(lines[2]!);
  event.prev_hash = 'deadbeef';
  lines[2] = JSON.stringify(event);
  await writeLines(fixture.jsonlPath, lines);
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('chain.linkage'), failing(result).join(','));
});

test('a hash that does not recompute is rejected', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  const event = JSON.parse(lines[1]!);
  event.hash = 'f'.repeat(64);
  lines[1] = JSON.stringify(event);
  await writeLines(fixture.jsonlPath, lines);
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('chain.hash'), failing(result).join(','));
});

test('a modified manifest is rejected', async () => {
  const fixture = await cleanExport();
  await editManifest(fixture, (manifest) => {
    manifest.event_count = 99;
  });

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('event.count'), failing(result).join(','));
});

test('a wrong checksum is rejected', async () => {
  const fixture = await cleanExport();
  await editManifest(fixture, (manifest) => {
    manifest.artifact.sha256 = 'a'.repeat(64);
  });

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('artifact.sha256'), failing(result).join(','));
});

test('an unchained event claimed as verified is rejected', async () => {
  const d = await tempDir();
  dirs.push(d);
  /* Events written before the chain existed: no hash at all. */
  const source = await writeEvents(d, [bareEvent(1), bareEvent(2)]);
  const exported = await exportAuditLog({
    sourcePath: source,
    checkpointPath: null,
    outDir: `${d}/out`,
    exportedBy: 'test',
  });

  const clean = await verifyExport(exported.jsonlPath, exported.manifestPath);
  assert.equal(clean.ok, true);
  assert.equal(clean.integrity?.unchained, 2);
  assert.equal(clean.integrity?.verified, 0);

  await editManifest(exported, (manifest) => {
    manifest.integrity.verified = 2;
    manifest.integrity.unchained = 0;
  });

  const result = await verifyExport(exported.jsonlPath, exported.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('unchained.not_verified'), failing(result).join(','));
  assert.ok(failing(result).includes('integrity.matches'), failing(result).join(','));
});

test('a manifest with an unknown field is rejected', async () => {
  const fixture = await cleanExport();
  await editManifest(fixture, (manifest) => {
    manifest.trust_me = true;
  });

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.deepEqual(failing(result), ['manifest.structure']);
});

test('a missing artifact is rejected', async () => {
  const fixture = await cleanExport();
  await unlink(fixture.jsonlPath);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('artifact.exists'), failing(result).join(','));
});

test('a truncated artifact is rejected by count and by checkpoint', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  await writeLines(fixture.jsonlPath, lines.slice(0, 2));
  await resyncArtifact(fixture);

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('event.count'), failing(result).join(','));
  assert.ok(failing(result).includes('event.range'), failing(result).join(','));
});

test('a duplicated event id is rejected even when the chain still joins', async () => {
  const fixture = await cleanExport();
  const lines = await readLines(fixture.jsonlPath);
  /*
   * Rebuild a chain where event 3 reuses event 1's id. The hashes are all
   * recomputed, so linkage and hashes pass — only the id check can catch it.
   */
  const { auditHash } = await import('../src/canonical.ts');
  const rebuilt: any[] = [];
  let prev: string | null = null;
  for (const [index, line] of lines.entries()) {
    const event = JSON.parse(line);
    if (index === 2) event.event_id = 'evt_1';
    const hash = auditHash(event, prev);
    rebuilt.push({ ...event, prev_hash: prev, hash });
    prev = hash;
  }
  await writeLines(fixture.jsonlPath, rebuilt.map((event) => JSON.stringify(event)));
  await resyncArtifact(fixture);
  await editManifest(fixture, (manifest) => {
    manifest.range.last = {
      event_id: rebuilt[rebuilt.length - 1]!.event_id,
      at: rebuilt[rebuilt.length - 1]!.at,
      hash: rebuilt[rebuilt.length - 1]!.hash,
    };
    manifest.integrity.verified = rebuilt.length;
  });

  const result = await verifyExport(fixture.jsonlPath, fixture.manifestPath);
  assert.equal(result.ok, false);
  assert.ok(failing(result).includes('event.ids_unique'), failing(result).join(','));
});
