#!/usr/bin/env node
/* Verifikasi bahwa salinan di apps/web/app/ benar-benar sama dengan sumbernya
 * di packages/. Gagal (exit 1) jika ada yang menyimpang.
 *
 * Ini bukan formalitas: tanpa pemeriksaan ini, packages/ bisa jadi duplikat
 * yang perlahan basi sementara halaman React memakai versi lain.
 *
 * Jalankan: node scripts/verify-packages.mjs
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPIES } from './sync-packages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;

for (const { from, to } of COPIES) {
  let a;
  let b;
  try {
    a = await readFile(resolve(root, from));
  } catch {
    console.error(`GAGAL  sumber tidak ada: ${from}`);
    failures += 1;
    continue;
  }
  try {
    b = await readFile(resolve(root, to));
  } catch {
    console.error(`GAGAL  salinan tidak ada: ${to} (jalankan node scripts/sync-packages.mjs)`);
    failures += 1;
    continue;
  }
  if (!a.equals(b)) {
    console.error(`GAGAL  berbeda: ${to} tidak sama dengan ${from}`);
    failures += 1;
    continue;
  }
  console.log(`ok     ${to}`);
}

/* Token di design-system harus benar-benar dipakai oleh CSS-nya. Kalau sebuah
   token dideklarasikan di tokens.json tapi tidak ada di CSS (atau sebaliknya
   untuk token wajib), dokumen token itu bohong. */
const tokensPath = resolve(root, 'packages/design-system/tokens.json');
const cssPath = resolve(root, 'packages/design-system/src/dashboard.css');
try {
  const tokens = JSON.parse(await readFile(tokensPath, 'utf8'));
  const css = await readFile(cssPath, 'utf8');
  const names = [];
  for (const group of Object.values(tokens.groups ?? {})) {
    for (const [name, value] of Object.entries(group)) {
      names.push({ name, value });
    }
  }
  if (names.length === 0) {
    console.error('GAGAL  tokens.json tidak berisi token apa pun');
    failures += 1;
  }
  for (const { name, value } of names) {
    const declared = new RegExp(`--${name}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`);
    if (!declared.test(css)) {
      console.error(`GAGAL  token --${name}: ${value} tidak ditemukan di dashboard.css`);
      failures += 1;
    }
  }
  if (failures === 0) console.log(`ok     ${names.length} token design-system cocok dengan CSS`);
} catch (err) {
  console.error(`GAGAL  tidak bisa memeriksa design-system: ${err.message}`);
  failures += 1;
}

if (failures > 0) {
  console.error(`\n${failures} pemeriksaan gagal.`);
  process.exit(1);
}
console.log('\nSemua paket tersinkron.');
