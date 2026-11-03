import { z } from 'zod';
import { getStorePaths } from './paths.ts';
import { readJsonFile } from './json-file.ts';
import { PrincipalSchema } from '../../contracts/src/identity.ts';
import type { Principal } from '../../contracts/src/identity.ts';

const RosterSchema = z.array(PrincipalSchema);

/** Reads the principal roster. Returns [] if missing/empty/invalid — never invents. */
export async function listPrincipals(): Promise<Principal[]> {
  const paths = getStorePaths();
  const raw = await readJsonFile<unknown>(paths.principals, []);
  const parsed = RosterSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export async function getPrincipal(principalId: string): Promise<Principal | null> {
  const roster = await listPrincipals();
  return roster.find((p) => p.principal_id === principalId) ?? null;
}
