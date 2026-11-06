import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseIntent } from '../src/intent.ts';

test('mengekstrak penerima, jam, tanggal relatif, durasi, dan zona', () => {
  const parsed = parseIntent('Kirim   laporan ke Budi besok pukul 10.30 selama 45 menit WIB');
  assert.equal(parsed.instruction, 'Kirim laporan ke Budi besok pukul 10.30 selama 45 menit WIB');
  assert.equal(parsed.hints.action_type, 'send_email');
  assert.equal(parsed.hints.recipient_name, 'Budi');
  assert.equal(parsed.hints.time_of_day, '10:30');
  assert.equal(parsed.hints.day_relation, 'tomorrow');
  assert.equal(parsed.hints.duration_minutes, 45);
  assert.equal(parsed.hints.timezone, 'Asia/Jakarta');
  assert.equal(parsed.assumptions.time_of_day, '10:30');
  assert.equal(parsed.assumptions.duration_minutes, 45);
  assert.equal(parsed.assumptions.timezone, 'Asia/Jakarta');
});

test('tanpa waktu: tidak mengarang jam dan tidak mengisi asumsi', () => {
  const parsed = parseIntent('Kirim laporan ke Budi bagian Keuangan');
  assert.equal(parsed.hints.time_of_day, null);
  assert.equal(parsed.assumptions.time_of_day, undefined);
  assert.equal(parsed.hints.day_relation, null);
  assert.equal(parsed.hints.recipient_name, 'Budi');
});

test('tanpa penerima: penerima tetap null, bukan tebakan', () => {
  const parsed = parseIntent('Jadwalkan rapat besok jam 9 selama 1 jam');
  assert.equal(parsed.hints.action_type, 'create_calendar_event');
  assert.equal(parsed.hints.recipient_name, null);
  assert.equal(parsed.hints.recipient_email, null);
  assert.equal(parsed.hints.time_of_day, '09:00');
  assert.equal(parsed.hints.day_relation, 'tomorrow');
  assert.equal(parsed.hints.duration_minutes, 60);
  assert.equal(parsed.assumptions.duration_minutes, 60);
});

test('kata umum setelah "ke" bukan penerima (ambigu / bukan nama)', () => {
  const parsed = parseIntent('Kirim email ke tim operasional');
  assert.equal(parsed.hints.recipient_name, null);
});

test('alamat email diambil sebagai email, bukan sebagai nama', () => {
  const parsed = parseIntent('Kirim dokumen ke budi.santoso@kenari.co.id pukul 14:00');
  assert.equal(parsed.hints.recipient_email, 'budi.santoso@kenari.co.id');
  assert.equal(parsed.hints.time_of_day, '14:00');
  assert.equal(parsed.hints.action_type, 'send_email');
});

test('hari ini dan nama hari dikenali', () => {
  const today = parseIntent('Ingatkan saya hari ini');
  assert.equal(today.hints.day_relation, 'today');

  const weekday = parseIntent('Rapat dengan Sari hari Senin pukul 09.00');
  assert.equal(weekday.hints.weekday, 1);
  assert.equal(weekday.hints.time_of_day, '09:00');
});

test('zona waktu WITA dipetakan ke IANA', () => {
  const parsed = parseIntent('Rapat pukul 13:00 WITA');
  assert.equal(parsed.hints.timezone, 'Asia/Makassar');
  assert.equal(parsed.assumptions.timezone, 'Asia/Makassar');
});

test('durasi lebih dari batas schema tetap dilaporkan di hints', () => {
  const parsed = parseIntent('Rapat selama 600 menit');
  assert.equal(parsed.hints.duration_minutes, 600);
  assert.equal(parsed.assumptions.duration_minutes, undefined);
});
