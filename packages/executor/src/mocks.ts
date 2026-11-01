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
