export {
  BACKOFF_MS,
  DEDUPE_BUCKET_MS,
  MAX_ATTEMPTS,
  alertIdFor,
  backoffMs,
  bucketStart,
  classifyStatus,
  createAlert,
  dedupeKeyFor,
  nextDelayMs,
  redactSecrets,
} from './policy.ts';
export type { CreateAlertInput } from './policy.ts';

export { FakeTransport, TelegramTransport, resolveTransport } from './transport.ts';
export type { AlertTransport, AlertTransportResult, TelegramTransportOptions } from './transport.ts';

export { DISPATCH_STALE_MS, dispatchAlert, renderAlertText } from './dispatch.ts';
export type { DispatchDeps, DispatchOutcome } from './dispatch.ts';

export {
  DEFAULT_APPROVAL_PENDING_MS,
  DEFAULT_EXPIRING_WITHIN_MS,
  DEFAULT_FAILURE_WINDOW_MS,
  REPEATED_FAILURE_THRESHOLD,
  detectAlerts,
} from './detect.ts';
export type { DetectInput } from './detect.ts';

export { scanAndDispatch } from './scan.ts';
export type { ScanInput, ScanOptions, ScanResult } from './scan.ts';
