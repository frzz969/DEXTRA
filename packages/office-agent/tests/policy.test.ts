import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { Org } from '../../contracts/src/index.ts';
import { checkOfficePolicy, suggestAlternatives, type OfficePolicyInput } from '../src/policy.ts';

const ORG: Org = {
  org_id: 'org_kenari',
  timezones: ['Asia/Jakarta'],
  office_hours: { start: '08:00', end: '17:00' },
  friday_prayer: { start: '11:30', end: '13:00' },
  holidays: ['2026-11-10'],
  approval_matrix_version: '1.0',
  contract_version: '1.0.0',
} as Org;

const NOW = new Date('2026-11-03T02:00:00.000Z');

const CALENDAR = [
  {
    event_id: 'evt_cal_friday_conflict',
    title: 'Rapat koordinasi mingguan',
    start_at: '2026-11-06T12:00:00+07:00',
    end_at: '2026-11-06T13:00:00+07:00',
    timezone: 'Asia/Jakarta',
    attendees: ['c_tim_ops'],
  },
];

function input(overrides: Partial<OfficePolicyInput> & { start?: string; end?: string | null; timezone?: string }): OfficePolicyInput {
  return {
    action: {
      item_id: 'item_001',
      action_type: 'create_calendar_event',
      schedule: {
        start_at: overrides.start ?? '2026-11-05T10:00:00+07:00',
        end_at: overrides.end === undefined ? '2026-11-05T11:00:00+07:00' : overrides.end,
        timezone: overrides.timezone ?? 'Asia/Jakarta',
      },
    },
    org: ORG,
    calendar: overrides.calendar === undefined ? CALENDAR : overrides.calendar,
    now: overrides.now ?? NOW,
  };
}

function codes(findings: ReturnType<typeof checkOfficePolicy>): string[] {
  return findings.map((finding) => finding.code);
}

test('zona waktu tidak valid menghasilkan temuan terkontrol, bukan crash', () => {
  const findings = checkOfficePolicy(input({ timezone: 'WIB2' }));
  assert.deepEqual(codes(findings), ['INVALID_TIMEZONE']);
  assert.equal(findings[0]?.severity, 'blocking');
});

test('WITA valid secara IANA tetapi tidak dikonfigurasi organisasi', () => {
  const findings = checkOfficePolicy(input({ timezone: 'Asia/Makassar', start: '2026-11-05T10:00:00+08:00', end: '2026-11-05T11:00:00+08:00' }));
  assert.ok(codes(findings).includes('TIMEZONE_NOT_CONFIGURED'));
  assert.ok(!codes(findings).includes('INVALID_TIMEZONE'));
});

test('jadwal Jumat 12.00 bertabrakan dengan waktu salat Jumat', () => {
  const findings = checkOfficePolicy(input({ start: '2026-11-06T12:00:00+07:00', end: '2026-11-06T13:00:00+07:00' }));
  assert.ok(codes(findings).includes('FRIDAY_PRAYER_CONFLICT'));
  assert.ok(codes(findings).includes('CALENDAR_CONFLICT'));
});

test('jadwal pada hari libur dilaporkan', () => {
  const findings = checkOfficePolicy(input({ start: '2026-11-10T10:00:00+07:00', end: '2026-11-10T11:00:00+07:00' }));
  assert.ok(codes(findings).includes('HOLIDAY_CONFLICT'));
});

test('jam di luar jam kerja dilaporkan sebagai peringatan', () => {
  const findings = checkOfficePolicy(input({ start: '2026-11-05T19:00:00+07:00', end: '2026-11-05T20:00:00+07:00' }));
  const finding = findings.find((entry) => entry.code === 'OUTSIDE_OFFICE_HOURS');
  assert.equal(finding?.severity, 'warning');
});

test('waktu selesai sebelum waktu mulai ditolak', () => {
  const findings = checkOfficePolicy(input({ start: '2026-11-05T10:00:00+07:00', end: '2026-11-05T09:00:00+07:00' }));
  const finding = findings.find((entry) => entry.code === 'END_BEFORE_START');
  assert.equal(finding?.severity, 'blocking');
});

test('jadwal di masa lalu ditolak', () => {
  const findings = checkOfficePolicy(input({ start: '2026-10-01T10:00:00+07:00', end: '2026-10-01T11:00:00+07:00' }));
  assert.ok(codes(findings).includes('START_IN_PAST'));
});

test('kalender yang tidak tersedia dilaporkan belum diperiksa, bukan dianggap kosong', () => {
  const findings = checkOfficePolicy(input({ calendar: null }));
  const finding = findings.find((entry) => entry.code === 'CALENDAR_UNCHECKED');
  assert.equal(finding?.severity, 'info');
  assert.ok(!codes(findings).includes('CALENDAR_CONFLICT'));
});

test('alternatif jadwal benar-benar diperiksa terhadap jam kerja dan salat Jumat', () => {
  const alternatives = suggestAlternatives(input({ start: '2026-11-06T12:00:00+07:00', end: '2026-11-06T13:00:00+07:00' }), 3);
  assert.ok(alternatives.length > 0, 'harus ada alternatif');
  assert.ok(alternatives.length <= 3);
  for (const iso of alternatives) {
    const hour = Number(iso.slice(11, 13));
    assert.ok(hour >= 8 && hour < 17, `di luar jam kerja: ${iso}`);
    assert.ok(!(hour === 12 || (hour === 11 && Number(iso.slice(14, 16)) >= 30)), `bentrok salat Jumat: ${iso}`);
  }
});
