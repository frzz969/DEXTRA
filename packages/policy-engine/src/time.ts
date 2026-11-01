import type { Org } from '../../contracts/src/index.ts';
import type { Zoned } from './types.ts';

export function parseIso(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${s}`);
  return d;
}

export function toZoned(date: Date, tz: string): Zoned {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function isWithinOfficeHours(zoned: Zoned, org: Org): boolean {
  const now = zoned.hour * 60 + zoned.minute;
  return now >= toMinutes(org.office_hours.start) && now <= toMinutes(org.office_hours.end);
}

export function isFridayPrayer(zoned: Zoned, org: Org): boolean {
  if (!org.friday_prayer) return false;
  if (zoned.weekday !== 5) return false;
  const now = zoned.hour * 60 + zoned.minute;
  return now >= toMinutes(org.friday_prayer.start) && now <= toMinutes(org.friday_prayer.end);
}

export function isHoliday(date: Date, org: Org, tz?: string): boolean {
  const z = toZoned(date, tz ?? org.timezones[0] ?? 'UTC');
  const key = `${z.year}-${String(z.month).padStart(2, '0')}-${String(z.day).padStart(2, '0')}`;
  return org.holidays.includes(key);
}

export function formatWib(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(date);
}