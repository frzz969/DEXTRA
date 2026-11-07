#!/usr/bin/env node
/* Verifikasi konfigurasi WorkBuddy: kontrak tool agent dan kelengkapan
 * agen/skill. Gagal (exit 1) jika ada yang menyimpang.
 *
 * Yang diperiksa:
 *   a) workbuddy/mcp.json valid dan allowedTools berupa array string.
 *   b) Tidak ada tool mutasi di allowedTools (TC-010 / PRD §8.3).
 *   c) Setiap tool di bagian `## Tools` agents/*.md dikenal allowedTools.
 *   d) Setiap skills/<id>/ punya agents/<id>.md (kecuali SKILL_TANPA_AGENT).
 *   e) Setiap skills/<id>/SKILL.md punya frontmatter `name:` dan `description:`.
 *
 * Catatan: folder workbuddy/agents dan workbuddy/skills sudah dihapus dari repo
 * secara sengaja (hanya mcp.json/icon.svg/connector-meta.json yang tersisa).
 * Jika folder tidak ada, pemeriksaan yang bergantung padanya DILEWATI (bukan
 * kegagalan). Jika folder ada, semua pemeriksaan ketat di atas tetap dijalankan.
 *
 * Jalankan: node scripts/verify-workbuddy.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Skill deterministik di server (validate_plan), bukan agen — sengaja tanpa
 * agen; keputusan pemilik produk masih tertunda. */
const SKILL_TANPA_AGENT = ['policy-validator'];

/* Tool mutasi yang tidak boleh pernah terekspos ke agent (TC-010 / PRD §8.3). */
const TOOL_MUTASI = ['execute_action', 'submit_approval', 'issue_mandate', 'revoke_mandate'];

let failures = 0;

function fail(message) {
  console.error(`GAGAL  ${message}`);
  failures += 1;
}

/* Semantik sama dengan section() di packages/store/src/specialists.ts. */
function toolsSection(lines) {
  const start = lines.findIndex(
    (l) => /^##\s+/.test(l) && l.slice(3).trim().toLowerCase().startsWith('tools')
  );
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^##\s+/.test(line)) break;
    out.push(line);
  }
  return out;
}

function parseTools(source) {
  return toolsSection(source.split(/\r?\n/))
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .split(',')
    .map((t) => t.trim().replace(/[.;]+$/, ''))
    .filter(Boolean);
}

const mcpPath = join(root, 'workbuddy', 'mcp.json');
let allowedTools = null;
try {
  const json = JSON.parse(await readFile(mcpPath, 'utf8'));
  allowedTools = json?.mcpServers?.dextra?.allowedTools;
  if (!Array.isArray(allowedTools) || !allowedTools.every((t) => typeof t === 'string')) {
    fail('workbuddy/mcp.json: allowedTools tidak ada atau bukan array string');
    allowedTools = null;
  } else {
    console.log(`ok     workbuddy/mcp.json valid (${allowedTools.length} allowedTools)`);
  }
} catch (err) {
  fail(`workbuddy/mcp.json tidak bisa diparse: ${err.message}`);
}

if (allowedTools) {
  const terlarang = TOOL_MUTASI.filter((t) => allowedTools.includes(t));
  if (terlarang.length > 0) {
    fail(`allowedTools memuat tool mutasi: ${terlarang.join(', ')}`);
  } else {
    console.log('ok     tidak ada tool mutasi di allowedTools');
  }

  const agentsDir = join(root, 'workbuddy', 'agents');
  let agentFiles = [];
  try {
    agentFiles = (await readdir(agentsDir)).filter((f) => f.endsWith('.md')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('dilewati: workbuddy/agents tidak ada di repo');
    } else {
      fail(`tidak bisa membaca workbuddy/agents: ${err.message}`);
    }
  }

  for (const file of agentFiles) {
    let source;
    try {
      source = await readFile(join(agentsDir, file), 'utf8');
    } catch (err) {
      fail(`tidak bisa membaca agents/${file}: ${err.message}`);
      continue;
    }
    const unknown = parseTools(source).filter((t) => !allowedTools.includes(t));
    if (unknown.length > 0) {
      fail(`agents/${file}: tool tidak dikenal: ${unknown.join(', ')}`);
    } else {
      console.log(`ok     agents/${file} tools cocok dengan allowedTools`);
    }
  }

  const skillsDir = join(root, 'workbuddy', 'skills');
  let skillIds = [];
  try {
    const entries = await readdir(skillsDir, { withFileTypes: true });
    skillIds = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log('dilewati: workbuddy/skills tidak ada di repo');
    } else {
      fail(`tidak bisa membaca workbuddy/skills: ${err.message}`);
    }
  }

  for (const id of skillIds) {
    if (SKILL_TANPA_AGENT.includes(id)) {
      console.log(`ok     skills/${id} sengaja tanpa agen (SKILL_TANPA_AGENT)`);
    } else if (agentFiles.includes(`${id}.md`)) {
      console.log(`ok     skills/${id} punya agents/${id}.md`);
    } else {
      fail(`skills/${id} tidak punya agents/${id}.md`);
    }

    let skillDoc;
    try {
      skillDoc = await readFile(join(skillsDir, id, 'SKILL.md'), 'utf8');
    } catch (err) {
      fail(`skills/${id}/SKILL.md tidak bisa dibaca: ${err.message}`);
      continue;
    }
    const frontmatter = skillDoc.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
    const body = frontmatter ? frontmatter[1] : '';
    const hasName = /^name:\s*\S/m.test(body);
    const hasDescription = /^description:\s*\S/m.test(body);
    if (!frontmatter || !hasName || !hasDescription) {
      fail(`skills/${id}/SKILL.md: frontmatter tidak memuat name dan description`);
    } else {
      console.log(`ok     skills/${id}/SKILL.md frontmatter lengkap`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} pemeriksaan gagal.`);
  process.exit(1);
}
console.log('\nSemua pemeriksaan WorkBuddy lulus.');
