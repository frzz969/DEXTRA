export const CONTRACT_VERSION = '1.0.0';
export const PLAN_HASH_PREFIX = 'sha256:';
export const DEFAULT_APPROVAL_TTL_SECONDS = 900;
export const DEFAULT_MANDATE_TTL_SECONDS = 3600;
export const RETENTION_DAYS = {
  audit: 90,
  plans: 30,
  contacts: 365,
} as const;
