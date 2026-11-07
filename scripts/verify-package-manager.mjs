#!/usr/bin/env node
/**
 * Memastikan dependency dipasang dengan pnpm, bukan npm atau yarn.
 *
 * Repo ini memakai pnpm (pnpm-lock.yaml + pnpm-workspace.yaml). Kalau seseorang
 * menjalankan `npm install`, npm membuat package-lock.json sendiri, dan repo
 * berakhir dengan dua lockfile yang saling bertentangan. Skrip ini dipasang
 * sebagai `preinstall`, jadi instalasi npm/yarn berhenti sebelum menulis apa pun.
 *
 *   node scripts/verify-package-manager.mjs
 */
const agent = process.env.npm_config_user_agent || '';

if (!agent.startsWith('pnpm/')) {
  console.error(
    'Repo ini memakai pnpm. Jalankan `pnpm install`, bukan npm atau yarn.\n' +
      'package-lock.json tidak boleh dibuat di repo ini (lihat .gitignore).',
  );
  process.exit(1);
}
