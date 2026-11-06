/* DEXTRA Workflow — data contoh (DEMO).
 *
 * Semua yang ada di sini adalah contoh tertulis, BUKAN hasil server dan
 * BUKAN bukti bahwa workflow pernah berjalan/disetujui/diulang di backend.
 * Endpoint workflow ada di backend v2 (router workflows,
 * backend/dextra/main.py:67 — GET/POST /api/v1/workflows, /{id}/activate,
 * /{id}/runs, /runs, /runs/{id}/gates/{step_id}/approve, /runs/{id}/resume);
 * jembatan workflow/api.js probe-aware memakai endpoint itu bila live.
 * Data ini hanya dipakai saat mode demo (backend tak tercapai); tiap angka
 * (success rate, durasi, jumlah run) berlabel DEMO.
 * Timestamp dipatok agar tampilan stabil; tidak ada waktu "sekarang".
 * Tidak ada kredensial, host, atau rahasia di berkas ini.
 *
 * Kosakata selaras packages/workflow (read-only): langkah dideklarasikan
 * statis, depends_on menegakkan urutan; engine server (packages/workflow)
 * membedakan step code|reasoning, sedangkan UI mengenal agent|human_approval|
 * tool|condition|checkpoint. Keduanya sengaja tidak dicampuradukkan di sini.
 */
(function () {
  'use strict';

  /* ---------- Langkah per workflow (statis, urutan via dependsOn) ---------- */

  var stepsMeeting = [
    { id: 'ingest',   name: 'Ingest ringkasan rapat',   type: 'tool',       tool: 'calendar.read',      dependsOn: [], optional: false },
    { id: 'extract',  name: 'Ekstrak keputusan & aksi', type: 'agent',      dependsOn: ['ingest'], optional: false },
    { id: 'assign',   name: 'Usulkan penanggung jawab', type: 'agent',      dependsOn: ['extract'], optional: false },
    { id: 'review',   name: 'Review manajer (approval)',type: 'human_approval', approverRole: 'operations_manager', timeoutMinutes: 240, dependsOn: ['assign'], optional: false },
    { id: 'publish',  name: 'Terbitkan notulen & tiket',type: 'tool',       tool: 'tickets.create',     dependsOn: ['review'], optional: false }
  ];

  var stepsContract = [
    { id: 'intake',   name: 'Terima dokumen kontrak',   type: 'tool',       tool: 'docs.read',          dependsOn: [], optional: false },
    { id: 'parse',    name: 'Parse klausul & pihak',    type: 'agent',      dependsOn: ['intake'], optional: false },
    { id: 'risk',     name: 'Skor risiko per klausul',  type: 'agent',      dependsOn: ['parse'], optional: false },
    { id: 'threshold',name: 'Risiko di atas ambang?',   type: 'condition',  condition: 'risk.max >= 0.7', dependsOn: ['risk'], optional: false },
    { id: 'legal_gate', name: 'Gerbang legal (approval)', type: 'human_approval', approverRole: 'legal_counsel', timeoutMinutes: 480, dependsOn: ['threshold'], optional: false },
    { id: 'cp_final', name: 'Checkpoint kontrak final', type: 'checkpoint', dependsOn: ['legal_gate'], optional: false },
    { id: 'archive',  name: 'Arsip + catatan audit',    type: 'tool',       tool: 'audit.write',        dependsOn: ['cp_final'], optional: false }
  ];

  var stepsInvoice = [
    { id: 'fetch',    name: 'Ambil invoice masuk',      type: 'tool',       tool: 'invoice.list',       dependsOn: [], optional: false },
    { id: 'match',    name: 'Cocokkan PO & penerimaan', type: 'agent',      dependsOn: ['fetch'], optional: false },
    { id: 'variance', name: 'Selisih di atas toleransi?', type: 'condition', condition: 'variance_pct > 2', dependsOn: ['match'], optional: false },
    { id: 'cp_recon', name: 'Checkpoint rekonsiliasi',  type: 'checkpoint', dependsOn: ['variance'], optional: false },
    { id: 'post',     name: 'Posting ke buku besar',    type: 'tool',       tool: 'ledger.post',        dependsOn: ['cp_recon'], optional: false }
  ];

  var stepsBrief = [
    { id: 'collect',  name: 'Kumpulkan metrik mingguan', type: 'tool',      tool: 'metrics.query',      dependsOn: [], optional: false },
    { id: 'draft',    name: 'Susun draf brief',          type: 'agent',     dependsOn: ['collect'], optional: false },
    { id: 'edit',     name: 'Edit editorial',            type: 'agent',     dependsOn: ['draft'], optional: true },
    { id: 'send',     name: 'Kirim ke kanal ops',        type: 'tool',      tool: 'slack.post',         dependsOn: ['edit'], optional: false }
  ];

  var stepsPolicy = [
    { id: 'request',  name: 'Terima pengajuan exception', type: 'tool',     tool: 'forms.read',         dependsOn: [], optional: false },
    { id: 'analyze',  name: 'Analisis dampak & preseden', type: 'agent',    dependsOn: ['request'], optional: false },
    { id: 'gov_gate', name: 'Gerbang governance (approval)', type: 'human_approval', approverRole: 'governance_lead', timeoutMinutes: 720, dependsOn: ['analyze'], optional: false },
    { id: 'cp_policy',name: 'Checkpoint keputusan',       type: 'checkpoint', dependsOn: ['gov_gate'], optional: false },
    { id: 'record',   name: 'Catat di register exception', type: 'tool',    tool: 'register.write',     dependsOn: ['cp_policy'], optional: false }
  ];

  var stepsVendor = [
    { id: 'kyc',      name: 'Kumpulkan dokumen KYC',     type: 'tool',      tool: 'docs.read',          dependsOn: [], optional: false },
    { id: 'screen',   name: 'Screening sanksi & media',  type: 'agent',     dependsOn: ['kyc'], optional: false },
    { id: 'risk_ok',  name: 'Lolos screening?',          type: 'condition', condition: 'screen.hits == 0', dependsOn: ['screen'], optional: false },
    { id: 'proc_gate',name: 'Gerbang procurement (approval)', type: 'human_approval', approverRole: 'procurement_lead', timeoutMinutes: 480, dependsOn: ['risk_ok'], optional: false },
    { id: 'onboard',  name: 'Aktivasi vendor di ERP',    type: 'tool',      tool: 'erp.vendor_create',  dependsOn: ['proc_gate'], optional: false }
  ];

  var stepsAudit = [
    { id: 'export',   name: 'Ekspor paket audit',        type: 'tool',      tool: 'audit.export',       dependsOn: [], optional: false },
    { id: 'verify',   name: 'Verifikasi hash & kelengkapan', type: 'agent', dependsOn: ['export'], optional: false },
    { id: 'cp_audit', name: 'Checkpoint verifikasi',     type: 'checkpoint', dependsOn: ['verify'], optional: false },
    { id: 'sign',     name: 'Tanda tangan bukti',        type: 'tool',      tool: 'sign.detached',      dependsOn: ['cp_audit'], optional: false }
  ];

  var stepsSupport = [
    { id: 'ticket',   name: 'Ambil tiket masuk',         type: 'tool',      tool: 'helpdesk.list',      dependsOn: [], optional: false },
    { id: 'classify', name: 'Klasifikasi intent & urgensi', type: 'agent',  dependsOn: ['ticket'], optional: false },
    { id: 'route',    name: 'Rutekan ke antrean tepat',  type: 'tool',      tool: 'helpdesk.route',     dependsOn: ['classify'], optional: false }
  ];

  var workflows = [
    { id: 'wf_meeting_action', name: 'Meeting to Action', domain: 'Operations', version: '2.4.0', status: 'active',
      risk: 'low', owner: 'Ops Enablement', description: 'Mengubah notulen rapat menjadi keputusan terstruktur, aksi, dan tiket tindak lanjut.',
      triggers: ['manual', 'webhook'], avgDurationMs: 184000, successRateDemo: 96, runCountDemo: 214,
      lastRunAt: '2026-11-03T09:12:00+07:00', updatedAt: '2026-10-28T14:00:00+07:00', steps: stepsMeeting },

    { id: 'wf_contract_review', name: 'Contract Review', domain: 'Legal', version: '3.1.2', status: 'active',
      risk: 'high', owner: 'Legal Ops', description: 'Review klausul kontrak, skor risiko, dan gerbang persetujuan legal sebelum arsip.',
      triggers: ['manual', 'api'], avgDurationMs: 612000, successRateDemo: 88, runCountDemo: 137,
      lastRunAt: '2026-11-02T16:45:00+07:00', updatedAt: '2026-10-30T10:20:00+07:00', steps: stepsContract },

    { id: 'wf_invoice_recon', name: 'Invoice Reconciliation', domain: 'Finance', version: '1.9.0', status: 'active',
      risk: 'medium', owner: 'Finance Ops', description: 'Mencocokkan invoice dengan PO dan penerimaan barang; menandai selisih di atas toleransi.',
      triggers: ['schedule', 'manual'], avgDurationMs: 245000, successRateDemo: 93, runCountDemo: 328,
      lastRunAt: '2026-11-04T06:30:00+07:00', updatedAt: '2026-10-25T09:00:00+07:00', steps: stepsInvoice },

    { id: 'wf_ops_brief', name: 'Weekly Operations Brief', domain: 'Operations', version: '0.9.0', status: 'draft',
      risk: 'low', owner: 'People & Ops', description: 'Draf ringkasan operasional mingguan dari metrik utama; belum diaktifkan.',
      triggers: ['schedule'], avgDurationMs: null, successRateDemo: null, runCountDemo: 0,
      lastRunAt: null, updatedAt: '2026-11-01T11:30:00+07:00', steps: stepsBrief },

    { id: 'wf_policy_exception', name: 'Policy Exception Review', domain: 'Governance', version: '2.0.1', status: 'paused',
      risk: 'high', owner: 'Governance', description: 'Meninjau pengajuan pengecualian kebijakan dengan gerbang governance; dijeda sementara audit internal.',
      triggers: ['manual'], avgDurationMs: 388000, successRateDemo: 74, runCountDemo: 56,
      lastRunAt: '2026-10-19T13:05:00+07:00', updatedAt: '2026-10-20T08:40:00+07:00', steps: stepsPolicy },

    { id: 'wf_vendor_onboarding', name: 'Vendor Onboarding', domain: 'Procurement', version: '1.4.3', status: 'active',
      risk: 'medium', owner: 'Procurement', description: 'KYC, screening sanksi, dan aktivasi vendor baru di ERP setelah persetujuan procurement.',
      triggers: ['manual', 'webhook'], avgDurationMs: 530000, successRateDemo: 91, runCountDemo: 89,
      lastRunAt: '2026-11-01T15:20:00+07:00', updatedAt: '2026-10-27T16:10:00+07:00', steps: stepsVendor },

    { id: 'wf_audit_export', name: 'Audit Export Verification', domain: 'Audit', version: '1.2.0', status: 'failed',
      risk: 'high', owner: 'Audit & Compliance', description: 'Ekspor paket audit dan verifikasi hash/kelengkapan sebelum tanda tangan bukti.',
      triggers: ['manual', 'schedule'], avgDurationMs: 420000, successRateDemo: 61, runCountDemo: 42,
      lastRunAt: '2026-10-30T22:10:00+07:00', updatedAt: '2026-10-31T07:45:00+07:00', steps: stepsAudit },

    { id: 'wf_support_triage', name: 'Support Triage', domain: 'Support', version: '1.0.0', status: 'deprecated',
      risk: 'low', owner: 'Support Ops', description: 'Klasifikasi dan perutean tiket dukungan; digantikan oleh Support Copilot v2.',
      triggers: ['webhook'], avgDurationMs: 95000, successRateDemo: 84, runCountDemo: 512,
      lastRunAt: '2026-09-12T10:00:00+07:00', updatedAt: '2026-09-15T09:00:00+07:00', steps: stepsSupport }
  ];

  /* ---------- Riwayat run untuk Contract Review (6 entri, DEMO) ---------- */

  var runs = [
    { runId: 'run_20261102_003', workflowId: 'wf_contract_review', status: 'waiting_approval', trigger: 'manual',
      startedAt: '2026-11-02T16:45:00+07:00', durationMs: null, currentStep: 'legal_gate',
      error: null, checkpointDone: 0, checkpointTotal: 1, requestedBy: 'sari.wulandari' },
    { runId: 'run_20261029_002', workflowId: 'wf_contract_review', status: 'completed', trigger: 'api',
      startedAt: '2026-10-29T10:12:00+07:00', durationMs: 588000, currentStep: 'archive',
      error: null, checkpointDone: 1, checkpointTotal: 1, requestedBy: 'farhan.pratama' },
    { runId: 'run_20261027_001', workflowId: 'wf_contract_review', status: 'failed', trigger: 'manual',
      startedAt: '2026-10-27T14:03:00+07:00', durationMs: 214000, currentStep: 'risk',
      error: 'Langkah "risk" melebihi batas waktu 180 dtk (DEMO). Tidak ada perubahan tersimpan.',
      checkpointDone: 0, checkpointTotal: 1, requestedBy: 'rina.kusuma' },
    { runId: 'run_20261022_004', workflowId: 'wf_contract_review', status: 'completed', trigger: 'manual',
      startedAt: '2026-10-22T09:31:00+07:00', durationMs: 640000, currentStep: 'archive',
      error: null, checkpointDone: 1, checkpointTotal: 1, requestedBy: 'farhan.pratama' },
    { runId: 'run_20261017_002', workflowId: 'wf_contract_review', status: 'cancelled', trigger: 'api',
      startedAt: '2026-10-17T16:20:00+07:00', durationMs: 98000, currentStep: 'parse',
      error: null, checkpointDone: 0, checkpointTotal: 1, requestedBy: 'sari.wulandari' },
    { runId: 'run_20261011_001', workflowId: 'wf_contract_review', status: 'completed', trigger: 'schedule',
      startedAt: '2026-10-11T02:00:00+07:00', durationMs: 702000, currentStep: 'archive',
      error: null, checkpointDone: 1, checkpointTotal: 1, requestedBy: 'scheduler' }
  ];

  var checkpoints = [
    { id: 'cp_r3_1', runId: 'run_20261102_003', stepId: 'cp_final', label: 'Kontrak final diverifikasi', status: 'pending', at: null, note: 'Menunggu gerbang legal.' },
    { id: 'cp_r2_1', runId: 'run_20261029_002', stepId: 'cp_final', label: 'Kontrak final diverifikasi', status: 'passed', at: '2026-10-29T10:21:00+07:00', note: 'Hash cocok dengan dokumen sumber.' },
    { id: 'cp_r3f_1', runId: 'run_20261027_001', stepId: 'cp_final', label: 'Kontrak final diverifikasi', status: 'skipped', at: null, note: 'Run gagal sebelum checkpoint.' },
    { id: 'cp_r4_1', runId: 'run_20261022_004', stepId: 'cp_final', label: 'Kontrak final diverifikasi', status: 'passed', at: '2026-10-22T09:42:00+07:00', note: 'Hash cocok dengan dokumen sumber.' },
    { id: 'cp_r5_1', runId: 'run_20261017_002', stepId: 'cp_final', label: 'Kontrak final diverifikasi', status: 'skipped', at: null, note: 'Run dibatalkan sebelum checkpoint.' },
    { id: 'cp_r6_1', runId: 'run_20261011_001', stepId: 'cp_final', label: 'Kontrak final diverifikasi', status: 'passed', at: '2026-10-11T02:11:00+07:00', note: 'Hash cocok dengan dokumen sumber.' }
  ];

  var approvalGates = [
    { id: 'gate_20261102_legal', runId: 'run_20261102_003', stepId: 'legal_gate',
      approverRole: 'legal_counsel', reason: 'Klausul indemnity menyimpang dari standar NDA v4; perlu keputusan legal.',
      timeoutMinutes: 480, requestedAt: '2026-11-02T16:52:00+07:00',
      planHash: 'sha256:9f2c4a1b7e', status: 'pending' },
    { id: 'gate_20261029_legal', runId: 'run_20261029_002', stepId: 'legal_gate',
      approverRole: 'legal_counsel', reason: 'Batas tanggung jawab di atas plafon standar; disetujui dengan catatan.',
      timeoutMinutes: 480, requestedAt: '2026-10-29T10:18:00+07:00',
      planHash: 'sha256:41bd08c2aa', status: 'approved' },
    { id: 'gate_20261022_legal', runId: 'run_20261022_004', stepId: 'legal_gate',
      approverRole: 'legal_counsel', reason: 'Perpanjangan otomatis 12 bulan; perlu persetujuan eksplisit.',
      timeoutMinutes: 480, requestedAt: '2026-10-22T09:38:00+07:00',
      planHash: 'sha256:77e10d93f0', status: 'approved' }
  ];

  /* Linimasa event per run; input/output hanya referensi, bukan isi. */
  var traces = {
    run_20261102_003: [
      { at: '2026-11-02T16:45:00+07:00', stepId: 'intake', type: 'tool', status: 'ok', message: 'Dokumen diterima (ref doc_88f1).', durationMs: 1200, inputRef: 'doc_88f1', outputRef: 'parsed_in' },
      { at: '2026-11-02T16:45:02+07:00', stepId: 'parse', type: 'agent', status: 'ok', message: '14 klausul, 3 pihak dikenali.', durationMs: 31000, inputRef: 'parsed_in', outputRef: 'clauses_v1' },
      { at: '2026-11-02T16:45:33+07:00', stepId: 'risk', type: 'agent', status: 'ok', message: 'Skor risiko maks 0.81 (klausul 7 — indemnity).', durationMs: 26000, inputRef: 'clauses_v1', outputRef: 'risk_v1' },
      { at: '2026-11-02T16:45:59+07:00', stepId: 'threshold', type: 'condition', status: 'ok', message: 'kondisi risk.max >= 0.7 → true; lanjut ke gerbang.', durationMs: 8, inputRef: 'risk_v1', outputRef: null },
      { at: '2026-11-02T16:52:00+07:00', stepId: 'legal_gate', type: 'human_approval', status: 'waiting', message: 'Menunggu keputusan legal_counsel (timeout 480 mnt).', durationMs: null, inputRef: 'risk_v1', outputRef: null }
    ],
    run_20261027_001: [
      { at: '2026-10-27T14:03:00+07:00', stepId: 'intake', type: 'tool', status: 'ok', message: 'Dokumen diterima (ref doc_51c0).', durationMs: 980, inputRef: 'doc_51c0', outputRef: 'parsed_in' },
      { at: '2026-10-27T14:03:02+07:00', stepId: 'parse', type: 'agent', status: 'ok', message: '11 klausul dikenali.', durationMs: 28000, inputRef: 'parsed_in', outputRef: 'clauses_v1' },
      { at: '2026-10-27T14:03:30+07:00', stepId: 'risk', type: 'agent', status: 'error', message: 'Batas waktu 180 dtk terlampaui (DEMO).', durationMs: 180000, inputRef: 'clauses_v1', outputRef: null, error: 'TIMEOUT_STEP' }
    ],
    run_20261029_002: [
      { at: '2026-10-29T10:12:00+07:00', stepId: 'intake', type: 'tool', status: 'ok', message: 'Dokumen diterima (ref doc_77a2).', durationMs: 1100, inputRef: 'doc_77a2', outputRef: 'parsed_in' },
      { at: '2026-10-29T10:12:02+07:00', stepId: 'parse', type: 'agent', status: 'ok', message: '9 klausul dikenali.', durationMs: 24000, inputRef: 'parsed_in', outputRef: 'clauses_v1' },
      { at: '2026-10-29T10:12:26+07:00', stepId: 'risk', type: 'agent', status: 'ok', message: 'Skor risiko maks 0.66.', durationMs: 19000, inputRef: 'clauses_v1', outputRef: 'risk_v1' },
      { at: '2026-10-29T10:12:45+07:00', stepId: 'threshold', type: 'condition', status: 'ok', message: 'kondisi risk.max >= 0.7 → true; lanjut ke gerbang.', durationMs: 6, inputRef: 'risk_v1', outputRef: null },
      { at: '2026-10-29T10:18:00+07:00', stepId: 'legal_gate', type: 'human_approval', status: 'ok', message: 'Disetujui legal_counsel dengan catatan.', durationMs: 315000, inputRef: 'risk_v1', outputRef: 'gate_ok' },
      { at: '2026-10-29T10:21:00+07:00', stepId: 'cp_final', type: 'checkpoint', status: 'ok', message: 'Checkpoint lolos; hash cocok.', durationMs: 40, inputRef: 'gate_ok', outputRef: 'cp_ok' },
      { at: '2026-10-29T10:21:40+07:00', stepId: 'archive', type: 'tool', status: 'ok', message: 'Diarsipkan + catatan audit ditulis.', durationMs: 1500, inputRef: 'cp_ok', outputRef: null }
    ]
  };

  window.DEXTRA_WORKFLOW_FIXTURES = {
    demo: true,
    generatedAt: '2026-11-04T00:00:00+07:00',
    note: 'Contoh tertulis untuk UI. Bukan hasil server; tidak ada workflow yang benar-benar berjalan.',
    workflows: workflows,
    runs: runs,
    checkpoints: checkpoints,
    approvalGates: approvalGates,
    traces: traces
  };
})();
