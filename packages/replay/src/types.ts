import type { AuditEvent } from '../../contracts/src/index.ts';

export interface ReplayStep {
  at: string;
  type: string;
  actor: string;
  subject: string;
  reason_code?: string;
  detail: Record<string, string>;
}

export interface DecisionReplay {
  plan_id: string;
  plan_hash: string;
  mandate_id: string | null;
  execution_id: string | null;
  steps: ReplayStep[];
  outcome: 'executed' | 'blocked' | 'revoked' | 'pending' | 'unknown';
}
