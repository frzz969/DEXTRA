/* Office Agent — data contoh (DEMO).
 *
 * Semua yang ada di sini adalah skenario tertulis, bukan hasil server. Waktu
 * bersifat tetap dan tidak pernah dihitung dari jam peramban. Tidak ada email,
 * jadwal, atau tugas yang dikirim ke mana pun saat data ini diputar.
 *
 * Skenario: notulen Rapat Koordinasi 30 Oktober 2026, tiga tindak lanjut, dua
 * kandidat bernama "Budi", satu benturan salat Jumat, dan eksekusi sebagian.
 */
(function () {
  'use strict';

  var DOC_NAME = 'notulen-rapat-koordinasi-2026-10-30.md';

  var NOTES = [
    'NOTULEN RAPAT KOORDINASI',
    'Kenari Group — Divisi Operasi',
    'Jumat, 30 Oktober 2026 · 09.00–10.30 WIB · Ruang Rapat Melati, Lantai 3',
    '',
    'Peserta',
    '- Budi Santoso — Keuangan',
    '- Sari Wulandari — Sumber Daya Manusia',
    '- Rina Kusuma — Legal',
    '',
    'Agenda',
    '1. Rekap realisasi anggaran operasional Oktober.',
    '2. Rencana rekrutmen dua posisi administrasi.',
    '3. Tinjauan klausul kontrak vendor kebersihan.',
    '',
    'Keputusan',
    '1. Realisasi anggaran Oktober disetujui tanpa revisi.',
    '2. Rekrutmen dua posisi administrasi dibuka pada November, menunggu persetujuan akhir Keuangan.',
    '3. Kontrak vendor kebersihan diperpanjang tiga bulan sambil menunggu tinjauan Legal.',
    '',
    'Tindak lanjut',
    '1. Notulen lengkap dikirim kepada Budi untuk dipublikasikan ke seluruh tim.',
    '2. Rapat tindak lanjut mingguan dijadwalkan Jumat depan, 6 November 2026, pukul 11.30 WIB, selama 60 menit.',
    '3. Daftar tindakan ditinjau ulang oleh tim Keuangan pada 2 November 2026.',
    '',
    'Catatan',
    'Lokasi dan daftar peserta rapat tindak lanjut belum ditetapkan dalam rapat ini.'
  ].join('\n');

  var EMAIL_BODY = [
    'Rekan-rekan,',
    '',
    'Berikut notulen Rapat Koordinasi Divisi Operasi yang berlangsung pada Jumat, 30 Oktober 2026, pukul 09.00–10.30 WIB di Ruang Rapat Melati, Lantai 3.',
    '',
    'Keputusan yang diambil:',
    '1. Realisasi anggaran operasional Oktober 2026 disetujui tanpa revisi.',
    '2. Rekrutmen dua posisi administrasi dibuka pada November 2026, menunggu persetujuan akhir dari Keuangan.',
    '3. Kontrak vendor kebersihan diperpanjang tiga bulan sambil menunggu tinjauan Legal.',
    '',
    'Tindak lanjut yang disepakati:',
    '1. Notulen ini dipublikasikan ke seluruh tim Operasi.',
    '2. Rapat tindak lanjut dijadwalkan pada Jumat, 6 November 2026, pukul 11.30 WIB selama 60 menit. Lokasi dan daftar peserta menyusul.',
    '3. Daftar tindakan ditinjau ulang oleh tim Keuangan pada 2 November 2026.',
    '',
    'Mohon koreksi bila ada butir yang tidak sesuai sebelum notulen dipublikasikan.',
    '',
    'Terima kasih.',
    'Rina Kusuma',
    'Legal — Kenari Group'
  ].join('\n');

  var REQUEST_ID = 'req_oa_20261030_01';
  var PLAN_ID = 'plan_oa_20261030_01';

  var CITATIONS = [
    { id: 'C-03', quote: 'Jumat, 30 Oktober 2026 · 09.00–10.30 WIB · Ruang Rapat Melati, Lantai 3' },
    { id: 'C-07', quote: 'Realisasi anggaran Oktober disetujui tanpa revisi.' },
    { id: 'C-11', quote: 'Notulen lengkap dikirim kepada Budi untuk dipublikasikan ke seluruh tim.' },
    { id: 'C-12', quote: 'Rapat tindak lanjut mingguan dijadwalkan Jumat depan, 6 November 2026, pukul 11.30 WIB, selama 60 menit.' },
    { id: 'C-13', quote: 'Daftar tindakan ditinjau ulang oleh tim Keuangan pada 2 November 2026.' },
    { id: 'C-14', quote: 'Lokasi dan daftar peserta rapat tindak lanjut belum ditetapkan dalam rapat ini.' }
  ];

  var BUDI_SANTOSO = {
    contact_id: 'ct_budi_santoso',
    display_name: 'Budi Santoso',
    department: 'Keuangan',
    masked: 'b***@kenari.co.id',
    email: 'budi.santoso@kenari.co.id',
    evidence: 'Hadir dalam rapat; disebut pada daftar peserta.'
  };

  var BUDI_PRAKOSO = {
    contact_id: 'ct_budi_prakoso',
    display_name: 'Budi Prakoso',
    department: 'Operasional',
    masked: 'b***@kenari.co.id',
    email: 'budi.prakoso@kenari.co.id',
    evidence: 'Nama sama di direktori; tidak hadir dalam rapat.'
  };

  var REQUEST = {
    request_id: REQUEST_ID,
    status: 'DRAFT',
    created_at: '2026-10-30T02:30:12.000Z',
    source: { type: 'document', filename: DOC_NAME, size_bytes: 4821, submitted_by: 'Maya Lestari' },
    text: 'Buatkan ringkasan dari notulen rapat koordinasi 30 Oktober 2026, lalu siapkan tindak lanjutnya.',
    document_name: DOC_NAME
  };

  var SUMMARY = {
    title: 'Rapat Koordinasi Divisi Operasi',
    ringkasan: 'Rapat membahas realisasi anggaran operasional Oktober, rencana rekrutmen dua posisi administrasi, dan tinjauan kontrak vendor kebersihan. Tiga keputusan diambil dan tiga tindak lanjut disepakati. Notulen perlu dipublikasikan, rapat tindak lanjut perlu dijadwalkan, dan daftar tindakan perlu ditinjau ulang.',
    keputusan: [
      'Realisasi anggaran operasional Oktober 2026 disetujui tanpa revisi.',
      'Rekrutmen dua posisi administrasi dibuka pada November 2026, menunggu persetujuan akhir Keuangan.',
      'Kontrak vendor kebersihan diperpanjang tiga bulan sambil menunggu tinjauan Legal.'
    ],
    pihak: [
      { name: 'Budi Santoso', department: 'Keuangan' },
      { name: 'Sari Wulandari', department: 'Sumber Daya Manusia' },
      { name: 'Rina Kusuma', department: 'Legal' }
    ],
    tanggal: '2026-10-30',
    waktu: { start: '09:00', end: '10:30', timezone: 'Asia/Jakarta' },
    sumber: {
      filename: DOC_NAME,
      size_bytes: 4821,
      processed_at: '2026-10-30T02:30:41.000Z',
      citations: CITATIONS
    },
    warnings: [
      { code: 'AMBIGUOUS_NAME', message: 'Nama "Budi" pada butir tindak lanjut cocok dengan dua kontak di direktori. Penerima belum ditetapkan.' },
      { code: 'MISSING_FIELD', message: 'Lokasi dan daftar peserta rapat tindak lanjut tidak disebutkan pada notulen.' }
    ]
  };

  var ACTIONS = [
    {
      action_id: 'act_01',
      action_type: 'send_email',
      what: 'Kirim notulen rapat ke Budi untuk dipublikasikan ke seluruh tim.',
      pic: { name: 'Rina Kusuma', department: 'Legal' },
      recipient: null,
      due_at: '2026-10-31T02:00:00.000Z',
      schedule: null,
      source: { document: DOC_NAME, citations: ['C-11'] },
      status: 'NEEDS_CLARIFICATION',
      findings: []
    },
    {
      action_id: 'act_02',
      action_type: 'create_calendar_event',
      what: 'Jadwalkan rapat tindak lanjut mingguan, 60 menit.',
      pic: { name: 'Sari Wulandari', department: 'Sumber Daya Manusia' },
      recipient: null,
      due_at: '2026-11-05T02:00:00.000Z',
      schedule: { start_at: '2026-11-06T04:30:00.000Z', duration_minutes: 60, timezone: 'Asia/Jakarta' },
      location: '',
      attendees: [],
      source: { document: DOC_NAME, citations: ['C-12'] },
      status: 'NEEDS_CLARIFICATION',
      findings: []
    },
    {
      action_id: 'act_03',
      action_type: 'create_task',
      what: 'Buat tugas tinjau ulang daftar tindakan untuk tim Keuangan.',
      pic: { name: 'Budi Santoso', department: 'Keuangan' },
      recipient: { contact_id: 'ct_budi_santoso', display_name: 'Budi Santoso', department: 'Keuangan', email: 'budi.santoso@kenari.co.id', masked: 'b***@kenari.co.id' },
      due_at: '2026-11-02T02:00:00.000Z',
      schedule: null,
      source: { document: DOC_NAME, citations: ['C-13'] },
      status: 'READY',
      findings: []
    }
  ];

  var CLARIFICATIONS = [
    {
      question_id: 'clar_recipient',
      action_id: 'act_01',
      kind: 'recipient',
      question: 'Notulen dikirim kepada Budi yang mana? Dua kontak di direktori memakai nama depan yang sama.',
      required: true,
      options: [BUDI_SANTOSO, BUDI_PRAKOSO]
    },
    {
      question_id: 'clar_schedule',
      action_id: 'act_02',
      kind: 'schedule',
      question: 'Kapan rapat tindak lanjut dijadwalkan?',
      required: true,
      suggested: { date: '2026-11-06', time: '11:30', timezone: 'Asia/Jakarta', duration_minutes: 60 }
    },
    {
      question_id: 'clar_location',
      action_id: 'act_02',
      kind: 'location',
      question: 'Di mana rapat berlangsung, dan siapa saja yang diundang?',
      required: true,
      attendees: [
        { name: 'Sari Wulandari', department: 'Sumber Daya Manusia' },
        { name: 'Rina Kusuma', department: 'Legal' },
        { name: 'Budi Santoso', department: 'Keuangan' },
        { name: 'Budi Prakoso', department: 'Operasional' }
      ]
    }
  ];

  var PLAN_ACTIONS = [
    {
      action_id: 'act_01',
      title: 'Kirim Notulen Rapat',
      action_type: 'send_email',
      channel: 'email',
      adapter: 'mock',
      target: {
        contact_id: 'ct_budi_santoso',
        display_name: 'Budi Santoso',
        department: 'Keuangan',
        email: 'budi.santoso@kenari.co.id',
        masked: 'b***@kenari.co.id'
      },
      subject: 'Notulen Rapat Koordinasi 30 Oktober 2026 — Divisi Operasi',
      body: EMAIL_BODY,
      attachment: { name: DOC_NAME, size_bytes: 4821 },
      schedule: null,
      source: { document: DOC_NAME, citations: ['C-11', 'C-03'] },
      findings: [
        { code: 'RECIPIENT_INTERNAL', severity: 'info', message: 'Penerima berada di domain internal kenari.co.id.' }
      ]
    },
    {
      action_id: 'act_02',
      title: 'Jadwalkan Rapat Tindak Lanjut',
      action_type: 'create_calendar_event',
      channel: 'calendar',
      adapter: 'mock',
      target: { display_name: 'Kalender Divisi Operasi', department: 'Operasi' },
      subject: 'Rapat Tindak Lanjut Mingguan — Divisi Operasi',
      schedule: { start_at: '2026-11-06T04:30:00.000Z', duration_minutes: 60, timezone: 'Asia/Jakarta' },
      location: 'Ruang Rapat Melati, Lantai 3',
      attendees: [
        { name: 'Sari Wulandari', department: 'Sumber Daya Manusia', email: 'sari.wulandari@kenari.co.id' },
        { name: 'Rina Kusuma', department: 'Legal', email: 'rina.kusuma@kenari.co.id' },
        { name: 'Budi Santoso', department: 'Keuangan', email: 'budi.santoso@kenari.co.id' }
      ],
      source: { document: DOC_NAME, citations: ['C-12'] },
      findings: [
        { code: 'FRIDAY_PRAYER_CONFLICT', severity: 'warning', message: 'Jadwal 11.30–12.30 WIB bertabrakan dengan jendela salat Jumat 11.30–13.00 WIB.' }
      ]
    },
    {
      action_id: 'act_03',
      title: 'Buat Tugas Tinjau Ulang Tindakan',
      action_type: 'create_task',
      channel: 'task',
      adapter: 'mock',
      target: { display_name: 'Tim Keuangan', department: 'Keuangan' },
      subject: 'Tinjau ulang daftar tindakan rapat 30 Oktober 2026',
      due_at: '2026-11-02T02:00:00.000Z',
      source: { document: DOC_NAME, citations: ['C-13'] },
      findings: []
    }
  ];

  var PLAN = {
    plan_id: PLAN_ID,
    request_id: REQUEST_ID,
    plan_hash: 'demo_5f3c91a7d204',
    status: 'PENDING_APPROVAL',
    can_approve: true,
    risk: 'medium',
    requester: { name: 'Maya Lestari', department: 'Operasi' },
    created_at: '2026-10-30T02:36:02.000Z',
    actions: PLAN_ACTIONS,
    findings: [
      { code: 'FRIDAY_PRAYER_CONFLICT', severity: 'warning', message: 'Rapat tindak lanjut jatuh pada jendela salat Jumat 11.30–13.00 WIB.' },
      { code: 'RECIPIENT_INTERNAL', severity: 'info', message: 'Seluruh penerima berada di domain internal kenari.co.id.' }
    ]
  };

  var BLOCKED_PLAN = {
    plan_id: 'plan_oa_20261030_blocked',
    request_id: REQUEST_ID,
    plan_hash: 'demo_blocked_77ab10',
    status: 'BLOCKED',
    can_approve: false,
    risk: 'high',
    requester: { name: 'Maya Lestari', department: 'Operasi' },
    created_at: '2026-10-30T02:36:02.000Z',
    actions: [
      {
        action_id: 'act_01',
        title: 'Kirim Notulen Rapat',
        action_type: 'send_email',
        channel: 'email',
        adapter: 'mock',
        target: {
          contact_id: 'ct_budi_prakoso',
          display_name: 'Budi Prakoso',
          department: 'Operasional',
          email: 'budi.prakoso@kenari.co.id',
          masked: 'b***@kenari.co.id'
        },
        subject: 'Notulen Rapat Koordinasi 30 Oktober 2026 — Divisi Operasi',
        body: EMAIL_BODY,
        attachment: { name: DOC_NAME, size_bytes: 4821 },
        source: { document: DOC_NAME, citations: ['C-11'] },
        findings: [
          { code: 'RECIPIENT_NOT_IN_MEETING', severity: 'blocking', message: 'Budi Prakoso tidak tercatat hadir pada rapat dan tidak ada di daftar distribusi notulen.' }
        ]
      }
    ],
    findings: [
      { code: 'RECIPIENT_NOT_IN_MEETING', severity: 'blocking', message: 'Penerima yang dipilih tidak berhak menerima notulen rapat ini.' },
      { code: 'FRIDAY_PRAYER_CONFLICT', severity: 'warning', message: 'Rapat tindak lanjut jatuh pada jendela salat Jumat 11.30–13.00 WIB.' }
    ]
  };

  var CHANGED_PLAN = {
    plan_id: PLAN_ID,
    request_id: REQUEST_ID,
    plan_hash: 'demo_changed_2b9e40',
    status: 'PENDING_APPROVAL',
    can_approve: false,
    risk: 'medium',
    requester: { name: 'Maya Lestari', department: 'Operasi' },
    created_at: '2026-10-30T02:36:02.000Z',
    actions: PLAN_ACTIONS,
    findings: PLAN.findings
  };

  var REJECTION = {
    decision: 'REJECTED',
    at: '2026-10-30T03:04:00.000Z',
    reason: 'Penerima Budi Prakoso belum dikonfirmasi hadir pada rapat. Notulen tidak boleh dikirim sebelum penerima benar.',
    approver_name: 'Farhan Pratama',
    demo: true,
    note: 'demo lokal — tidak ada keputusan yang tercatat di backend'
  };

  var EXECUTIONS = [
    {
      action_id: 'act_01',
      action_type: 'send_email',
      status: 'DISPATCHED_MOCK',
      adapter: 'mock',
      at: '2026-10-30T03:02:30.000Z',
      detail: 'mock_message_id: mock-msg-7f1a2c',
      note: 'Adapter mock menerima perintah. Tidak ada email yang dikirim.'
    },
    {
      action_id: 'act_02',
      action_type: 'create_calendar_event',
      status: 'DISPATCHED_MOCK',
      adapter: 'mock',
      at: '2026-10-30T03:02:31.000Z',
      detail: 'mock_event_id: mock-evt-4d90be',
      note: 'Adapter mock menerima perintah. Tidak ada jadwal yang dibuat.'
    },
    {
      action_id: 'act_03',
      action_type: 'create_task',
      status: 'FAILED',
      adapter: 'mock',
      at: '2026-10-30T03:02:32.000Z',
      reason_code: 'TASK_BOARD_UNAVAILABLE',
      detail: 'Adapter tugas tidak tersedia pada lingkungan ini.',
      note: 'Tidak ada tugas yang dibuat.'
    }
  ];

  var AUDIT = {
    request_received: {
      event_id: 'evt_oa_001', type: 'request_received', at: '2026-10-30T02:30:12.000Z',
      actor: 'maya.lestari', request_id: REQUEST_ID, plan_id: null, demo: true,
      detail: { channel: 'upload', filename: DOC_NAME }
    },
    document_processed: {
      event_id: 'evt_oa_002', type: 'document_processed', at: '2026-10-30T02:30:41.000Z',
      actor: 'document_processor', request_id: REQUEST_ID, plan_id: null, demo: true,
      detail: { sections: '4', keputusan: '3', tindak_lanjut: '3' }
    },
    clarification_requested: {
      event_id: 'evt_oa_003', type: 'clarification_requested', at: '2026-10-30T02:31:05.000Z',
      actor: 'executive_assistant', request_id: REQUEST_ID, plan_id: null, demo: true,
      detail: { questions: '3', open: 'penerima, jadwal, lokasi' }
    },
    clarification_answered: {
      event_id: 'evt_oa_004', type: 'clarification_answered', at: '2026-10-30T02:35:20.000Z',
      actor: 'maya.lestari', request_id: REQUEST_ID, plan_id: null, demo: true,
      detail: { answered: '3' }
    },
    plan_created: {
      event_id: 'evt_oa_005', type: 'plan_created', at: '2026-10-30T02:36:02.000Z',
      actor: 'executive_assistant', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { actions: '3', plan_hash: 'demo_5f3c91a7d204' }
    },
    plan_validated: {
      event_id: 'evt_oa_006', type: 'plan_validated', at: '2026-10-30T02:36:40.000Z',
      actor: 'policy_validator', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { findings: '2', blocking: '0' }
    },
    plan_revalidated: {
      event_id: 'evt_oa_007', type: 'plan_revalidated', at: '2026-10-30T02:38:10.000Z',
      actor: 'policy_validator', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { findings: '2', blocking: '0', plan_hash: 'demo_changed_2b9e40' }
    },
    approval_requested: {
      event_id: 'evt_oa_008', type: 'approval_requested', at: '2026-10-30T02:37:00.000Z',
      actor: 'system', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { plan_hash: 'demo_5f3c91a7d204' }
    },
    approval_granted: {
      event_id: 'evt_oa_009', type: 'approval_granted', at: '2026-10-30T03:02:11.000Z',
      actor: 'farhan.pratama', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { decision: 'APPROVED', plan_hash: 'demo_5f3c91a7d204' }
    },
    approval_rejected: {
      event_id: 'evt_oa_010', type: 'approval_rejected', at: '2026-10-30T03:04:00.000Z',
      actor: 'farhan.pratama', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { decision: 'REJECTED', reason: REJECTION.reason }
    },
    mandate_issued: {
      event_id: 'evt_oa_011', type: 'mandate_issued', at: '2026-10-30T03:02:12.000Z',
      actor: 'mandate_engine', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { mandate_id: 'mnd_demo_9c31', max_risk: 'medium' }
    },
    action_executed: {
      event_id: 'evt_oa_012', type: 'action_executed', at: '2026-10-30T03:02:30.000Z',
      actor: 'executor', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { action_id: 'act_01', adapter: 'mock', mock_message_id: 'mock-msg-7f1a2c' }
    },
    action_executed_2: {
      event_id: 'evt_oa_013', type: 'action_executed', at: '2026-10-30T03:02:31.000Z',
      actor: 'executor', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { action_id: 'act_02', adapter: 'mock', mock_event_id: 'mock-evt-4d90be' }
    },
    action_blocked: {
      event_id: 'evt_oa_014', type: 'action_blocked', at: '2026-10-30T03:02:32.000Z',
      actor: 'executor', request_id: REQUEST_ID, plan_id: PLAN_ID, demo: true,
      detail: { action_id: 'act_03', reason_code: 'TASK_BOARD_UNAVAILABLE' }
    }
  };

  window.DEXTRA_OFFICE_FIXTURES = {
    demo: true,
    label: 'DEMO',
    note: 'Data contoh tertulis. Tidak ada email, jadwal, atau tugas yang dikirim.',
    demoHash: 'demo_5f3c91a7d204',
    request_id: REQUEST_ID,
    plan_id: PLAN_ID,
    document: {
      filename: DOC_NAME,
      size_bytes: 4821,
      text: NOTES,
      mime: 'text/markdown'
    },
    notes: NOTES,
    request: REQUEST,
    summary: SUMMARY,
    actions: ACTIONS,
    clarifications: CLARIFICATIONS,
    plan: PLAN,
    email: { subject: PLAN_ACTIONS[0].subject, body: EMAIL_BODY },
    attachments: [{ name: DOC_NAME, size_bytes: 4821 }],
    rejection: REJECTION,
    executions: EXECUTIONS,
    audit: AUDIT,
    /* Urutan penyusunan timeline demo. Mesin demo menambahkan peristiwa ini
       hanya saat tahapnya benar-benar terjadi. */
    auditOrder: [
      'request_received', 'document_processed', 'clarification_requested',
      'clarification_answered', 'plan_created', 'plan_validated',
      'approval_requested', 'approval_granted', 'mandate_issued',
      'action_executed', 'action_executed_2', 'action_blocked'
    ],
    variants: {
      blockedPlan: BLOCKED_PLAN,
      changedPlan: CHANGED_PLAN,
      rejection: REJECTION
    },
    /* Jawaban contoh yang dipakai tombol "Muat contoh" pada mode demo. */
    sampleAnswers: {
      clar_recipient: { contact_id: 'ct_budi_santoso' },
      clar_schedule: { date: '2026-11-06', time: '11:30', timezone: 'Asia/Jakarta', duration_minutes: 60 },
      clar_location: { location: 'Ruang Rapat Melati, Lantai 3', attendees: ['Sari Wulandari', 'Rina Kusuma', 'Budi Santoso'] }
    }
  };
})();
