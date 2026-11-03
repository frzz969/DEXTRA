/**
 * Klien API DEXTRA untuk apps/web.
 *
 * Token dibaca di server dari environment, tidak pernah dikirim ke browser.
 * Kalau API tidak tersedia, fungsi ini mengembalikan `{ ok: false }` — bukan
 * data contoh. Halaman harus menampilkan keadaan "tidak tersedia" apa adanya.
 */

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

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  if (!TOKEN) {
    return { ok: false, error: "DEXTRA_API_TOKEN belum diisi; UI tidak boleh mengarang data." };
  }
  try {
    const response = await fetch(`${BASE_URL}/api/v1${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      // Tanpa cache. Dashboard operasional yang menampilkan angka lama saat API
      // mati lebih berbahaya daripada dashboard yang jujur bilang "tidak
      // tersedia" — dan dengan revalidate, halaman tetap menyajikan data basi
      // sampai 30 detik setelah API berhenti.
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

export async function getOverview(): Promise<ApiResult<Overview>> {
  return apiGet<Overview>("/overview");
}
