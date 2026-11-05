"use server";

import { apiWrite } from "@/lib/api";

export type ApproveActionResult =
  | { ok: true; approval_id: string; mandate_id: string | null; decision: string }
  | { ok: false; error: string; status?: number };

export async function approveOfficeAction(input: {
  plan_id: string;
  action_id: string;
  decision: "approved" | "rejected";
  reason?: string;
  ttl_minutes?: number;
}): Promise<ApproveActionResult> {
  const { plan_id, action_id, decision, reason = "", ttl_minutes = 30 } = input;
  if (!plan_id || !action_id) return { ok: false, error: "plan_id dan action_id wajib diisi." };
  const path = `/office-agent/plans/${encodeURIComponent(plan_id)}/actions/${encodeURIComponent(action_id)}/approve`;
  const result = await apiWrite<{ approval_id?: string; mandate_id?: string | null; decision?: string }>(
    "POST",
    path,
    { reason, ttl_minutes, decision }
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return {
    ok: true,
    approval_id: result.data?.approval_id ?? "",
    mandate_id: result.data?.mandate_id ?? null,
    decision: result.data?.decision ?? decision
  };
}
