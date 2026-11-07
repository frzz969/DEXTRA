/**
 * Notification Center DEXTRA — komposisi di sisi server.
 *
 * KENYATAAN YANG TIDAK BOLEH DILANGGAR BERKAS INI:
 * 1. Backend TIDAK punya tabel/model/endpoint notifikasi. Tidak ada
 *    `GET /notifications`. Jangan menambahkannya di sini.
 * 2. Backend TIDAK menyimpan status baca (`read_at` / `seen_at` /
 *    `acknowledged` / `dismissed`). Karena itu daftar ini TIDAK boleh
 *    menyebut "belum dibaca" atau "unread". Istilah yang jujur untuk
 *    hitungannya adalah "perlu tindakan".
 * 3. `pending_approvals` di `GET /overview` secara struktural selalu 0
 *    (penghitung mati) — tidak dipakai di sini.
 *
 * Jadi daftar ini adalah DERIVASI dari tiga endpoint nyata yang sudah ada,
 * dengan predikat eksplisit per sumber. Tiap baris membawa id dan waktu
 * asli dari record; tidak ada timestamp karangan.
 *
 * BERKAS INI HANYA UNTUK SERVER. Ia memanggil `lib/api.ts`, yang membaca
 * cookie sesi lewat `next/headers`. Jangan pernah mengimpornya dari
 * komponen `"use client"`.
 *
 * Catatan: paket `server-only` TIDAK terpasang di repo ini (tidak ada di
 * `node_modules` root maupun `apps/web`), jadi `import "server-only"`
 * tidak bisa dipakai. Batas server ditegakkan oleh konvensi di atas dan
 * oleh fakta bahwa `NotificationBell.tsx` adalah async server component.
 */
import { getExecutions, getMandates, getOfficePlans } from "@/lib/api";

/* ---------- Bentuk data yang dikirim ke klien ---------- */

export type NotificationKind = "plan" | "execution" | "mandate";

export type NotificationItem = {
  /** Id stabil untuk React key — gabungan kind + id record. */
  key: string;
  /** Id record asli, dipakai untuk menyusun tautan. */
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
  /**
   * Timestamp ISO asli dari record, atau `null` bila record tidak
   * menyediakannya. `null` berarti UI menghilangkan waktunya — bukan
   * mengarang. Lihat `NotificationBellClient`.
   */
  at: string | null;
};

/** Keadaan satu sumber. `ok: false` WAJIB tampil sebagai "tidak tersedia". */
export type FeedSection =
  | { ok: true; count: number }
  | { ok: false; error: string };

export type FeedSectionKey = "plans" | "executions" | "mandates";

export type NotificationFeed = {
  /** Sudah diurutkan (terbaru dulu) dan dipotong ke `MAX_ITEMS`. */
  items: NotificationItem[];
  /** Jumlah item yang lolos predikat, SEBELUM dipotong. */
  count: number;
  /** Jumlah item yang benar-benar dikirim untuk dirender. */
  shown: number;
  /** True bila `count > shown` — daftar yang tampil bukan daftar lengkap. */
  truncated: boolean;
  sections: Record<FeedSectionKey, FeedSection>;
  /** Waktu komposisi, ISO. Ditampilkan sebagai "disusun pada". */
  composedAt: string;
};

/* ---------- Predikat per sumber ----------
 *
 * Ketiganya sengaja sempit dan eksplisit. Predikat longgar di halaman lain
 * (`!/reject|expired/i.test(...)` di app/approvals/page.tsx:39-41 dan
 * app/review/page.tsx:21-23) menghitung rencana yang SUDAH disetujui penuh
 * sebagai masih menunggu. Pola itu sengaja TIDAK disalin di sini.
 */

/**
 * Rencana butuh keputusan hanya bila statusnya `"received"` (belum ada
 * keputusan) atau `"partially_approved"` (sebagian tindakan belum diputuskan).
 *
 * Nilai ini diverifikasi di backend, bukan ditebak:
 * - `models/office.py:19` → OFFICE_PLAN_STATUSES = ("received",
 *   "partially_approved", "approved", "rejected")
 * - `modules/office_agent/router.py:126` → status="received" saat dibuat
 * - `modules/office_agent/router.py:232` → status="rejected"
 * - `modules/office_agent/router.py:234` → status="partially_approved"
 *
 * `"approved"` ada di tuple model tetapi TIDAK PERNAH ditulis oleh router,
 * jadi tidak dimasukkan. `"rejected"` sudah diputuskan, jadi tidak
 * dimasukkan. Status lain (di luar tuple) tidak dikenal → tidak ditampilkan,
 * supaya tidak ada positif palsu.
 */
const PLAN_STATUS_NEEDS_DECISION: ReadonlySet<string> = new Set([
  "received",
  "partially_approved"
]);

/** Eksekusi gagal — satu-satunya status yang dipakai sebagai sinyal. */
const EXECUTION_FAILED = "failed";

/** Jendela "akan berakhir" untuk mandat. */
const MANDATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Batas baris yang dirender. */
const MAX_ITEMS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/* ---------- Utilitas ---------- */

/** Parse ISO → epoch ms, atau `null` bila kosong / tidak valid. */
function toTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** Buang spasi berlebih; string kosong → null supaya tidak dirender kosong. */
function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Label status rencana dalam Bahasa Indonesia, apa adanya. */
function planStatusLabel(status: string): string {
  if (status === "received") return "baru diterima";
  if (status === "partially_approved") return "disetujui sebagian";
  return status;
}

/**
 * Sisa hari menuju kedaluwarsa, dibulatkan ke atas. Dipakai sebagai teks
 * ("berakhir dalam 2 hari"), bukan sebagai timestamp.
 */
function daysUntil(target: number, now: number): number {
  return Math.ceil((target - now) / DAY_MS);
}

/* ---------- Komposisi ---------- */

/**
 * Susun daftar "perlu tindakan" dari tiga endpoint nyata.
 *
 * Ketiga permintaan dijalankan paralel. Kegagalan satu sumber tidak
 * menjatuhkan yang lain: sumber itu ditandai `{ ok: false, error }` dan UI
 * menampilkannya sebagai tidak tersedia — bukan sebagai nol.
 */
export async function getNotificationFeed(now = Date.now()): Promise<NotificationFeed> {
  const [plansResult, executionsResult, mandatesResult] = await Promise.all([
    getOfficePlans(),
    getExecutions(200),
    getMandates()
  ]);

  const items: NotificationItem[] = [];
  const sections: Record<FeedSectionKey, FeedSection> = {
    plans: { ok: false, error: "belum diperiksa" },
    executions: { ok: false, error: "belum diperiksa" },
    mandates: { ok: false, error: "belum diperiksa" }
  };

  /* --- Rencana yang menunggu keputusan → /review/<plan_id> ---
   *
   * Tautan memakai `plan_id`, bukan `id`. `app/review/[id]/page.tsx:104`
   * memanggil `getOfficePlan(id)`, yang menembak
   * `GET /office-agent/plans/{plan_id}` — jadi segmen URL-nya adalah
   * `plan_id`. Memakai `id` akan menghasilkan tautan yang tidak ditemukan. */
  if (plansResult.ok) {
    let count = 0;
    for (const plan of plansResult.data.items) {
      if (!PLAN_STATUS_NEEDS_DECISION.has(plan.status)) continue;
      const planId = clean(plan.plan_id);
      if (!planId) continue;
      count += 1;

      const actionCount = Array.isArray(plan.actions) ? plan.actions.length : 0;
      items.push({
        key: `plan:${planId}`,
        id: planId,
        kind: "plan",
        title: `Rencana ${planId} menunggu keputusan`,
        detail:
          actionCount > 0
            ? `${actionCount} tindakan · status ${planStatusLabel(plan.status)}`
            : `status ${planStatusLabel(plan.status)}`,
        href: `/review/${encodeURIComponent(planId)}`,
        at: clean(plan.created_at)
      });
    }
    sections.plans = { ok: true, count };
  } else {
    sections.plans = { ok: false, error: plansResult.error };
  }

  /* --- Eksekusi gagal → /executions?id=<id> ---
   *
   * `app/executions/page.tsx:7` mendeklarasikan `id` di tipe searchParams dan
   * baris 39 memakai `sp.id` untuk membuka panel detail, jadi `?id=` adalah
   * target yang benar-benar dibaca halaman itu. */
  if (executionsResult.ok) {
    let count = 0;
    for (const execution of executionsResult.data.items) {
      if (execution.status !== EXECUTION_FAILED) continue;
      const executionId = clean(execution.id);
      if (!executionId) continue;
      count += 1;

      const reason = clean(execution.result);
      const adapter = clean(execution.adapter);
      const planRef = clean(execution.plan_id);
      const context = [adapter ? `adapter ${adapter}` : null, planRef ? `rencana ${planRef}` : null]
        .filter((part): part is string => part !== null)
        .join(" · ");

      items.push({
        key: `execution:${executionId}`,
        id: executionId,
        kind: "execution",
        title: "Eksekusi gagal",
        detail: reason ?? (context || "API tidak menyertakan alasan kegagalan"),
        href: `/executions?id=${encodeURIComponent(executionId)}`,
        /* `ExecutionItem` hanya punya `started_at` — tidak ada `finished_at`.
         * Bila null, waktu dihilangkan, bukan dikarang. */
        at: clean(execution.started_at)
      });
    }
    sections.executions = { ok: true, count };
  } else {
    sections.executions = { ok: false, error: executionsResult.error };
  }

  /* --- Mandat yang masih berlaku dan segera berakhir → /mandates/<id> ---
   *
   * Predikat: `usable === true` DAN `expires_at` ada DAN belum lewat DAN
   * dalam 7 hari ke depan. Mandat yang `expires_at`-nya null tidak bisa
   * dipastikan kapan berakhir, jadi tidak dimasukkan (tidak ditebak).
   *
   * `app/mandates/[id]/page.tsx:29` memanggil `getMandate(id)` →
   * `GET /mandates/{id}` → segmen URL-nya adalah `id` milik mandat. */
  if (mandatesResult.ok) {
    let count = 0;
    for (const mandate of mandatesResult.data.items) {
      if (mandate.usable !== true) continue;
      const expiresAt = clean(mandate.expires_at);
      const expiresTime = toTime(expiresAt);
      if (!expiresAt || expiresTime === null) continue;
      if (expiresTime <= now) continue;
      if (expiresTime > now + MANDATE_WINDOW_MS) continue;

      const mandateId = clean(mandate.id);
      if (!mandateId) continue;
      count += 1;

      const remaining = daysUntil(expiresTime, now);
      const scope = clean(mandate.resource_scope) ?? clean(mandate.recipient_scope);
      const actionType = clean(mandate.action_type) ?? "tindakan";

      items.push({
        key: `mandate:${mandateId}`,
        id: mandateId,
        kind: "mandate",
        title:
          remaining <= 1
            ? `Mandat ${actionType} berakhir hari ini`
            : `Mandat ${actionType} berakhir dalam ${remaining} hari`,
        detail: scope ? `lingkup ${scope}` : "lingkup tidak dinyatakan API",
        href: `/mandates/${encodeURIComponent(mandateId)}`,
        /* Waktu yang bermakna untuk mandat adalah tenggatnya. */
        at: expiresAt
      });
    }
    sections.mandates = { ok: true, count };
  } else {
    sections.mandates = { ok: false, error: mandatesResult.error };
  }

  /* --- Urutkan: terbaru dulu, yang tanpa waktu di akhir --- */
  items.sort((a, b) => {
    const ta = toTime(a.at);
    const tb = toTime(b.at);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });

  const count = items.length;
  const shown = Math.min(count, MAX_ITEMS);

  return {
    items: items.slice(0, MAX_ITEMS),
    count,
    shown,
    truncated: count > shown,
    sections,
    composedAt: new Date(now).toISOString()
  };
}
