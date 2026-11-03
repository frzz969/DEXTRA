#!/usr/bin/env node
/* Salin sumber kanonik dari packages/ ke apps/dashboard/assets/.
 *
 * Dashboard sengaja tetap "tanpa build step": berkas hasil salin ikut di-commit,
 * jadi membuka index.html langsung tetap bekerja. Skrip ini hanya memastikan
 * salinan tidak pernah menyimpang dari sumbernya.
 *
 * Jalankan: node scripts/sync-packages.mjs
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const COPIES = [
  {
    from: 'packages/ui/src/ui.js',
    to: 'apps/dashboard/assets/js/ui.js'
  },
  {
    from: 'packages/api-client/src/api-client.js',
    to: 'apps/dashboard/assets/js/api-client.js'
  },
  {
    from: 'packages/design-system/src/dashboard.css',
    to: 'apps/dashboard/assets/css/dashboard.css'
  }
];

async function main() {
  let changed = 0;
  for (const { from, to } of COPIES) {
    const src = resolve(root, from);
    const dst = resolve(root, to);
    let same = false;
    try {
      const [a, b] = await Promise.all([readFile(src), readFile(dst)]);
      same = a.equals(b);
    } catch {
      same = false;
    }
    if (same) {
      console.log(`sama    ${to}`);
      continue;
    }
    await mkdir(dirname(dst), { recursive: true });
    await copyFile(src, dst);
    console.log(`disalin ${from} -> ${to}`);
    changed += 1;
  }
  console.log(changed === 0 ? '\nTidak ada yang berubah.' : `\n${changed} berkas disalin.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
