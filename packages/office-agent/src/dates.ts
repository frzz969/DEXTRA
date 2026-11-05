/**
 * Tanggal dan jam Indonesia, tanpa pustaka tambahan.
 *
 * Semua fungsi di sini murni: tidak membaca jam sistem, tidak menyentuh store.
 * `now` selalu diberikan pemanggil supaya hasilnya bisa diuji dan tidak
 * bergantung pada hari ketika tes dijalankan.
 */

const MONTHS: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8,
  sep: 9, sept: 9, okt: 10, nov: 11, des: 12,
};

const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, sabtu: 6,
};

/**
 * Pemetaan zona waktu Indonesia.
 *
 * WIB/WITA/WIT adalah nama yang dipakai manusia, bukan id IANA. Memetakannya
 * di sini berarti permintaan "pukul 9 WITA" bisa diperiksa terhadap konfigurasi
 * organisasi — bukan ditolak buta karena `Intl` tidak mengenal "WITA".
 */
const TZ_ALIASES: Record<string, string> = {
  wib: 'Asia/Jakarta',
  wita: 'Asia/Makassar',
  wit: 'Asia/Jayapura',
  'asia/jakarta': 'Asia/Jakarta',
  'asia/makassar': 'Asia/Makassar',
  'asia/jayapura': 'Asia/Jayapura',
};

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Id IANA yang valid menurut runtime ini. `Intl` adalah sumber kebenaran, bukan daftar hardcode. */
export function isValidTimezone(tz: string): boolean {
  if (tz.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** WIB/WITA/WIT (atau id IANA apa pun yang valid) → id IANA; null bila tidak dikenali. */
export function toIanaTimezone(hint: string): string | null {
  const key = normalizeText(hint).trim();
  if (key === '') return null;
  const alias = TZ_ALIASES[key];
  if (alias !== undefined) return alias;
  return isValidTimezone(hint) ? hint : null;
}

export function detectTimezoneHint(text: string): string | null {
  const t = normalizeText(text);
  for (const name of ['wita', 'wit', 'wib']) {
    if (new RegExp(`\\b${name}\\b`).test(t)) {
      return TZ_ALIASES[name] ?? null;
    }
  }
  const iana = text.match(/\b(Asia\/[A-Za-z_]+)\b/);
  return iana?.[1] ?? null;
}

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** Bagian kalender dari sebuah instan di zona tertentu. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

function offsetMinutes(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return (asUtc - Math.floor(instant.getTime() / 60000) * 60000) / 60000;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

/**
 * Jam dinding di zona tertentu → ISO-8601 dengan offset eksplisit.
 *
 * Dua langkah, karena offset bisa berubah di tengah tahun (DST di zona lain).
 * Tebakan pertama memakai offset pada tanggal UTC yang sama; hasilnya dipakai
 * untuk menghitung offset sebenarnya. Hasil akhir selalu menyebut offset, bukan
 * `Z`, supaya jadwal tetap terbaca benar walau zona asalnya bukan UTC.
 */
export function wallClockToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMinutes(new Date(guess), timeZone);
  const candidate = guess - first * 60000;
  const second = offsetMinutes(new Date(candidate), timeZone);
  const finalMs = guess - second * 60000;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${formatOffset(second)}`;
}

export function parseDateHint(text: string): { year: number | null; month: number; day: number } | null {
  const t = normalizeText(text);
  const m = t.match(/(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|sep|sept|okt|nov|des)\b(?:\s+(\d{4}))?/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2] ?? ''];
  if (month === undefined || !Number.isFinite(day) || day < 1 || day > 31) return null;
  const year = m[3] === undefined ? null : Number(m[3]);
  return { year, month, day };
}

export function parseWeekdayHint(text: string): number | null {
  const t = normalizeText(text);
  const m = t.match(/\b(minggu|ahad|senin|selasa|rabu|kamis|jumat|sabtu)\b/);
  if (!m) return null;
  return WEEKDAYS[m[1] ?? ''] ?? null;
}

export function parseTimeHint(text: string): string | null {
  const t = normalizeText(text);
  const withPrefix = t.match(/\b(?:pukul|jam)\s*(\d{1,2})(?:[.:](\d{2}))?\b/);
  const bare = t.match(/\b(\d{1,2})[.:](\d{2})\b/);
  const m = withPrefix ?? bare;
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] === undefined ? 0 : Number(m[2]);
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseIsoInstant(value: string): Date | null {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

/** Tanggal kalender (YYYY-MM-DD) untuk `instant` di zona `timeZone`. */
export function calendarDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * Kapan tanggal itu jatuh? Tahun eksplisit menang; tanpa tahun, pakai tahun
 * acuan dan geser ke tahun berikutnya bila tanggalnya sudah lewat. Ini bukan
 * tebakan: "5 November" yang dibaca pada 30 Oktober memang 5 November tahun itu.
 */
export function resolveCalendarDate(
  hint: { year: number | null; month: number; day: number },
  reference: Date,
  timeZone: string,
): { year: number; month: number; day: number } {
  const ref = zonedParts(reference, timeZone);
  if (hint.year !== null) return { year: hint.year, month: hint.month, day: hint.day };
  const sameYear = Date.UTC(hint.year ?? ref.year, hint.month - 1, hint.day);
  const refUtc = Date.UTC(ref.year, ref.month - 1, ref.day);
  if (sameYear >= refUtc) return { year: ref.year, month: hint.month, day: hint.day };
  return { year: ref.year + 1, month: hint.month, day: hint.day };
}

/** Hari kerja berikutnya (termasuk hari ini bila jamnya belum lewat) untuk `weekday`. */
export function resolveNextWeekday(weekday: number, reference: Date, timeZone: string, atTime: string | null): { year: number; month: number; day: number } {
  const ref = zonedParts(reference, timeZone);
  const refUtc = Date.UTC(ref.year, ref.month - 1, ref.day);
  let delta = (weekday - ref.weekday + 7) % 7;
  if (delta === 0 && atTime !== null) {
    const [h, m] = atTime.split(':').map(Number);
    const refMinutes = ref.hour * 60 + ref.minute;
    if ((h ?? 0) * 60 + (m ?? 0) <= refMinutes) delta = 7;
  }
  const target = new Date(refUtc + delta * 86400000);
  return { year: target.getUTCFullYear(), month: target.getUTCMonth() + 1, day: target.getUTCDate() };
}

export function addMinutes(iso: string, minutes: number): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO instant: ${iso}`);
  return new Date(ms + minutes * 60000).toISOString();
}

/** "2026-11-06T12:00:00+07:00" + 60 menit → ISO dengan offset yang sama. */
export function addMinutesKeepingOffset(iso: string, minutes: number): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([+-]\d{2}:\d{2})$/);
  if (!m) return addMinutes(iso, minutes);
  const base = Date.parse(`${m[1]}${m[2]}`);
  const shifted = new Date(base + minutes * 60000);
  const offset = m[2] ?? '+00:00';
  const sign = offset.startsWith('-') ? -1 : 1;
  const [oh, om] = offset.slice(1).split(':').map(Number);
  const shiftedLocal = new Date(shifted.getTime() + sign * ((oh ?? 0) * 60 + (om ?? 0)) * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shiftedLocal.getUTCFullYear()}-${pad(shiftedLocal.getUTCMonth() + 1)}-${pad(shiftedLocal.getUTCDate())}T${pad(shiftedLocal.getUTCHours())}:${pad(shiftedLocal.getUTCMinutes())}:00${offset}`;
}
