import { OfficeAgentError } from './errors.ts';
import type {
  ClarificationAnswer,
  ClarificationOption,
  ClarificationQuestion,
  ClarificationSession,
  ExtractedActionItem,
  NormalizedDocument,
  OfficeRequest,
} from './types.ts';

export interface ResolvedContact {
  contact_id: string;
  display_name: string;
  masked_address: string;
  department: string;
}

export interface RecipientResolution {
  item_id: string;
  status: 'resolved' | 'ambiguous' | 'none';
  contact: ResolvedContact | null;
  candidates: ResolvedContact[];
}

export interface ClarifyInput {
  request: OfficeRequest;
  document: NormalizedDocument | null;
  items: ExtractedActionItem[];
  recipients: RecipientResolution[];
  /** Asumsi eksplisit dari pemohon. Bila ada, pertanyaan tidak perlu ditanyakan. */
  assumptions: { time_of_day?: string; duration_minutes?: number; timezone?: string };
  timeZone: string;
  now: Date;
}

function option(value: string, label: string, detail: string | null): ClarificationOption {
  return { value, label, detail };
}

/**
 * Menyusun pertanyaan klarifikasi.
 *
 * Aturan yang dijaga: pertanyaan hanya dibuat untuk informasi yang MEMANG
 * menentukan plan. Tidak ada pertanyaan basa-basi, dan tidak ada pemilihan
 * otomatis ketika lebih dari satu kandidat masuk akal — dua orang bernama Budi
 * adalah dua orang, bukan satu orang yang dipilih berdasarkan urutan id.
 */
export function buildClarificationSession(input: ClarifyInput): ClarificationSession | null {
  const questions: ClarificationQuestion[] = [];
  const recipientByItem = new Map(input.recipients.map((entry) => [entry.item_id, entry]));

  for (const item of input.items) {
    const resolution = recipientByItem.get(item.item_id);

    if (resolution?.status === 'ambiguous') {
      questions.push({
        question_id: `clq_${item.item_id}_recipient`,
        code: 'AMBIGUOUS_RECIPIENT',
        item_id: item.item_id,
        prompt: `Ada ${resolution.candidates.length} kandidat penerima untuk "${item.description}". Pilih salah satu.`,
        options: resolution.candidates.map((candidate) =>
          option(candidate.contact_id, candidate.display_name, `${candidate.department} — ${candidate.masked_address}`),
        ),
        blocking: true,
      });
    } else if (resolution?.status === 'none') {
      questions.push({
        question_id: `clq_${item.item_id}_recipient`,
        code: item.recipient.hint === null ? 'MISSING_RECIPIENT' : 'UNKNOWN_CONTACT',
        item_id: item.item_id,
        prompt:
          item.recipient.hint === null
            ? `Penerima untuk "${item.description}" belum disebutkan. Siapa penerimanya?`
            : `Penerima "${item.recipient.hint}" tidak ditemukan di direktori. Siapa penerima yang dimaksud?`,
        options: [],
        blocking: true,
      });
    }

    const hint = item.schedule_hint;
    const hasDateOrWeekday = hint.date !== null || hint.weekday !== null;
    const needsTime = hint.time === null && input.assumptions.time_of_day === undefined;
    if (hasDateOrWeekday && needsTime) {
      questions.push({
        question_id: `clq_${item.item_id}_time`,
        code: 'MISSING_TIME',
        item_id: item.item_id,
        prompt: `Tanggal untuk "${item.description}" sudah ada, tetapi jamnya belum. Jam berapa?`,
        options: [
          option('09:00', '09.00', 'Awal hari kerja'),
          option('10:00', '10.00', 'Setelah koordinasi pagi'),
          option('13:00', '13.00', 'Awal sesi siang'),
        ],
        blocking: true,
      });
    }

    if (item.action_type === 'create_calendar_event' && input.assumptions.duration_minutes === undefined) {
      questions.push({
        question_id: `clq_${item.item_id}_duration`,
        code: 'MISSING_DURATION',
        item_id: item.item_id,
        prompt: `Berapa lama "${item.description}" dijadwalkan?`,
        options: [option('30', '30 menit', null), option('60', '60 menit', null), option('90', '90 menit', null)],
        blocking: true,
      });
    }
  }

  if (questions.length === 0) return null;

  const nowIso = input.now.toISOString();
  return {
    session_id: `cls_${input.request.request_id.replace(/^req_/, '')}`,
    request_id: input.request.request_id,
    document_id: input.document?.document_id ?? null,
    questions,
    answers: [],
    status: 'open',
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Mencatat jawaban manusia.
 *
 * `answered_by_principal_id` diisi pemanggil dari principal server-side, bukan
 * dari badan permintaan — jawaban tanpa identitas tidak bisa
 * dipertanggungjawabkan, dan itu sama pentingnya dengan plan yang disetujui.
 */
export function applyAnswers(
  session: ClarificationSession,
  answers: ReadonlyArray<{ question_id: string; value: string }>,
  principalId: string,
  now: Date,
): ClarificationSession {
  if (principalId.trim() === '') {
    throw new OfficeAgentError('UNKNOWN_PRINCIPAL', 'Clarification answers require a bound principal.');
  }
  const next: ClarificationSession = {
    ...session,
    questions: [...session.questions],
    answers: [...session.answers],
    updated_at: now.toISOString(),
  };

  for (const answer of answers) {
    const question = next.questions.find((candidate) => candidate.question_id === answer.question_id);
    if (!question) {
      throw new OfficeAgentError('UNKNOWN_QUESTION', `Unknown clarification question: ${answer.question_id}`);
    }
    if (next.answers.some((existing) => existing.question_id === answer.question_id)) {
      throw new OfficeAgentError('QUESTION_ALREADY_ANSWERED', `Question already answered: ${answer.question_id}`);
    }
    const value = String(answer.value ?? '').trim();
    if (value === '') {
      throw new OfficeAgentError('INVALID_ANSWER', `Empty answer for ${answer.question_id}`);
    }
    if (question.options.length > 0 && !question.options.some((option_) => option_.value === value)) {
      throw new OfficeAgentError('INVALID_ANSWER', `Answer "${value}" is not one of the offered options for ${answer.question_id}.`);
    }
    const record: ClarificationAnswer = {
      question_id: answer.question_id,
      value,
      answered_by_principal_id: principalId,
      answered_at: now.toISOString(),
      source: 'human',
    };
    next.answers.push(record);
  }

  next.status = next.questions.every((question) => next.answers.some((a) => a.question_id === question.question_id))
    ? 'answered'
    : 'open';
  return next;
}

export function answerValue(session: ClarificationSession | null, questionId: string): string | null {
  if (session === null) return null;
  return session.answers.find((answer) => answer.question_id === questionId)?.value ?? null;
}

export function openQuestions(session: ClarificationSession | null): ClarificationQuestion[] {
  if (session === null) return [];
  return session.questions.filter(
    (question) => question.blocking && !session.answers.some((answer) => answer.question_id === question.question_id),
  );
}
