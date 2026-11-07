/**
 * Deterministic masking helpers. Pure functions, no I/O.
 *
 * These run inside the repository boundary: the values returned by repository
 * functions are already masked and never contain the raw sensitive field.
 */

function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) {
    return null;
  }
  return { local: email.slice(0, at), domain: email.slice(at + 1) };
}

/**
 * `budi.finance@kenari.co.id` -> `b***@kenari.co.id`
 * A one-character local part -> `*@kenari.co.id`
 */
export function maskEmail(email: string): string {
  const parts = splitEmail(email);
  if (parts === null) {
    return '***';
  }

  if (parts.local.length <= 1) {
    return `*@${parts.domain}`;
  }

  return `${parts.local[0]}***@${parts.domain}`;
}

/**
 * `+6281234567890` -> `+62812****7890`
 *
 * The visible prefix is the first six characters (country code plus the
 * operator prefix) and the last four digits. Anything shorter than eight
 * digits is fully masked.
 */
export function maskPhone(phone: string): string {
  const compact = phone.replace(/[\s()-]/g, '');
  const digits = compact.replace(/\D/g, '');

  if (digits.length < 8) {
    return '***';
  }

  if (compact.length >= 10) {
    return `${compact.slice(0, 6)}****${compact.slice(-4)}`;
  }

  return `${compact.slice(0, 2)}****${compact.slice(-2)}`;
}

/**
 * `3174091234567890` -> `3174**********90`
 * First four and last two digits stay visible; every middle digit is removed.
 */
export function redactNik(nik: string): string {
  const digits = nik.replace(/\D/g, '');
  if (digits.length <= 6) {
    return '***';
  }

  return `${digits.slice(0, 4)}${'*'.repeat(digits.length - 6)}${digits.slice(-2)}`;
}

export interface CappedResponse {
  text: string;
  truncated: boolean;
}

const TRUNCATION_MARKER = '\n...[dipotong]';

/**
 * Caps a response body at `limit` characters and appends an explicit marker.
 * Never splits a surrogate pair: if the cut would land between the two code
 * units of an astral character, the cut moves one character left.
 */
export function capResponse(text: string, limit = 8192): CappedResponse {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new TypeError('capResponse limit must be a positive integer');
  }

  if (text.length <= limit) {
    return { text, truncated: false };
  }

  let cut = limit;
  const lastCodeUnit = text.charCodeAt(cut - 1);
  if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
    cut -= 1;
  }

  return { text: `${text.slice(0, cut)}${TRUNCATION_MARKER}`, truncated: true };
}
