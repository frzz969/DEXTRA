"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";
const SESSION_COOKIE = process.env.DEXTRA_SESSION_COOKIE ?? "dextra_session";
const CSRF_COOKIE = process.env.DEXTRA_CSRF_COOKIE ?? "dextra_csrf";

export type AuthFormState = {
  error?: string;
  mfa?: boolean;
  email?: string;
};

type JsonBody = Record<string, unknown> | null;

function getSetCookies(headers: Headers): string[] {
  const raw = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : null;
  if (raw) return raw;
  const single = headers.get("set-cookie");
  // Pecah kasar: cukup untuk cookie kita (nilai tidak mengandung koma).
  return single ? single.split(/,(?=[^;,]+=[^;,]+)/) : [];
}

function parseCookiePair(raw: string): { name: string; value: string; maxAge?: number } | null {
  const [nameValue, ...attrs] = raw.split(";");
  const eq = nameValue.indexOf("=");
  if (eq <= 0) return null;
  const name = nameValue.slice(0, eq).trim();
  const value = nameValue.slice(eq + 1).trim();
  const maxAgeAttr = attrs
    .map((a) => a.trim().toLowerCase())
    .find((a) => a.startsWith("max-age="));
  const maxAge = maxAgeAttr ? Number.parseInt(maxAgeAttr.split("=")[1] ?? "", 10) : undefined;
  return { name, value, maxAge: Number.isFinite(maxAge) ? maxAge : undefined };
}

async function storeBackendCookies(setCookies: string[]) {
  const store = await cookies();
  for (const raw of setCookies) {
    const parsed = parseCookiePair(raw);
    if (!parsed) continue;
    const base = {
      path: "/",
      sameSite: "lax" as const,
      secure: false,
      maxAge: parsed.maxAge
    };
    if (parsed.name === SESSION_COOKIE) {
      store.set(SESSION_COOKIE, parsed.value, { ...base, httpOnly: true });
    } else if (parsed.name === CSRF_COOKIE) {
      // CSRF cookie harus terbaca JS (double-submit); bukan rahasia.
      store.set(CSRF_COOKIE, parsed.value, { ...base, httpOnly: false });
    }
  }
}

async function readBody(response: Response): Promise<JsonBody> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as JsonBody;
  } catch {
    return null;
  }
}

function friendlyError(status: number, body: JsonBody): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail; // pesan server sudah aman (generic)
  if (status === 429) return "Terlalu banyak percobaan login. Coba lagi nanti.";
  if (status === 401) return "Email atau password salah.";
  return `Gagal masuk (HTTP ${status}).`;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const tenant = String(formData.get("tenant") ?? "").trim();
  if (!email || !password) return { error: "Email dan password wajib diisi." };

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, tenant: tenant || null }),
      cache: "no-store"
    });
  } catch {
    return { error: "Tidak dapat menghubungi server autentikasi.", email };
  }

  const body = await readBody(response);
  if (!response.ok) {
    return { error: friendlyError(response.status, body), email };
  }

  await storeBackendCookies(getSetCookies(response.headers));
  if (body?.mfa_required === true) {
    return { mfa: true, email };
  }
  redirect("/overview");
}

export async function verifyMfa(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const code = String(formData.get("code") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^\d{6,10}$/.test(code)) return { mfa: true, email, error: "Kode 6 digit wajib diisi." };

  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) return { error: "Sesi login tidak ditemukan. Mulai ulang dari awal.", email };
  const csrf = store.get(CSRF_COOKIE)?.value;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1/auth/mfa/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE}=${session}${csrf ? `; ${CSRF_COOKIE}=${csrf}` : ""}`,
        ...(csrf ? { "X-CSRF-Token": csrf } : {})
      },
      body: JSON.stringify({ code }),
      cache: "no-store"
    });
  } catch {
    return { mfa: true, email, error: "Tidak dapat menghubungi server autentikasi." };
  }

  const body = await readBody(response);
  if (!response.ok) {
    return { mfa: true, email, error: friendlyError(response.status, body) };
  }

  await storeBackendCookies(getSetCookies(response.headers));
  redirect("/overview");
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  const csrf = store.get(CSRF_COOKIE)?.value;
  if (session) {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: `${SESSION_COOKIE}=${session}${csrf ? `; ${CSRF_COOKIE}=${csrf}` : ""}`,
          ...(csrf ? { "X-CSRF-Token": csrf } : {})
        },
        cache: "no-store"
      });
    } catch {
      // API mati pun: cookie lokal tetap dihapus — pengguna keluar di sisi ini.
    }
  }
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
  redirect("/login");
}

export async function loginAsDemo(): Promise<void> {
  // Escape hatch eksplisit: hapus sesi dan kembali ke shell demo (token server).
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(CSRF_COOKIE);
  redirect("/overview");
}
