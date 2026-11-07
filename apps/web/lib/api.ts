/**
 * Klien API DEXTRA untuk apps/web.
 *
 * Dua jalur otentikasi, dipilih otomatis di server:
 * 1. Sesi pengguna (cookie `dextra_session` + CSRF) bila cookie ada —
 *    wewenang mengikuti role pengguna di sesi. Cookie TIDAK pernah dikirim
 *    ke browser; ia hanya diteruskan server → API.
 * 2. Bearer token dari environment (DEXTRA_API_TOKEN) selain itu — mode
 *    demo / headless. Token tidak pernah sampai ke browser.
 *
 * Kalau API tidak tersedia, fungsi ini mengembalikan `{ ok: false }` — bukan
 * data contoh. Halaman harus menampilkan keadaan "tidak tersedia" apa adanya.
 */
import { cookies } from "next/headers";

export type OverviewKpi = {
  active_agents: number;
  open_work_packages: number;
  pending_approvals: number;
  failed_executions: number;
  active_mandates: number;
};

export type Overview = {
  generated_at: string;
  scope: string;
  kpi: OverviewKpi;
  unavailable: string[];
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

const BASE_URL = process.env.DEXTRA_API_URL ?? "http://127.0.0.1:8000";
const TOKEN = process.env.DEXTRA_API_TOKEN ?? "";
const SESSION_COOKIE = process.env.DEXTRA_SESSION_COOKIE ?? "dextra_session";
const CSRF_COOKIE = process.env.DEXTRA_CSRF_COOKIE ?? "dextra_csrf";

export const apiAuth = {
  sessionCookie: SESSION_COOKIE,
  csrfCookie: CSRF_COOKIE,
  hasToken: TOKEN.length > 0
} as const;

/**
 * Header otentikasi sesuai cookie yang ada. Diekspor untuk server actions —
 * mereka wajib memakai wewenang yang sama dengan halaman, bukan token tetap.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const store = await cookies();
    const session = store.get(SESSION_COOKIE)?.value;
    if (session) {
      const csrf = store.get(CSRF_COOKIE)?.value ?? "";
      return csrf
        ? { Cookie: `${SESSION_COOKIE}=${session}; ${CSRF_COOKIE}=${csrf}`, "X-CSRF-Token": csrf }
        : { Cookie: `${SESSION_COOKIE}=${session}` };
    }
  } catch {
    // cookies() di luar konteks request (mis. build) — pakai token saja.
  }
  if (!TOKEN) throw new Error("DEXTRA_API_TOKEN belum diisi.");
  return { Authorization: `Bearer ${TOKEN}` };
}

export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
    return { ok: false, error: "DEXTRA_API_TOKEN belum diisi; UI tidak boleh mengarang data." };
  }
  try {
    const response = await fetch(`${BASE_URL}/api/v1${path}`, {
      headers,
      // Tanpa cache: angka basi lebih berbahaya daripada pesan "tidak tersedia".
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, error: `API menolak permintaan (HTTP ${response.status}).`, status: response.status };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }
}

/** Tulis ke API dengan otentikasi yang sama. Body JSON, respons diparse bila ada. */
export async function apiWrite<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<ApiResult<T>> {
  let headers: Record<string, string>;
  try {
    headers = await authHeaders();
  } catch {
    return { ok: false, error: "DEXTRA_API_TOKEN belum diisi; UI tidak boleh mengarang data." };
  }
  try {
    const response = await fetch(`${BASE_URL}/api/v1${path}`, {
      method,
      headers: {
        ...headers,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const text = await response.text();
    const parsed = text ? (JSON.parse(text) as unknown) : undefined;
    if (!response.ok) {
      const detail =
        (parsed as { detail?: string | { detail?: string } } | undefined)?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : typeof detail === "object" && detail && "detail" in detail
            ? String((detail as { detail: unknown }).detail)
            : `API menolak permintaan (HTTP ${response.status}).`;
      return { ok: false, error: message, status: response.status };
    }
    return { ok: true, data: parsed as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }
}

export async function getOverview(): Promise<ApiResult<Overview>> {
  return apiGet<Overview>("/overview");
}

/* P2b — workforce & intelligence. Semua fungsi di bawah memanggil API :8000
 * yang sama; kegagalan dikembalikan sebagai { ok: false }, bukan data contoh. */

export type Agent = {
  id: string;
  slug: string;
  display_name: string;
  agent_type: string;
  /* Non-null di backend (`models/workforce.py`: `description` = Text, nullable=False,
   * default ""). Kosong berarti string kosong, bukan null. */
  description: string;
  model_provider: string | null;
  status: string;
  is_enabled: boolean;
  capabilities: string[];
  versions?: number;
};

export type AgentsResponse = {
  items: Agent[];
  expected_specialists: string[];
  unexpected: string[];
};

export async function getAgents(): Promise<ApiResult<AgentsResponse>> {
  return apiGet<AgentsResponse>("/agents");
}

export async function getAgent(slug: string): Promise<ApiResult<Agent>> {
  return apiGet<Agent>(`/agents/${encodeURIComponent(slug)}`);
}

export type AgentUpdate = {
  display_name?: string;
  description?: string;
  status?: string;
  is_enabled?: boolean;
  model_provider?: string;
};

export async function updateAgent(slug: string, body: AgentUpdate): Promise<ApiResult<Agent>> {
  return apiWrite<Agent>("PATCH", `/agents/${encodeURIComponent(slug)}`, body);
}

export type SkillItem = {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  status: string;
  latest_version: string | null;
  is_system: boolean;
  created_at: string;
};

export async function getSkills(): Promise<ApiResult<{ items: SkillItem[] }>> {
  return apiGet<{ items: SkillItem[] }>("/skills");
}

export type SkillVersion = {
  version: string;
  status: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  required_capabilities: string[];
  notes: string;
  published_at: string | null;
  created_at: string;
};

export type SkillDetail = SkillItem & { versions: SkillVersion[] };

export async function getSkill(slug: string): Promise<ApiResult<SkillDetail>> {
  return apiGet<SkillDetail>(`/skills/${encodeURIComponent(slug)}`);
}

export async function setSkillStatus(slug: string, status: string): Promise<ApiResult<SkillDetail>> {
  return apiWrite<SkillDetail>("POST", `/skills/${encodeURIComponent(slug)}/status`, { status });
}

export type WorkflowStep = {
  id: string;
  type?: string;
  depends_on?: string[];
  max_attempts?: number;
  params?: Record<string, unknown>;
};

export type WorkflowItem = {
  id: string;
  name: string;
  version: number;
  description: string;
  status: string;
  steps: WorkflowStep[];
  created_at: string;
};

export async function getWorkflows(): Promise<ApiResult<{ items: WorkflowItem[]; tenant_id?: string }>> {
  return apiGet<{ items: WorkflowItem[]; tenant_id?: string }>("/workflows");
}

export type WorkflowStepRun = {
  step_id: string;
  status: string;
  attempts: number;
  error: string | null;
  output: unknown;
  started_at: string | null;
  finished_at: string | null;
  approved_by: string | null;
};

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  status: string;
  idempotency_key: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  steps: WorkflowStepRun[];
};

export async function getWorkflowRuns(): Promise<ApiResult<{ items: WorkflowRun[] }>> {
  return apiGet<{ items: WorkflowRun[] }>("/workflows/runs");
}

export async function getWorkflowRun(runId: string): Promise<ApiResult<WorkflowRun>> {
  return apiGet<WorkflowRun>(`/workflows/runs/${encodeURIComponent(runId)}`);
}

export async function startWorkflowRun(
  workflowId: string,
  idempotencyKey: string
): Promise<ApiResult<WorkflowRun>> {
  return apiWrite<WorkflowRun>("POST", `/workflows/${encodeURIComponent(workflowId)}/runs`, {
    idempotency_key: idempotencyKey,
    inputs: {}
  });
}

export async function resumeWorkflowRun(runId: string): Promise<ApiResult<WorkflowRun>> {
  return apiWrite<WorkflowRun>("POST", `/workflows/runs/${encodeURIComponent(runId)}/resume`);
}

export type ExecutionItem = {
  id: string;
  plan_id: string | null;
  mandate_id: string | null;
  action_id: string | null;
  status: string;
  adapter: string | null;
  started_at: string | null;
  duration_ms: number | null;
  result: string | null;
};

export async function getExecutions(limit = 200): Promise<ApiResult<{ items: ExecutionItem[] }>> {
  const path = `/executions${limit > 0 ? `?limit=${limit}` : ""}`;
  return apiGet<{ items: ExecutionItem[] }>(path);
}

export async function getApprovals(): Promise<ApiResult<{ items: ApprovalItem[] }>> {
  return apiGet<{ items: ApprovalItem[] }>("/approvals");
}

export async function getAuditEvents(limit = 100, offset = 0): Promise<ApiResult<{ items: AuditEvent[] }>> {
  return apiGet<{ items: AuditEvent[] }>(`/audit-events?limit=${limit}&offset=${offset}`);
}

export async function getWorkPackages(): Promise<ApiResult<{ items: WorkPackageItem[] }>> {
  return apiGet<{ items: WorkPackageItem[] }>("/work-packages");
}

/* ---------- P1 parity: tambahan yang belum ada di atas ---------- */
export type TaskItem = { id: string; work_package_id: string; title: string; status: string; assigned_agent_id: string | null };
export type PlanItem = { id: string; title?: string; status?: string; summary?: string; created_at?: string };
export type AssignmentItem = { id: string; task_id: string; agent_id: string; role: string };

export const getTasks = () => apiGet<{ items: TaskItem[] }>("/tasks");
export const getPlanDetail = (id: string) => apiGet<Record<string, unknown>>(`/office-agent/plans/${id}`);
export const getTaskAssignments = (id: string) => apiGet<{ items: AssignmentItem[] }>(`/tasks/${id}/assignments`);

/* Governance (P2a) — typed helpers over /api/v1. Failure → { ok: false }. */

export type ApprovalItem = {
  id: string;
  plan_id: string;
  approver_id: string | null;
  decision: string;
  reason: string | null;
  decided_at: string | null;
  mandate_id: string | null;
};

export type PlanActionItem = {
  action_id: string;
  action_type: string;
  params?: Record<string, unknown>;
  source_ref?: Record<string, unknown>;
};

/**
 * Temuan validator. `backend/.../office_agent/router.py` menyimpan `findings`
 * sebagai `list[dict]` apa adanya, jadi bentuknya ditentukan pengirim rencana:
 * policy engine menulis `decision` (allow|deny|review), worker lain menulis
 * `severity` (blocking|warning). Keduanya opsional dan dibaca tanpa menebak.
 */
export type PlanFinding = {
  code?: string;
  message?: string;
  severity?: string;
  decision?: string;
  policy_slug?: string;
  [k: string]: unknown;
};

export type OfficePlan = {
  id: string;
  request_id: string;
  plan_id: string;
  plan_hash: string;
  status: string;
  actions: PlanActionItem[];
  findings: PlanFinding[];
  validation: Record<string, unknown>;
  created_at: string;
};

export type MandateItem = {
  id: string;
  plan_id: string;
  approval_id: string | null;
  action_id: string;
  action_type: string;
  resource_scope: string | null;
  recipient_scope: string | null;
  approver_id: string | null;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  usable: boolean;
};

export type PolicyItem = {
  id: string;
  slug: string;
  title: string;
  scope: string;
  is_active: boolean;
  versions: number;
};

export type AuditEventItem = {
  id: string;
  seq: number;
  at: string;
  event_type: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  decision: string | null;
  /* Dikembalikan `GET /audit-events` (lihat modules/audit/router.py) tetapi
   * sebelumnya tidak ditipekan — tanpa ini halaman tidak bisa menautkan event
   * ke rencana tanpa menebak. */
  scope?: string | null;
  plan_id?: string | null;
  mandate_id?: string | null;
  execution_id?: string | null;
  correlation_id?: string | null;
  detail: unknown;
  entry_hash: string;
};

export const getGovernanceApprovals = () =>
  apiGet<{ items: ApprovalItem[]; note?: string }>("/approvals");

export const getOfficePlans = () =>
  apiGet<{ items: OfficePlan[] }>("/office-agent/plans");

export const getOfficePlan = (planId: string) =>
  apiGet<OfficePlan>(`/office-agent/plans/${encodeURIComponent(planId)}`);

/* ---------- Tautan plan -> eksekusi / mandat / audit ----------
 *
 * Tidak satu pun endpoint di bawah menerima filter `plan_id`: `GET /executions`
 * hanya punya `limit` (dipangkas 200 di server), `GET /mandates` tidak punya
 * parameter, `GET /audit-events` hanya `limit`/`offset`. Jadi penyaringan
 * dilakukan di sini setelah satu halaman terbaru diambil.
 *
 * `complete: false` berarti batas halaman tercapai — mungkin ada baris lebih
 * lama yang tidak ikut diperiksa. UI wajib menyebut itu, bukan mengklaim daftar
 * lengkap. */

export type PlanScoped<T> = {
  items: T[];
  /** Jumlah baris yang benar-benar diperiksa dari API. */
  scanned: number;
  /** False bila batas halaman tercapai: hasil bisa terpotong. */
  complete: boolean;
};

export async function getExecutionsForPlan(
  planId: string,
  limit = 200
): Promise<ApiResult<PlanScoped<ExecutionItem>>> {
  const result = await apiGet<{ items: ExecutionItem[] }>(`/executions?limit=${limit}`);
  if (!result.ok) return result;
  const rows = result.data.items;
  return {
    ok: true,
    data: {
      items: rows.filter((row) => row.plan_id === planId),
      scanned: rows.length,
      complete: rows.length < limit
    }
  };
}

export async function getMandatesForPlan(
  planId: string,
  limit = 200
): Promise<ApiResult<PlanScoped<MandateItem>>> {
  const result = await apiGet<{ items: MandateItem[] }>("/mandates");
  if (!result.ok) return result;
  const rows = result.data.items;
  return {
    ok: true,
    data: {
      items: rows.filter((row) => row.plan_id === planId),
      scanned: rows.length,
      complete: rows.length < limit
    }
  };
}

/**
 * Audit untuk satu rencana. Dua jalur pencocokan, keduanya field nyata:
 * `plan_id` (event yang menyebut rencananya) dan `resource` (event
 * `office_plan_received` ditulis dengan `plan_id` kosong dan nama rencana di
 * `resource` — lihat `audit_repo.append_event` di router office-agent).
 */
export async function getAuditEventsForPlan(
  planId: string,
  limit = 200
): Promise<ApiResult<PlanScoped<AuditEventItem>>> {
  const result = await apiGet<{ items: AuditEventItem[] }>(`/audit-events?limit=${limit}&offset=0`);
  if (!result.ok) return result;
  const rows = result.data.items;
  return {
    ok: true,
    data: {
      items: rows.filter((row) => row.plan_id === planId || row.resource === planId),
      scanned: rows.length,
      complete: rows.length < limit
    }
  };
}

export type OfficePlanCreatePayload = {
  request_id: string;
  plan_id: string;
  source: Record<string, unknown>;
  document: Record<string, unknown>;
  actions: Array<{ action_id: string; action_type: string; params: Record<string, unknown>; source_ref: Record<string, unknown> }>;
  findings: Array<Record<string, unknown>>;
  validation: Record<string, unknown>;
};

export const createOfficePlan = (payload: OfficePlanCreatePayload) =>
  apiWrite<OfficePlan>("POST", "/office-agent/plans", payload);

export type ServiceAccount = {
  id: string;
  name: string;
  kind: string;
  description: string;
  status: string;
  scopes: string[];
  token_count?: number;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
};

export type ServiceAccountDetail = ServiceAccount & {
  tokens: Array<{ id: string; name: string; prefix: string; status: string; last_used_at: string | null }>;
};

export const getServiceAccounts = () =>
  apiGet<{ items: ServiceAccount[]; kinds: string[] }>("/service-accounts");

export const getServiceAccount = (id: string) =>
  apiGet<ServiceAccountDetail>(`/service-accounts/${encodeURIComponent(id)}`);

export const revokeServiceAccount = (id: string, reason: string) =>
  apiWrite<ServiceAccountDetail>("POST", `/service-accounts/${encodeURIComponent(id)}/revoke`, { reason });

export const getMandates = () => apiGet<{ items: MandateItem[] }>("/mandates");

export const getMandate = (id: string) =>
  apiGet<MandateItem>(`/mandates/${encodeURIComponent(id)}`);

export const getPolicies = () =>
  apiGet<{ items: PolicyItem[]; writable: boolean }>("/policies");

export type AuditEvent = AuditEventItem;
export type WorkPackageItem = { id: string; title: string; status: string; priority: string; task_count: number; due_at: string | null };

export const verifyAuditChain = () =>
  apiGet<{ ok: boolean; checked: number; broken_at_seq?: number; chain_versions?: number[] }>(
    "/audit-events/verify"
  );

/** Approve/reject satu tindakan pada plan via endpoint resmi office-agent. */
export function approvePlanAction(
  planId: string,
  actionId: string,
  decision: "approved" | "rejected",
  reason: string,
  ttlMinutes = 30
) {
  return apiWrite<{
    approval_id: string;
    mandate_id: string | null;
    action_id: string;
    decision: string;
  }>(
    "POST",
    `/office-agent/plans/${encodeURIComponent(planId)}/actions/${encodeURIComponent(actionId)}/approve`,
    { decision, reason, ttl_minutes: ttlMinutes }
  );
}

/**
 * Endpoint yang tidak berada di bawah `/api/v1` (mis. `/health`). Publik —
 * tanpa Authorization. Hanya untuk endpoint yang memang publik.
 */
/* ---------- P3a — administration (read + write via API resmi) ----------
 * Semua fungsi di bawah memanggil endpoint :8000 yang benar-benar ada.
 * Endpoint yang tidak ada (status konektor, pengaturan, seed/reset/export,
 * mutasi anggota) TIDAK dibuatkan getter: halamannya menampilkan banner
 * jujur, bukan data contoh. */

export type PermissionsResponse = {
  scope: string;
  principal: {
    principal_id?: string;
    display_name?: string;
    email?: string;
    role?: string;
    kind?: string;
    tenant_id?: string;
  } | null;
  capabilities: string[];
  enforced_capabilities: string[];
  unbacked_capabilities: string[];
  all_capabilities: string[];
  scope_capabilities: Record<string, string[]>;
  note?: string;
};

export type MemberItem = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  is_default?: boolean;
  joined_at: string;
};

export type RoleItem = {
  id: string;
  name: string;
  description: string;
  is_system: boolean;
  capabilities: string[];
};

export type TokenItem = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  status: string;
  owner: string;
  owner_id: string | null;
  created_at?: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  rotated_from_id?: string | null;
};

/** Secret hanya muncul sekali pada respons buat/rotasi. Jangan disimpan. */
export type CreatedToken = TokenItem & { token: string; note?: string };

export type ServiceAccountItem = {
  id: string;
  name: string;
  kind: string;
  description?: string;
  status: string;
  scopes?: string[];
  token_count: number;
  created_at: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
};

export type MetaResponse = {
  api_prefix: string;
  capabilities: string[];
  enforced_capabilities: string[];
  unbacked_capabilities: string[];
  auth_kind: string;
};

export type HealthResponse = {
  ok: boolean;
  service: string;
  version: string;
  database: { ok: boolean };
  environment: string;
};

export const getPermissions = () => apiGet<PermissionsResponse>("/permissions");
export const getMembers = () =>
  apiGet<{ items: MemberItem[]; tenant_id?: string }>("/users");
export const getRoles = () => apiGet<{ items: RoleItem[] }>("/roles");
export const getTokens = () =>
  apiGet<{ items: TokenItem[]; tenant_id?: string }>("/tokens");
// getServiceAccounts + revokeServiceAccount sudah ada di atas (P2) — jangan diduplikasi.
export const getMeta = () => apiGet<MetaResponse>("/meta");
export const getHealth = () => apiRootGet<HealthResponse>("/health");

export type CreateTokenInput = {
  name: string;
  scopes: string[];
  service_account_id?: string;
  expires_in_days?: number;
};

export const createToken = (body: CreateTokenInput) =>
  apiWrite<CreatedToken>("POST", "/tokens", body);

export const revokeToken = (tokenId: string, reason = "") =>
  apiWrite<TokenItem>("POST", `/tokens/${encodeURIComponent(tokenId)}/revoke`, { reason });

export const rotateToken = (tokenId: string, expiresInDays?: number) =>
  apiWrite<CreatedToken>("POST", `/tokens/${encodeURIComponent(tokenId)}/rotate`, {
    expires_in_days: expiresInDays,
  });

export type CreateServiceAccountInput = {
  name: string;
  kind: string;
  description: string;
  scopes: string[];
};

export const createServiceAccount = (body: CreateServiceAccountInput) =>
  apiWrite<ServiceAccountItem>("POST", "/service-accounts", body);

// revokeServiceAccount memakai definisi P2 di atas (POST .../revoke dengan { reason }).

/* ---------- Endpoint demo-ready baru (sudah live di :8000) ---------- */

export type SearchHit = {
  entity: string;
  id: string;
  title: string;
  status: string;
  href: string;
};

export type SearchResponse = { q: string; items: SearchHit[]; count: number };

export const SEARCH_PER_ENTITY_LIMIT = 20;

export function search(q: string): Promise<ApiResult<SearchResponse>> {
  return apiGet<SearchResponse>(`/search?q=${encodeURIComponent(q)}`);
}

export type AnalyticsDay = {
  date: string;
  total: number;
  succeeded: number;
  failed: number;
  blocked: number;
  pending: number;
  running: number;
  skipped: number;
};

export type AnalyticsDailyResponse = { tenant_id: string; items: AnalyticsDay[] };

export const getAnalyticsDaily = () =>
  apiGet<AnalyticsDailyResponse>("/analytics/daily");

export type WorkPackageTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  assigned_agent_id: string | null;
  sort_order: number | null;
};

export type WorkPackageDetail = {
  id: string;
  title: string;
  status: string;
  priority: string;
  org_id: string | null;
  tenant_id: string | null;
  due_at: string | null;
  created_at: string | null;
  tasks: WorkPackageTask[];
};

export const getWorkPackageDetail = (id: string) =>
  apiGet<WorkPackageDetail>(`/work-packages/${encodeURIComponent(id)}`);

export type PolicyVersionItem = {
  id: string;
  version: number;
  rules_json: unknown;
  change_note: string | null;
  created_at: string | null;
};

export type PolicyVersionsResponse = {
  policy_id: string;
  slug: string;
  items: PolicyVersionItem[];
};

export const getPolicyVersions = (slug: string) =>
  apiGet<PolicyVersionsResponse>(`/policies/${encodeURIComponent(slug)}/versions`);

export type IntegrationStatusItem = {
  name: string;
  configured: boolean;
  status: string;
  adapter: string | null;
  detail: string;
  evidence: string;
};

export const getIntegrationsStatus = () =>
  apiGet<{ items: IntegrationStatusItem[]; tenant_id: string | null }>("/integrations/status");

export type SettingsResponse = {
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  settings: Record<string, unknown>;
};

export const getSettings = () => apiGet<SettingsResponse>("/settings");

export const updateSettings = (settings: Record<string, unknown>) =>
  apiWrite<SettingsResponse>("PATCH", "/settings", { settings });

export async function apiRootGet<T>(path: string): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
    if (!response.ok) {
      return { ok: false, error: `Endpoint publik menolak permintaan (HTTP ${response.status}).`, status: response.status };
    }
    return { ok: true, data: (await response.json()) as T };
  } catch (error) {
    const message = error instanceof Error ? error.message : "gagal menghubungi API";
    return { ok: false, error: message };
  }
}
