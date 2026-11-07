import { en } from "./en";
import { id } from "./id";
import { DEFAULT_LOCALE, type Locale } from "./locale";

/* Kamus sebagai peta datar teks-sumber → teks-terjemahan.
 *
 * Lookup yang gagal mengembalikan teks sumber apa adanya. Itu disengaja:
 * selama migrasi, string yang belum dipindahkan ke kamus tetap tampil dalam
 * bahasa aslinya, bukan kosong atau kunci mentah. */
export type Messages = Record<string, string>;

const DICTIONARIES: Record<Locale, Messages> = {
  en: en as Messages,
  id: id as Messages
};

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export function translate(messages: Messages, text: string): string {
  return messages[text] ?? text;
}

export type Translator = (text: string) => string;

export function makeTranslator(messages: Messages): Translator {
  return (text: string) => translate(messages, text);
}
