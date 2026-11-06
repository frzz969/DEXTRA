/* DEXTRA Workflow — kontrak backend yang terdaftar (backend/dextra/main.py:67).
 *
 * Endpoint workflow ada di FastAPI v2: router workflows
 * (modules/workflows/router.py) — GET/POST /api/v1/workflows, /{id}/activate,
 * /{id}/runs, /runs, /runs/{id}/gates/{step_id}/approve, /runs/{id}/resume.
 * Daftar di bawah mencerminkan router yang ada; status 'live' per item.
 * Jembatan workflow/api.js probe-aware: live bila GET /api/v1/workflows
 * berhasil.
 *
 * Tidak ada URL yang dipanggil dari berkas ini. Tidak ada token atau rahasia.
 * Vocabulary selaras dengan packages/workflow (read-only) dan
 * packages/contracts/src/workflow.ts (StepType code|reasoning, RunStatus
 * queued|running|waiting_reasoning|completed|failed|cancelled), diperluas
 * untuk kebutuhan UI: waiting_approval, human_approval, tool, condition,
 * checkpoint.
 */
(function () {
  'use strict';

  var STATUS = {
    ACTIVE: 'active',
    DRAFT: 'draft',
    PAUSED: 'paused',
    FAILED: 'failed',
    DEPRECATED: 'deprecated'
  };

  var RUN_STATUS = {
    QUEUED: 'queued',
    RUNNING: 'running',
    WAITING_APPROVAL: 'waiting_approval',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  };

  var STEP_TYPE = {
    AGENT: 'agent',
    HUMAN_APPROVAL: 'human_approval',
    TOOL: 'tool',
    CONDITION: 'condition',
    CHECKPOINT: 'checkpoint'
  };

  /**
   * @typedef {Object} Workflow
   * @property {string} id
   * @property {string} name
   * @property {string} domain            mis. 'Legal', 'Finance'.
   * @property {string} version           Semver, mis. '3.1.2'.
   * @property {string} status            active|draft|paused|failed|deprecated.
   * @property {string} risk              low|medium|high.
   * @property {string} owner             Tim/peran pemilik.
   * @property {string} description
   * @property {string[]} triggers        mis. ['manual', 'schedule', 'webhook'].
   * @property {number|null} avgDurationMs
   * @property {number|null} successRateDemo  Persen DEMO, null bila tidak ada data.
   * @property {string|null} lastRunAt    ISO atau null.
   * @property {number} runCountDemo
   * @property {WorkflowStep[]} steps
   * @property {string} updatedAt
   */

  /**
   * @typedef {Object} WorkflowStep
   * @property {string} id
   * @property {string} name
   * @property {string} type              agent|human_approval|tool|condition|checkpoint.
   * @property {string} [tool]            Nama tool/MCP untuk type=tool (info, bukan eksekusi).
   * @property {string[]} dependsOn
   * @property {string} [condition]       Ekspresi kondisi ringkas untuk type=condition.
   * @property {string} [approverRole]    Peran approver untuk type=human_approval.
   * @property {number} [timeoutMinutes]  Timeout approval, menit.
   * @property {boolean} [optional]
   */

  /**
   * @typedef {Object} WorkflowRun
   * @property {string} runId             mis. 'run_20261028_001'.
   * @property {string} workflowId
   * @property {string} status            queued|running|waiting_approval|completed|failed|cancelled.
   * @property {string} trigger           manual|schedule|webhook|api.
   * @property {string|null} startedAt    ISO.
   * @property {number|null} durationMs
   * @property {string|null} currentStep  Step id yang sedang/terakhir dieksekusi.
   * @property {string|null} error        Pesan error bila gagal (DEMO).
   * @property {string} checkpointTotal
   * @property {number} checkpointDone
   * @property {string} requestedBy
   */

  /**
   * @typedef {Object} WorkflowCheckpoint
   * @property {string} id
   * @property {string} runId
   * @property {string} stepId
   * @property {string} label
   * @property {string} status            passed|failed|pending|skipped.
   * @property {string|null} at           ISO atau null bila pending.
   * @property {string} [note]
   */

  /**
   * @typedef {Object} ApprovalGate
   * @property {string} id
   * @property {string} runId
   * @property {string} stepId
   * @property {string} approverRole      mis. 'governance_lead'.
   * @property {string} reason            Alasan gerbang diajukan.
   * @property {number} timeoutMinutes
   * @property {string} requestedAt       ISO.
   * @property {string|null} planHash     Hash rencana (prefix) bila ada, mis. 'sha256:9f2c…'.
   * @property {string} status            pending|approved|rejected.
   */

  /* Kontrak ini mencerminkan router yang ada (modules/workflows/router.py).
   * Tidak ada GET /workflows/{id}, POST /workflows/{id}/run, /workflow-runs,
   * /retry, /trace, /checkpoints di backend — entri itu sudah dihapus. */
  var EXPECTED_ENDPOINTS = [
    { area: 'catalog', method: 'GET', path: '/api/v1/workflows',
      auth: 'view_all', status: 'live',
      ui: 'Daftar katalog workflow.' },
    { area: 'catalog', method: 'POST', path: '/api/v1/workflows',
      auth: 'manage_integrations', status: 'live',
      ui: 'Membuat workflow baru.' },
    { area: 'catalog', method: 'POST', path: '/api/v1/workflows/{id}/activate',
      auth: 'manage_integrations', status: 'live',
      ui: 'Mengaktifkan workflow.' },
    { area: 'runs', method: 'POST', path: '/api/v1/workflows/{id}/runs',
      auth: 'create_request', status: 'live',
      ui: 'Memulai run workflow (POST /workflows/{id}/runs).' },
    { area: 'runs', method: 'GET', path: '/api/v1/workflows/runs',
      auth: 'view_all', status: 'live',
      ui: 'Riwayat run lintas workflow.' },
    { area: 'runs', method: 'GET', path: '/api/v1/workflows/runs/{id}',
      auth: 'view_all', status: 'live',
      ui: 'Detail satu run.' },
    { area: 'runs', method: 'POST', path: '/api/v1/workflows/runs/{id}/gates/{step_id}/approve',
      auth: 'approve', status: 'live',
      ui: 'Menyetujui approval gate pada run.' },
    { area: 'runs', method: 'POST', path: '/api/v1/workflows/runs/{id}/resume',
      auth: 'create_request', status: 'live',
      ui: 'Melanjutkan run yang menunggu approval.' }
  ];

  window.DEXTRA_WORKFLOW_CONTRACTS = {
    STATUS: STATUS,
    RUN_STATUS: RUN_STATUS,
    STEP_TYPE: STEP_TYPE,
    EXPECTED_ENDPOINTS: EXPECTED_ENDPOINTS
  };
})();
