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

export type ExecuteResult =
  | { ok: true; execution_id: string; status: string }
  | { ok: false; error: string; status?: number };

/** Eksekusi satu mandate via POST /executions (backend :8000). */
export async function executeMandate(input: {
  mandate_id: string;
  action_id: string;
  action_type: string;
  params: Record<string, unknown>;
}): Promise<ExecuteResult> {
  if (!input.mandate_id.trim() || !input.action_id.trim() || !input.action_type.trim()) {
    return { ok: false, error: "Mandate ID, action ID, dan action type wajib diisi." };
  }
  const result = await apiWrite<{ id?: string; status?: string }>("POST", "/executions", {
    mandate_id: input.mandate_id.trim(),
    action_id: input.action_id.trim(),
    action_type: input.action_type.trim(),
    params: input.params ?? {},
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return {
    ok: true,
    execution_id: result.data?.id ?? "",
    status: result.data?.status ?? "",
  };
}
