import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function dataDir(): string {
  return process.env.DEXTRA_DATA_DIR || 'data';
}

export const taskAdapter = {
  name: 'outbox',
  async run(action: any, _plan: any) {
    const startedAt = Date.now();
    const id = randomBytes(4).toString('hex');
    const taskId = `task_${id}`;
    const dir = join(dataDir(), 'outbox');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `task-${id}.json`);
    const record = {
      title: action?.content?.subject ?? 'task',
      assignee: action?.target?.display_name ?? '',
      due: action?.schedule?.start_at ?? null,
      created_at: new Date().toISOString(),
    };
    writeFileSync(path, JSON.stringify(record, null, 2), 'utf8');
    const latency = Date.now() - startedAt;
    return {
      evidence: { task_id: taskId, task_path: path },
      usage: { provider: 'outbox', model: null, tokens_in: null, tokens_out: null, cost_usd: null, latency_ms: latency },
    };
  },
};