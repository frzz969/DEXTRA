"use server";

import { apiWrite } from "@/lib/api";

export type GateResult =
  | { ok: true; status: string }
  | { ok: false; error: string; status?: number };

export async function approveGate(runId: string, stepId: string, note = ""): Promise<GateResult> {
  if (!runId || !stepId) return { ok: false, error: "run_id dan step_id wajib diisi." };
  const path = `/workflows/runs/${encodeURIComponent(runId)}/gates/${encodeURIComponent(stepId)}/approve`;
  const result = await apiWrite<{ status?: string }>("POST", path, { note });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, status: result.data?.status ?? "running" };
}
