#!/usr/bin/env node
/**
 * Satu urutan pemeriksaan, dipakai lokal dan di CI.
 *
 * Versi sebelumnya hanya ada sebagai shell script (`test-all.sh`), dan di mesin
 * pengembangan Windows tidak ada `sh`, jadi skrip itu tidak pernah benar-benar
 * dijalankan. Akibatnya `verify-packages.mjs` diam-diam gagal sejak commit
 * 8154736: salinan `ui.js` di dashboard menyimpang dari sumber kanonik, dan
 * tidak ada yang tahu sampai CI ditambahkan.
 *
 * Karena itu urutannya ditulis di sini, sekali, dalam Node yang pasti ada di
 * repo ini. `test-all.sh` hanya meneruskan ke berkas ini.
 *
 *   node scripts/test-all.mjs
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function run(label, command, args) {
  console.log(`\n== ${label} ==`);
  // Di Windows, npm hanya ada sebagai `npm.cmd`, dan Node menolak menjalankan
  // `.cmd` tanpa shell (EINVAL sejak Node 18). Dengan shell, argumen harus
  // dirangkai sendiri, karena array argumen tidak di-escape oleh cmd.exe.
  const useShell = process.platform === 'win32' && command === 'npm';
  const cp = useShell
    ? spawnSync([command, ...args].map(shellArg).join(' '), { cwd: ROOT, stdio: 'inherit', shell: true })
    : spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (cp.error) {
    console.error(`gagal menjalankan ${command}: ${cp.error.message}`);
    process.exit(1);
  }
  if (cp.status !== 0) {
    console.error(`\nGAGAL: ${label} (exit ${cp.status})`);
    process.exit(cp.status ?? 1);
  }
}

function shellArg(value) {
  return /[\s"]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}

/**
 * `python` di Windows sering hanya alias Microsoft Store: perintahnya ditemukan,
 * tetapi gagal saat dijalankan. Jadi kandidat diuji dengan benar-benar memanggilnya.
 */
function resolvePython() {
  const candidates = [process.env.PYTHON, 'python', 'python3', 'py'].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-c', 'import sys'], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    if (!probe.error && probe.status === 0) return candidate;
  }
  console.error('Tidak ada Python yang bisa dijalankan. Set PYTHON atau pasang Python >= 3.11.');
  process.exit(1);
}

const python = resolvePython();

run('sintaks JavaScript dapat di-parse', 'node', ['scripts/check-syntax.mjs']);
run('salinan paket tidak menyimpang', 'node', ['scripts/verify-packages.mjs']);
run('typecheck semua workspace', 'npm', ['run', 'typecheck']);
run('tes paket + gateway', 'npm', ['test']);
run('kontrak dashboard', 'npm', ['run', 'test:dashboard']);
run('tes HTTP gateway', 'npm', ['run', 'test:http']);
run('tes Python', python, ['-m', 'pytest', 'tests', '-q']);

console.log('\nSemua pemeriksaan lulus.');
