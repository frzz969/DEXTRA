// Public surface of @dextra/store.
//
// Sensitive record types (ContactRecord and the raw contact fields) are
// deliberately NOT exported here: masking happens inside the repository, and
// the only contact shape that can leave this package is ContactPublic.

export type { CalendarEvent, ContactPublic, Org, StorePaths } from './types.ts';
export { DuplicateExecutionError, StoreError, StoreFileError } from './types.ts';

export { capResponse, maskEmail, maskPhone, redactNik } from './mask.ts';
export type { CappedResponse } from './mask.ts';

export {
  assertInsideDataDir,
  getDataDir,
  getDocumentsDir,
  getRepoRoot,
  getStorePaths,
  isInsideDataDir,
} from './paths.ts';

export * from './repository.ts';

export { seed } from './seed.ts';
export type { SeedOptions, SeedSummary } from './seed.ts';
