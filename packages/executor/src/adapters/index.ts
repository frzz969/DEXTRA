type Plan = any;
type ExecutionUsage = any;
import { emailAdapter } from './email.ts';
import { calendarAdapter } from './calendar.ts';
import { taskAdapter } from './task.ts';

export interface AdapterResult {
  evidence: Record<string, string>;
  usage: ExecutionUsage;
}

export interface Adapter {
  name: string;
  run(action: any, plan: Plan | null): Promise<AdapterResult>;
}

export function getAdapter(actionType: string): Adapter | null {
  if (actionType === 'send_email' || actionType === 'send_message') return emailAdapter as Adapter;
  if (actionType === 'create_calendar_event') return calendarAdapter as Adapter;
  if (actionType === 'create_task') return taskAdapter as Adapter;
  return null;
}

export { emailAdapter, calendarAdapter, taskAdapter };