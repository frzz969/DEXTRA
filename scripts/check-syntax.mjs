#!/usr/bin/env node
/**
 * Memeriksa sintaks setiap berkas JavaScript runtime.
 *
 * Kenapa ini ada: commit beba8ec menulis `;` diikuti literal `\n` pada
 * berkas JavaScript lama, sehingga berkas itu gagal di-parse. `pnpm run
 * test:all` tetap hijau, karena tidak ada satu pun pemeriksaan yang membaca
 * berkas itu, dan `tsc` tidak menyentuh berkas .js yang tidak di-import.
 *
 * Jadi gerbangnya harus menyebut hal paling dasar: apakah berkas ini bisa
 * dijalankan sama sekali. `node --check` hanya mem-parse, tidak mengeksekusi,
 * sehingga aman dijalankan atas berkas yang butuh DOM.
 *
 *   node scripts/check-syntax.mjs
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = ['apps', 'packages', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', 'coverage']);

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
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...collect(join(dir, entry.name)));
    } else if (entry.isFile() && /\.(js|mjs|cjs)$/.test(entry.name)) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

const files = SCAN.flatMap((dir) => collect(join(ROOT, dir))).sort();

if (files.length === 0) {
  console.error('Tidak ada berkas JavaScript yang ditemukan — periksa daftar SCAN.');
  process.exit(1);
}

const broken = [];
for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');

  // BOM UTF-8 di awal berkas membuat kernel/shell tidak mengenali shebang dan
  // membuat `node --check` melaporkan galat pada karakter pertama. Deteksi
  // eksplisit di sini supaya pesannya jelas, bukan "Unexpected token".
  const head = readFileSync(file).subarray(0, 3);
  const hasBom = head.length >= 3 && head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf;
  if (hasBom) {
    broken.push({
      file: rel,
      message: 'BOM UTF-8 di awal berkas membuat shebang tidak dikenali. Hapus BOM dari berkas ini.',
    });
    continue;
  }

  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    broken.push({ file: rel, message: (result.stderr || '').trim() });
  }
}

if (broken.length > 0) {
  for (const item of broken) {
    console.error(`\ngagal  ${item.file}`);
    console.error(item.message.split('\n').slice(0, 4).map((line) => `       ${line}`).join('\n'));
  }
  console.error(`\n${broken.length} dari ${files.length} berkas gagal di-parse.`);
  process.exit(1);
}

console.log(`ok     ${files.length} berkas JavaScript dapat di-parse.`);
