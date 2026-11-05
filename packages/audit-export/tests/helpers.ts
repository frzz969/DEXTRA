import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AuditEvent } from '../../contracts/src/audit.ts';
import { auditHash } from '../src/canonical.ts';

export async function tempDir(prefix = 'dextra-export-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

/** An event with no hash yet, so the caller decides whether it joins the chain. */
export function bareEvent(index: number, overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    event_id: `evt_${index}`,
    at: `2026-11-0${(index % 9) + 1}T0${index % 10}:00:00.000Z`,
    type: 'plan_created',
    actor: 'agent',
    detail: { n: String(index) },
    ...overrides,
  } as AuditEvent;
}

/** Adds `prev_hash`/`hash` the same way `appendAudit` does. */
export function chain(events: AuditEvent[]): AuditEvent[] {
  let prev: string | null = null;
  return events.map((event) => {
    const hash = auditHash(event, prev);
    const chained: AuditEvent = { ...event, prev_hash: prev, hash };
    prev = hash;
    return chained;
  });
}

export async function writeLog(dir: string, lines: string[], name = 'audit.jsonl'): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, lines.length === 0 ? '' : `${lines.join('\n')}\n`, 'utf8');
  return path;
}

export async function writeEvents(dir: string, events: AuditEvent[], name = 'audit.jsonl'): Promise<string> {
  return writeLog(dir, events.map((event) => JSON.stringify(event)), name);
}

export async function writeCheckpoint(dir: string, eventCount: number, headHash: string): Promise<string> {
  const path = join(dir, 'audit.checkpoint.json');
  await writeFile(
    path,
    JSON.stringify({ event_count: eventCount, head_hash: headHash, at: '2026-11-04T00:00:00.000Z' }),
    'utf8',
  );
  return path;
}
