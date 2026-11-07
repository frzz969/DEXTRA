/**
 * Mock adapters — NON-PROD ONLY, TIDAK terhubung ke getAdapter().
 *
 * Modul ini TIDAK dipakai oleh jalur eksekusi normal: getAdapter() pada
 * execute.ts tidak merujuk mocks.ts sama sekali. Eksekusi nyata memakai adapter
 * outbox/smtp, dengan provider dilaporkan apa adanya oleh adapter
 * ('outbox' saat SMTP_HOST tidak diset, 'smtp' saat terkirim lewat SMTP).
 * Functions di sini hanya helper non-prod yang tidak pernah dipanggil runtime.
 * IDs yang dikembalikan adalah hash lokal (`mock_*`), bukan ID provider.
 * See docs/MONOREPO-MAP.md section 0 for non-prod module list.
 */
export const MOCK_PROVIDER = 'mock' as const;
import { createHash } from 'node:crypto';

function hash8(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

export function mockSendEmail(input: { to: string; subject: string; body: string; attachments?: string[] }): { mock_message_id: string } {
  return { mock_message_id: `msg_${hash8(input.to + input.subject)}` };
}

export function mockCreateCalendarEvent(input: { title: string; start: string; end?: string; tz: string; participants: string[] }): { mock_event_id: string } {
  return { mock_event_id: `evt_${hash8(input.title + input.start)}` };
}

export function mockCreateTask(input: { title: string; assignee: string; due?: string }): { mock_task_id: string } {
  return { mock_task_id: `task_${hash8(input.title + input.assignee)}` };
}
