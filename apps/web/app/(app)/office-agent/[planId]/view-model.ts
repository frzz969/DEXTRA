/**
 * Turunan data untuk halaman detail rencana Office Agent.
 *
 * Semua fungsi di sini murni dan tanpa React: masuk JSON dari API, keluar bentuk
 * siap-render. Aturannya satu — **tidak mengarang**. `params` tindakan adalah
 * `dict` bebas (lihat `OfficePlanPayload.actions[].params` di router), jadi
 * kunci yang dibaca dicoba berurutan dan hasil yang tidak ada menjadi `null`.
 * UI menulis "tidak disebutkan", bukan nilai contoh.
 *
 * Penerima ditampilkan **persis seperti API mengirimnya** — termasuk bentuk
 * tersamarkan (`b***@kenari.co.id`). Modul ini tidak membuka, menyusun ulang,
 * atau menormalkan alamat.
 */
import type { AuditEventItem, ExecutionItem, PlanFinding } from "@/lib/api";

export type ParamMap = Record<string, unknown>;

export function isRecord(value: unknown): value is ParamMap {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** String non-kosong, atau null. Angka/boolean diterima apa adanya. */
export function text(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Ringkasan satu nilai untuk tempat sempit. String dipakai apa adanya. */
export function compact(value: unknown, max = 120): string {
  if (typeof value === "string") return truncate(value, max);
  if (value === null || value === undefined) return "—";
  try {
    const json = JSON.stringify(value);
    return json === undefined ? String(value) : truncate(json, max);
  } catch {
    return String(value);
  }
}

/* ---------------------------------------------------------------- tindakan */

/**
 * Kunci yang sudah ditampilkan sebagai baris sendiri di `.def-list`. Sisanya
 * muncul sebagai "Parameter lain" supaya tidak ada data yang disembunyikan
 * tanpa harus membuang seluruh `params` sebagai JSON mentah.
 */
const CONSUMED_KEYS = new Set([
  "to",
  "recipients",
  "recipient",
  "attendees",
  "target",
  "cc",
  "bcc",
  "channel",
  "medium",
  "start",
  "start_at",
  "end",
  "end_at",
  "at",
  "due_at",
  "schedule",
  "timezone",
  "subject",
  "title",
  "headline",
  "name",
  "body",
  "content",
  "detail",
  "text",
  "message"
]);

/**
 * Kunci bersarang yang sudah tampil sebagai baris sendiri. Sisa kuncinya
 * (mis. `target.contact_id`, `content.locale`) tetap ditampilkan sebagai
 * "Parameter lain" — objek kecil yang dibuang seluruhnya akan menyembunyikan
 * data yang justru dipakai approver.
 */
const CONSUMED_NESTED: Record<string, Set<string>> = {
  target: new Set(["display_name", "name", "masked_address", "address", "email", "to", "channel"]),
  schedule: new Set(["start_at", "end_at", "timezone", "all_day"]),
  content: new Set(["subject", "title", "body"])
};

function recipientFrom(value: unknown): string[] {
  const scalar = text(value);
  if (scalar) return [scalar];
  if (Array.isArray(value)) return value.flatMap(recipientFrom);
  if (isRecord(value)) {
    const name = text(value.display_name) ?? text(value.name);
    const address =
      text(value.masked_address) ?? text(value.address) ?? text(value.email) ?? text(value.to);
    if (name && address) return [`${name} · ${address}`];
    if (address) return [address];
    if (name) return [name];
  }
  return [];
}

function scheduleText(params: ParamMap): string | null {
  const schedule = isRecord(params.schedule) ? params.schedule : null;
  const parts: string[] = [];
  const start =
    text(params.start) ??
    (schedule ? text(schedule.start_at) : null) ??
    text(params.start_at) ??
    text(params.at) ??
    text(params.due_at);
  if (start) parts.push(start);
  const end = text(params.end) ?? (schedule ? text(schedule.end_at) : null);
  if (end) parts.push(`s.d. ${end}`);
  const timezone = text(params.timezone) ?? (schedule ? text(schedule.timezone) : null);
  if (timezone) parts.push(timezone);
  if (schedule?.all_day === true) parts.push("sepanjang hari");
  return parts.length > 0 ? parts.join(" · ") : null;
}

function bodyText(params: ParamMap): string | null {
  const content = isRecord(params.content) ? params.content : null;
  return (
    text(params.body) ??
    (content ? text(content.body) : null) ??
    text(params.content) ??
    text(params.detail) ??
    text(params.text) ??
    text(params.message)
  );
}

function subjectText(params: ParamMap): string | null {
  const content = isRecord(params.content) ? params.content : null;
  return (
    text(params.subject) ??
    text(params.title) ??
    text(params.headline) ??
    text(params.name) ??
    (content ? (text(content.subject) ?? text(content.title)) : null)
  );
}

function extrasOf(params: ParamMap): Array<{ key: string; value: string }> {
  const extras: Array<{ key: string; value: string }> = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (!CONSUMED_KEYS.has(key)) {
      extras.push({ key, value: compact(value, 160) });
      continue;
    }
    const consumedNested = CONSUMED_NESTED[key];
    if (!consumedNested || !isRecord(value)) continue;
    for (const nestedKey of Object.keys(value).sort()) {
      if (consumedNested.has(nestedKey)) continue;
      extras.push({ key: `${key}.${nestedKey}`, value: compact(value[nestedKey], 160) });
    }
  }
  return extras;
}

export type ActionScope = {
  recipients: string[];
  channel: string | null;
  schedule: string | null;
  subject: string | null;
  body: string | null;
  extras: Array<{ key: string; value: string }>;
};

export function actionScope(params: ParamMap | undefined): ActionScope {
  const source = params ?? {};
  const target = isRecord(source.target) ? source.target : null;
  const recipients = Array.from(
    new Set([
      ...recipientFrom(source.to),
      ...recipientFrom(source.recipients),
      ...recipientFrom(source.recipient),
      ...recipientFrom(source.attendees),
      ...recipientFrom(source.target)
    ])
  );
  const extras = extrasOf(source);

  return {
    recipients,
    channel: text(source.channel) ?? (target ? text(target.channel) : null) ?? text(source.medium),
    schedule: scheduleText(source),
    subject: subjectText(source),
    body: bodyText(source),
    extras
  };
}

/* ----------------------------------------------------------------- temuan */

export type FindingTone = "danger" | "warning" | "info";

/** `severity` (worker) dan `decision` (policy engine) sama-sama dibaca. */
export function findingTone(finding: PlanFinding): FindingTone {
  const severity = (text(finding.severity) ?? "").toLowerCase();
  const decision = (text(finding.decision) ?? "").toLowerCase();
  if (["blocking", "critical", "error", "high"].includes(severity)) return "danger";
  if (["deny", "denied", "blocked"].includes(decision)) return "danger";
  if (["warning", "medium"].includes(severity)) return "warning";
  if (decision === "review") return "warning";
  return "info";
}

export function findingIcon(finding: PlanFinding): string {
  const tone = findingTone(finding);
  return tone === "danger" ? "block" : tone === "warning" ? "warning" : "info";
}

export function findingCode(finding: PlanFinding): string {
  return text(finding.code) ?? "tanpa kode";
}

export function findingMessage(finding: PlanFinding): string {
  return text(finding.message) ?? "Temuan tanpa pesan.";
}

export type FindingGroup = {
  tone: FindingTone;
  label: string;
  hint: string;
  items: PlanFinding[];
};

/** Urutan kelompok tetap: menghalangi → peringatan → informasi. */
export function groupFindings(findings: PlanFinding[]): FindingGroup[] {
  const groups: FindingGroup[] = [
    {
      tone: "danger",
      label: "Menghalangi",
      hint: "Tidak boleh dieksekusi sebelum temuan ini diselesaikan.",
      items: []
    },
    {
      tone: "warning",
      label: "Perlu perhatian",
      hint: "Boleh lanjut, tetapi keputusan tercatat menerima risiko ini.",
      items: []
    },
    {
      tone: "info",
      label: "Informasi",
      hint: "Catatan validator tanpa pengaruh pada keputusan.",
      items: []
    }
  ];
  for (const finding of findings) {
    const tone = findingTone(finding);
    const group = groups.find((candidate) => candidate.tone === tone);
    if (group) group.items.push(finding);
  }
  return groups.filter((group) => group.items.length > 0);
}

/* -------------------------------------------------------------- eksekusi */

export type ExecutionTone = "success" | "danger" | "info";

export function executionTone(status: string): ExecutionTone {
  const normalized = status.toLowerCase();
  if (/succeed|success|sent|completed|done|ok/.test(normalized)) return "success";
  if (/fail|error|blocked|denied|timeout|cancel/.test(normalized)) return "danger";
  return "info";
}

export function executionIcon(status: string): string {
  const tone = executionTone(status);
  return tone === "success" ? "check_circle" : tone === "danger" ? "error" : "pending";
}

/**
 * `executions[].result` adalah string JSON bebas (`result_json` di model).
 * Objek dirapikan menjadi `kunci=nilai`, string dipakai apa adanya. Tidak ada
 * nilai yang ditambahkan bila field-nya tidak ada.
 */
export function summarizeResult(result: string | null): string | null {
  const raw = text(result);
  if (!raw) return null;
  try {
    return describeValue(JSON.parse(raw), 300);
  } catch {
    return truncate(raw, 300);
  }
}

/** Objek → `kunci=nilai · kunci=nilai`. Dipakai untuk `result` dan `detail`. */
function describeValue(value: unknown, max: number): string | null {
  if (isRecord(value)) {
    const pairs = Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${key}=${compact(item, 80)}`);
    return pairs.length > 0 ? truncate(pairs.join(" · "), max) : null;
  }
  return truncate(compact(value, max), max);
}

/** Berapa kali sebuah mandat dipakai — dihitung dari eksekusi yang tercatat. */
export function usesOfMandate(mandateId: string, executions: ExecutionItem[]): number {
  return executions.filter((execution) => execution.mandate_id === mandateId).length;
}

/* ------------------------------------------------------------------ audit */

export type TimelineTone = "is-done" | "is-current" | "is-blocked";

const BLOCKED_PATTERN = /deny|denied|block|fail|reject|revoke|error|throttl/i;
const DONE_PATTERN = /execut|succeed|issu|complete|record|allow|approv/i;

export function timelineTone(event: AuditEventItem): TimelineTone {
  const decision = (text(event.decision) ?? "").toLowerCase();
  const eventType = text(event.event_type) ?? "";
  if (decision === "deny" || BLOCKED_PATTERN.test(eventType)) return "is-blocked";
  if (decision === "allow" || DONE_PATTERN.test(eventType)) return "is-done";
  return "is-current";
}

export function timelineIcon(tone: TimelineTone): string {
  return tone === "is-blocked" ? "block" : tone === "is-done" ? "check" : "chevron_right";
}

export function shortHash(hash: string | null | undefined, length = 10): string {
  const value = text(hash);
  if (!value) return "—";
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

export type TimelineEntry = {
  key: string;
  seq: number;
  at: string;
  label: string;
  actor: string;
  hash: string;
  hashShort: string;
  tone: TimelineTone;
  icon: string;
  detail: string | null;
};

/** Terlama dulu (`seq` menaik) — jejak dibaca sebagai urutan kejadian. */
export function buildTimeline(events: AuditEventItem[]): TimelineEntry[] {
  return [...events]
    .sort((left, right) => left.seq - right.seq)
    .map((event) => {
      const tone = timelineTone(event);
      const detail = isRecord(event.detail) ? describeValue(event.detail, 220) : null;
      return {
        key: event.id,
        seq: event.seq,
        at: event.at,
        label: (text(event.event_type) ?? "event").replace(/_/g, " "),
        actor: text(event.actor) ?? "tanpa aktor",
        hash: text(event.entry_hash) ?? "",
        hashShort: shortHash(event.entry_hash),
        tone,
        icon: timelineIcon(tone),
        detail
      };
    });
}
