import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { AuditEventSchema, type AuditEvent } from '../../contracts/src/audit.ts';
import { auditHash } from './canonical.ts';
import { readLines } from './lines.ts';
import { EXPORT_FORMAT_VERSION, type AuditExportManifest } from './manifest.ts';

/**
 * Upper bound on the source log, in bytes.
 *
 * The export streams, so memory is not the reason for this number — disk and
 * time are. 64 MiB is roughly 200 000 events at the current event size, two
 * orders of magnitude above anything this installation has produced. The limit
 * exists so that a mistake (pointing the exporter at a huge file) fails loudly
 * instead of filling the disk; it is documented rather than silently applied.
 */
export const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

export type AuditExportErrorCode =
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_TOO_LARGE'
  | 'SOURCE_UNREADABLE'
  | 'OUTPUT_WRITE_FAILED';

export class AuditExportError extends Error {
  readonly code: AuditExportErrorCode;

  constructor(code: AuditExportErrorCode, message: string) {
    super(message);
    this.name = 'AuditExportError';
    this.code = code;
  }
}

export interface AuditExportCheckpoint {
  event_count: number;
  head_hash: string;
  at: string;
}

export interface ExportAuditOptions {
  /** Absolute path to the live `audit.jsonl`. Read only; never written. */
  sourcePath: string;
  /** Absolute path to the checkpoint file, or null when this log has none. */
  checkpointPath: string | null;
  /** Directory the two artifacts are written to. Created if missing. */
  outDir: string;
  /** Principal id, or `scope:<name>` when no principal is bound to the token. */
  exportedBy: string;
  now?: Date;
  /** Fixed only by tests; production uses a random id. */
  exportId?: string;
  maxSourceBytes?: number;
}

export interface ExportAuditResult {
  manifest: AuditExportManifest;
  jsonlPath: string;
  manifestPath: string;
}

export function newExportId(): string {
  return `exp_${randomBytes(6).toString('hex')}`;
}

/**
 * Reads the checkpoint without failing the export when it is absent or damaged.
 *
 * Absent and corrupt both become `null`, which the manifest reports as
 * `checkpoint_status: 'missing'`. The two are not distinguished here because the
 * export must not become impossible just because a runtime file was truncated;
 * the consequence is visible in the manifest instead of hidden.
 */
async function readCheckpoint(path: string | null): Promise<AuditExportCheckpoint | null> {
  if (path === null) return null;
  try {
    const raw = JSON.parse(await readFile(path, 'utf8')) as Partial<AuditExportCheckpoint>;
    if (typeof raw.event_count !== 'number' || typeof raw.head_hash !== 'string') return null;
    return { event_count: raw.event_count, head_hash: raw.head_hash, at: String(raw.at ?? '') };
  } catch {
    return null;
  }
}

export function compareCheckpoint(
  eventCount: number,
  last: AuditEvent | null,
  checkpoint: AuditExportCheckpoint | null,
): AuditExportManifest['integrity']['checkpoint_status'] {
  if (!checkpoint) return 'missing';
  if (eventCount < checkpoint.event_count) return 'truncated';
  if (eventCount > checkpoint.event_count) return 'ahead';
  if (!last || last.hash !== checkpoint.head_hash) return 'head_mismatch';
  return 'matches';
}

/**
 * Copies the readable prefix of the audit log into a new JSONL artifact and
 * writes a manifest beside it.
 *
 * Three properties this function is built around:
 *
 * 1. The source is opened read-only and never rewritten. There is no code path
 *    here that can modify `audit.jsonl`.
 * 2. Lines are copied byte-for-byte. `event_id`, `prev_hash`, and `hash` are the
 *    ones that were stored; nothing is recomputed to make the export look valid.
 * 3. The artifact is written to `<id>.jsonl.partial` and renamed only after the
 *    stream closes, and the manifest is written last. A crash therefore leaves
 *    an obviously incomplete `.partial` file with no manifest, rather than a
 *    truncated file that looks like a finished export.
 */
export async function exportAuditLog(options: ExportAuditOptions): Promise<ExportAuditResult> {
  const maxBytes = options.maxSourceBytes ?? MAX_SOURCE_BYTES;
  const exportId = options.exportId ?? newExportId();

  let size: number;
  try {
    const info = await stat(options.sourcePath);
    if (!info.isFile()) throw new AuditExportError('SOURCE_UNREADABLE', `Not a regular file: ${options.sourcePath}`);
    size = info.size;
  } catch (error) {
    if (error instanceof AuditExportError) throw error;
    throw new AuditExportError('SOURCE_NOT_FOUND', `Audit log not found: ${options.sourcePath}`);
  }
  if (size > maxBytes) {
    throw new AuditExportError(
      'SOURCE_TOO_LARGE',
      `Audit log is ${size} bytes, above the ${maxBytes}-byte export limit. Export a range or raise the limit deliberately.`,
    );
  }

  const checkpoint = await readCheckpoint(options.checkpointPath);

  await mkdir(options.outDir, { recursive: true });
  const jsonlName = `${exportId}.jsonl`;
  const manifestName = `${exportId}.manifest.json`;
  const partialPath = join(options.outDir, `${jsonlName}.partial`);
  const jsonlPath = join(options.outDir, jsonlName);
  const manifestPath = join(options.outDir, manifestName);

  const artifactHash = createHash('sha256');
  let bytes = 0;
  let lines = 0;
  let verified = 0;
  let unchained = 0;
  let brokenAt: string | null = null;
  let brokenIndex: number | null = null;
  let malformedAt: number | null = null;
  let expectedPrev: string | null = null;
  let first: AuditEvent | null = null;
  let last: AuditEvent | null = null;
  /** Once the chain breaks, later events are still copied but no longer counted. */
  let stopped = false;

  const out = createWriteStream(partialPath, { encoding: 'utf8' });
  try {
    for await (const { line, index } of readLines(options.sourcePath)) {
      let event: AuditEvent;
      try {
        event = AuditEventSchema.parse(JSON.parse(line));
      } catch {
        /*
         * Same rule as the live reader: the first unparseable line ends the
         * readable prefix. Everything before it is still evidence, everything
         * after it is unverifiable, so it is not copied.
         */
        malformedAt = index;
        break;
      }

      if (!stopped) {
        if (!event.hash) {
          /* Old event, written before the chain existed. Counted, never verified. */
          unchained += 1;
          expectedPrev = null;
        } else if ((event.prev_hash ?? null) !== expectedPrev) {
          brokenAt = event.event_id;
          brokenIndex = index;
          stopped = true;
        } else if (auditHash(event, expectedPrev) !== event.hash) {
          brokenAt = event.event_id;
          brokenIndex = index;
          stopped = true;
        } else {
          verified += 1;
          expectedPrev = event.hash;
        }
      }

      if (!out.write(`${line}\n`)) {
        await new Promise<void>((resolve) => out.once('drain', () => resolve()));
      }
      const written = Buffer.from(`${line}\n`, 'utf8');
      artifactHash.update(written);
      bytes += written.length;
      lines += 1;
      first ??= event;
      last = event;
    }
    await new Promise<void>((resolve, reject) => {
      out.end((error?: Error | null) => (error ? reject(error) : resolve()));
    });
  } catch (error) {
    out.destroy();
    await unlink(partialPath).catch(() => undefined);
    throw error instanceof AuditExportError
      ? error
      : new AuditExportError('OUTPUT_WRITE_FAILED', `Export failed while writing: ${(error as Error).message}`);
  }

  await rename(partialPath, jsonlPath).catch(async (error: Error) => {
    await unlink(partialPath).catch(() => undefined);
    throw new AuditExportError('OUTPUT_WRITE_FAILED', `Could not finalise the artifact: ${error.message}`);
  });

  const checkpointStatus = compareCheckpoint(lines, last, checkpoint);
  const integrity: AuditExportManifest['integrity'] = {
    verified,
    unchained,
    broken_at: brokenAt,
    broken_index: brokenIndex,
    malformed_at: malformedAt,
    checkpoint_status: checkpointStatus,
    /*
     * `ahead` is not a failure: it means events were appended after the last
     * checkpoint write, which an honest crash between the two steps produces.
     * A broken chain and a malformed line are failures: the log as a whole
     * cannot be vouched for, so `ok` is false even if the checkpoint agrees.
     */
    ok:
      brokenAt === null &&
      malformedAt === null &&
      checkpointStatus !== 'truncated' &&
      checkpointStatus !== 'head_mismatch',
  };

  const manifest: AuditExportManifest = {
    format_version: EXPORT_FORMAT_VERSION,
    export_id: exportId,
    exported_at: (options.now ?? new Date()).toISOString(),
    exported_by: options.exportedBy,
    source: { file: basename(options.sourcePath) },
    event_count: lines,
    range: {
      first: first ? { event_id: first.event_id, at: first.at, hash: first.hash ?? null } : null,
      last: last ? { event_id: last.event_id, at: last.at, hash: last.hash ?? null } : null,
    },
    integrity,
    checkpoint,
    artifact: { file: jsonlName, sha256: artifactHash.digest('hex'), bytes, lines },
  };

  /* Manifest last: its presence is the only signal that the export completed. */
  const manifestTmp = `${manifestPath}.tmp`;
  try {
    await writeFile(manifestTmp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rename(manifestTmp, manifestPath);
  } catch (error) {
    await unlink(manifestTmp).catch(() => undefined);
    throw new AuditExportError('OUTPUT_WRITE_FAILED', `Could not write the manifest: ${(error as Error).message}`);
  }

  return { manifest, jsonlPath, manifestPath };
}

