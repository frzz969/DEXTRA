import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { StringDecoder } from 'node:string_decoder';

import { AuditEventSchema, type AuditEvent } from '../../contracts/src/audit.ts';
import { auditHash } from './canonical.ts';
import { AuditExportManifestSchema, EXPORT_FORMAT_VERSION, type AuditExportManifest } from './manifest.ts';

export type CheckStatus = 'pass' | 'fail' | 'unverifiable';

export interface VerifyCheck {
  id: string;
  status: CheckStatus;
  detail: string;
}

export interface RecomputedIntegrity {
  verified: number;
  unchained: number;
  hashed: number;
  broken_at: string | null;
  broken_index: number | null;
  malformed_at: number | null;
  checkpoint_status: AuditExportManifest['integrity']['checkpoint_status'];
  ok: boolean;
}

export interface VerifyResult {
  /** True only when no check failed. `unverifiable` does not fail the export. */
  ok: boolean;
  manifest: AuditExportManifest | null;
  integrity: RecomputedIntegrity | null;
  checks: VerifyCheck[];
  failures: string[];
}

interface ArtifactScan {
  sha256: string;
  bytes: number;
  lines: number;
  first: AuditEvent | null;
  last: AuditEvent | null;
  malformedAt: number | null;
  structureError: string | null;
  duplicateId: string | null;
  verified: number;
  unchained: number;
  hashed: number;
  brokenAt: string | null;
  brokenIndex: number | null;
  /** Which test failed: `prev_hash` did not point back, or the content hash did not recompute. */
  brokenKind: 'linkage' | 'hash' | null;
}

/**
 * Reads the artifact once and recomputes everything it can from the bytes alone.
 *
 * Nothing in here consults the live log, the store, or the dashboard. That is
 * what makes the result independent: it is derived from the artifact and the
 * manifest, and from nothing else.
 *
 * The chain loop is a deliberate second implementation of the rule in
 * `packages/store/src/repository.ts`. Sharing it would make the verifier agree
 * with the writer by construction, which is not verification. Three
 * implementations (store, exporter, verifier) are kept in agreement by
 * `tests/chain-parity.test.ts`.
 */
async function scanArtifact(path: string): Promise<ArtifactScan> {
  const hash = createHash('sha256');
  const decoder = new StringDecoder('utf8');
  const ids = new Set<string>();

  let bytes = 0;
  let lines = 0;
  let leftover = '';
  let first: AuditEvent | null = null;
  let last: AuditEvent | null = null;
  let malformedAt: number | null = null;
  let structureError: string | null = null;
  let duplicateId: string | null = null;

  let verified = 0;
  let unchained = 0;
  let hashed = 0;
  let expectedPrev: string | null = null;
  let brokenAt: string | null = null;
  let brokenIndex: number | null = null;
  let brokenKind: 'linkage' | 'hash' | null = null;
  let stopped = false;

  function handle(raw: string, index: number): void {
    let event: AuditEvent;
    try {
      const parsed: unknown = JSON.parse(raw);
      const result = AuditEventSchema.safeParse(parsed);
      if (!result.success) {
        structureError ??= `line ${index}: ${result.error.issues[0]?.message ?? 'invalid event'}`;
        return;
      }
      event = result.data;
    } catch {
      /* A malformed line ends the readable prefix, exactly as it does at write time. */
      malformedAt ??= index;
      stopped = true;
      return;
    }

    if (ids.has(event.event_id)) {
      duplicateId ??= event.event_id;
    }
    ids.add(event.event_id);

    if (event.hash) hashed += 1;

    if (!stopped) {
      if (!event.hash) {
        unchained += 1;
        expectedPrev = null;
      } else if ((event.prev_hash ?? null) !== expectedPrev) {
        brokenAt = event.event_id;
        brokenIndex = index;
        brokenKind = 'linkage';
        stopped = true;
      } else if (auditHash(event, expectedPrev) !== event.hash) {
        brokenAt = event.event_id;
        brokenIndex = index;
        brokenKind = 'hash';
        stopped = true;
      } else {
        verified += 1;
        expectedPrev = event.hash;
      }
    }

    lines += 1;
    first ??= event;
    last = event;
  }

  const stream = createReadStream(path);
  for await (const chunk of stream) {
    const buf = chunk as Buffer;
    hash.update(buf);
    bytes += buf.length;
    leftover += decoder.write(buf);
    let newline = leftover.indexOf('\n');
    while (newline !== -1) {
      const raw = leftover.slice(0, newline);
      leftover = leftover.slice(newline + 1);
      handle(raw.endsWith('\r') ? raw.slice(0, -1) : raw, lines);
      newline = leftover.indexOf('\n');
    }
  }
  leftover += decoder.end();
  if (leftover !== '') {
    handle(leftover.endsWith('\r') ? leftover.slice(0, -1) : leftover, lines);
  }

  return {
    sha256: hash.digest('hex'),
    bytes,
    lines,
    first,
    last,
    malformedAt,
    structureError,
    duplicateId,
    verified,
    unchained,
    hashed,
    brokenAt,
    brokenIndex,
    brokenKind,
  };
}

function compareCheckpoint(
  eventCount: number,
  last: AuditEvent | null,
  checkpoint: AuditExportManifest['checkpoint'],
): AuditExportManifest['integrity']['checkpoint_status'] {
  if (!checkpoint) return 'missing';
  if (eventCount < checkpoint.event_count) return 'truncated';
  if (eventCount > checkpoint.event_count) return 'ahead';
  if (!last || last.hash !== checkpoint.head_hash) return 'head_mismatch';
  return 'matches';
}

/**
 * Verifies an export directory pair without trusting the manifest.
 *
 * The manifest is treated as a set of CLAIMS. Every claim that can be
 * recomputed from the artifact is recomputed and compared; the rest
 * (`export_id`, `exported_at`, `exported_by`) are marked `unverifiable` rather
 * than passed. A modified manifest therefore fails wherever it contradicts the
 * artifact, and is honestly reported as unverifiable where it cannot.
 *
 * What this cannot do: detect a manifest that was rewritten *consistently* with
 * a fully re-hashed artifact. That is inherent to any hash chain whose anchor
 * travels with the evidence. Keeping the checkpoint somewhere else, or
 * publishing the export id and checksum through another channel, is what turns
 * evidence into proof. See `design/AUDIT-EXPORT.md` §7.
 */
export async function verifyExport(jsonlPath: string, manifestPath: string): Promise<VerifyResult> {
  const checks: VerifyCheck[] = [];

  let manifest: AuditExportManifest | null = null;
  try {
    const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
    const parsed = AuditExportManifestSchema.safeParse(raw);
    if (!parsed.success) {
      checks.push({
        id: 'manifest.structure',
        status: 'fail',
        detail: `manifest does not match format ${EXPORT_FORMAT_VERSION}: ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      });
      return { ok: false, manifest: null, integrity: null, checks, failures: ['manifest.structure'] };
    }
    manifest = parsed.data;
    checks.push({ id: 'manifest.structure', status: 'pass', detail: `format ${manifest.format_version}` });
  } catch (error) {
    checks.push({ id: 'manifest.structure', status: 'fail', detail: `manifest unreadable: ${(error as Error).message}` });
    return { ok: false, manifest: null, integrity: null, checks, failures: ['manifest.structure'] };
  }

  try {
    const info = await stat(jsonlPath);
    if (!info.isFile()) throw new Error('not a regular file');
    checks.push({ id: 'artifact.exists', status: 'pass', detail: basename(jsonlPath) });
  } catch {
    checks.push({ id: 'artifact.exists', status: 'fail', detail: `artifact missing: ${basename(jsonlPath)}` });
    return { ok: false, manifest, integrity: null, checks, failures: ['artifact.exists'] };
  }

  if (basename(jsonlPath) !== manifest.artifact.file) {
    checks.push({
      id: 'artifact.name',
      status: 'fail',
      detail: `manifest names ${manifest.artifact.file}, verifying ${basename(jsonlPath)}`,
    });
  } else {
    checks.push({ id: 'artifact.name', status: 'pass', detail: manifest.artifact.file });
  }

  const scan = await scanArtifact(jsonlPath);

  checks.push(
    scan.sha256 === manifest.artifact.sha256
      ? { id: 'artifact.sha256', status: 'pass', detail: scan.sha256 }
      : {
          id: 'artifact.sha256',
          status: 'fail',
          detail: `manifest says ${manifest.artifact.sha256}, file hashes to ${scan.sha256}`,
        },
  );

  checks.push(
    scan.bytes === manifest.artifact.bytes
      ? { id: 'artifact.bytes', status: 'pass', detail: `${scan.bytes} bytes` }
      : { id: 'artifact.bytes', status: 'fail', detail: `manifest says ${manifest.artifact.bytes}, file has ${scan.bytes}` },
  );

  checks.push(
    scan.structureError === null
      ? { id: 'event.structure', status: 'pass', detail: `${scan.lines} events match the event contract` }
      : { id: 'event.structure', status: 'fail', detail: scan.structureError },
  );

  checks.push(
    scan.malformedAt === null
      ? { id: 'event.parse', status: 'pass', detail: 'every line is parseable JSON' }
      : { id: 'event.parse', status: 'fail', detail: `line ${scan.malformedAt} is not parseable` },
  );

  checks.push(
    scan.duplicateId === null
      ? { id: 'event.ids_unique', status: 'pass', detail: `${scan.lines} unique event ids` }
      : { id: 'event.ids_unique', status: 'fail', detail: `duplicate event_id: ${scan.duplicateId}` },
  );

  checks.push(
    scan.lines === manifest.event_count
      ? { id: 'event.count', status: 'pass', detail: `${scan.lines} events` }
      : { id: 'event.count', status: 'fail', detail: `manifest says ${manifest.event_count}, artifact has ${scan.lines}` },
  );

  /*
   * An empty export is not a verified export.
   *
   * This is the one place where this verifier deliberately disagrees with
   * `verifyAuditChain`, which reports `ok: true` for an empty log because there
   * is no bad link to find. Over nothing, "no bad link" is not a finding. A
   * green verdict on zero events is the most dangerous output this system can
   * produce, so it is refused here and the live endpoint's behaviour is
   * recorded as a known defect in design/AUDIT-EXPORT.md §7 rather than
   * quietly changed in a feature that was not asked to change it.
   */
  checks.push(
    scan.lines === 0
      ? { id: 'export.nonempty', status: 'fail', detail: 'the artifact has no events; an export of nothing vouches for nothing' }
      : { id: 'export.nonempty', status: 'pass', detail: `${scan.lines} events` },
  );

  const firstOk = refMatches(manifest.range.first, scan.first);
  const lastOk = refMatches(manifest.range.last, scan.last);
  checks.push(
    firstOk && lastOk
      ? { id: 'event.range', status: 'pass', detail: 'first and last event match the manifest' }
      : {
          id: 'event.range',
          status: 'fail',
          detail: `range mismatch: first ${firstOk ? 'ok' : 'differs'}, last ${lastOk ? 'ok' : 'differs'}`,
        },
  );

  /*
   * Linkage and hash are separate checks because they answer different
   * questions: "does this event point at its predecessor" (which catches
   * deletion, insertion, and reordering) and "is this event's own content the
   * content that was hashed" (which catches an edited detail field). Reporting
   * them together would hide which one failed.
   */
  checks.push(
    scan.brokenKind === 'linkage'
      ? { id: 'chain.linkage', status: 'fail', detail: `chain breaks at ${scan.brokenAt} (index ${scan.brokenIndex}): prev_hash does not point at the previous event` }
      : { id: 'chain.linkage', status: 'pass', detail: `${scan.verified} links verified` },
  );

  checks.push(
    scan.brokenKind === 'hash'
      ? { id: 'chain.hash', status: 'fail', detail: `hash mismatch at ${scan.brokenAt} (index ${scan.brokenIndex}): stored content does not reproduce the stored hash` }
      : { id: 'chain.hash', status: 'pass', detail: 'stored hashes recompute correctly' },
  );

  const checkpointStatus = compareCheckpoint(scan.lines, scan.last, manifest.checkpoint);
  const recomputed: RecomputedIntegrity = {
    verified: scan.verified,
    unchained: scan.unchained,
    hashed: scan.hashed,
    broken_at: scan.brokenAt,
    broken_index: scan.brokenIndex,
    malformed_at: scan.malformedAt,
    checkpoint_status: checkpointStatus,
    ok:
      scan.brokenAt === null &&
      scan.malformedAt === null &&
      checkpointStatus !== 'truncated' &&
      checkpointStatus !== 'head_mismatch',
  };

  const claimed = manifest.integrity;
  const fields: Array<keyof typeof claimed> = [
    'verified',
    'unchained',
    'broken_at',
    'broken_index',
    'malformed_at',
    'checkpoint_status',
    'ok',
  ];
  const differing = fields.filter((field) => claimed[field] !== recomputed[field as keyof RecomputedIntegrity]);
  checks.push(
    differing.length === 0
      ? { id: 'integrity.matches', status: 'pass', detail: 'manifest verdict equals the recomputed verdict' }
      : {
          id: 'integrity.matches',
          status: 'fail',
          detail: differing
            .map((field) => `${field}: manifest ${JSON.stringify(claimed[field])}, recomputed ${JSON.stringify(recomputed[field as keyof RecomputedIntegrity])}`)
            .join('; '),
        },
  );

  /*
   * An unhashed event is old, not verified. This check exists on its own so the
   * failure says why: a manifest that counts `unchained` events inside
   * `verified` is the specific lie this project has had to remove before.
   */
  checks.push(
    claimed.verified <= scan.hashed
      ? { id: 'unchained.not_verified', status: 'pass', detail: `${scan.unchained} unchained events excluded from verified` }
      : {
          id: 'unchained.not_verified',
          status: 'fail',
          detail: `manifest claims ${claimed.verified} verified but only ${scan.hashed} events carry a hash`,
        },
  );

  checks.push(
    checkpointStatus === 'matches' || checkpointStatus === 'ahead' || checkpointStatus === 'missing'
      ? { id: 'checkpoint.consistent', status: 'pass', detail: `checkpoint ${checkpointStatus}` }
      : { id: 'checkpoint.consistent', status: 'fail', detail: `checkpoint ${checkpointStatus}: the artifact is shorter than the checkpoint or ends elsewhere` },
  );

  checks.push(
    { id: 'export.identity', status: 'unverifiable', detail: `export_id ${manifest.export_id} is a claim, not a signature` },
    { id: 'export.time', status: 'unverifiable', detail: `exported_at ${manifest.exported_at} cannot be checked offline` },
    { id: 'export.principal', status: 'unverifiable', detail: `exported_by ${manifest.exported_by} is asserted by the exporter` },
  );

  const failures = checks.filter((check) => check.status === 'fail').map((check) => check.id);
  return { ok: failures.length === 0, manifest, integrity: recomputed, checks, failures };
}

function refMatches(
  claimed: AuditExportManifest['range']['first'],
  actual: AuditEvent | null,
): boolean {
  if (claimed === null) return actual === null;
  if (actual === null) return false;
  return claimed.event_id === actual.event_id && claimed.at === actual.at && claimed.hash === (actual.hash ?? null);
}
