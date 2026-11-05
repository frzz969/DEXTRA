import { OfficeAgentError } from './errors.ts';
import type { OfficeIntakeSource, OfficeRequest, RawOfficeRequest } from './types.ts';

/**
 * Batas ukuran intake.
 *
 * Angkanya dipilih supaya notulen rapat yang wajar (belasan halaman) masuk
 * dengan lapang, sementara satu permintaan tidak bisa memaksa seluruh isi
 * dokumen diproses berulang kali. Angkanya disamakan dengan batas yang
 * dinyatakan layar Office Agent (1 MB) supaya tidak ada dokumen yang lolos di
 * klien lalu ditolak server tanpa alasan yang terlihat pengguna.
 *
 * Dilebihkan berarti DITOLAK dengan pesan yang
 * menyebut batasnya — bukan dipotong diam-diam, karena dokumen yang dipotong
 * menghasilkan ekstraksi yang tampak lengkap padahal tidak.
 */
export const MAX_INSTRUCTION_CHARS = 20_000;
export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.md', '.txt'] as const;

const REQUEST_ID_PATTERN = /^req_[a-z0-9_]+$/;
const ORG_ID_PATTERN = /^org_[a-z0-9_]+$/;

export interface VoiceTranscriptInput {
  request_id: string;
  org_id: string;
  requester_principal_id: string;
  /** Transkrip yang SUDAH dihasilkan di luar. Office Agent tidak melakukan ASR. */
  transcript: string;
  provider: string;
  confidence: number | null;
  received_at?: string;
}

/**
 * Titik masuk untuk transkrip suara di masa depan.
 *
 * Yang dilakukan di sini hanya membungkus transkrip menjadi permintaan biasa
 * dan mencatat asalnya. Tidak ada ASR, tidak ada klaim akurasi: `confidence`
 * diteruskan apa adanya, termasuk `null` bila penyedia tidak melaporkannya.
 * Ini antarmuka, bukan fitur suara yang sudah jadi — dan tidak dipakai jalur
 * mana pun sampai ada penyedia sungguhan.
 */
export function fromVoiceTranscript(input: VoiceTranscriptInput): RawOfficeRequest {
  if (input.provider.trim() === '') {
    throw new OfficeAgentError('INVALID_REQUEST', 'Voice transcript requires a provider name; none was given.');
  }
  return {
    request_id: input.request_id,
    org_id: input.org_id,
    requester_principal_id: input.requester_principal_id,
    instruction: input.transcript,
    received_at: input.received_at,
    source: 'voice_transcript',
  };
}

function detectSource(filename: string | null): OfficeIntakeSource {
  if (filename === null) return 'text';
  return filename.toLowerCase().endsWith('.md') ? 'markdown' : 'txt';
}

/**
 * Validasi dan normalisasi permintaan.
 *
 * Yang TIDAK dilakukan di sini: memercayai `requester_principal_id`. Fungsi ini
 * hanya memastikan field itu terisi; siapa orangnya ditentukan adapter yang
 * memanggil `runOfficeAgent` dari principal server-side.
 */
export function acceptRequest(input: RawOfficeRequest): OfficeRequest {
  if (typeof input !== 'object' || input === null) {
    throw new OfficeAgentError('INVALID_REQUEST', 'Request body must be an object.');
  }
  if (!REQUEST_ID_PATTERN.test(input.request_id ?? '')) {
    throw new OfficeAgentError('INVALID_REQUEST', `request_id must match req_[a-z0-9_]+, got "${input.request_id ?? ''}".`);
  }
  if (!ORG_ID_PATTERN.test(input.org_id ?? '')) {
    throw new OfficeAgentError('INVALID_REQUEST', `org_id must match org_[a-z0-9_]+, got "${input.org_id ?? ''}".`);
  }
  if (typeof input.requester_principal_id !== 'string' || input.requester_principal_id.trim() === '') {
    throw new OfficeAgentError(
      'UNKNOWN_PRINCIPAL',
      'requester_principal_id is required: an office request must be attributable to a principal bound server-side.',
    );
  }

  const instruction = typeof input.instruction === 'string' ? input.instruction : '';
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    throw new OfficeAgentError('INPUT_TOO_LARGE', `Instruction exceeds ${MAX_INSTRUCTION_CHARS} characters.`, {
      length: String(instruction.length),
      limit: String(MAX_INSTRUCTION_CHARS),
    });
  }

  let document: OfficeRequest['document'] = null;
  if (input.document !== undefined) {
    const { filename, content } = input.document;
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new OfficeAgentError('INVALID_DOCUMENT', 'Document filename is required.');
    }
    const lower = filename.toLowerCase();
    if (!ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      throw new OfficeAgentError(
        'UNSUPPORTED_DOCUMENT_TYPE',
        `Document type is not supported. Allowed: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}.`,
        { filename },
      );
    }
    if (typeof content !== 'string') {
      throw new OfficeAgentError('INVALID_DOCUMENT', 'Document content must be text.', { filename });
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_DOCUMENT_BYTES) {
      throw new OfficeAgentError('DOCUMENT_TOO_LARGE', `Document exceeds ${MAX_DOCUMENT_BYTES} bytes.`, {
        filename,
        bytes: String(bytes),
        limit: String(MAX_DOCUMENT_BYTES),
      });
    }
    if (content.trim() === '') {
      throw new OfficeAgentError('INVALID_DOCUMENT', 'Document is empty.', { filename });
    }
    document = { filename, content };
  }

  if (instruction.trim() === '' && document === null) {
    throw new OfficeAgentError('EMPTY_INPUT', 'Provide an instruction, a document, or both.');
  }

  const receivedAt = input.received_at ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(receivedAt))) {
    throw new OfficeAgentError('INVALID_REQUEST', `received_at is not a valid ISO instant: ${receivedAt}`);
  }

  return {
    request_id: input.request_id,
    org_id: input.org_id,
    requester_principal_id: input.requester_principal_id,
    instruction: instruction.trim(),
    document,
    received_at: receivedAt,
    source: input.source ?? detectSource(document?.filename ?? null),
    assumptions: [],
  };
}
