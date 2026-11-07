import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureStoreFiles, readJsonFile, readJsonLines, writeJsonAtomic } from './json-file.ts';
import {
  assertInsideDataDir,
  getDataDir,
  getDocumentsDir,
  getRepoRoot,
  getStorePaths,
} from './paths.ts';
import {
  SEED_CALENDAR,
  SEED_CONTACTS,
  SEED_DOCUMENTS,
  SEED_ORG,
  SEED_PRECEDENTS,
  SEED_PRINCIPALS,
} from './seed-data.ts';
import type { CalendarEvent } from './types.ts';

export interface SeedOptions {
  /** Delete the configured data directory before seeding. */
  reset?: boolean;
}

export interface SeedSummary {
  dataDir: string;
  contacts: number;
  plans: number;
  audit: number;
  documents: number;
  reset: boolean;
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function isEmptyArray(file: string): Promise<boolean> {
  const raw = await readJsonFile<unknown>(file, []);
  return !Array.isArray(raw) || raw.length === 0;
}

async function resetDataDir(): Promise<void> {
  const dataDir = getDataDir();
  assertInsideDataDir(dataDir);

  const repoRoot = resolve(getRepoRoot());
  if (dataDir === repoRoot || resolve(dataDir, '..') === dataDir) {
    throw new Error(`Refusing to reset an unsafe data directory: ${dataDir}`);
  }

  await rm(dataDir, { recursive: true, force: true });
}

/**
 * Deterministic seed. Running it twice never duplicates data: files that
 * already contain records are left untouched.
 */
export async function seed(options: SeedOptions = {}): Promise<SeedSummary> {
  const reset = options.reset === true;
  if (reset) {
    await resetDataDir();
  }

  await ensureStoreFiles();
  const store = getStorePaths();

  if (await isEmptyArray(store.contacts)) {
    await writeJsonAtomic(store.contacts, SEED_CONTACTS);
  }

  const orgRaw = await readJsonFile<unknown>(store.org, {});
  if (typeof orgRaw !== 'object' || orgRaw === null || Object.keys(orgRaw).length === 0) {
    await writeJsonAtomic(store.org, SEED_ORG);
  }

  if (await isEmptyArray(store.precedents)) {
    await writeJsonAtomic(store.precedents, SEED_PRECEDENTS);
  }

  if (await isEmptyArray(store.principals)) {
    await writeJsonAtomic(store.principals, SEED_PRINCIPALS);
  }

  const calendarRaw = await readJsonFile<{ events?: unknown }>(store.calendar, { events: [] });
  if (!Array.isArray(calendarRaw.events) || calendarRaw.events.length === 0) {
    const events: CalendarEvent[] = SEED_CALENDAR;
    await writeJsonAtomic(store.calendar, { events });
  }

  const documentsDir = getDocumentsDir();
  await mkdir(documentsDir, { recursive: true });
  let documents = 0;
  for (const document of SEED_DOCUMENTS) {
    const target = resolve(documentsDir, document.filename);
    assertInsideDataDir(target);
    if (!(await pathExists(target))) {
      await writeFile(target, document.content, 'utf8');
    }
    documents += 1;
  }

  const [contacts, plans, audit] = await Promise.all([
    readJsonFile<unknown[]>(store.contacts, []),
    readJsonFile<unknown[]>(store.plans, []),
    readJsonLines<unknown>(store.audit),
  ]);

  return {
    dataDir: store.dataDir,
    contacts: Array.isArray(contacts) ? contacts.length : 0,
    plans: Array.isArray(plans) ? plans.length : 0,
    audit: audit.length,
    documents,
    reset,
  };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
}

if (isMainModule()) {
  const reset = process.argv.includes('--reset');
  seed({ reset })
    .then((summary) => {
      // Summary only: counts and paths, never record contents.
      console.log(
        [
          `Seed selesai${summary.reset ? ' (reset)' : ''}.`,
          `Data dir : ${summary.dataDir}`,
          `Kontak   : ${summary.contacts}`,
          `Plan     : ${summary.plans}`,
          `Audit    : ${summary.audit}`,
          `Dokumen  : ${summary.documents}`,
        ].join('\n'),
      );
    })
    .catch((error: unknown) => {
      console.error(`Seed gagal: ${(error as Error).message}`);
      process.exitCode = 1;
    });
}
