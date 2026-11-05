import type { ExtractedActionItem } from './types.ts';
import type { RecipientResolution, ResolvedContact } from './clarify.ts';

/**
 * Pencarian kontak disuntikkan, bukan diimpor.
 *
 * Alasannya bukan gaya: dengan menyuntikkan lookup, aturan "dua Budi berarti
 * bertanya" bisa diuji tanpa menyentuh store, dan kalau nanti pencarian pindah
 * ke database, aturan itu tidak perlu ditulis ulang.
 */
export type ContactLookup = (hint: string, limit?: number) => Promise<ResolvedContact[]>;
export type ContactByIdLookup = (contactId: string) => Promise<ResolvedContact | null>;

function matchesDepartment(contact: ResolvedContact, department: string): boolean {
  return contact.department.toLowerCase().includes(department.toLowerCase());
}

/**
 * Mencocokkan hint penerima ke kandidat nyata.
 *
 * Tidak ada pemilihan otomatis. Kalau departemen mempersempit menjadi satu
 * orang, itu bukan tebakan — itu informasi yang diberikan pemohon. Kalau tidak
 * mempersempit, hasilnya `ambiguous` beserta daftar kandidat, dan pertanyaan
 * klarifikasi yang menyebut nama serta departemennya.
 */
export async function resolveRecipients(
  items: ReadonlyArray<ExtractedActionItem>,
  lookup: ContactLookup,
): Promise<RecipientResolution[]> {
  const results: RecipientResolution[] = [];

  for (const item of items) {
    const hint = item.recipient.hint;
    if (hint === null) {
      results.push({ item_id: item.item_id, status: 'none', contact: null, candidates: [] });
      continue;
    }

    const found = await lookup(hint, 5);
    if (found.length === 0) {
      results.push({ item_id: item.item_id, status: 'none', contact: null, candidates: [] });
      continue;
    }

    const narrowed =
      item.recipient.department === null ? found : found.filter((contact) => matchesDepartment(contact, item.recipient.department as string));

    if (narrowed.length === 1) {
      results.push({ item_id: item.item_id, status: 'resolved', contact: narrowed[0] ?? null, candidates: narrowed });
      continue;
    }

    if (narrowed.length === 0) {
      /* Departemen yang disebut tidak cocok dengan siapa pun yang namanya mirip.
       * Itu bukan alasan memilih yang pertama: kandidat tetap disodorkan. */
      results.push({ item_id: item.item_id, status: 'ambiguous', contact: null, candidates: found });
      continue;
    }

    results.push({ item_id: item.item_id, status: 'ambiguous', contact: null, candidates: narrowed });
  }

  return results;
}

/**
 * Menerapkan jawaban klarifikasi ke hasil resolusi.
 *
 * Jawaban diperlakukan sebagai PETUNJUK, bukan sebagai kebenaran: contact id
 * dicocokkan ke direktori dulu. Kalau jawabannya "Budi" dan masih ada dua Budi,
 * hasilnya tetap ambigu — jawaban manusia tidak menghapus ambiguitas yang masih
 * ada, dan memilih salah satu di sini akan mengulang kesalahan yang justru
 * ingin dicegah klarifikasi.
 */
export async function applyRecipientAnswers(
  resolutions: ReadonlyArray<RecipientResolution>,
  items: ReadonlyArray<ExtractedActionItem>,
  answerFor: (itemId: string) => string | null,
  lookup: ContactLookup,
  lookupById: ContactByIdLookup,
): Promise<RecipientResolution[]> {
  const byItem = new Map(items.map((item) => [item.item_id, item]));
  const out: RecipientResolution[] = [];

  for (const resolution of resolutions) {
    if (resolution.status === 'resolved') {
      out.push(resolution);
      continue;
    }
    const item = byItem.get(resolution.item_id);
    const answer = item === undefined ? null : answerFor(resolution.item_id);
    if (answer === null || answer.trim() === '') {
      out.push(resolution);
      continue;
    }

    const direct = await lookupById(answer.trim());
    if (direct !== null) {
      out.push({ ...resolution, status: 'resolved', contact: direct, candidates: [direct] });
      continue;
    }

    const found = await lookup(answer.trim(), 5);
    if (found.length === 1) {
      out.push({ ...resolution, status: 'resolved', contact: found[0] ?? null, candidates: found });
    } else if (found.length > 1) {
      out.push({ ...resolution, status: 'ambiguous', contact: null, candidates: found });
    } else {
      out.push(resolution);
    }
  }

  return out;
}
