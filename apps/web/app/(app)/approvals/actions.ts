"use server";

import { apiWrite } from "@/lib/api";

export type ApprovalActionInput = {
  plan_id: string;
  action_id: string;
  action_type: string;
  params: Record<string, unknown>;
  plan_hash: string;
  decision: "approved" | "rejected" | "revision";
  reason: string;
  ttl_minutes: number;
};

export type ApprovalActionResult =
  | { ok: true; id: string; decision: string; mandate_id: string | null }
  | { ok: false; error: string; status?: number };

/** Setujui/tolak satu tindakan pada plan (endpoint resmi office-agent). */
export async function approvePlanAction(
  planId: string,
  actionId: string,
  decision: "approved" | "rejected",
  reason: string,
  ttlMinutes = 30
): Promise<ApprovalActionResult> {
  const plan = planId.trim();
  const action = actionId.trim();
  if (!plan || !action) return { ok: false, error: "Plan ID dan Action ID wajib diisi." };
  const result = await apiWrite<{ approval_id?: string; decision?: string; mandate_id?: string | null }>(
    "POST",
    `/office-agent/plans/${encodeURIComponent(plan)}/actions/${encodeURIComponent(action)}/approve`,
    { decision, reason: reason.trim(), ttl_minutes: ttlMinutes }
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return {
    ok: true,
    id: result.data?.approval_id ?? "",
    decision: result.data?.decision ?? decision,
    mandate_id: result.data?.mandate_id ?? null,
  };
}

export async function submitApprovalChallenge(input: ApprovalActionInput): Promise<ApprovalActionResult> {
  // Wewenang diambil ApiWrite dari cookie sesi bila ada; selain itu Bearer env.
  const result = await apiWrite<{ id?: string; decision?: string; mandate_id?: string | null }>(
    "POST",
    "/approvals",
    input
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return {
    ok: true,
    id: result.data?.id ?? "",
    decision: result.data?.decision ?? input.decision,
    mandate_id: result.data?.mandate_id ?? null
  };
}
