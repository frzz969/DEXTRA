/*
 * Berapa biaya membaca audit log saat log tumbuh?
 * Diukur, bukan dikira-kira. Menulis berkas langsung dengan rantai hash yang
 * benar, supaya yang diukur adalah biaya BACA, bukan biaya tulis.
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'dextra-bench-'));
process.env.DEXTRA_DATA_DIR = dir;

const { auditHash } = await import('../packages/store/src/repository.ts');
const { handleTool } = await import('../apps/mcp-server/src/handlers.ts');

function build(n) {
  const lines = [];
  let prev = null;
  for (let i = 0; i < n; i += 1) {
    const base = {
      event_id: `evt_bench_${i}`,
      at: new Date(1700000000000 + i * 1000).toISOString(),
      type: 'action_executed',
      actor: 'executor',
      plan_id: `plan_bench_${i % 500}`,
      mandate_id: `mandate_bench_${i % 500}`,
      detail: { index: String(i), note: 'baris audit sintetis untuk mengukur biaya baca' },
    };
    const hash = auditHash(base, prev);
    lines.push(JSON.stringify({ ...base, prev_hash: prev, hash }));
    prev = hash;
  }
  return { text: lines.join('\n') + '\n', head: prev };
}

for (const n of [1000, 5000, 20000]) {
  const { text, head } = build(n);
  writeFileSync(join(dir, 'audit.jsonl'), text);
  writeFileSync(join(dir, 'audit.checkpoint.json'), JSON.stringify({ event_count: n, head_hash: head, at: new Date().toISOString() }));

  const t0 = performance.now();
  const result = await handleTool('get_audit_log', { limit: 25 }, 'ops');
  const t1 = performance.now();

  const t2 = performance.now();
  await handleTool('get_audit_log', { q: 'bench_499', limit: 25 }, 'ops');
  const t3 = performance.now();

  const mb = (Buffer.byteLength(text) / 1024 / 1024).toFixed(1);
  console.log(
    `n=${String(n).padStart(5)}  ${mb.padStart(5)} MB  ` +
    `baca+verifikasi ${(t1 - t0).toFixed(0).padStart(5)} ms  ` +
    `dengan q ${(t3 - t2).toFixed(0).padStart(5)} ms  ` +
    `ok=${result.data.integrity.ok} verified=${result.data.integrity.verified}`,
  );
}

rmSync(dir, { recursive: true, force: true });
