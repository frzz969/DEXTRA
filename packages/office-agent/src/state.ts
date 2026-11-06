import { resolve } from 'node:path';

import { getStorePaths } from '../../store/src/index.ts';
import { readJsonFile, withCrossProcessLock, writeJsonAtomic } from '../../store/src/json-file.ts';
import type { ClarificationSession } from './types.ts';

/**
 * Penyimpanan sesi klarifikasi.
 *
 * Sesi perlu bertahan antar panggilan: pertanyaan dibuat pada satu permintaan,
 * jawabannya datang pada permintaan berikutnya, sering dari pengguna yang sama
 * tetapi bukan proses yang sama. Menyimpannya di memori berarti klarifikasi
 * hilang setiap kali server restart.
 *
 * Ini BUKAN audit dan bukan sumber kebenaran plan. Isinya hanya pertanyaan dan
 * jawaban; plan tetap di store utama, dan setiap perubahan tetap tercatat di
 * audit chain.
 */

/**
 * Ikatan chat -> request.
 *
 * Satu chat Telegram adalah satu percakapan kerja, bukan satu pesan. Tanpa
 * ikatan ini setiap pesan susulan akan menumbuhkan request baru dan pengguna
 * kehilangan jawaban klarifikasi yang sudah diberikan pada pesan sebelumnya.
 * Ikatan disimpan di berkas sesi yang sama supaya sesi dan pemiliknya tidak
 * bisa terpisah saat salah satu ditulis.
 */
export interface ChatRequestBinding {
  /** Kunci stabil dari adapter (mis. id chat Telegram sebagai string). */
  chat_key: string;
  request_id: string;
  updated_at: string;
}

interface SessionFile {
  sessions: ClarificationSession[];
  chats?: ChatRequestBinding[];
}

function sessionsPath(): string {
  return resolve(getStorePaths().dataDir, 'office-sessions.json');
}

export async function loadSession(requestId: string): Promise<ClarificationSession | null> {
  const file = await readJsonFile<SessionFile>(sessionsPath(), { sessions: [] });
  return file.sessions.find((session) => session.request_id === requestId) ?? null;
}

export async function saveSession(session: ClarificationSession): Promise<void> {
  const path = sessionsPath();
  await withCrossProcessLock(path, async () => {
    const file = await readJsonFile<SessionFile>(path, { sessions: [] });
    const index = file.sessions.findIndex((entry) => entry.session_id === session.session_id);
    const sessions = [...file.sessions];
    if (index >= 0) sessions[index] = session;
    else sessions.push(session);
    /* `...file` penting: ikatan chat hidup di berkas yang sama. Menulis hanya
       `{ sessions }` akan menghapus ikatan itu setiap kali sesi disimpan. */
    await writeJsonAtomic(path, { ...file, sessions });
  });
}

export async function listSessions(): Promise<ClarificationSession[]> {
  const file = await readJsonFile<SessionFile>(sessionsPath(), { sessions: [] });
  return file.sessions;
}

/**
 * Request id kanonik untuk sebuah chat.
 *
 * Panggilan pertama menyimpan `proposedRequestId`; panggilan berikutnya dari
 * chat yang sama mengembalikan id yang tersimpan, berapa pun id yang diajukan
 * adapter. Ini yang membuat pesan susulan melanjutkan request yang sama tanpa
 * adapter menulis berkas sendiri.
 */
export async function resolveChatRequest(
  chatKey: string,
  proposedRequestId: string,
  now: Date = new Date(),
): Promise<string> {
  const key = chatKey.trim();
  if (key === '') return proposedRequestId;
  const path = sessionsPath();
  let resolved = proposedRequestId;

  await withCrossProcessLock(path, async () => {
    const file = await readJsonFile<SessionFile>(path, { sessions: [] });
    const chats = [...(file.chats ?? [])];
    const existing = chats.find((binding) => binding.chat_key === key);
    if (existing !== undefined) {
      resolved = existing.request_id;
      return;
    }
    chats.push({ chat_key: key, request_id: proposedRequestId, updated_at: now.toISOString() });
    await writeJsonAtomic(path, { ...file, chats });
  });

  return resolved;
}

export async function getChatRequest(chatKey: string): Promise<string | null> {
  const file = await readJsonFile<SessionFile>(sessionsPath(), { sessions: [] });
  return file.chats?.find((binding) => binding.chat_key === chatKey)?.request_id ?? null;
}
