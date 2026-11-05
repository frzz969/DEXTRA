import type { ActionType } from '../../contracts/src/index.ts';

import {
  detectTimezoneHint,
  parseDateHint,
  parseTimeHint,
  parseWeekdayHint,
  normalizeText,
  zonedParts,
} from './dates.ts';
import type {
  DecisionItem,
  Decomposition,
  DocumentBlock,
  ExtractedActionItem,
  NormalizedDocument,
  OfficeRequest,
  ScheduleHint,
  SourceRef,
} from './types.ts';

/**
 * Dekomposisi deterministik.
 *
 * Tidak ada model bahasa di jalur ini, dan itu disengaja: hasilnya bisa
 * diulang, bisa diuji, dan bisa dipertanggungjawabkan. Konsekuensinya juga
 * jujur — kalimat yang tidak cocok dengan pola mana pun TIDAK ditebak. Ia masuk
 * `unresolved`, dan pemanggil melihat bahwa ada bagian permintaan yang belum
 * dipahami, alih-alih menerima plan yang tampak lengkap.
 *
 * Batas kemampuan ini nyata: pola kata kerja Indonesia terbatas, dan dokumen
 * yang ditulis dengan gaya berbeda bisa lolos tanpa terdeteksi. Karena itu
 * antarmuka `Decomposer` disiapkan supaya pengganti berbasis model bisa
 * ditambahkan tanpa mengubah batas governance — model tetap hanya menghasilkan
 * usulan, bukan plan yang dieksekusi.
 */

export interface Decomposer {
  decompose(input: DecomposeInput): Decomposition;
}

export interface DecomposeInput {
  request: OfficeRequest;
  document: NormalizedDocument | null;
  /** Instan acuan untuk tanggal relatif ("Jumat", "5 November"). */
  now: Date;
  /** Zona acuan untuk menafsirkan tanggal di dokumen. */
  timeZone: string;
}

const ACTION_VERBS: Array<{ pattern: RegExp; type: ActionType }> = [
  /* Bentuk 'di-' ikut dikenali: notulen nyata menulis "dikirim", "dijadwalkan",
   * bukan "kirim", "jadwalkan". Tanpa ini, kalimat keputusan yang paling
   * penting justru yang terlewat. */
  { pattern: /\b(di)?jadwalkan\b|\bjadwal ulang\b|\bagendakan\b|\bundang\b|\batur rapat\b/i, type: 'create_calendar_event' },
  { pattern: /\b(di)?kirim(kan)?\b|\bsurel\b|\bemail\b|\b(di)?balas\b|\bteruskan\b|\bnotulen\b/i, type: 'send_email' },
  { pattern: /\b(chat|whatsapp|kabari|pesan singkat)\b/i, type: 'send_message' },
  { pattern: /\b(siapkan|susun|buat|kumpulkan|tindak lanjuti|review|tinjau|evaluasi|lengkapi|perbarui|update)\b/i, type: 'create_task' },
];

const DECISION_VERBS = /\b(diputuskan|disepakati|ditetapkan|menyetujui|disetujui|keputusan)\b/i;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function sourceOfBlock(document: NormalizedDocument, block: DocumentBlock): SourceRef {
  return {
    document_id: document.document_id,
    document_sha256: document.source_sha256,
    block_id: block.block_id,
    line: block.line,
    quote: block.text,
  };
}

function sourceOfRequest(request: OfficeRequest): SourceRef {
  return {
    document_id: null,
    document_sha256: null,
    block_id: 'request',
    line: null,
    quote: request.instruction,
  };
}

function pickActionType(sentence: string): ActionType {
  for (const entry of ACTION_VERBS) {
    if (entry.pattern.test(sentence)) return entry.type;
  }
  return 'create_task';
}

function isActionSentence(sentence: string): boolean {
  return ACTION_VERBS.some((entry) => entry.pattern.test(sentence));
}

/**
 * Penerima dan departemen dari satu kalimat.
 *
 * Departemen penting karena justru itu yang membedakan dua orang bernama Budi.
 * Kalau kalimat hanya menyebut "Budi", hasilnya hint tanpa departemen — dan
 * pemanggil yang berwenang memutuskan, bukan fungsi ini.
 */
export function extractRecipient(sentence: string): { hint: string | null; department: string | null } {
  /*
   * Nama departemen dibatasi pada kata yang berhuruf besar di awal.
   * Tanpa batas itu, "bagian Keuangan paling lambat 5 November" terbaca sebagai
   * satu departemen bernama "Keuangan paling lambat November", yang tidak cocok
   * dengan siapa pun — dan dua Budi yang sebenarnya bisa dibedakan menjadi
   * ambigu. Batas ini yang membuat "bagian Keuangan" berarti Keuangan.
   */
  const departmentMatch = sentence.match(
    /\b(?:bagian|divisi|departemen|dept\.?)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,2})/,
  );
  const parenMatch = sentence.match(/\(([A-Z][A-Za-z ]{1,30})\)/);
  const department = (departmentMatch?.[1] ?? parenMatch?.[1] ?? null)?.trim() ?? null;

  const after = sentence.match(/\b(?:kepada|ke|untuk)\s+((?:Bapak|Pak|Ibu|Bu|Mas|Mbak|Sdr\.?|Saudara)?\s*[A-Z][a-zA-Z]{1,20})\b/);
  let hint = after?.[1]?.replace(/^(Bapak|Pak|Ibu|Bu|Mas|Mbak|Sdr\.?|Saudara)\s+/i, '').trim() ?? null;

  if (hint === null) {
    const parenName = sentence.match(/([A-Z][a-z]{2,15})\s*\(/);
    hint = parenName?.[1] ?? null;
  }
  return { hint: hint === null || hint.length < 3 ? null : hint, department };
}

export function extractScheduleHint(sentence: string): ScheduleHint {
  const due = sentence.match(/paling lambat\s+([^.,;]+)/i);
  const dateHint = parseDateHint(sentence);
  const weekday = parseWeekdayHint(sentence);
  const time = parseTimeHint(sentence);
  const timezone = detectTimezoneHint(sentence);
  const rawParts = [due?.[1], dateHint ? 'tanggal' : null, weekday !== null ? 'hari' : null, time].filter(Boolean);
  return {
    date: dateHint === null ? null : `${dateHint.day} ${dateHint.month}${dateHint.year === null ? '' : ` ${dateHint.year}`}`,
    weekday,
    time,
    timezone_hint: timezone,
    raw: rawParts.length === 0 ? null : (due?.[1]?.trim() ?? sentence.trim()),
  };
}

function draftSubject(sentence: string): string {
  const cleaned = sentence.replace(/\s+/g, ' ').trim();
  const short = cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function buildActionItem(
  sentence: string,
  source: SourceRef,
  index: number,
  documentFilename: string | null,
): ExtractedActionItem {
  const recipient = extractRecipient(sentence);
  const schedule = extractScheduleHint(sentence);
  const actionType = pickActionType(sentence);
  const locationMatch = sentence.match(/\bdi\s+((?:Ruang|Gedung|Lantai|Aula|Kantor)[A-Za-z0-9 ]{1,40})/);

  const missing: string[] = [];
  if (recipient.hint === null) missing.push('recipient');
  if (schedule.time === null && schedule.weekday === null && schedule.date === null) missing.push('schedule');

  const body =
    documentFilename === null
      ? sentence
      : `${sentence}\n\nSumber: ${documentFilename} baris ${source.line ?? '?'} (${source.block_id}).`;

  return {
    item_id: `item_${String(index).padStart(3, '0')}`,
    source,
    action_type: actionType,
    description: sentence,
    recipient,
    schedule_hint: schedule,
    due_hint: schedule.raw,
    location: locationMatch?.[1]?.trim() ?? null,
    content_draft: { subject: draftSubject(sentence), body },
    missing,
    method: 'deterministic',
  };
}

/**
 * Bagian yang BUKAN sumber tindakan.
 *
 * Agenda berisi topik yang akan dibahas, bukan pekerjaan yang harus dilakukan.
 * Menganggap "Evaluasi capaian Oktober" sebagai action item menghasilkan plan
 * yang berisi rapat tentang rapat — kesalahan yang terlihat meyakinkan.
 */
function sectionIsNonAction(section: string | null): boolean {
  if (section === null) return false;
  return /agenda|peserta|latar belakang/i.test(normalizeText(section));
}

function sectionIsDecision(section: string | null): boolean {
  if (section === null) return false;
  return /keputusan|kesepakatan|hasil|action item|tindak lanjut/i.test(normalizeText(section));
}

export function decompose(input: DecomposeInput): Decomposition {
  const { request, document } = input;
  const decisions: DecisionItem[] = [];
  const actionItems: ExtractedActionItem[] = [];
  const unresolved: string[] = [];
  let itemCounter = 0;
  let decisionCounter = 0;

  const considerSentence = (
    sentence: string,
    source: SourceRef,
    isDecisionSection: boolean,
    filename: string | null,
    fromInstruction: boolean,
  ) => {
    if (sentence.length < 8) return;
    if (DECISION_VERBS.test(sentence) || isDecisionSection) {
      decisionCounter += 1;
      decisions.push({ decision_id: `dec_${String(decisionCounter).padStart(3, '0')}`, text: sentence, source });
    }
    if (isActionSentence(sentence)) {
      const item = buildActionItem(sentence, source, itemCounter + 1, filename);
      /*
       * Kalimat instruksi utama biasanya adalah TUJUAN ("tindak lanjuti notulen
       * rapat"), bukan satu action diskret. Menjadikannya action menghasilkan
       * tugas tanpa penerima yang lalu memaksa klarifikasi palsu. Kalimat
       * instruksi hanya menjadi action bila ia menyebut penerima atau waktu.
       */
      const carriesDetail =
        item.recipient.hint !== null ||
        item.schedule_hint.time !== null ||
        item.schedule_hint.weekday !== null ||
        item.schedule_hint.date !== null;
      if (!fromInstruction || carriesDetail) {
        itemCounter += 1;
        actionItems.push(item);
      }
    } else if (isDecisionSection) {
      unresolved.push(`Keputusan tanpa tindakan yang bisa diekstrak: "${sentence}"`);
    }
  };

  if (document !== null) {
    for (const block of document.blocks) {
      /*
       * Blok yang menyerupai instruksi TIDAK PERNAH menghasilkan action.
       * Bukan karena polanya sempurna, tetapi karena satu-satunya peran blok
       * seperti itu di sini adalah sebagai data yang dilaporkan ke manusia.
       */
      if (block.instruction_like) continue;
      if (block.kind === 'heading' || block.kind === 'code') continue;
      if (sectionIsNonAction(block.section)) continue;
      for (const sentence of splitSentences(block.text)) {
        considerSentence(sentence, sourceOfBlock(document, block), sectionIsDecision(block.section), document.filename, false);
      }
    }
  }

  if (request.instruction !== '') {
    for (const sentence of splitSentences(request.instruction)) {
      considerSentence(sentence, sourceOfRequest(request), false, null, true);
    }
  }

  const goal =
    request.instruction !== ''
      ? splitSentences(request.instruction)[0] ?? request.instruction
      : (document?.blocks.find((block) => block.kind === 'heading')?.text ?? 'Tindak lanjut dokumen');

  if (actionItems.length === 0) {
    unresolved.push('Tidak ada action item yang dapat diekstrak secara deterministik dari permintaan ini.');
  }

  return { goal, decisions, action_items: actionItems, unresolved, method: 'deterministic' };
}

/** Decomposer deterministik sebagai implementasi antarmuka, siap diganti. */
export const deterministicDecomposer: Decomposer = {
  decompose: (input) => decompose(input),
};
