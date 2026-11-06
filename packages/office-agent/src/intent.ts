import type { ActionType } from '../../contracts/src/index.ts';

import { detectTimezoneHint, normalizeText, parseTimeHint, parseWeekdayHint } from './dates.ts';

/**
 * Normalisasi niat dari pesan bebas.
 *
 * Fungsi ini PURE: tidak ada jaringan, tidak ada model bahasa, tidak membaca
 * jam sistem. Semua yang dikembalikan adalah yang benar-benar tertulis di teks
 * (atau `null` bila tidak ada). Itu disengaja: pesan Telegram yang tidak
 * menyebut penerima atau jam harus tetap menjadi pertanyaan klarifikasi, bukan
 * penerima dan jam karangan.
 *
 * Hasilnya dipakai dua arah:
 *   - `instruction` yang sudah dinormalisasi masuk ke pipeline yang ada;
 *   - `assumptions` diteruskan ke `runOfficeAgent` supaya jam/durasi/zona yang
 *     disebut pengguna tidak ditanyakan ulang oleh alur klarifikasi.
 */

export interface IntentAssumptions {
  time_of_day?: string;
  duration_minutes?: number;
  timezone?: string;
}

export interface IntentHints {
  action_type: ActionType | null;
  recipient_name: string | null;
  recipient_email: string | null;
  time_of_day: string | null;
  weekday: number | null;
  /** "besok"/"hari ini" bila disebut. Pipeline belum mengubahnya menjadi tanggal. */
  day_relation: 'today' | 'tomorrow' | null;
  date_text: string | null;
  duration_minutes: number | null;
  timezone: string | null;
}

export interface ParsedIntent {
  instruction: string;
  assumptions: IntentAssumptions;
  hints: IntentHints;
}

/**
 * Kata yang kerap muncul setelah "ke"/"kepada" tetapi bukan nama orang.
 *
 * Tanpa daftar ini, "kirim ke email Budi" atau "kirim ke kantor" akan terbaca
 * sebagai penerima bernama "email"/"kantor" - persis karangan yang ingin
 * dihindari. Nama yang tidak ada di daftar tetap diterima apa adanya; daftar ini
 * hanya menolak kata yang jelas bukan orang.
 */
const NON_RECIPIENT_WORDS = new Set([
  'email', 'surel', 'mail', 'dokumen', 'document', 'file', 'berkas', 'laporan',
  'rapat', 'agenda', 'kalender', 'calendar', 'meeting', 'kantor', 'bagian',
  'divisi', 'departemen', 'tim', 'semua', 'seluruh', 'klien', 'vendor',
  'atasan', 'pimpinan', 'semua', 'staf', 'karyawan', 'pesan', 'chat',
  'whatsapp', 'wa', 'telegram', 'besok', 'hari', 'ini', 'senin', 'selasa',
  'rabu', 'kamis', 'jumat', 'sabtu', 'minggu', 'pukul', 'jam', 'tanggal',
  'dashboard', 'sistem', 'server', 'mcp',
]);

const HONORIFICS = /^(bapak|pak|ibu|bu|mas|mbak|sdr\.?|saudara)\s+/i;

function detectActionType(text: string): ActionType | null {
  /* Urutan sama dengan decompose.ts: kalender lebih dulu karena "jadwalkan
     rapat" juga mengandung kata kerja yang bisa terbaca sebagai tugas. */
  if (/\b(jadwalkan|jadwal|rapat|agenda|undang|meeting|kalender|calendar)\b/i.test(text)) {
    return 'create_calendar_event';
  }
  if (/\b(email|surel|kirim(?:kan)?|balas|teruskan|notulen)\b/i.test(text)) {
    return 'send_email';
  }
  if (/\b(chat|whatsapp|kabari|pesan singkat)\b/i.test(text)) {
    return 'send_message';
  }
  if (/\b(dokumen|document|laporan|siapkan|susun|buat|tulis|lengkapi|perbarui|update|tindak lanjut)\b/i.test(text)) {
    return 'create_task';
  }
  return null;
}

function extractEmail(text: string): string | null {
  const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return match?.[0] ?? null;
}

/**
 * Nama penerima setelah "ke"/"kepada"/"untuk".
 *
 * Nama boleh ditulis kapital maupun huruf kecil selama bukan kata umum di
 * NON_RECIPIENT_WORDS. Email tidak pernah menjadi nama: ia punya field sendiri.
 */
function extractRecipientName(text: string): string | null {
  const match = text.match(
    /\b(?:kepada|ke|untuk)\s+((?:bapak|pak|ibu|bu|mas|mbak|sdr\.?|saudara)\s+)?([A-Za-z][A-Za-z]{1,20})\b(?!@)/i,
  );
  if (!match) return null;
  const candidate = (match[2] ?? '').trim();
  if (candidate === '' || NON_RECIPIENT_WORDS.has(normalizeText(candidate))) return null;
  const withoutHonorific = candidate.replace(HONORIFICS, '').trim();
  return withoutHonorific.length >= 2 ? withoutHonorific : null;
}

function extractDurationMinutes(text: string): number | null {
  const normalized = normalizeText(text);
  if (/\bsetengah jam\b/.test(normalized)) return 30;
  if (/\b(?:satu|sejam)\s*jam\b/.test(normalized)) return 60;
  const minutes = normalized.match(/\b(\d{1,3})\s*menit\b/);
  if (minutes) {
    const value = Number(minutes[1]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  /* "2 jam" adalah durasi; "jam 2" adalah waktu, jadi hanya pola angka-dulu
     yang diterima di sini. */
  const hours = normalized.match(/\b(\d{1,2})\s*jam\b/);
  if (hours) {
    const value = Number(hours[1]);
    return Number.isFinite(value) && value > 0 ? value * 60 : null;
  }
  return null;
}

function extractDayRelation(text: string): 'today' | 'tomorrow' | null {
  const normalized = normalizeText(text);
  if (/\bbesok\b/.test(normalized)) return 'tomorrow';
  if (/\bhari ini\b/.test(normalized)) return 'today';
  return null;
}

function extractDateText(text: string): string | null {
  const match = text.match(
    /\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b(?:\s+\d{4})?/i,
  );
  return match?.[0]?.trim() ?? null;
}

export function parseIntent(text: string): ParsedIntent {
  const raw = typeof text === 'string' ? text : '';
  const instruction = raw.replace(/\s+/g, ' ').trim();

  const timeOfDay = parseTimeHint(instruction);
  const weekday = parseWeekdayHint(instruction);
  const timezone = detectTimezoneHint(instruction);
  const durationMinutes = extractDurationMinutes(instruction);

  const assumptions: IntentAssumptions = {};
  if (timeOfDay !== null) assumptions.time_of_day = timeOfDay;
  if (timezone !== null) assumptions.timezone = timezone;
  /* Batas durasi sama dengan schema OFFICE_AGENT_INPUT_SCHEMA. Nilai di luar
     batas tetap dilaporkan di hints, tetapi tidak dipaksakan sebagai asumsi. */
  if (durationMinutes !== null && durationMinutes >= 5 && durationMinutes <= 480) {
    assumptions.duration_minutes = durationMinutes;
  }

  return {
    instruction,
    assumptions,
    hints: {
      action_type: detectActionType(instruction),
      recipient_name: extractRecipientName(instruction),
      recipient_email: extractEmail(instruction),
      time_of_day: timeOfDay,
      weekday,
      day_relation: extractDayRelation(instruction),
      date_text: extractDateText(instruction),
      duration_minutes: durationMinutes,
      timezone,
    },
  };
}
