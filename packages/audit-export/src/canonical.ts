import { createHash } from 'node:crypto';

import type { AuditEvent } from '../../contracts/src/audit.ts';

/**
 * Canonical payload for hashing an audit event.
 *
 * This is a deliberate COPY of the function in `packages/store/src/repository.ts`,
 * not an import. The verifier is supposed to be usable on an export that came
 * from another machine, and an import would drag the whole store (filesystem
 * layout, `DEXTRA_DATA_DIR`, zod schemas) along with it.
 *
 * A copy is only safe if it is provably identical, so
 * `tests/canonical-parity.test.ts` compares this implementation against the
 * source one over a corpus that covers every optional field, empty detail
 * objects, unicode, and unsorted detail keys. If someone changes one side and
 * not the other, that test fails — which is the entire reason it exists.
 *
 * The field list is explicit and ordered. `JSON.stringify(event)` would depend
 * on property insertion order, so an event rebuilt by a different code path
 * would hash differently and the chain would appear broken for no reason.
 */
export function canonicalAuditPayload(event: AuditEvent, prevHash: string | null): string {
  return JSON.stringify([
    prevHash,
    event.event_id,
    event.at,
    event.type,
    event.actor,
    event.plan_id ?? null,
    event.mandate_id ?? null,
    event.action_id ?? null,
    event.plan_hash ?? null,
    event.reason_code ?? null,
    Object.keys(event.detail)
      .sort()
      .map((key) => [key, event.detail[key]]),
  ]);
}

export function auditHash(event: AuditEvent, prevHash: string | null): string {
  return createHash('sha256').update(canonicalAuditPayload(event, prevHash)).digest('hex');
}
