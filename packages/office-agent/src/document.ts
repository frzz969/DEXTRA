import { createHash } from 'node:crypto';

import { OfficeAgentError } from './errors.ts';
import type { DocumentBlock, NormalizedDocument, OfficeDocumentRef } from './types.ts';

/**
 * Pola teks yang MENYERUPAI instruksi.
 *
 * Ini bukan deteksi prompt injection, dan tidak boleh dipresentasikan sebagai
 * itu. Yang dilakukan: menandai blok yang bentuknya perintah, supaya validator
 * bisa memastikan tidak ada satu pun action yang lahir dari blok tersebut.
 *
 * Pertahanan sebenarnya bukan pola ini — pertahanan sebenarnya adalah
 * arsitektur: tidak ada LLM yang membaca dokumen ini sebagai instruksi, dan
 * planner tidak punya akses adapter. Pola hanya menaikkan kecurigaan.
 */
const INSTRUCTION_LIKE_PATTERNS: RegExp[] = [
  /^\s*(ai|assistant|system|model|developer|admin|sistem)\s*:/i,
  /abaikan\s+(semua\s+)?(instruksi|perintah)/i,
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /forward\s+this/i,
  /kirim\s+(ini\s+|dokumen\s+ini\s+)?ke\s+semua/i,
  /beri\s+(saya|aku|kami)\s+(akses|izin|permission)/i,
  /grant\s+(me|us)\s+.*(access|permission)/i,
  /you\s+are\s+now\s+/i,
  /sebagai\s+admin\s*,/i,
  /kamu\s+sekarang\s+adalah/i,
  /jangan\s+(laporkan|catat)\s+ke\s+audit/i,
];

export function looksLikeInstruction(text: string): boolean {
  return INSTRUCTION_LIKE_PATTERNS.some((pattern) => pattern.test(text));
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Normalisasi dokumen menjadi blok yang dapat dirujuk.
 *
 * Kontrak penting: setiap blok punya `block_id` yang stabil untuk isi dokumen
 * yang sama, dan setiap blok menyimpan nomor baris asalnya. Tanpa itu,
 * "action ini berasal dari mana" hanya bisa dijawab dengan menebak, dan
 * provenance berubah menjadi hiasan.
 */
export function normalizeDocument(input: OfficeDocumentRef): NormalizedDocument {
  const content = input.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (content.trim() === '') {
    throw new OfficeAgentError('INVALID_DOCUMENT', 'Document is empty after normalization.', { filename: input.filename });
  }
  /* Dokumen biner yang disamarkan sebagai .txt tetap harus ditolak, bukan
   * diekstrak menjadi sampah yang tampak seperti teks. */
  if (content.includes('\u0000')) {
    throw new OfficeAgentError('INVALID_DOCUMENT', 'Document contains NUL bytes; it is not a text document.', {
      filename: input.filename,
    });
  }

  const sourceSha = sha256(content);
  const documentId = `doc_${sourceSha.slice(0, 16)}`;

  const blocks: DocumentBlock[] = [];
  const warnings: string[] = [];
  let section: string | null = null;
  let inCodeFence = false;
  let paragraph: string[] = [];
  let paragraphLine = 0;
  let counter = 0;

  const push = (kind: DocumentBlock['kind'], text: string, line: number, level: number | null) => {
    const trimmed = text.trim();
    if (trimmed === '') return;
    counter += 1;
    blocks.push({
      block_id: `blk_${String(counter).padStart(3, '0')}`,
      kind,
      level,
      text: trimmed,
      line,
      section,
      instruction_like: looksLikeInstruction(trimmed),
    });
  };

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    push('paragraph', paragraph.join(' '), paragraphLine, null);
    paragraph = [];
  };

  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const lineNo = index + 1;
    const line = raw.replace(/\s+$/, '');

    if (/^\s*```/.test(line)) {
      flushParagraph();
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) {
      push('code', line, lineNo, null);
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const text = (heading[2] ?? '').trim();
      section = text;
      push('heading', text, lineNo, (heading[1] ?? '').length);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      push('quote', quote[1] ?? '', lineNo, null);
      continue;
    }

    const bullet = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      push('list_item', bullet[2] ?? '', lineNo, null);
      continue;
    }

    if (paragraph.length === 0) paragraphLine = lineNo;
    paragraph.push(line.trim());
  }
  flushParagraph();

  if (blocks.length === 0) {
    throw new OfficeAgentError('INVALID_DOCUMENT', 'Document produced no readable blocks.', {
      filename: input.filename,
    });
  }

  const instructionLike = blocks.filter((block) => block.instruction_like).map((block) => block.block_id);
  if (instructionLike.length > 0) {
    warnings.push(
      `${instructionLike.length} block(s) look like instructions to the system (${instructionLike.join(', ')}). They are treated as document data and cannot create actions.`,
    );
  }

  return {
    document_id: documentId,
    filename: input.filename,
    source_sha256: sourceSha,
    bytes: Buffer.byteLength(content, 'utf8'),
    blocks,
    instruction_like_block_ids: instructionLike,
    warnings,
    trust: 'untrusted_data',
  };
}
