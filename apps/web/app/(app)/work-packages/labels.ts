/**
 * Label dan urutan status work package — satu sumber untuk daftar dan detail.
 *
 * Urutan dan daftar status disalin dari enum backend
 * (backend/dextra/models/tasks.py:16-29, WORK_STATUSES) dan sengaja TIDAK
 * dirapikan ulang: kalau backend menambah status, satu tempat ini yang berubah.
 */

export const STATUS_ORDER = [
  "draft",
  "assigned",
  "in_progress",
  "review",
  "pending_approval",
  "approved",
  "executing",
  "completed",
  "rejected",
  "revoked",
  "failed",
  "cancelled"
] as const;

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draf",
  assigned: "Ditugaskan",
  in_progress: "Berjalan",
  review: "Review",
  pending_approval: "Menunggu approval",
  approved: "Disetujui",
  executing: "Eksekusi",
  completed: "Selesai",
  rejected: "Ditolak",
  revoked: "Dicabut",
  failed: "Gagal",
  cancelled: "Dibatalkan"
};

export const PRIORITY_LABEL: Record<string, string> = {
  low: "Rendah",
  normal: "Normal",
  high: "Tinggi",
  urgent: "Mendesak"
};

/** Status yang menandakan paket berhenti, bukan maju. */
export const NEGATIVE_STATUSES = new Set(["rejected", "revoked", "failed", "cancelled"]);

/** Status maju, dalam urutan enum backend (dipakai stepper detail). */
export const FORWARD_STATUSES = STATUS_ORDER.filter((s) => !NEGATIVE_STATUSES.has(s));

export const statusLabel = (status: string): string => STATUS_LABEL[status] ?? status;
