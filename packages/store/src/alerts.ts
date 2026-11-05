import {
  AlertDeliverySchema,
  AlertSummarySchema,
  type Alert,
  type AlertDelivery,
  type AlertProvider,
  type AlertSummary,
} from '../../contracts/src/index.ts';

import { ensureStoreFiles, readJsonFile, withCrossProcessLock, withFileLock, writeJsonAtomic } from './json-file.ts';
import { getStorePaths } from './paths.ts';

/**
 * Alert deliveries are a JSON array, not an append-only log.
 *
 * The reason is that a delivery has a lifecycle: it is claimed, attempted,
 * retried, and finally settled. An append-only log would need every reader to
 * replay the events to learn the current state, and the dedupe check would have
 * to scan the whole file. Here the current state is the record.
 *
 * The audit log still gets one event per attempt (see `appendAudit`), so the
 * history is not lost — it lives where history belongs.
 */

async function prepare(): Promise<string> {
  await ensureStoreFiles();
  return getStorePaths().alerts;
}

interface RawDeliveries {
  deliveries: AlertDelivery[];
  /** Records that failed schema validation. Reported, never silently dropped. */
  invalid: number;
}

/**
 * Reads deliveries, skipping records that do not validate.
 *
 * A single corrupt record must not make the delivery history unreadable: the
 * dedupe check runs on every dispatch, so one bad line would otherwise disable
 * alerting entirely — a monitoring outage caused by the monitoring code.
 */
async function readDeliveries(file: string): Promise<RawDeliveries> {
  const raw = await readJsonFile<unknown>(file, []);
  if (!Array.isArray(raw)) {
    return { deliveries: [], invalid: 1 };
  }
  const deliveries: AlertDelivery[] = [];
  let invalid = 0;
  for (const entry of raw) {
    const parsed = AlertDeliverySchema.safeParse(entry);
    if (parsed.success) {
      deliveries.push(parsed.data);
    } else {
      invalid += 1;
    }
  }
  return { deliveries, invalid };
}

export async function listAlertDeliveries(limit?: number): Promise<{ deliveries: AlertDelivery[]; invalid: number }> {
  const file = await prepare();
  const { deliveries, invalid } = await readDeliveries(file);
  if (limit !== undefined && limit >= 0) {
    return { deliveries: deliveries.slice(-limit), invalid };
  }
  return { deliveries, invalid };
}

export async function getAlertDelivery(alertId: string): Promise<AlertDelivery | null> {
  const file = await prepare();
  const { deliveries } = await readDeliveries(file);
  return deliveries.find((d) => d.alert.alert_id === alertId) ?? null;
}

/**
 * Claim-then-send, under both locks.
 *
 * The dedupe check and the claim must be one critical section. If two
 * dispatchers both read "no record" and both send, the duplicate suppression
 * the design promises does not exist — and the failure is invisible, because
 * each dispatcher sees a perfectly consistent history of its own.
 *
 * Returns `claimed: false` when an earlier delivery already owns this alert.
 */
export async function claimAlertDelivery(
  alert: Alert,
  provider: AlertProvider,
  now: string,
): Promise<{ claimed: boolean; delivery: AlertDelivery }> {
  const file = await prepare();

  return withFileLock(file, () =>
    withCrossProcessLock(file, async () => {
      const { deliveries } = await readDeliveries(file);
      const existing = deliveries.find((d) => d.alert.alert_id === alert.alert_id);

      if (existing && existing.status !== 'queued') {
        /*
         * `queued` is the only status that can be taken over. It means a claim
         * was written and the process died before the first attempt — no
         * message was sent, so sending now is not a duplicate. Every other
         * status either already reached the provider or was deliberately
         * settled.
         */
        return { claimed: false, delivery: existing };
      }

      const delivery: AlertDelivery = {
        alert,
        status: 'queued',
        provider,
        attempts: existing?.attempts ?? [],
        suppressed_count: existing?.suppressed_count ?? 0,
        first_at: existing?.first_at ?? now,
        last_at: now,
      };

      const next = [...deliveries.filter((d) => d.alert.alert_id !== alert.alert_id), delivery];
      await writeJsonAtomic(file, next);
      return { claimed: true, delivery };
    }),
  );
}

/**
 * Counts one refused dispatch. The message is not touched: it was already
 * accepted (or already failed), and rewriting its status here would erase that.
 */
export async function recordSuppressedDuplicate(alertId: string, now: string): Promise<AlertDelivery | null> {
  const file = await prepare();

  return withFileLock(file, () =>
    withCrossProcessLock(file, async () => {
      const { deliveries } = await readDeliveries(file);
      const existing = deliveries.find((d) => d.alert.alert_id === alertId);
      if (!existing) return null;
      const updated: AlertDelivery = {
        ...existing,
        suppressed_count: existing.suppressed_count + 1,
        last_at: now,
      };
      const next = deliveries.map((d) => (d.alert.alert_id === alertId ? updated : d));
      await writeJsonAtomic(file, next);
      return updated;
    }),
  );
}

/** Replaces the record for this alert. Creates it if it is not there yet. */
export async function saveAlertDelivery(delivery: AlertDelivery): Promise<void> {
  const parsed = AlertDeliverySchema.parse(delivery);
  const file = await prepare();

  await withFileLock(file, () =>
    withCrossProcessLock(file, async () => {
      const { deliveries } = await readDeliveries(file);
      const next = [...deliveries.filter((d) => d.alert.alert_id !== parsed.alert.alert_id), parsed];
      await writeJsonAtomic(file, next);
    }),
  );
}

/**
 * Summary over the whole set, computed before any limit is applied.
 *
 * Same rule as `summarizeExecutions`: computing counts from the page a caller
 * asked for makes the numbers change with page size, which is indistinguishable
 * from the system actually changing.
 */
export function summarizeAlertDeliveries(deliveries: readonly AlertDelivery[]): AlertSummary {
  const byStatus: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let attempts = 0;
  let retried = 0;
  let suppressed = 0;

  for (const delivery of deliveries) {
    byStatus[delivery.status] = (byStatus[delivery.status] ?? 0) + 1;
    byKind[delivery.alert.kind] = (byKind[delivery.alert.kind] ?? 0) + 1;
    byProvider[delivery.provider] = (byProvider[delivery.provider] ?? 0) + 1;
    attempts += delivery.attempts.length;
    retried += delivery.attempts.filter((a) => a.status !== 'accepted_by_provider').length;
    suppressed += delivery.suppressed_count;
  }

  return AlertSummarySchema.parse({
    total: deliveries.length,
    by_status: byStatus,
    by_kind: byKind,
    by_provider: byProvider,
    attempts,
    retried_attempts: retried,
    suppressed_total: suppressed,
  });
}
