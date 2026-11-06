import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function dataDir(): string {
  return process.env.DEXTRA_DATA_DIR || 'data';
}

export const calendarAdapter = {
  name: 'outbox',
  async run(action: any, _plan: any) {
    const startedAt = Date.now();
    const id = randomBytes(4).toString('hex');
    const eventId = `evt_${id}`;
    const dir = join(dataDir(), 'outbox');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, `event-${id}.ics`);
    const title = action?.content?.subject ?? 'event';
    const start = action?.schedule?.start_at ?? new Date().toISOString();
    const end = action?.schedule?.end_at ?? start;
    const participants = [action?.target?.display_name ?? ''];
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:${eventId}\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${title}\r\nATTENDEE:${participants.join(',')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    writeFileSync(path, ics, 'utf8');
    const latency = Date.now() - startedAt;
    return {
      evidence: { event_id: eventId, ics_path: path },
      usage: { provider: 'outbox', model: null, tokens_in: null, tokens_out: null, cost_usd: null, latency_ms: latency },
    };
  },
};