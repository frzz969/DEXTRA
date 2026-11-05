"use server";

import { apiWrite } from "@/lib/api";

export type RevokeResult =
  | { ok: true; revoked: true }
  | { ok: false; error: string; status?: number };

export async function revokeMandate(mandateId: string, reason: string): Promise<RevokeResult> {
  if (!reason.trim()) {
    return { ok: false, error: "Alasan cabut wajib diisi." };
  }
  const result = await apiWrite("POST", `/mandates/${encodeURIComponent(mandateId)}/revoke`, {
    reason: reason.trim()
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, revoked: true };
}
