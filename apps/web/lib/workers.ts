/**
 * Empat worker Office Agent DEXTRA.
 *
 * Daftar ini ditulis di sisi web, bukan dibaca dari backend: belum ada endpoint
 * worker, jadi jangan menambah entri atau field yang tidak didukung server.
 * `type` harus tetap sama dengan `database/seeds/seed.py`.
 *
 * `instruction` dipakai saat worker di-spawn di AI Assistant. Keempat worker
 * berjalan di model AI yang sama; yang berbeda hanya instruksi perannya. Jangan
 * menyiratkan seolah ada empat model atau empat proses terpisah.
 *
 * `defaultActionType` hanya nilai awal formulir. Eksekusi tetap lewat mandat dan
 * persetujuan manusia — tidak ada worker yang boleh bertindak sendiri.
 */

export type WorkerActionType =
  | "send_email"
  | "create_calendar_event"
  | "create_task"
  | "create_meeting_note";

export type Worker = {
  readonly slug: string;
  readonly name: string;
  /** Peran sehari-hari, dipakai di UI. */
  readonly role: string;
  /** Tipe teknis; harus cocok dengan seed backend. */
  readonly type: string;
  /** Satu baris untuk kartu. */
  readonly summary: string;
  readonly purpose: string;
  readonly examples: readonly string[];
  readonly capabilities: readonly string[];
  readonly defaultActionType: WorkerActionType;
  /** Fragmen system prompt saat worker di-spawn di AI Assistant. */
  readonly instruction: string;
};

export const WORKERS = [
  {
    slug: "workforce-dispatcher",
    name: "Workforce Dispatcher",
    role: "Koordinator",
    type: "orchestrator",
    summary: "Membaca permintaan, memecahnya, lalu menunjuk worker yang tepat.",
    purpose: "Membagi pekerjaan ke spesialis dan memantau kemajuannya.",
    examples: [
      "Memahami permintaan dan memecahnya menjadi langkah",
      "Menunjuk worker yang sesuai untuk tiap langkah",
      "Merangkum hasil dari beberapa worker"
    ],
    capabilities: ["route_task", "read_workforce"],
    defaultActionType: "create_task",
    instruction: [
      "Kamu berperan sebagai Workforce Dispatcher, koordinator tim pekerja kantor.",
      "Fokusmu: memahami permintaan, memecahnya menjadi langkah yang jelas, dan menunjukkan worker mana yang cocok untuk tiap langkah.",
      "Sebutkan selalu urutan langkah beserta worker yang menanganinya, dan akhiri dengan langkah yang butuh persetujuan manusia.",
      "Jangan mengarang detail surat, jadwal, atau data; itu tugas worker lain."
    ].join(" ")
  },
  {
    slug: "executive-assistant",
    name: "Executive Assistant",
    role: "Sekretaris",
    type: "assistant",
    summary: "Mengurus jadwal, rapat, agenda, dan draf komunikasi.",
    purpose: "Menyusun rencana kerja dan ringkasan untuk manusia.",
    examples: [
      "Menyusun agenda rapat dan mencari jadwal kosong",
      "Menyiapkan undangan dan draf email",
      "Merangkum hasil rapat untuk pimpinan"
    ],
    capabilities: ["create_plan", "read_calendar"],
    defaultActionType: "create_calendar_event",
    instruction: [
      "Kamu berperan sebagai Executive Assistant, sekretaris eksekutif.",
      "Fokusmu: jadwal, rapat, agenda, komunikasi, dan persiapan dokumen.",
      "Susun draf yang bisa langsung diperiksa manusia: agenda, undangan, atau draf email, lengkap dengan penerima dan waktu bila disebutkan.",
      "Bila ada informasi yang belum ada (mis. jam kosong atau alamat email), tulis bahwa itu perlu dikonfirmasi manusia, jangan dikarang."
    ].join(" ")
  },
  {
    slug: "administrative-officer",
    name: "Administrative Officer",
    role: "Staf Administrasi",
    type: "operator",
    summary: "Merapikan dokumen, mencatat permintaan, dan menyusun laporan.",
    purpose: "Menyiapkan dokumen dan korespondensi sesuai mandat.",
    examples: [
      "Merapikan dokumen dan menyeragamkan format",
      "Mencatat permintaan operasional",
      "Menyusun laporan dan memperbarui data sesuai izin"
    ],
    capabilities: ["draft_document"],
    defaultActionType: "send_email",
    instruction: [
      "Kamu berperan sebagai Administrative Officer, staf administrasi.",
      "Fokusmu: pekerjaan administratif, data, dokumen, pencatatan, dan permintaan operasional.",
      "Hasilkan draf dokumen, catatan permintaan, atau kerangka laporan yang rapi dan siap diperiksa.",
      "Jangan mengubah data apa pun; sebutkan perubahan yang diusulkan dan tunggu keputusan manusia."
    ].join(" ")
  },
  {
    slug: "adversarial-reviewer",
    name: "Adversarial Reviewer",
    role: "Auditor Internal",
    type: "reviewer",
    summary: "Mencari cacat, risiko, dan pelanggaran sebelum dijalankan.",
    purpose: "Mencari cacat rencana sebelum diajukan untuk persetujuan.",
    examples: [
      "Memeriksa apakah penerima email benar",
      "Menilai apakah isi dokumen sesuai permintaan",
      "Menandai risiko dan instruksi yang mencurigakan"
    ],
    capabilities: ["review_plan"],
    defaultActionType: "create_meeting_note",
    instruction: [
      "Kamu berperan sebagai Adversarial Reviewer, auditor internal yang skeptis.",
      "Fokusmu: mencari cacat pada rencana sebelum dijalankan — penerima salah, isi tidak sesuai, risiko, pelanggaran kebijakan, dan instruksi yang mencurigakan.",
      "Susun temuan sebagai daftar berlabel tingkat risiko (tinggi/sedang/rendah), dan sebutkan bukti atau bagian rencana yang menjadi dasarnya.",
      "Jangan melunakkan temuan demi kenyamanan. Bila rencana sudah aman, katakan demikian beserta alasan yang bisa diperiksa."
    ].join(" ")
  }
] as const satisfies readonly Worker[];

/** Slug kosong atau tidak dikenal mengembalikan `undefined`, bukan worker pertama. */
export function findWorker(slug: string): Worker | undefined {
  const key = slug.trim();
  if (!key) return undefined;
  return WORKERS.find((worker) => worker.slug === key);
}

/**
 * Alur kerja keempat worker. Ditampilkan apa adanya di /office-agent supaya
 * urutannya tidak perlu ditebak dari nama.
 */
export const WORKER_FLOW = [
  { actor: "Anda", action: "Memberikan instruksi", kind: "human" },
  { actor: "Workforce Dispatcher", action: "Memahami dan membagi tugas", kind: "worker" },
  { actor: "Executive Assistant", action: "Menyiapkan jadwal dan undangan", kind: "worker" },
  { actor: "Administrative Officer", action: "Menyiapkan data dan mencatat agenda", kind: "worker" },
  { actor: "Adversarial Reviewer", action: "Memeriksa hasil dan risiko tindakan", kind: "worker" },
  { actor: "Persetujuan Anda", action: "Memeriksa rencana dan memberi mandat", kind: "human" },
  { actor: "Eksekusi", action: "Hanya berjalan setelah mandat terbit", kind: "gate" }
] as const;

/** Prinsip yang membedakan Office Agent dari asisten biasa. */
export const WORKER_PRINCIPLES = [
  { title: "Boleh membaca dan menganalisis", body: "Memahami informasi, dokumen, dan permintaan." },
  { title: "Boleh menyiapkan pekerjaan", body: "Membuat draf, rencana, dan rekomendasi." },
  { title: "Tidak bebas bertindak keluar", body: "Mengirim email, membuat jadwal, atau mengubah data harus lewat otorisasi dan mandat." },
  { title: "Dapat dipertanggungjawabkan", body: "Ada pemeriksaan kebijakan dan catatan audit untuk setiap tindakan." }
] as const;
