"use server";
import { redirect } from "next/navigation";
import { apiWrite } from "@/lib/api";

export async function transitionTask(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const toStatus = String(formData.get("to_status") ?? "");
  if (!taskId || !toStatus) redirect("/board?err=Data tidak lengkap.");
  const res = await apiWrite("POST", `/tasks/${taskId}/transition`, { to_status: toStatus });
  redirect(res.ok ? `/board?msg=${encodeURIComponent(`Tugas ${taskId} → ${toStatus}`)}` : `/board?err=${encodeURIComponent(res.error)}`);
}
