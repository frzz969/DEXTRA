import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function dataDir(): string {
  return process.env.DEXTRA_DATA_DIR || 'data';
}

export const emailAdapter = {
  name: 'outbox',
  async run(action: any, _plan: any) {
    const startedAt = Date.now();
    const id = randomBytes(4).toString('hex');
    const messageId = `eml_${id}`;
    const dir = join(dataDir(), 'outbox');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `email-${id}.eml`);
    const body = action?.content?.body ?? '';
    const subject = action?.content?.subject ?? '';
    const to = action?.target?.masked_address ?? '';
    const attachments = action?.content?.attachments ?? [];
    const content = `From: dextra@local\r\nTo: ${to}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\n\r\n${body}\r\nAttachments: ${JSON.stringify(attachments)}\r\n`;
    writeFileSync(path, content, 'utf8');
    const latency = Date.now() - startedAt;
    return {
      evidence: { message_id: messageId, outbox_path: path },
      usage: { provider: 'outbox', model: null, tokens_in: null, tokens_out: null, cost_usd: null, latency_ms: latency },
    };
  },
};