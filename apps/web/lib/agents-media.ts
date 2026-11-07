/**
 * Avatar agen — pemetaan aset statis, BUKAN field dari API.
 *
 * API workforce tidak menyimpan avatar: model `Agent` di backend hanya punya
 * `slug`, `display_name`, `agent_type`, `description`, `model_provider`,
 * `status`, `is_enabled`. Karena itu gambar dipetakan di sisi web lewat `slug`,
 * dan berkasnya ada di `public/agents/<slug>.jpg`.
 *
 * Slug di bawah harus sama persis dengan `SPECIALISTS` di
 * `backend/dextra/modules/workforce/router.py`. Menambah agen di backend berarti
 * menambah baris di sini; agen tanpa gambar mengembalikan `null` dan pemanggil
 * wajib menyiapkan tampilan cadangan (inisial, ikon) — bukan gambar rusak.
 */

/** Slug agen → path publik gambar. Kunci harus cocok dengan `SPECIALISTS` backend. */
export const AGENT_AVATARS: Readonly<Record<string, string>> = {
  "workforce-dispatcher": "/agents/workforce-dispatcher.jpg",
  "executive-assistant": "/agents/executive-assistant.jpg",
  "administrative-officer": "/agents/administrative-officer.jpg",
  "adversarial-reviewer": "/agents/adversarial-reviewer.jpg"
};

/**
 * Path avatar untuk `slug`, atau `null` bila agen itu tidak punya gambar.
 *
 * `slug` hanya dipakai sebagai kunci pencarian, tidak pernah dirangkai menjadi
 * path, sehingga slug asing dari URL tidak bisa menunjuk berkas di luar
 * `public/agents/`. Pemeriksaan `hasOwnProperty` menjaga agar kunci bawaan
 * prototipe seperti `constructor` atau `toString` tidak ikut lolos.
 */
export function agentAvatar(slug: string): string | null {
  return Object.prototype.hasOwnProperty.call(AGENT_AVATARS, slug)
    ? AGENT_AVATARS[slug]
    : null;
}
