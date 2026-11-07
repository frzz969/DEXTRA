"use server";

import { apiWrite, authHeaders } from "@/lib/api";
import { getSetCookies, storeBackendCookies } from "./cookies";

/**
 * Aksi akun. Semua memanggil endpoint nyata di backend/dextra/modules/auth/router.py;
 * tidak ada yang mensimulasikan hasil.
 *
 * Endpoint akun menuntut `auth_kind == "session"` (cookie httpOnly), jadi
 * pemanggil dengan token gateway akan menerima 400/401. Pesan penolakan itu
 * diteruskan apa adanya — UI menampilkannya sebagai keadaan "memerlukan sesi",
 * bukan menyembunyikannya.
 */

const API_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";

export type ActionResult<T> =
  | { ok: true; data: T; sessionRotated: boolean }
  | { ok: false; error: string; status?: number };

type JsonRecord = Record<string, unknown>;

function detailOf(parsed: JsonRecord | null, status: number): string {
  const detail = parsed?.detail;
  if (typeof detail === "string" && detail.trim() !== "") return detail;
  return `API menolak permintaan (HTTP ${status}).`;
}

/**
 * POST JSON dengan wewenang pemanggil, sekaligus menyimpan cookie hasil
 * rotasi sesi. Dipakai hanya oleh endpoint yang merotasi sesi.
 */
async function postJson<T>(path: string, body: unknown): Promise<ActionResult<T>> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
    return { ok: false, error: "DEXTRA_API_TOKEN belum diisi; tindakan tidak dijalankan." };
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }

  // Cookie rotasi harus disimpan sebelum apa pun yang bisa melempar.
  const sessionRotated = await storeBackendCookies(getSetCookies(response.headers));

  const text = await response.text();
  let parsed: JsonRecord | null = null;
  if (text) {
    try {
      const value = JSON.parse(text) as unknown;
      parsed = typeof value === "object" && value !== null ? (value as JsonRecord) : null;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    return { ok: false, error: detailOf(parsed, response.status), status: response.status };
  }

  return { ok: true, data: (parsed ?? {}) as T, sessionRotated };
}

/* ---------------- Sesi ---------------- */

export type RevokeResult = { ok: true; id: string } | { ok: false; error: string; status?: number };

export async function revokeOwnSession(sessionId: string): Promise<RevokeResult> {
  const id = sessionId.trim();
  if (id === "") return { ok: false, error: "ID sesi kosong." };
  const result = await apiWrite<{ revoked?: boolean; id?: string }>(
    "POST",
    `/auth/sessions/${encodeURIComponent(id)}/revoke`
  );
  if (!result.ok) return { ok: false, error: result.error, status: result.status };
  return { ok: true, id: result.data?.id ?? id };
}

export type RevokeOthersResult = {
  ok: boolean;
  revoked: number;
  failed: { id: string; error: string }[];
};

/**
 * "Cabut semua sesi lain" tidak punya endpoint borongan: yang ada hanya
 * `POST /auth/sessions/{id}/revoke` per sesi (auth/router.py:859). Jadi aksi ini
 * memanggil endpoint itu berulang untuk setiap ID yang diberikan, dan
 * melaporkan berapa yang berhasil — bukan mengklaim semua tercabut.
 */
export async function revokeOtherSessions(ids: string[]): Promise<RevokeOthersResult> {
  let revoked = 0;
  const failed: { id: string; error: string }[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (id === "") continue;
    const result = await apiWrite<{ revoked?: boolean }>(
      "POST",
      `/auth/sessions/${encodeURIComponent(id)}/revoke`
    );
    if (result.ok) revoked += 1;
    else failed.push({ id, error: result.error });
  }
  return { ok: failed.length === 0, revoked, failed };
}

/* ---------------- MFA ---------------- */

export type EnrollResult =
  | { ok: true; secret: string; otpauth_uri: string; note: string }
  | { ok: false; error: string; status?: number };

export async function enrollMfa(): Promise<EnrollResult> {
  const result = await postJson<{ secret?: string; otpauth_uri?: string; note?: string }>(
    "/auth/mfa/enroll",
    {}
  );
  if (!result.ok) return result;
  return {
    ok: true,
    secret: result.data.secret ?? "",
    otpauth_uri: result.data.otpauth_uri ?? "",
    note: result.data.note ?? ""
  };
}

export type MfaActiveResult = { ok: true; mfa_enabled: boolean; sessionRotated: boolean } | { ok: false; error: string; status?: number };

export async function activateMfa(code: string): Promise<MfaActiveResult> {
  const trimmed = code.trim();
  if (!/^\d{6,10}$/.test(trimmed)) {
    return { ok: false, error: "Kode harus 6–10 digit angka." };
  }
  const result = await postJson<{ active?: boolean; mfa_enabled?: boolean }>("/auth/mfa/activate", {
    code: trimmed
  });
  if (!result.ok) return result;
  return { ok: true, mfa_enabled: result.data.mfa_enabled ?? false, sessionRotated: result.sessionRotated };
}

export async function disableMfa(password: string, code: string): Promise<MfaActiveResult> {
  const trimmedCode = code.trim();
  if (password === "") return { ok: false, error: "Password wajib diisi." };
  if (!/^\d{6,10}$/.test(trimmedCode)) return { ok: false, error: "Kode harus 6–10 digit angka." };

  const result = await postJson<{ active?: boolean; mfa_enabled?: boolean }>("/auth/mfa/disable", {
    password,
    code: trimmedCode
  });
  if (!result.ok) return result;
  return { ok: true, mfa_enabled: result.data.mfa_enabled ?? false, sessionRotated: result.sessionRotated };
}

/* ---------------- Password ---------------- */

export type PasswordResult =
  | { ok: true; sessionsRevoked: number; sessionRotated: boolean }
  | { ok: false; error: string; status?: number };

export async function changePassword(currentPassword: string, newPassword: string): Promise<PasswordResult> {
  if (currentPassword === "") return { ok: false, error: "Password saat ini wajib diisi." };
  // Backend: Field(min_length=12) + password_policy_error (core/passwords.py:36).
  if (newPassword.length < 12) return { ok: false, error: "Password baru minimal 12 karakter." };
  if (newPassword === currentPassword) {
    return { ok: false, error: "Password baru harus berbeda dari yang lama." };
  }

  const result = await postJson<{ changed?: boolean; sessions_revoked?: number }>("/auth/password", {
    current_password: currentPassword,
    new_password: newPassword
  });
  if (!result.ok) return result;
  return {
    ok: true,
    sessionsRevoked: result.data.sessions_revoked ?? 0,
    sessionRotated: result.sessionRotated
  };
}
