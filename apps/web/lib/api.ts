/**
 * Klien API DEXTRA untuk apps/web.
 *
<<<<<<< HEAD
 * Dua jalur otentikasi, dipilih otomatis di server:
 * 1. Sesi pengguna (cookie `dextra_session` + CSRF) bila cookie ada —
 *    wewenang mengikuti role pengguna di sesi. Cookie TIDAK pernah dikirim
 *    ke browser; ia hanya diteruskan server → API.
 * 2. Bearer token dari environment (DEXTRA_API_TOKEN) selain itu — mode
 *    demo / headless. Token tidak pernah sampai ke browser.
 *
 * Kalau API tidak tersedia, fungsi ini mengembalikan `{ ok: false }` — bukan
 * data contoh. Halaman harus menampilkan keadaan "tidak tersedia" apa adanya.
 */
import { cookies } from "next/headers";
=======
 * Token dibaca di server dari environment, tidak pernah dikirim ke browser.
 * Kalau API tidak tersedia, fungsi ini mengembalikan `{ ok: false }` — bukan
 * data contoh. Halaman harus menampilkan keadaan "tidak tersedia" apa adanya.
 */
>>>>>>> fa42d129d43eb3b3b947f6d9b79c427b8b660ea1

export type OverviewKpi = {
  active_agents: number;
  open_work_packages: number;
  pending_approvals: number;
  failed_executions: number;
  active_mandates: number;
};

export type Overview = {
  generated_at: string;
  scope: string;
  kpi: OverviewKpi;
  unavailable: string[];
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";
const TOKEN = process.env.DEXTRA_API_TOKEN ?? "";
<<<<<<< HEAD
const SESSION_COOKIE = process.env.DEXTRA_SESSION_COOKIE ?? "dextra_session";
const CSRF_COOKIE = process.env.DEXTRA_CSRF_COOKIE ?? "dextra_csrf";

export const apiAuth = {
  sessionCookie: SESSION_COOKIE,
  csrfCookie: CSRF_COOKIE,
  hasToken: TOKEN.length > 0
} as const;

/**
 * Header otentikasi sesuai cookie yang ada. Diekspor untuk server actions —
 * mereka wajib memakai wewenang yang sama dengan halaman, bukan token tetap.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const session = store.get(SESSION_COOKIE)?.value;
    if (session) {
      const csrf = store.get(CSRF_COOKIE)?.value ?? "";
      return csrf
        ? { Cookie: `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`, "X-CSRF-Token": csrf }
        : { Cookie: `${SESSION_COOKIE}=${session}` };
    }
  } catch {
    // cookies() di luar konteks request (mis. build) — pakai token saja.
  }
  if (!TOKEN) throw new Error("DEXTRA_API_TOKEN belum diisi.");
  return { Authorization: `Bearer ${TOKEN}` };
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
=======

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  if (!TOKEN) {
>>>>>>> fa42d129d43eb3b3b947f6d9b79c427b8b660ea1
    return { ok: false, error: "DEXTRA_API_TOKEN belum diisi; UI tidak boleh mengarang data." };
  }
  try {
    const response = await fetch(`${BASE_URL}/api/v1${path}`, {
<<<<<<< HEAD
      headers,
      // Tanpa cache: angka basi lebih berbahaya daripada pesan "tidak tersedia".
=======
      headers: { Authorization: `Bearer ${TOKEN}` },
      // Tanpa cache. Dashboard operasional yang menampilkan angka lama saat API
      // mati lebih berbahaya daripada dashboard yang jujur bilang "tidak
      // tersedia" — dan dengan revalidate, halaman tetap menyajikan data basi
      // sampai 30 detik setelah API berhenti.
>>>>>>> fa42d129d43eb3b3b947f6d9b79c427b8b660ea1
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, error: `API menolak permintaan (HTTP ${response.status}).`, status: response.status };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }
}

<<<<<<< HEAD
/** Tulis ke API dengan otentikasi yang sama. Body JSON, respons diparse bila ada. */
export async function apiWrite<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
    return { ok: false, error: "DEXTRA_API_TOKEN belum diisi; UI tidak boleh mengarang data." };
  }
  try {
    const response = await fetch(`${BASE_URL}/api/v1${path}`, {
      method,
      headers: {
        ...headers,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const detail =
        (parsed as { detail?: string | { detail?: string } } | undefined)?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : typeof detail === "object" && detail && "detail" in detail
            ? String((detail as { detail: unknown }).detail)
            : `API menolak permintaan (HTTP ${response.status}).`;
      return { ok: false, error: message, status: response.status };
    }
    return { ok: true, data: parsed as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }
}

export async function getOverview(): Promise<ApiResult<Overview>> {
  return apiGet<Overview>("/overview");
}

/**
 * Endpoint yang tidak berada di bawah `/api/v1` (mis. `/health`). Publik —
 * tanpa Authorization. Hanya untuk endpoint yang memang publik.
 */
export async function apiRootGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, error: `Endpoint publik menolak permintaan (HTTP ${response.status}).`, status: response.status };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }
}
=======
export async function getOverview(): Promise<ApiResult<Overview>> {
  return apiGet<Overview>("/overview");
}
>>>>>>> fa42d129d43eb3b3b947f6d9b79c427b8b660ea1
