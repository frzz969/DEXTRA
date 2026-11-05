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
