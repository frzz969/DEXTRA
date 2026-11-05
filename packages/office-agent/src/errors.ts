/**
 * Kesalahan Office Agent.
 *
 * Kode di sini sengaja TERPISAH dari `ErrorCode` kontrak. `ErrorCode` adalah
 * kosakata jawaban MCP untuk pemanggil; ia tidak punya kata untuk "dokumen
 * melebihi 256 KB" atau "klarifikasi belum dijawab". Menambahkannya ke kontrak
 * berarti mengubah shared core yang sedang disentuh P4, dan memperluas arti
 * kode yang sudah dipakai jalur lain.
 *
 * Jadi: kesalahan intake/dekomposisi/klarifikasi hidup di sini, dan hanya
 * kesalahan yang memang punya padanan kontrak (plan sudah ada, recipient
 * ambigu, timezone tidak dikenal) yang dipetakan ke `ErrorCode` saat hasilnya
 * menyeberang ke MCP.
 */
export type OfficeErrorCode =
  | 'INVALID_REQUEST'
  | 'EMPTY_INPUT'
  | 'INPUT_TOO_LARGE'
  | 'UNSUPPORTED_DOCUMENT_TYPE'
  | 'DOCUMENT_TOO_LARGE'
  | 'INVALID_DOCUMENT'
  | 'INVALID_TIMEZONE'
  | 'INVALID_SCHEDULE'
  | 'MISSING_REQUIRED_INFO'
  | 'UNKNOWN_PRINCIPAL'
  | 'PLAN_ALREADY_EXISTS'
  | 'AUDIT_WRITE_FAILED'
  | 'NOT_AUTHORIZED'
  | 'UNKNOWN_QUESTION'
  | 'QUESTION_ALREADY_ANSWERED'
  | 'INVALID_ANSWER';

export class OfficeAgentError extends Error {
  readonly code: OfficeErrorCode;
  readonly detail: Record<string, string>;

  constructor(code: OfficeErrorCode, message: string, detail: Record<string, string> = {}) {
    super(message);
    this.name = 'OfficeAgentError';
    this.code = code;
    this.detail = detail;
  }
}
