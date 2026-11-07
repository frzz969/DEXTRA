"use server";

import { revalidatePath } from "next/cache";
import { setSkillStatus, type SkillDetail } from "@/lib/api";

export type SkillStatusResult =
  | { ok: true; status: string }
  | { ok: false; error: string; status?: number };

export async function changeSkillStatus(
  slug: string,
  status: string
): Promise<SkillStatusResult> {
  if (!slug) return { ok: false, error: "Slug skill wajib diisi." };
  if (!["active", "disabled", "deprecated"].includes(status)) {
    return { ok: false, error: "Status tidak dikenal." };
  }
  const result = await setSkillStatus(slug, status);
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidatePath("/skills");
  revalidatePath(`/skills/${slug}`);
  return { ok: true, status: (result.data as SkillDetail).status };
}
