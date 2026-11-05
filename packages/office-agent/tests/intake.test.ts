import { test } from 'node:test';
import assert from 'node:assert/strict';

import { acceptRequest, fromVoiceTranscript, MAX_DOCUMENT_BYTES } from '../src/intake.ts';
import { OfficeAgentError } from '../src/errors.ts';

const base = {
  request_id: 'req_intake01',
  org_id: 'org_kenari',
  requester_principal_id: 'usr_nadia',
  instruction: 'Tindak lanjuti notulen rapat',
};

test('intake menerima teks biasa', () => {
  const request = acceptRequest(base);
  assert.equal(request.instruction, 'Tindak lanjuti notulen rapat');
  assert.equal(request.document, null);
  assert.equal(request.source, 'text');
});

test('intake menerima Markdown dan menandai sumbernya', () => {
  const request = acceptRequest({ ...base, document: { filename: 'notulen.md', content: '# Judul\n\nIsi.' } });
  assert.equal(request.source, 'markdown');
  assert.equal(request.document?.filename, 'notulen.md');
});

test('intake menerima TXT', () => {
  const request = acceptRequest({ ...base, document: { filename: 'catatan.txt', content: 'Isi catatan.' } });
  assert.equal(request.source, 'txt');
});

test('intake menolak dokumen kosong', () => {
  assert.throws(
    () => acceptRequest({ ...base, document: { filename: 'kosong.md', content: '   \n  ' } }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'INVALID_DOCUMENT',
  );
});

test('intake menolak tipe dokumen yang tidak didukung', () => {
  assert.throws(
    () => acceptRequest({ ...base, document: { filename: 'notulen.docx', content: 'x' } }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'UNSUPPORTED_DOCUMENT_TYPE',
  );
});

test('intake menolak dokumen melebihi batas, bukan memotongnya', () => {
  const oversized = 'a'.repeat(MAX_DOCUMENT_BYTES + 1);
  assert.throws(
    () => acceptRequest({ ...base, document: { filename: 'besar.txt', content: oversized } }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'DOCUMENT_TOO_LARGE',
  );
});

test('intake menolak permintaan tanpa isi sama sekali', () => {
  assert.throws(
    () => acceptRequest({ ...base, instruction: '   ' }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'EMPTY_INPUT',
  );
});

test('intake menolak permintaan tanpa principal', () => {
  assert.throws(
    () => acceptRequest({ ...base, requester_principal_id: '  ' }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'UNKNOWN_PRINCIPAL',
  );
});

test('intake menolak request_id yang tidak sesuai pola', () => {
  assert.throws(
    () => acceptRequest({ ...base, request_id: 'demo-1' }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'INVALID_REQUEST',
  );
});

test('antarmuka transkrip suara mencatat asalnya dan menolak tanpa penyedia', () => {
  const raw = fromVoiceTranscript({
    request_id: 'req_voice01',
    org_id: 'org_kenari',
    requester_principal_id: 'usr_nadia',
    transcript: 'Tolong kirim laporan ke Budi',
    provider: 'future-asr',
    confidence: null,
  });
  const request = acceptRequest(raw);
  assert.equal(request.source, 'voice_transcript');

  assert.throws(
    () => fromVoiceTranscript({ ...raw, provider: '  ' } as never),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'INVALID_REQUEST',
  );
});
