import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function dataDir(): string {
  return process.env.DEXTRA_DATA_DIR || 'data';
}

function writeEml(action: any, id: string): string {
  const dir = join(dataDir(), 'outbox');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `email-${id}.eml`);
  const body = action?.content?.body ?? '';
  const subject = action?.content?.subject ?? '';
  const to = action?.target?.masked_address ?? '';
  const attachments = action?.content?.attachments ?? [];
  const content = `From: dextra@local\r\nTo: ${to}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\n\r\n${body}\r\nAttachments: ${JSON.stringify(attachments)}\r\n`;
  writeFileSync(path, content, 'utf8');
  return path;
}

export const emailAdapter = {
  name: 'email',
  async run(action: any, _plan: any) {
    const startedAt = Date.now();
    const id = randomBytes(4).toString('hex');
    const host = process.env.SMTP_HOST;
    const to = action?.target?.masked_address ?? '';
    const subject = action?.content?.subject ?? '';
    const body = action?.content?.body ?? '';
    if (host) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        // @ts-ignore
        const nodemailer: any = await import('nodemailer');
        const transporter = nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT || 587) === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        });
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || 'dextra@local',
          to,
          subject,
          text: body,
        });
        const path = writeEml(action, id);
        const latency = Date.now() - startedAt;
        return {
          evidence: { message_id: info.messageId, provider: 'smtp', outbox_path: path },
          usage: { provider: 'smtp', model: null, tokens_in: null, tokens_out: null, cost_usd: null, latency_ms: latency },
        };
      } catch (e) {
        process.stderr.write(`[email] SMTP send failed: ${e}\n`);
      }
    }
    const messageId = `eml_${id}`;
    const path = writeEml(action, id);
    const latency = Date.now() - startedAt;
    return {
      evidence: { message_id: messageId, provider: 'outbox', outbox_path: path },
      usage: { provider: 'outbox', model: null, tokens_in: null, tokens_out: null, cost_usd: null, latency_ms: latency },
    };
  },
};