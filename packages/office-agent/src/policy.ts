import type { Org } from '../../contracts/src/index.ts';
import { isFridayPrayer, isHoliday, isWithinOfficeHours, toZoned } from '../../policy-engine/src/index.ts';

import { calendarDate, isValidTimezone, wallClockToIso, zonedParts } from './dates.ts';
import type { OfficePolicyFinding } from './types.ts';

/**
 * OfficePolicy — domain policy di ATAS Policy Engine DEXTRA.
 *
 * Yang dilakukan di sini hanya menambah pemeriksaan yang tidak dimiliki engine:
 * validitas zona waktu sebelum engine menyentuhnya, `end_at` setelah `start_at`,
 * jadwal di masa lalu, konflik kalender, dan alternatif jadwal.
 *
 * Yang TIDAK dilakukan: menyalin jam kerja, aturan Jumat, atau hari libur ke
 * sini. Itu milik engine, dan menduplikasinya berarti dua sumber kebenaran yang
 * akan berbeda pendapat cepat atau lambat.
 */

export interface CalendarEventView {
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  timezone: string;
  attendees: string[];
}

export interface PolicyActionView {
  item_id: string;
  action_type: string;
  schedule: { start_at: string; end_at: string | null; timezone: string };
}

export interface OfficePolicyInput {
  action: PolicyActionView;
  org: Org;
  /** null berarti kalender tidak tersedia — bukan berarti kosong. */
  calendar: ReadonlyArray<CalendarEventView> | null;
  now: Date;
}

const CANDIDATE_TIMES = ['09:00', '10:00', '13:00', '14:00'];

function finding(
  code: string,
  severity: OfficePolicyFinding['severity'],
  item_id: string | null,
  message: string,
  alternatives: string[] = [],
): OfficePolicyFinding {
  return { code, severity, item_id, message, alternatives };
}

function endOf(action: PolicyActionView): string {
  if (action.schedule.end_at !== null) return action.schedule.end_at;
  const startMs = Date.parse(action.schedule.start_at);
  return new Date(startMs + 30 * 60000).toISOString();
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return Date.parse(aStart) < Date.parse(bEnd) && Date.parse(aEnd) > Date.parse(bStart);
}

/**
 * Alternatif jadwal yang benar-benar diperiksa.
 *
 * Ini penting untuk kejujuran produk: menawarkan "pukul 09.00" tanpa memeriksa
 * jam kerja, hari libur, dan kalender berarti menawarkan slot yang belum tentu
 * ada. Setiap kandidat di sini melewati pemeriksaan yang sama dengan jadwal
 * yang ditolak.
 */
export function suggestAlternatives(input: OfficePolicyInput, limit = 3): string[] {
  const { action, org, calendar } = input;
  if (!isValidTimezone(action.schedule.timezone)) return [];

  const startMs = Date.parse(action.schedule.start_at);
  const durationMs = Date.parse(endOf(action)) - startMs;
  const out: string[] = [];

  for (let dayOffset = 0; dayOffset <= 7 && out.length < limit; dayOffset += 1) {
    for (const time of CANDIDATE_TIMES) {
      if (out.length >= limit) break;
      const base = new Date(startMs + dayOffset * 86400000);
      const parts = zonedParts(base, action.schedule.timezone);
      const [hour, minute] = time.split(':').map(Number);
      const iso = wallClockToIso(parts.year, parts.month, parts.day, hour ?? 9, minute ?? 0, action.schedule.timezone);
      if (Date.parse(iso) <= input.now.getTime()) continue;

      const zoned = toZoned(new Date(iso), action.schedule.timezone);
      if (!isWithinOfficeHours(zoned, org)) continue;
      if (isFridayPrayer(zoned, org)) continue;
      if (isHoliday(new Date(iso), org, action.schedule.timezone)) continue;
      if (calendar !== null) {
        const endIso = new Date(Date.parse(iso) + durationMs).toISOString();
        const busy = calendar.some((event) => overlaps(iso, endIso, event.start_at, event.end_at));
        if (busy) continue;
      }
      out.push(iso);
    }
  }
  return out;
}

export function checkOfficePolicy(input: OfficePolicyInput): OfficePolicyFinding[] {
  const { action, org, calendar, now } = input;
  const findings: OfficePolicyFinding[] = [];
  const tz = action.schedule.timezone;

  /*
   * Zona waktu diperiksa SEBELUM apa pun yang memakai `Intl`. Engine memanggil
   * `toZoned` yang melempar RangeError untuk zona tak dikenal; melemparnya ke
   * pemanggil berarti permintaan dengan "WIB2" meruntuhkan jalur, bukan
   * menghasilkan temuan yang bisa dibaca manusia.
   */
  if (!isValidTimezone(tz)) {
    return [
      finding(
        'INVALID_TIMEZONE',
        'blocking',
        action.item_id,
        `Zona waktu "${tz}" tidak dikenali. Gunakan id IANA (mis. Asia/Jakarta) atau WIB/WITA/WIT.`,
      ),
    ];
  }

  const startMs = Date.parse(action.schedule.start_at);
  if (Number.isNaN(startMs)) {
    return [finding('INVALID_SCHEDULE', 'blocking', action.item_id, `Waktu mulai tidak valid: ${action.schedule.start_at}`)];
  }

  if (action.schedule.end_at !== null) {
    const endMs = Date.parse(action.schedule.end_at);
    if (Number.isNaN(endMs) || endMs <= startMs) {
      findings.push(
        finding('END_BEFORE_START', 'blocking', action.item_id, 'Waktu selesai harus setelah waktu mulai.'),
      );
    }
  }

  if (startMs < now.getTime()) {
    findings.push(
      finding('START_IN_PAST', 'blocking', action.item_id, 'Jadwal berada di masa lalu sehingga tidak bisa dieksekusi.'),
    );
  }

  if (!org.timezones.includes(tz)) {
    findings.push(
      finding(
        'TIMEZONE_NOT_CONFIGURED',
        'warning',
        action.item_id,
        `Zona "${tz}" valid secara IANA tetapi tidak ada di konfigurasi organisasi (${org.timezones.join(', ')}).`,
      ),
    );
  }

  const zoned = toZoned(new Date(startMs), tz);

  if (!isWithinOfficeHours(zoned, org)) {
    findings.push(
      finding(
        'OUTSIDE_OFFICE_HOURS',
        'warning',
        action.item_id,
        `Di luar jam kerja organisasi (${org.office_hours.start}–${org.office_hours.end}).`,
        suggestAlternatives(input),
      ),
    );
  }

  if (isFridayPrayer(zoned, org)) {
    findings.push(
      finding(
        'FRIDAY_PRAYER_CONFLICT',
        'warning',
        action.item_id,
        `Bertepatan dengan waktu salat Jumat (${org.friday_prayer?.start ?? '?'}–${org.friday_prayer?.end ?? '?'}).`,
        suggestAlternatives(input),
      ),
    );
  }

  if (isHoliday(new Date(startMs), org, tz)) {
    findings.push(
      finding(
        'HOLIDAY_CONFLICT',
        'warning',
        action.item_id,
        `Bertepatan dengan hari libur (${calendarDate(new Date(startMs), tz)}).`,
        suggestAlternatives(input),
      ),
    );
  }

  if (calendar === null) {
    findings.push(
      finding(
        'CALENDAR_UNCHECKED',
        'info',
        action.item_id,
        'Kalender tidak tersedia; bentrok jadwal belum diperiksa. Jadwal ini belum bisa disebut kosong.',
      ),
    );
  } else {
    const endIso = endOf(action);
    const conflict = calendar.find((event) => overlaps(action.schedule.start_at, endIso, event.start_at, event.end_at));
    if (conflict) {
      findings.push(
        finding(
          'CALENDAR_CONFLICT',
          'warning',
          action.item_id,
          `Bentrok dengan "${conflict.title}" (${conflict.start_at}–${conflict.end_at}).`,
          suggestAlternatives(input),
        ),
      );
    }
  }

  return findings;
}

export function hasBlocking(findings: ReadonlyArray<OfficePolicyFinding>): boolean {
  return findings.some((entry) => entry.severity === 'blocking');
}
