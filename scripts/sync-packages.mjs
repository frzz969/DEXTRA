#!/usr/bin/env node
/* Salin sumber kanonik dari packages/ ke apps/web/app/.
 *
 * apps/web punya node_modules sendiri (bukan workspace root) karena symlink
 * workspace gagal dibuat di Windows. Skrip ini memastikan salinan CSS tidak
 * pernah menyimpang dari sumber kanonik di packages/design-system.
 *
 * Jalankan: node scripts/sync-packages.mjs
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const COPIES = [
  // aset packages/ sekarang dikonsumsi langsung oleh sumber React di apps/web.
  {
    from: 'packages/design-system/src/design-system.css',
    to: 'apps/web/app/dextra-design-system.css'
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

/* Hanya jalankan penyalinan kalau berkas ini dieksekusi langsung.
   Tanpa penjaga ini, `import { COPIES }` di verify-packages.mjs ikut menyalin
   lebih dulu — sehingga verifikasi selalu lulus karena sumber dan salinan baru
   saja disamakan oleh efek samping impor. */
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
