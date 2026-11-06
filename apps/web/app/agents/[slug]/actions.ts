"use server";

import { revalidatePath } from "next/cache";
import { updateAgent, type Agent } from "@/lib/api";

export type AgentToggleResult =
  | { ok: true; status: string; is_enabled: boolean }
  | { ok: false; error: string; status?: number };

export async function setAgentEnabled(
  slug: string,
  isEnabled: boolean
): Promise<AgentToggleResult> {
  if (!slug) return { ok: false, error: "Slug agen wajib diisi." };
  const result = await updateAgent(slug, { is_enabled: isEnabled });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  const agent = result.data as Agent;
  revalidatePath("/agents");
  revalidatePath(`/agents/${slug}`);
  return { ok: true, status: agent.status, is_enabled: agent.is_enabled };
}
