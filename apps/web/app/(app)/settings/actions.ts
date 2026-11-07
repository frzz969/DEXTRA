"use server";

import { apiWrite } from "@/lib/api";

/**
 * Reset berguard. Backend menuntut dua hal sekaligus
 * (backend/dextra/modules/data_management/router.py:306-331):
 *
 *   1. capability `manage_integrations` — kalau tidak ada, 403;
 *   2. `confirm` sama dengan slug tenant dan `scope` = "conversations" — kalau
 *      tidak, 422.
 *
 * Tidak ada scope lain yang didukung, jadi UI tidak menawarkan pilihan scope:
 * menampilkan opsi yang pasti ditolak 422 hanya akan menyesatkan.
 */

export type ResetOutcome =
  | { ok: true; deleted_conversations: number; deleted_messages: number }
  | { ok: false; error: string; status?: number };

type ResetResponse = {
  tenant_id?: string;
  scope?: string;
  deleted_conversations?: number;
  deleted_messages?: number;
};

export async function resetConversations(confirm: string): Promise<ResetOutcome> {
  const trimmed = confirm.trim();
  if (trimmed === "") {
    return { ok: false, error: "Konfirmasi slug tenant wajib diisi." };
  }

  const result = await apiWrite<ResetResponse>("POST", "/data/reset", {
    confirm: trimmed,
    scope: "conversations"
  });

  if (!result.ok) {
    return { ok: false, error: result.error, status: result.status };
  }

  return {
    ok: true,
    deleted_conversations: result.data?.deleted_conversations ?? 0,
    deleted_messages: result.data?.deleted_messages ?? 0
  };
}
