import { createHash } from 'node:crypto';
import { PLAN_HASH_PREFIX } from './constants.ts';

function assertNoLoneSurrogates(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new TypeError('canonicalSerialize cannot serialize a string containing a lone surrogate');
      }
      index += 1;
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw new TypeError('canonicalSerialize cannot serialize a string containing a lone surrogate');
    }
  }
}

/**
 * Deterministic JSON serialization used as the hashing input.
 *
 * Rules:
 * - object keys are sorted by UTF-16 code unit order (`<`, not localeCompare)
 * - no insignificant whitespace
 * - `undefined`, functions, symbols and bigints are rejected instead of dropped
 * - numbers must be finite
 * - Date instances are rejected; callers must pass ISO8601 strings
 */
export function canonicalSerialize(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  const valueType = typeof value;

  if (typeof value === 'string') {
    assertNoLoneSurrogates(value);
    return JSON.stringify(value) as string;
  }

  if (valueType === 'boolean') {
    return JSON.stringify(value) as string;
  }

  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('canonicalSerialize cannot serialize NaN or Infinity');
    }
    return JSON.stringify(value) as string;
  }

  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol' || valueType === 'bigint') {
    throw new TypeError(`canonicalSerialize cannot serialize a value of type ${valueType}`);
  }

  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      parts.push(canonicalSerialize(value[index]));
    }
    return `[${parts.join(',')}]`;
  }

  if (valueType === 'object') {
    if (value instanceof Date) {
      throw new TypeError('canonicalSerialize does not accept Date; pass an ISO8601 string');
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    const parts: string[] = [];

    for (const key of keys) {
      const entry = record[key];
      if (entry === undefined) {
        throw new TypeError(`canonicalSerialize cannot serialize undefined at key "${key}"`);
      }
      assertNoLoneSurrogates(key);
      parts.push(`${JSON.stringify(key) as string}:${canonicalSerialize(entry)}`);
    }

    return `{${parts.join(',')}}`;
  }

  throw new TypeError('canonicalSerialize received an unsupported value');
}

/**
 * Computes the plan hash over the plan with the top-level `plan_hash` key removed.
 * Nested keys are left untouched.
 */
export function computePlanHash(plan: unknown): string {
  if (typeof plan !== 'object' || plan === null || Array.isArray(plan)) {
    throw new TypeError('computePlanHash expects a plan object');
  }

  const source = plan as Record<string, unknown>;
  const payload: Record<string, unknown> = {};

  for (const key of Object.keys(source)) {
    if (key === 'plan_hash') {
      continue;
    }
    payload[key] = source[key];
  }

  const hex = createHash('sha256').update(canonicalSerialize(payload), 'utf8').digest('hex');
  return `${PLAN_HASH_PREFIX}${hex}`;
}
