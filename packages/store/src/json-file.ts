import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { getDocumentsDir, getStorePaths } from './paths.ts';
import { StoreFileError } from './types.ts';

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
    [paths.mandates, '[]\n'],
    [paths.approvals, '[]\n'],
    [paths.executions, '[]\n'],
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
