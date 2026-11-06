"use server";

import { apiWrite } from "@/lib/api";

export type RevokeSessionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status?: number };

export async function revokeSession(sessionId: string): Promise<RevokeSessionResult> {
  const id = sessionId.trim();
  if (!id) return { ok: false, error: "Session ID wajib diisi." };
  const result = await apiWrite<{ revoked?: boolean; id?: string }>(
    "POST",
    `/security/sessions/${encodeURIComponent(id)}/revoke`
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, id: result.data?.id ?? id };
}
