#!/usr/bin/env node
/**
 * Lint dashboard (minimal, tanpa eslint — repo ini tidak punya config eslint).
 *
 * A25: `tsc --noEmit` (via `npm run typecheck`, per-workspace) memeriksa
 * packages/apps TS. Berkas `apps/dashboard/assets/js/*.js` adalah runtime
 * browser (bukan modul yang di-import TS), jadi `tsc` tidak menyentuhnya —
 * lint harus mem-parse langsung tiap berkas dashboard dengan `node --check`,
 * sama seperti check-syntax.mjs tetapi khusus sweep dashboard (termasuk
 * subfolder enterprise/skills/workflow/data-management/dll).
 *
 * Memfail bila satu pun berkas gagal parse, dengan daftar berkas rusak.
 * `node --check` hanya parse; tidak mengeksekusi DOM.
 *
 *   node scripts/lint-dashboard.mjs
 *   npm run lint:dashboard
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DASH_JS = join(ROOT, 'apps', 'dashboard', 'assets', 'js');

/** @param {string} dir @returns {string[]} */
function collect(dir) {
  /** @type {string[]} */
  const found = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      found.push(...collect(join(dir, entry.name)));
    } else if (entry.isFile() && /\.js$/.test(entry.name)) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const files = collect(DASH_JS).sort();

if (files.length === 0) {
  console.error('Tidak ada berkas dashboard yang ditemukan — periksa path apps/dashboard/assets/js.');
  process.exit(1);
}

const broken = [];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    broken.push({ file: relative(ROOT, file).replace(/\\/g, '/'), message: (result.stderr || '').trim() });
  }
}

if (broken.length > 0) {
  for (const item of broken) {
    console.error(`\ngagal  ${item.file}`);
    console.error(item.message.split('\n').slice(0, 4).map((line) => `       ${line}`).join('\n'));
  }
  console.error(`\n${broken.length} dari ${files.length} berkas dashboard gagal di-parse.`);
  process.exit(1);
}

console.log(`ok     ${files.length} berkas dashboard (apps/dashboard/assets/js) dapat di-parse (node --check).`);
