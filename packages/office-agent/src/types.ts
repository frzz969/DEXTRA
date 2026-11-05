import type { ActionType, Org, Plan } from '../../contracts/src/index.ts';

/** Dari mana permintaan masuk. Voice adalah transkrip yang sudah ada, bukan ASR. */
export type OfficeIntakeSource = 'text' | 'markdown' | 'txt' | 'voice_transcript';

/**
 * Permintaan mentah dari pemanggil.
 *
 * `requester_principal_id` WAJIB berasal dari principal yang diresolusi server
 * (token → roster), bukan dari badan permintaan klien. Tipe ini tidak bisa
 * menegakkan itu — `runOfficeAgent` menolak principal kosong, dan adapter MCP
 * mengisinya dari `resolvePrincipal`, bukan dari `args`.
 */
export interface RawOfficeRequest {
  request_id: string;
  org_id: string;
  requester_principal_id: string;
  instruction: string;
  document?: { filename: string; content: string };
  received_at?: string;
  source?: OfficeIntakeSource;
}

export interface OfficeDocumentRef {
  filename: string;
  content: string;
}

/** Permintaan yang sudah lolos intake: dinormalisasi, dibatasi, dan dicatat asalnya. */
export interface OfficeRequest {
  request_id: string;
  org_id: string;
  requester_principal_id: string;
  instruction: string;
  document: OfficeDocumentRef | null;
  received_at: string;
  source: OfficeIntakeSource;
  assumptions: string[];
}

export type BlockKind = 'heading' | 'paragraph' | 'list_item' | 'quote' | 'code';

export interface DocumentBlock {
  block_id: string;
  kind: BlockKind;
  level: number | null;
  text: string;
  line: number;
  /** Heading terdekat di atas blok ini, mis. "Keputusan". null bila belum ada heading. */
  section: string | null;
  /** true bila blok ini berbentuk perintah kepada sistem — tetap DATA, tidak pernah dijalankan. */
  instruction_like: boolean;
}

export interface NormalizedDocument {
  document_id: string;
  filename: string;
  source_sha256: string;
  bytes: number;
  blocks: DocumentBlock[];
  /** Daftar blok yang menyerupai instruksi. Dilaporkan, tidak dieksekusi. */
  instruction_like_block_ids: string[];
  warnings: string[];
  /** Dokumen selalu tidak dipercaya; field ini ada supaya pemanggil tidak lupa. */
  trust: 'untrusted_data';
}

export interface SourceRef {
  /** `null` bila kalimat berasal dari instruksi pengguna, bukan dari dokumen. */
  document_id: string | null;
  document_sha256: string | null;
  block_id: string;
  line: number | null;
  quote: string;
}

export interface ScheduleHint {
  date: string | null;
  weekday: number | null;
  time: string | null;
  timezone_hint: string | null;
  raw: string | null;
}

export interface ExtractedActionItem {
  item_id: string;
  source: SourceRef;
  action_type: ActionType;
  description: string;
  recipient: { hint: string | null; department: string | null };
  schedule_hint: ScheduleHint;
  due_hint: string | null;
  location: string | null;
  content_draft: { subject: string | null; body: string };
  /** Field yang belum bisa diisi tanpa mengarang. Menjadi pertanyaan klarifikasi. */
  missing: string[];
  method: 'deterministic';
}

export interface DecisionItem {
  decision_id: string;
  text: string;
  source: SourceRef;
}

export interface Decomposition {
  goal: string;
  decisions: DecisionItem[];
  action_items: ExtractedActionItem[];
  unresolved: string[];
  method: 'deterministic';
}

export type ClarificationCode =
  | 'AMBIGUOUS_RECIPIENT'
  | 'MISSING_RECIPIENT'
  | 'MISSING_TIME'
  | 'MISSING_DURATION'
  | 'UNRESOLVED_DATE'
  | 'MISSING_TIMEZONE'
  | 'UNKNOWN_CONTACT';

export interface ClarificationOption {
  value: string;
  label: string;
  detail: string | null;
}

export interface ClarificationQuestion {
  question_id: string;
  code: ClarificationCode;
  item_id: string | null;
  prompt: string;
  options: ClarificationOption[];
  blocking: boolean;
}

export interface ClarificationAnswer {
  question_id: string;
  value: string;
  answered_by_principal_id: string;
  answered_at: string;
  source: 'human';
}

export interface ClarificationSession {
  session_id: string;
  request_id: string;
  document_id: string | null;
  questions: ClarificationQuestion[];
  answers: ClarificationAnswer[];
  status: 'open' | 'answered';
  created_at: string;
  updated_at: string;
}

export type OfficePolicySeverity = 'info' | 'warning' | 'blocking';

export interface OfficePolicyFinding {
  code: string;
  severity: OfficePolicySeverity;
  item_id: string | null;
  message: string;
  alternatives: string[];
}

export interface ResolvedAction {
  item_id: string;
  source: SourceRef;
  action_type: ActionType;
  contact: { contact_id: string; display_name: string; masked_address: string; department: string };
  schedule: { start_at: string; end_at: string | null; timezone: string; all_day: boolean };
  content: { subject: string | null; body: string };
  assumptions: string[];
}

export interface ValidationCheck {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface ValidationReport {
  verdict: 'pass' | 'warn' | 'fail';
  checks: ValidationCheck[];
}

export interface OfficeAgentRunInput {
  request_id: string;
  instruction: string;
  document?: OfficeDocumentRef;
  /** Diisi adapter dari principal server-side. Tidak pernah dari badan permintaan. */
  requester_principal_id: string;
  received_at?: string;
}

export interface OfficeAgentRunOptions {
  org: Org;
  calendar: ReadonlyArray<{ event_id: string; title: string; start_at: string; end_at: string; timezone: string; attendees: string[] }>;
  /** Asumsi eksplisit dari pemohon; dicatat, bukan disembunyikan. */
  assumptions?: { time_of_day?: string; duration_minutes?: number; timezone?: string };
  answers?: Array<{ question_id: string; value: string }>;
  now?: Date;
}

export interface OfficeAgentRunResult {
  status: 'needs_clarification' | 'plan_ready' | 'blocked' | 'failed';
  plan: Plan | null;
  decomposition: Decomposition;
  session: ClarificationSession | null;
  resolved_actions: ResolvedAction[];
  policy_findings: OfficePolicyFinding[];
  validation: ValidationReport;
  audit_event_ids: string[];
  assumptions: string[];
  error: { code: string; message: string } | null;
}
