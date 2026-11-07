"use server";

import { revokeServiceAccount } from "@/lib/api";

export type RevokeResult = { ok: true; tokens_revoked: number } | { ok: false; error: string; status?: number };

export async function revokeServiceAccountAction(input: { id: string; reason: string }): Promise<RevokeResult> {
  const id = input.id.trim();
  if (!id) return { ok: false, error: "ID service account wajib diisi." };
  const result = await revokeServiceAccount(id, input.reason.trim().slice(0, 200) || "revoked_by_user");
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  const data = result.data as unknown as { tokens_revoked?: number };
  return { ok: true, tokens_revoked: data.tokens_revoked ?? 0 };
}
