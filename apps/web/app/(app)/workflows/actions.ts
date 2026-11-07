"use server";

import { revalidatePath } from "next/cache";
import { startWorkflowRun, resumeWorkflowRun, type WorkflowRun } from "@/lib/api";

export type RunActionResult =
  | { ok: true; id: string; status: string }
  | { ok: false; error: string; status?: number };

export async function startRun(workflowId: string): Promise<RunActionResult> {
  if (!workflowId) return { ok: false, error: "Workflow wajib dipilih." };
  const key = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const result = await startWorkflowRun(workflowId, key);
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidatePath("/workflows/runs");
  const run = result.data as WorkflowRun;
  return { ok: true, id: run.id, status: run.status };
}

export async function resumeRun(runId: string): Promise<RunActionResult> {
  if (!runId) return { ok: false, error: "Run wajib dipilih." };
  const result = await resumeWorkflowRun(runId);
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidatePath("/workflows/runs");
  const run = result.data as WorkflowRun;
  return { ok: true, id: run.id, status: run.status };
}
