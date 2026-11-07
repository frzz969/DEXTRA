import { cookies } from "next/headers";

/**
 * Menyimpan cookie sesi/CSRF yang diterbitkan backend.
 *
 * Dibutuhkan karena beberapa endpoint akun **merotasi sesi** dan mengirim
 * cookie baru pada respons: `POST /auth/password` (auth/router.py:824-826) dan
 * `POST /auth/mfa/activate|disable`. `apiWrite` di lib/api membuang header
 * respons, jadi cookie baru akan hilang dan pengguna tiba-tiba tidak punya sesi
 * yang sah. Helper ini menangkapnya supaya rotasi tidak memutus sesi.
 *
 * Isinya sengaja sama dengan lib/auth-actions.ts:39-57 — helper di sana tidak
 * diekspor (berkas "use server" hanya boleh mengekspor fungsi async), jadi
 * salinan kecil ini yang dipakai. Kalau salah satu berubah, ubah keduanya.
 */

const SESSION_COOKIE = process.env.DEXTRA_SESSION_COOKIE ?? "dextra_session";
const CSRF_COOKIE = process.env.DEXTRA_CSRF_COOKIE ?? "dextra_csrf";

export function getSetCookies(headers: Headers): string[] {
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
  const maxAgeAttr = attrs.map((a) => a.trim().toLowerCase()).find((a) => a.startsWith("max-age="));
  const maxAge = maxAgeAttr ? Number.parseInt(maxAgeAttr.split("=")[1] ?? "", 10) : undefined;
  return { name, value, maxAge: Number.isFinite(maxAge) ? maxAge : undefined };
}

/** Mengembalikan true bila cookie sesi benar-benar ikut diperbarui. */
export async function storeBackendCookies(setCookies: string[]): Promise<boolean> {
  const store = await cookies();
  let sessionUpdated = false;
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
      sessionUpdated = true;
    } else if (parsed.name === CSRF_COOKIE) {
      // CSRF cookie harus terbaca JS (double-submit); bukan rahasia.
      store.set(CSRF_COOKIE, parsed.value, { ...base, httpOnly: false });
    }
  }
  return sessionUpdated;
}
