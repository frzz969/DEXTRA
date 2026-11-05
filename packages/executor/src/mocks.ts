/**
 * Mock adapters — NON-PROD ONLY. Label jujur: provider:'mock'.
 *
 * PROVIDER LABEL: provider:'mock' (see executor execution-usage; execute.ts
 * sets usage.provider = 'mock' for every execution). These functions NEVER
 * contact an external system. IDs returned are local hashes (`mock_*`),
 * not provider IDs. Any UI showing these results MUST label them as
 * mock/demo. Production adapters must replace this module.
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
