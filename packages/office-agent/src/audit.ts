import { randomUUID } from 'node:crypto';

import type { AuditActor, AuditEventType, ErrorCode } from '../../contracts/src/index.ts';
import { appendAudit } from '../../store/src/index.ts';

/**
 * Audit Office Agent menulis ke audit chain DEXTRA yang sama.
 *
 * Tidak ada `office_audit.jsonl`, tidak ada rantai kedua, tidak ada verifier
 * kedua. Kalau Office Agent punya catatan sendiri, pertanyaan "apa yang
 * terjadi" akan punya dua jawaban yang bisa berbeda — dan itu persis yang
 * ingin dicegah produk ini.
 */

let sequence = 0;

export function nextOfficeEventId(now = Date.now()): string {
  sequence += 1;
  return `evt_${now}_${sequence}`;
}

export interface OfficeAuditInput {
  type: AuditEventType;
  actor: AuditActor;
  at: string;
  plan_id?: string;
  plan_hash?: string;
  action_id?: string;
  reason_code?: ErrorCode;
  detail: Record<string, string>;
}

export async function recordOfficeAudit(input: OfficeAuditInput): Promise<string> {
  const event_id = nextOfficeEventId();
  await appendAudit({
    event_id,
    at: input.at,
    type: input.type,
    actor: input.actor,
    ...(input.plan_id === undefined ? {} : { plan_id: input.plan_id }),
    ...(input.plan_hash === undefined ? {} : { plan_hash: input.plan_hash }),
    ...(input.action_id === undefined ? {} : { action_id: input.action_id }),
    ...(input.reason_code === undefined ? {} : { reason_code: input.reason_code }),
    detail: input.detail,
  } as never);
  return event_id;
}

/** Id sesi klarifikasi. Stabil per request supaya retry tidak menggandakan sesi. */
export function newSessionId(requestId: string): string {
  const suffix = requestId.replace(/^req_/, '');
  return `cls_${suffix.length > 0 ? suffix : randomUUID().slice(0, 8)}`;
}
