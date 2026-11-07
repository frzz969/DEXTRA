/**
 * Empat worker yang bisa dipilih di /office-agent.
 *
 * Daftar ini ditulis di sisi web, bukan dibaca dari backend: tidak ada endpoint
 * worker, jadi jangan menambah entri atau field yang tidak didukung server.
 * `defaultActionType` hanya nilai awal formulir; eksekusi tetap lewat mandat
 * dan persetujuan manusia.
 */

export type WorkerActionType =
  | "send_email"
  | "create_calendar_event"
  | "create_task"
  | "create_meeting_note";

export type Worker = {
  readonly slug: string;
  readonly name: string;
  readonly type: string;
  readonly purpose: string;
  readonly capabilities: readonly string[];
  readonly defaultActionType: WorkerActionType;
};

export const WORKERS = [
  {
    slug: "workforce-dispatcher",
    name: "Workforce Dispatcher",
    type: "orchestrator",
    purpose: "Membagi pekerjaan ke spesialis dan memantau kemajuannya.",
    capabilities: ["route_task", "read_workforce"],
    defaultActionType: "create_task"
  },
  {
    slug: "executive-assistant",
    name: "Executive Assistant",
    type: "assistant",
    purpose: "Menyusun rencana kerja dan ringkasan untuk manusia.",
    capabilities: ["create_plan", "read_calendar"],
    defaultActionType: "create_calendar_event"
  },
  {
    slug: "administrative-officer",
    name: "Administrative Officer",
    type: "operator",
    purpose: "Menyiapkan dokumen dan korespondensi sesuai mandat.",
    capabilities: ["draft_document"],
    defaultActionType: "send_email"
  },
  {
    slug: "adversarial-reviewer",
    name: "Adversarial Reviewer",
    type: "reviewer",
    purpose: "Mencari cacat rencana sebelum diajukan untuk persetujuan.",
    capabilities: ["review_plan"],
    defaultActionType: "create_meeting_note"
  }
] as const satisfies readonly Worker[];

/** Slug kosong atau tidak dikenal mengembalikan `undefined`, bukan worker pertama. */
export function findWorker(slug: string): Worker | undefined {
  const key = slug.trim();
  if (!key) return undefined;
  return WORKERS.find((worker) => worker.slug === key);
}
