import type { ActionResult, Approval, AuditEvent, Mandate, AlertProvider } from '../../contracts/src/index.ts';
import { listApprovals, listAudit, listExecutions, listMandates } from '../../store/src/index.ts';

import { detectAlerts, type DetectInput } from './detect.ts';
import { dispatchAlert, type DispatchOutcome } from './dispatch.ts';
import type { AlertTransport } from './transport.ts';

/**
 * One scan: read the store, decide what is worth saying, say it.
 *
 * The read is a snapshot, not a transaction. Two things can change between the
 * read and the send, and that is accepted: an alert describes a fact that was
 * true when it was detected. Pretending otherwise would need a lock across the
 * whole store for the duration of a network call.
 *
 * Dispatching is sequential. Sending in parallel would be faster and would also
 * be the fastest way to hit the provider's rate limit — the alerts most worth
 * sending are exactly the ones that arrive in a burst.
 */

export interface ScanInput {
  executions: readonly ActionResult[];
  mandates: readonly Mandate[];
  approvals: readonly Approval[];
  audit: readonly AuditEvent[];
}

export interface ScanOptions {
  transport: AlertTransport;
  chatId: string;
  now?: Date;
  /** Injected in tests so a scan can run without touching the store. */
  load?: () => Promise<ScanInput>;
  detect?: Omit<DetectInput, 'executions' | 'mandates' | 'approvals' | 'audit' | 'now'>;
  audit?: Parameters<typeof dispatchAlert>[1]['audit'];
  sleep?: Parameters<typeof dispatchAlert>[1]['sleep'];
  jitter?: Parameters<typeof dispatchAlert>[1]['jitter'];
}

export interface ScanResult {
  provider: AlertProvider;
  detected: number;
  accepted: number;
  suppressed: number;
  failed: number;
  /** Alerts whose dispatch threw. Reported, not swallowed. */
  errored: number;
  outcomes: DispatchOutcome[];
}

async function defaultLoad(): Promise<ScanInput> {
  const [executions, mandates, approvals, auditResult] = await Promise.all([
    listExecutions(),
    listMandates(),
    listApprovals(),
    listAudit(),
  ]);
  return { executions, mandates, approvals, audit: auditResult };
}

export async function scanAndDispatch(options: ScanOptions): Promise<ScanResult> {
  const load = options.load ?? defaultLoad;
  const now = options.now ?? new Date();

  const input = await load();
  const alerts = detectAlerts({
    executions: input.executions,
    mandates: input.mandates,
    approvals: input.approvals,
    audit: input.audit,
    now,
    ...options.detect,
  });

  const result: ScanResult = {
    provider: options.transport.name,
    detected: alerts.length,
    accepted: 0,
    suppressed: 0,
    failed: 0,
    errored: 0,
    outcomes: [],
  };

  for (const alert of alerts) {
    try {
      const outcome = await dispatchAlert(alert, {
        transport: options.transport,
        chatId: options.chatId,
        now: () => now,
        ...(options.audit !== undefined ? { audit: options.audit } : {}),
        ...(options.sleep !== undefined ? { sleep: options.sleep } : {}),
        ...(options.jitter !== undefined ? { jitter: options.jitter } : {}),
      });
      result.outcomes.push(outcome);
      if (outcome.status === 'accepted_by_provider') result.accepted += 1;
      else if (outcome.status === 'suppressed_duplicate') result.suppressed += 1;
      else result.failed += 1;
    } catch {
      /*
       * One alert that cannot be dispatched must not stop the scan: the next
       * alert may be the critical one. The failure is counted here and the
       * attempt, if it happened at all, is already in the audit log.
       */
      result.errored += 1;
    }
  }

  return result;
}
