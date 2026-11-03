import { appendFile, mkdir, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { getDocumentsDir, getStorePaths } from './paths.ts';
import { StoreError, StoreFileError } from './types.ts';

const WRITE_QUEUES = new Map<string, Promise<void>>();

async function ensureParent(file: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureParent(file);
  const temp = `${file}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  // Never write the target directly: serialize to a temp file then rename.
  await writeFile(temp, payload, 'utf8');
  await rename(temp, file);
}

/**
 * Serializes a whole read-modify-write transaction per target file.
 *
 * `writeJsonAtomic` already serializes the *write*, but every repository writer
 * reads the file, decides what the new contents should be, and only then writes.
 * Two concurrent writers can therefore both read the pre-write state and each
 * write a list containing only its own change — the second write silently
 * discards the first. For plans that loses a plan; for executions it defeats
 * duplicate detection entirely, which is how a single action can be executed
 * twice. Serializing the transaction rather than just the write closes that
 * window.
 *
 * Re-entrancy is not supported: a function holding the lock must not call
 * another function that takes the same lock, or it will wait on itself.
 */
const TRANSACTIONS = new Map<string, Promise<unknown>>();

export function withFileLock<T>(file: string, run: () => Promise<T>): Promise<T> {
  const previous = TRANSACTIONS.get(file) ?? Promise.resolve();
  // Run whether the previous transaction resolved or rejected: one failed write
  // must not wedge every later write to the same file.
  const result = previous.then(
    () => run(),
    () => run(),
  );
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  TRANSACTIONS.set(file, tail);
  void tail.then(() => {
    if (TRANSACTIONS.get(file) === tail) {
      TRANSACTIONS.delete(file);
    }
  });
  return result;
}

/**
 * Lock that holds across processes, not just across calls.
 *
 * `withFileLock` below serializes callers inside one Node process, which is not
 * the same thing. The MCP server, the Telegram adapter, the seed script and the
 * tests are separate processes; two of them appending at once both read the same
 * predecessor and both chain to it, forking the audit chain. The verifier then
 * reports a fork as tampering — a false alarm on a legitimate write, which is
 * worse than no alarm at all.
 *
 * `open(path, 'wx')` is the primitive: it fails with EEXIST if the file exists,
 * atomically, on POSIX and Windows alike. There is no portable advisory lock in
 * Node without a dependency, and this is enough for the critical section here
 * (read last hash, append, write checkpoint).
 *
 * Stale locks are broken after 30s. The section this protects takes
 * milliseconds, so a lock that old belongs to a process that died.
 */
const LOCK_STALE_MS = 30_000;
const LOCK_TIMEOUT_MS = 10_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withCrossProcessLock<T>(target: string, run: () => Promise<T>): Promise<T> {
  const lockPath = `${target}.lock`;
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let handle: Awaited<ReturnType<typeof open>> | null = null;

  for (;;) {
    try {
      handle = await open(lockPath, 'wx');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

      try {
        const info = await stat(lockPath);
        if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
          // The holder died without releasing. Remove and retry immediately.
          await unlink(lockPath).catch(() => undefined);
          continue;
        }
      } catch {
        // The lock vanished between open and stat: retry.
        continue;
      }

      if (Date.now() > deadline) {
        throw new StoreError('AUDIT_WRITE_FAILED', `lock timeout: ${lockPath} (proses lain menahan lebih dari ${LOCK_TIMEOUT_MS}ms)`);
      }
      // Jitter keeps two waiters from retrying in lockstep forever.
      await sleep(10 + Math.floor(Math.random() * 25));
    }
  }

  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    return await run();
  } finally {
    await handle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
}

/**
 * Atomic write serialized per target path. Because the temp file name is
 * fixed (`<file>.tmp`), concurrent writes to the same target are chained so
 * they cannot interleave.
 */
export function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const previous = WRITE_QUEUES.get(file) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => writeJson(file, value));
  WRITE_QUEUES.set(file, next);

  return next.finally(() => {
    if (WRITE_QUEUES.get(file) === next) {
      WRITE_QUEUES.delete(file);
    }
  });
}

/** Reads JSON, returning `fallback` only when the file does not exist. */
export async function readJsonFile<T>(file: string, fallback: T): Promise<T> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }

  if (raw.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new StoreFileError(file, (error as Error).message);
  }
}

/** Appends one JSON line. The audit log is append-only and never rewritten. */
export async function appendJsonLine(file: string, value: unknown): Promise<void> {
  await ensureParent(file);
  await appendFile(file, `${JSON.stringify(value)}\n`, 'utf8');
}

/** Reads JSON Lines in file order (oldest first). */
export async function readJsonLines<T>(file: string): Promise<T[]> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.map((line) => {
    try {
      return JSON.parse(line) as T;
    } catch (error) {
      throw new StoreFileError(file, (error as Error).message);
    }
  });
}

/**
 * Reads JSON Lines but stops at the first unparseable line instead of failing
 * the whole file.
 *
 * A crash during an append can leave a half-written last line. For a data file
 * that is corruption, and refusing to read it is defensible. For the audit log
 * it is the opposite: one truncated line would make the entire history
 * unreadable, so a single bad write would erase the evidence of everything
 * before it. This reader keeps what is intact and reports where it stopped.
 *
 * `malformed_at` is the zero-based index of the first bad line, or null.
 */
export async function readJsonLinesLenient<T>(file: string): Promise<{ records: T[]; malformed_at: number | null }> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { records: [], malformed_at: null };
    }
    throw error;
  }

  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  const records: T[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    try {
      records.push(JSON.parse(lines[index]!) as T);
    } catch {
      return { records, malformed_at: index };
    }
  }
  return { records, malformed_at: null };
}

/**
 * Creates the data tree and every store file if missing. Existing files are
 * never touched. Safe to call on every repository operation.
 */
export async function ensureStoreFiles(): Promise<void> {
  const paths = getStorePaths();
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(getDocumentsDir(), { recursive: true });

  const defaults: Array<[string, string]> = [
    [paths.contacts, '[]\n'],
    [paths.org, '{}\n'],
    [paths.precedents, '[]\n'],
    [paths.calendar, '{"events":[]}\n'],
    [paths.plans, '[]\n'],
    [paths.principals, '[]\n'],
    [paths.mandates, '[]\n'],
    [paths.approvals, '[]\n'],
    [paths.executions, '[]\n'],
    [paths.alerts, '[]\n'],
    [paths.audit, ''],
  ];

  for (const [file, content] of defaults) {
    try {
      // `wx` fails with EEXIST instead of truncating an existing file.
      await writeFile(file, content, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
}
