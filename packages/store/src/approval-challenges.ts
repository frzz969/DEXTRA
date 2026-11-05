import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { ensureStoreFiles, readJsonFile, withFileLock, writeJsonAtomic } from './json-file.ts';
import { getStorePaths } from './paths.ts';

/**
 * One-time approval challenges (finding D-04).
 *
 * Before this, `submit_approval` accepted any string of eight characters as an
 * approval token, and the dashboard minted it client-side (`apt_<timestamp>`).
 * The token therefore proved nothing: it was not issued by the server, could be
 * reused indefinitely, and had no expiry. "Approval token is required" looked
 * like a control in the schema while enforcing nothing.
 *
 * A challenge is now created by the server for one (plan, plan_hash, approver)
 * triple. Its code is printed to the server terminal and stored only as a
 * SHA-256 hash, so reading the data directory does not reveal a usable code.
 * Consuming it is a single locked read-modify-write: the same challenge cannot
 * be used twice even if two approvals race.
 */

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export const ApprovalChallengeSchema = z
  .object({
    challenge_id: z.string().min(1),
    plan_id: z.string().min(1),
    plan_hash: z.string().min(1),
    approver_principal_id: z.string().min(1),
    code_hash: z.string().min(1),
    created_at: z.string().min(1),
    expires_at: z.string().min(1),
    consumed_at: z.string().nullable(),
  })
  .strict();

export type ApprovalChallenge = z.infer<typeof ApprovalChallengeSchema>;

export interface CreatedChallenge {
  challenge_id: string;
  /** `apc_<id>.<code>` — the only value `submit_approval` accepts. */
  approval_token: string;
  /** Printed by the caller to the server terminal; never persisted in clear. */
  code: string;
  expires_at: string;
}

export type ChallengeRejection =
  | 'APPROVAL_CHALLENGE_MISSING'
  | 'APPROVAL_CHALLENGE_EXPIRED'
  | 'APPROVAL_CHALLENGE_CONSUMED'
  | 'APPROVAL_CHALLENGE_MISMATCH';

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function digestEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function parseToken(token: string): { challengeId: string; code: string } | null {
  const trimmed = token.trim();
  const separator = trimmed.indexOf('.');
  if (separator <= 0 || separator === trimmed.length - 1) return null;
  const challengeId = trimmed.slice(0, separator);
  const code = trimmed.slice(separator + 1);
  if (!/^apc_[A-Za-z0-9]+$/.test(challengeId)) return null;
  if (!/^[0-9]{6}$/.test(code)) return null;
  return { challengeId, code };
}

async function readChallenges(file: string): Promise<ApprovalChallenge[]> {
  const raw = await readJsonFile<unknown>(file, []);
  if (!Array.isArray(raw)) throw new Error(`approval challenges file is not an array: ${file}`);
  return raw.map((entry) => ApprovalChallengeSchema.parse(entry));
}

export interface CreateChallengeInput {
  planId: string;
  planHash: string;
  approverPrincipalId: string;
  ttlMs?: number;
  now?: Date;
}

export async function createApprovalChallenge(input: CreateChallengeInput): Promise<CreatedChallenge> {
  await ensureStoreFiles();
  const file = getStorePaths().approvalChallenges;
  const ttl = input.ttlMs ?? DEFAULT_TTL_MS;
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('approval challenge ttl must be positive');
  const now = input.now ?? new Date();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge: ApprovalChallenge = {
    challenge_id: `apc_${randomBytes(12).toString('hex')}`,
    plan_id: input.planId,
    plan_hash: input.planHash,
    approver_principal_id: input.approverPrincipalId,
    code_hash: hash(code),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + ttl).toISOString(),
    consumed_at: null,
  };

  await withFileLock(file, async () => {
    const challenges = await readChallenges(file);
    // Retain a bounded history: consumed/expired entries are evidence, but the
    // file must not grow without limit. Keep the newest 500.
    const kept = challenges.slice(-499);
    kept.push(challenge);
    await writeJsonAtomic(file, kept);
  });

  return {
    challenge_id: challenge.challenge_id,
    approval_token: `${challenge.challenge_id}.${code}`,
    code,
    expires_at: challenge.expires_at,
  };
}

export interface ConsumeChallengeInput {
  token: string;
  planId: string;
  planHash: string;
  approverPrincipalId: string;
  now?: Date;
}

export type ConsumeChallengeResult =
  | { ok: true; challenge: ApprovalChallenge }
  | { ok: false; code: ChallengeRejection; message: string };

/**
 * Validates and consumes a challenge atomically. A rejected attempt does not
 * consume the challenge, except that an expired or already-used one stays
 * unusable forever.
 */
export async function consumeApprovalChallenge(input: ConsumeChallengeInput): Promise<ConsumeChallengeResult> {
  await ensureStoreFiles();
  const parsed = parseToken(input.token);
  if (parsed === null) {
    return {
      ok: false,
      code: 'APPROVAL_CHALLENGE_MISSING',
      message: 'Approval token must be a server-issued challenge (apc_<id>.<6 digits>).',
    };
  }

  const file = getStorePaths().approvalChallenges;
  const now = input.now ?? new Date();

  return withFileLock(file, async () => {
    const challenges = await readChallenges(file);
    const index = challenges.findIndex((entry) => entry.challenge_id === parsed.challengeId);
    if (index === -1) {
      return {
        ok: false as const,
        code: 'APPROVAL_CHALLENGE_MISSING' as const,
        message: 'Approval challenge was not issued by this server or no longer exists.',
      };
    }
    const challenge = challenges[index]!;

    if (challenge.consumed_at !== null) {
      return {
        ok: false as const,
        code: 'APPROVAL_CHALLENGE_CONSUMED' as const,
        message: 'Approval challenge has already been used.',
      };
    }
    if (Date.parse(challenge.expires_at) <= now.getTime()) {
      return {
        ok: false as const,
        code: 'APPROVAL_CHALLENGE_EXPIRED' as const,
        message: 'Approval challenge has expired; request a new one.',
      };
    }
    if (
      challenge.plan_id !== input.planId ||
      challenge.plan_hash !== input.planHash ||
      challenge.approver_principal_id !== input.approverPrincipalId
    ) {
      return {
        ok: false as const,
        code: 'APPROVAL_CHALLENGE_MISMATCH' as const,
        message: 'Approval challenge is bound to a different plan, plan hash, or approver.',
      };
    }
    if (!digestEquals(challenge.code_hash, hash(parsed.code))) {
      return {
        ok: false as const,
        code: 'APPROVAL_CHALLENGE_MISMATCH' as const,
        message: 'Approval code does not match the issued challenge.',
      };
    }

    const consumed: ApprovalChallenge = { ...challenge, consumed_at: now.toISOString() };
    challenges[index] = consumed;
    await writeJsonAtomic(file, challenges);
    return { ok: true as const, challenge: consumed };
  });
}

export async function listApprovalChallenges(): Promise<ApprovalChallenge[]> {
  await ensureStoreFiles();
  return readChallenges(getStorePaths().approvalChallenges);
}
