"use server";

import { apiWrite, createOfficePlan, type OfficePlan } from "@/lib/api";

export type CreatePlanResult =
  | { ok: true; plan_id: string; request_id: string; status: string }
  | { ok: false; error: string; status?: number };

const ACTION_TYPES = ["send_email", "create_calendar_event", "create_task", "create_meeting_note"];

export async function createOfficePlanAction(input: {
  request_id: string;
  plan_id: string;
  source_title: string;
  intake_text: string;
  action_id: string;
  action_type: string;
  target: string;
  subject: string;
  start: string;
}): Promise<CreatePlanResult> {
  const request_id = input.request_id.trim();
  const plan_id = input.plan_id.trim();
  const action_id = input.action_id.trim();
  const action_type = input.action_type.trim();
  const intake_text = input.intake_text.trim();

  if (request_id.length < 4 || request_id.length > 96) return { ok: false, error: "Request ID wajib 4–96 karakter." };
  if (!plan_id || plan_id.length > 96) return { ok: false, error: "Plan ID wajib diisi (maks 96 karakter)." };
  if (!/^[a-zA-Z0-9._-]+$/.test(action_id)) return { ok: false, error: "Action ID hanya boleh huruf, angka, titik, garis bawah, atau strip." };
  if (!ACTION_TYPES.includes(action_type)) return { ok: false, error: "Tipe tindakan tidak dikenal." };
  if (intake_text.length < 20) return { ok: false, error: "Teks permintaan minimal 20 karakter." };
  if (intake_text.length > 8000) return { ok: false, error: "Teks permintaan maksimal 8000 karakter." };

  let params: Record<string, unknown>;
  if (action_type === "send_email") {
    const to = input.target.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: "Email tujuan tidak valid." };
    if (!input.subject.trim()) return { ok: false, error: "Subjek email wajib diisi." };
    params = { to, subject: input.subject.trim(), body: intake_text };
  } else if (action_type === "create_calendar_event") {
    if (!input.subject.trim()) return { ok: false, error: "Judul acara wajib diisi." };
    if (!input.start) return { ok: false, error: "Waktu mulai wajib diisi." };
    params = { title: input.subject.trim(), start: input.start };
  } else if (action_type === "create_task") {
    if (!input.subject.trim()) return { ok: false, error: "Judul tugas wajib diisi." };
    params = { title: input.subject.trim(), detail: intake_text };
  } else {
    if (!input.subject.trim()) return { ok: false, error: "Judul notulen wajib diisi." };
    params = { title: input.subject.trim(), content: intake_text };
  }

  const result = await createOfficePlan({
    request_id,
    plan_id,
    source: { kind: "web_intake", title: input.source_title.trim() || "Permintaan web" },
    document: { text: intake_text, chars: intake_text.length },
    actions: [{ action_id, action_type, params, source_ref: { origin: "web_intake" } }],
    findings: [],
    validation: { origin: "web_intake" },
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  const plan = result.data as OfficePlan;
  return { ok: true, plan_id: plan.plan_id, request_id: plan.request_id, status: plan.status };
}

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
