"use server";

import { apiWrite } from "@/lib/api";

export type EvaluateResult =
  | { ok: true; decision: string; reason_code: string; detail: string }
  | { ok: false; error: string; status?: number };

export async function evaluatePolicy(input: {
  action_type: string;
  recipient_count: number;
  bulk_threshold: number;
  is_holiday: boolean;
  contains_injection: boolean;
  policy_slug: string;
}): Promise<EvaluateResult> {
  const actionType = input.action_type.trim();
  if (!actionType) return { ok: false, error: "Tipe aksi wajib diisi." };
  const result = await apiWrite<{ decision?: string; reason_code?: string; detail?: string }>(
    "POST",
    "/policies/evaluate",
    {
      action_type: actionType,
      recipient_count: input.recipient_count,
      bulk_threshold: input.bulk_threshold,
      is_holiday: input.is_holiday,
      contains_injection: input.contains_injection,
      ...(input.policy_slug.trim() ? { policy_slug: input.policy_slug.trim() } : {}),
    }
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return {
    ok: true,
    decision: result.data?.decision ?? "—",
    reason_code: result.data?.reason_code ?? "—",
    detail: result.data?.detail ?? "",
  };
}
