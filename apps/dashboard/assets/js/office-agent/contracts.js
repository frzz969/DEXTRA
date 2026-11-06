/* Office Agent — kontrak frontend.
 *
 * Berkas ini hanya mendokumentasikan bentuk data dan kosakata status yang
 * dipakai layar Office Agent. Tidak ada perilaku di sini, dan tidak ada klaim
 * bahwa tool di bawah sudah ada di server. EXPECTED_TOOLS adalah kontrak yang
 * dibutuhkan frontend dari backend nanti; selama tool itu belum terpasang,
 * layar berjalan dalam mode demo dan menyebut dirinya demo.
 */
(function () {
  'use strict';

  /**
   * @typedef {Object} OfficeRequest
   * @property {string} request_id
   * @property {string} status              Salah satu kunci STATUS di bawah.
   * @property {string} created_at          ISO-8601 dari server.
   * @property {{type:'text'|'document', filename?:string, size_bytes?:number, submitted_by?:string}} source
   * @property {string} [text]              Isi permintaan bebas.
   * @property {string} [document_name]
   */

  /**
   * @typedef {Object} DocumentInput
   * @property {string} filename            .md atau .txt.
   * @property {number} size_bytes          Maksimum 1 MB pada layar ini.
   * @property {string} text                Isi berkas apa adanya.
   */

  /**
   * @typedef {Object} MeetingSummary
   * @property {string} title
   * @property {string} ringkasan
   * @property {string[]} keputusan
   * @property {Array<{name:string, department:string}>} pihak
   * @property {string} tanggal
   * @property {{start:string, end:string, timezone:string}} waktu
   * @property {{filename:string, size_bytes:number, processed_at:string, citations:Array<{id:string, quote:string}>}} sumber
   * @property {Array<{code:string, message:string}>} warnings
   */

  /**
   * @typedef {Object} ActionItem
   * @property {string} action_id
   * @property {'send_email'|'create_calendar_event'|'create_task'} action_type
   * @property {string} what
   * @property {{name:string, department:string}} pic
   * @property {{contact_id?:string, display_name:string, department?:string, email?:string, masked?:string}|null} recipient
   * @property {string} [due_at]
   * @property {{start_at:string, duration_minutes:number, timezone:string}|null} [schedule]
   * @property {string} [location]
   * @property {Array<{name:string, department?:string, email?:string}>} [attendees]
   * @property {{document:string, citations:string[]}} source
   * @property {string} status
   * @property {Array<{code:string, severity:'info'|'warning'|'blocking', message:string}>} findings
   */

  /**
   * @typedef {Object} ClarificationQuestion
   * @property {string} question_id
   * @property {string} action_id
   * @property {'recipient'|'schedule'|'location'} kind
   * @property {string} question
   * @property {boolean} required
   * @property {Array<{contact_id:string, display_name:string, department:string, masked:string, email?:string, evidence?:string}>} [options]
   */

  /**
   * @typedef {Object} PlanAction
   * @property {string} action_id
   * @property {string} title
   * @property {string} action_type
   * @property {'email'|'calendar'|'task'} channel
   * @property {'mock'} adapter
   * @property {Object} target
   * @property {string} [subject]
   * @property {string} [body]
   * @property {{name:string, size_bytes:number}} [attachment]
   * @property {{start_at:string, duration_minutes:number, timezone:string}|null} [schedule]
   * @property {string} [location]
   * @property {Array<Object>} [attendees]
   * @property {string} [due_at]
   * @property {{document:string, citations:string[]}} source
   * @property {Array<{code:string, severity:string, message:string}>} findings
   */

  /**
   * @typedef {Object} PlanPreview
   * @property {string} plan_id
   * @property {string} request_id
   * @property {string} plan_hash          sha256 di backend; di demo berawalan "demo_".
   * @property {string} status             DRAFT | VALIDATING | PENDING_APPROVAL | BLOCKED | APPROVED | REJECTED
   * @property {boolean} can_approve       Hanya backend yang boleh menyatakan ini.
   * @property {'low'|'medium'|'high'|'critical'} risk
   * @property {{name:string, department?:string}} requester
   * @property {string} created_at
   * @property {PlanAction[]} actions
   * @property {Array<{code:string, severity:string, message:string}>} findings
   */

  /**
   * @typedef {Object} ApprovalState
   * @property {'APPROVED'|'REJECTED'} decision
   * @property {string} at
   * @property {string} [reason]
   * @property {string} [approver_name]    Dari respons server, bukan dari peramban.
   * @property {string} [approver_id]
   * @property {boolean} demo
   * @property {string} [note]
   */

  /**
   * @typedef {Object} ExecutionState
   * @property {string} action_id
   * @property {string} action_type
   * @property {string} status             DISPATCHED_MOCK | FAILED | BLOCKED
   * @property {string} adapter
   * @property {string} at
   * @property {string} [detail]
   * @property {string} [reason_code]
   * @property {string} [note]
   */

  /**
   * @typedef {Object} AuditEvent
   * @property {string} event_id
   * @property {string} type
   * @property {string} at                 ISO-8601 dari server/berkas contoh.
   * @property {string} actor
   * @property {Object|string} [detail]
   * @property {string} [request_id]
   * @property {string} [plan_id]
   * @property {boolean} [demo]
   */

  /**
   * @typedef {Object} OfficeApiResult
   * @property {boolean} demo
   * @property {Object|null} state         Snapshot penuh (mode demo).
   * @property {Object|null} patch         Potongan state hasil pemetaan respons (mode live).
   */

  var STATUS = {
    DRAFT: {
      label: 'Draf',
      tone: 'outline',
      icon: 'edit_note',
      desc: 'Permintaan dibuat lokal; belum diproses menjadi ringkasan.'
    },
    NEEDS_CLARIFICATION: {
      label: 'Perlu Klarifikasi',
      tone: 'warning',
      icon: 'help',
      desc: 'Ada pertanyaan yang harus dijawab manusia sebelum rencana bisa disusun.'
    },
    VALIDATING: {
      label: 'Sedang Divalidasi',
      tone: 'info',
      icon: 'rule',
      desc: 'Rencana sedang diperiksa terhadap kebijakan organisasi.'
    },
    PENDING_APPROVAL: {
      label: 'Menunggu Persetujuan',
      tone: 'warning',
      icon: 'pending_actions',
      desc: 'Rencana lengkap menunggu keputusan manusia. Belum ada mandat.'
    },
    APPROVED: {
      label: 'Disetujui',
      tone: 'success',
      icon: 'verified',
      desc: 'Disetujui manusia. Persetujuan bukan berarti sudah dieksekusi.'
    },
    REJECTED: {
      label: 'Ditolak',
      tone: 'danger',
      icon: 'cancel',
      desc: 'Ditolak manusia. Tidak ada tindakan yang dijalankan.'
    },
    EXECUTION_REQUESTED: {
      label: 'Eksekusi Diminta',
      tone: 'info',
      icon: 'play_circle',
      desc: 'Permintaan eksekusi dikirim; hasil per tindakan belum diterima.'
    },
    DISPATCHED_MOCK: {
      label: 'Didispatch (mock)',
      tone: 'info',
      icon: 'outbox',
      desc: 'Adapter mock menerima perintah. Tidak ada email, jadwal, atau tugas yang benar-benar dibuat.'
    },
    FAILED: {
      label: 'Gagal',
      tone: 'danger',
      icon: 'error',
      desc: 'Eksekusi gagal pada satu atau lebih tindakan. Tindakan lain tidak otomatis dibatalkan.'
    },
    BLOCKED: {
      label: 'Diblokir',
      tone: 'danger',
      icon: 'block',
      desc: 'Kebijakan memblokir eksekusi. Rencana harus diubah atau dibatalkan.'
    }
  };

  /* Label peristiwa audit. core.js hanya mengenal sebagian tipe ini; sisanya
     diberi label di sini agar timeline tidak menampilkan "snake_case" mentah. */
  var EVENTS = {
    request_received: 'Permintaan diterima',
    document_processed: 'Dokumen diproses',
    clarification_requested: 'Klarifikasi diminta',
    clarification_answered: 'Klarifikasi dijawab',
    plan_created: 'Rencana disusun',
    plan_validated: 'Rencana divalidasi',
    plan_revalidated: 'Rencana divalidasi ulang',
    approval_requested: 'Persetujuan diminta',
    approval_granted: 'Disetujui manusia',
    approval_rejected: 'Ditolak manusia',
    mandate_issued: 'Mandat terbit',
    action_executed: 'Tindakan dieksekusi',
    action_blocked: 'Tindakan diblokir'
  };

  /* Kontrak backend yang dibutuhkan. Belum ada satu pun di server hari ini.
     Frontend memeriksa keberadaannya lewat probe() dan, bila tidak ada,
     menyatakan dirinya demo. */
  var EXPECTED_TOOLS = {
    office_create_request: {
      request: {
        source_type: "'text' | 'document'",
        text: 'string — isi permintaan atau isi dokumen',
        filename: 'string | null — wajib untuk source_type=document',
        size_bytes: 'number | null',
        requester_id: 'string — dari token, bukan dari peramban'
      },
      response: '{ request_id, status, created_at }'
    },
    office_get_request: {
      request: { request_id: 'string' },
      response: '{ request, summary, actions[], clarifications[], plan_id|null }'
    },
    office_clarify: {
      request: {
        request_id: 'string',
        answers: "Array<{ question_id, value }> — value bebas per jenis pertanyaan"
      },
      response: '{ request_id, status, actions[], plan_id|null }'
    },
    office_get_plan: {
      request: { request_id: 'string' },
      response: '{ plan: PlanPreview }'
    },
    office_approve: {
      request: {
        request_id: 'string',
        plan_hash: 'string — hash yang disetujui, bukan hash yang dihitung ulang di peramban',
        decision: "'APPROVED' | 'REJECTED'",
        reason: 'string | null'
      },
      response: '{ plan_id, status, approval: ApprovalState }'
    },
    office_execute: {
      request: { request_id: 'string', plan_hash: 'string' },
      response: '{ status, executions: ExecutionState[] }'
    },
    office_get_audit: {
      request: { request_id: 'string', limit: 'number?' },
      response: '{ events: AuditEvent[] }'
    }
  };

  var LABEL = 'DEMO — data contoh, bukan operasi nyata';

  window.DEXTRA_OFFICE_CONTRACTS = {
    STATUS: STATUS,
    EVENTS: EVENTS,
    EXPECTED_TOOLS: EXPECTED_TOOLS,
    TOOL_NAMES: Object.keys(EXPECTED_TOOLS),
    LABEL: LABEL,
    /* Status rencana yang boleh diajukan untuk persetujuan. */
    APPROVABLE: { PENDING_APPROVAL: true, VALIDATING: true }
  };
})();
