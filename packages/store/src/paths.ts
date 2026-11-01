import { dirname, isAbsolute, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorePaths } from './types.ts';

const PACKAGE_SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Repository root, derived from this source file: packages/store/src -> repo. */
export function getRepoRoot(): string {
  return resolve(PACKAGE_SRC_DIR, '..', '..', '..');
}

/**
 * Data directory. `DEXTRA_DATA_DIR` wins; otherwise `<repo>/data`.
 * Always returned as an absolute, normalized path.
 */
export function getDataDir(): string {
  const configured = process.env.DEXTRA_DATA_DIR;
  if (configured !== undefined && configured.trim() !== '') {
    return isAbsolute(configured) ? resolve(configured) : resolve(getRepoRoot(), configured);
  }
  return resolve(getRepoRoot(), 'data');
}

export function getDocumentsDir(): string {
  return resolve(getDataDir(), 'documents');
}

export function getStorePaths(): StorePaths {
  const dataDir = getDataDir();
  return {
    dataDir,
    documentsDir: resolve(dataDir, 'documents'),
    contacts: resolve(dataDir, 'contacts.json'),
    org: resolve(dataDir, 'org.json'),
    precedents: resolve(dataDir, 'precedents.json'),
    calendar: resolve(dataDir, 'calendar.json'),
    plans: resolve(dataDir, 'plans.json'),
    mandates: resolve(dataDir, 'mandates.json'),
    approvals: resolve(dataDir, 'approvals.json'),
    executions: resolve(dataDir, 'executions.json'),
    audit: resolve(dataDir, 'audit.jsonl'),
  };
}

/**
 * True when `target` is the configured data directory or lives inside it.
 * Used to make `seed --reset` refuse to delete anything outside the store.
 */
export function isInsideDataDir(target: string): boolean {
  const dataDir = getDataDir();
  const resolved = resolve(target);
  if (resolved === dataDir) {
    return true;
  }
  return resolved.startsWith(`${dataDir}${sep}`);
}

/** Throws unless `target` is safely inside the configured data directory. */
export function assertInsideDataDir(target: string): void {
  if (!isInsideDataDir(target)) {
    throw new Error(`Refusing to operate outside DEXTRA_DATA_DIR: ${target}`);
  }
}
