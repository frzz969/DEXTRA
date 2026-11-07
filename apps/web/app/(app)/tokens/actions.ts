"use server";

import { revalidatePath } from "next/cache";
import {
  createServiceAccount,
  createToken,
  revokeServiceAccount,
  revokeToken,
  rotateToken,
} from "@/lib/api";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

function revalidate() {
  revalidatePath("/tokens");
}

export async function createTokenAction(input: {
  name: string;
  scopes: string[];
  serviceAccountId?: string;
  expiresInDays?: number;
}): Promise<ActionResult<{ id: string; secret: string; note: string }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama token wajib diisi." };
  if (input.scopes.length === 0) return { ok: false, error: "Pilih minimal satu scope." };
  const result = await createToken({
    name,
    scopes: input.scopes,
    service_account_id: input.serviceAccountId || undefined,
    expires_in_days: input.expiresInDays,
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidate();
  return {
    ok: true,
    data: {
      id: result.data.id,
      secret: result.data.token,
      note: result.data.note ?? "Simpan token ini sekarang. Server hanya menyimpan hash-nya.",
    },
  };
}

export async function revokeTokenAction(
  tokenId: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  const id = tokenId.trim();
  if (!id) return { ok: false, error: "Token ID wajib diisi." };
  const result = await revokeToken(id, reason.trim());
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidate();
  return { ok: true, data: { id } };
}

export async function rotateTokenAction(
  tokenId: string,
  expiresInDays?: number
): Promise<ActionResult<{ id: string; secret: string; note: string }>> {
  const id = tokenId.trim();
  if (!id) return { ok: false, error: "Token ID wajib diisi." };
  const result = await rotateToken(id, expiresInDays);
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidate();
  return {
    ok: true,
    data: {
      id: result.data.id,
      secret: result.data.token,
      note: result.data.note ?? "Token lama sudah dicabut. Simpan token baru sekarang.",
    },
  };
}

export async function createServiceAccountAction(input: {
  name: string;
  kind: string;
  description: string;
  scopes: string[];
}): Promise<ActionResult<{ id: string }>> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nama service account wajib diisi." };
  if (!input.kind) return { ok: false, error: "Kind wajib dipilih." };
  if (input.scopes.length === 0) return { ok: false, error: "Pilih minimal satu scope." };
  const result = await createServiceAccount({
    name,
    kind: input.kind,
    description: input.description.trim(),
    scopes: input.scopes,
  });
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidate();
  return { ok: true, data: { id: result.data.id } };
}

export async function revokeServiceAccountAction(
  accountId: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  const id = accountId.trim();
  if (!id) return { ok: false, error: "Service account ID wajib diisi." };
  const result = await revokeServiceAccount(id, reason.trim());
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  revalidate();
  return { ok: true, data: { id } };
}
