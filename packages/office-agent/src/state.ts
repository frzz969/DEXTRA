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

interface SessionFile {
  sessions: ClarificationSession[];
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
    await writeJsonAtomic(path, { sessions });
  });
}

export async function listSessions(): Promise<ClarificationSession[]> {
  const file = await readJsonFile<SessionFile>(sessionsPath(), { sessions: [] });
  return file.sessions;
}
