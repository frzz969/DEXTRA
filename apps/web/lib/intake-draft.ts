/**
 * Draf permintaan yang dibawa dari AI Assistant ke formulir intake /office-agent.
 *
 * Kenapa sessionStorage, bukan query string: teks percakapan bisa ribuan
 * karakter dan akan memotong URL. Kenapa bukan database: draf ini belum
 * menjadi apa pun sampai manusia mengirimnya, jadi tidak perlu meninggalkan
 * jejak di audit.
 *
 * Kunci dipakai bersama oleh AssistantChat (menulis) dan PlanIntakeForm
 * (membaca lalu menghapus), supaya draf hanya terpakai sekali.
 */

export const INTAKE_DRAFT_KEY = "dextra:intake-draft";

export type IntakeDraft = {
  /** Judul sumber, diambil dari permintaan pertama pengguna. */
  title: string;
  /** Teks permintaan beserta draf usulan asisten. */
  text: string;
};

function isDraft(value: unknown): value is IntakeDraft {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.title === "string" && typeof v.text === "string";
}

export function writeIntakeDraft(draft: IntakeDraft): boolean {
  try {
    window.sessionStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    // Mode privat atau storage diblokir: biarkan pengguna mengisi manual.
    return false;
  }
}

/**
 * Mengambil draf lalu menghapusnya. Mengembalikan `null` bila tidak ada,
 * rusak, atau kosong — pemanggil tidak perlu membedakan ketiganya.
 */
export function takeIntakeDraft(): IntakeDraft | null {
  try {
    const raw = window.sessionStorage.getItem(INTAKE_DRAFT_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(INTAKE_DRAFT_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed)) return null;
    if (!parsed.text.trim()) return null;
    return { title: parsed.title.slice(0, 200), text: parsed.text.slice(0, 8000) };
  } catch {
    return null;
  }
}
