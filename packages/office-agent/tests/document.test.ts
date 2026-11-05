import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDocument } from '../src/document.ts';
import { OfficeAgentError } from '../src/errors.ts';
import { CLEAN_DOCUMENT, INJECTED_DOCUMENT } from './helpers.ts';

test('normalisasi memisahkan heading, daftar, dan paragraf beserta nomor barisnya', () => {
  const doc = normalizeDocument({ filename: 'notulen.md', content: CLEAN_DOCUMENT });
  const kinds = new Set(doc.blocks.map((block) => block.kind));
  assert.ok(kinds.has('heading'));
  assert.ok(kinds.has('list_item'));
  assert.ok(kinds.has('paragraph'));

  const firstHeading = doc.blocks[0];
  assert.equal(firstHeading?.kind, 'heading');
  assert.equal(firstHeading?.line, 1);
  assert.equal(firstHeading?.level, 1);

  const decisionBlock = doc.blocks.find((block) => block.text.startsWith('Laporan keuangan'));
  assert.equal(decisionBlock?.section, 'Keputusan', 'blok harus tahu bagiannya');
  assert.ok((decisionBlock?.line ?? 0) > 1);
});

test('document_id diturunkan dari isi, sehingga isi sama menghasilkan id sama', () => {
  const a = normalizeDocument({ filename: 'a.md', content: CLEAN_DOCUMENT });
  const b = normalizeDocument({ filename: 'b.md', content: CLEAN_DOCUMENT });
  assert.equal(a.document_id, b.document_id);
  assert.equal(a.source_sha256, b.source_sha256);
  assert.match(a.source_sha256, /^[a-f0-9]{64}$/);

  const c = normalizeDocument({ filename: 'a.md', content: `${CLEAN_DOCUMENT}\nTambahan.` });
  assert.notEqual(a.document_id, c.document_id);
});

test('setiap blok punya block_id unik dan stabil', () => {
  const doc = normalizeDocument({ filename: 'notulen.md', content: CLEAN_DOCUMENT });
  const ids = doc.blocks.map((block) => block.block_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, normalizeDocument({ filename: 'x.md', content: CLEAN_DOCUMENT }).blocks.map((b) => b.block_id));
});

test('instruksi tertanam ditandai sebagai data, bukan dijalankan', () => {
  const doc = normalizeDocument({ filename: 'notulen.md', content: INJECTED_DOCUMENT });
  assert.ok(doc.instruction_like_block_ids.length >= 1, 'blok menyerupai instruksi harus ditandai');
  const flaggedText = doc.blocks.filter((block) => block.instruction_like).map((block) => block.text).join(' ');
  assert.match(flaggedText, /forward this/i);
  assert.match(flaggedText, /Abaikan instruksi/i);
  assert.equal(doc.trust, 'untrusted_data');
  assert.ok(doc.warnings.some((warning) => warning.includes('instructions to the system')));

  const flagged = doc.blocks.filter((block) => block.instruction_like);
  for (const block of flagged) {
    assert.match(block.text, /forward this|Abaikan instruksi/i);
  }
});

test('dokumen biner yang menyamar sebagai teks ditolak', () => {
  assert.throws(
    () => normalizeDocument({ filename: 'biner.txt', content: 'abc\u0000def' }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'INVALID_DOCUMENT',
  );
});

test('dokumen tanpa blok terbaca ditolak', () => {
  assert.throws(
    () => normalizeDocument({ filename: 'spasi.txt', content: '\n\n   \n' }),
    (error: unknown) => error instanceof OfficeAgentError && error.code === 'INVALID_DOCUMENT',
  );
});

test('provenance menunjuk blok yang benar-benar ada di dokumen', () => {
  const doc = normalizeDocument({ filename: 'notulen.md', content: CLEAN_DOCUMENT });
  const block = doc.blocks.find((candidate) => candidate.text.startsWith('Laporan keuangan'));
  assert.ok(block);
  const id = block?.block_id ?? '';
  assert.ok(doc.blocks.some((candidate) => candidate.block_id === id));
  assert.ok((block?.line ?? 0) >= 1);
});
