/* DEXTRA Dashboard — data layer.
   Two sources, one shape:
   - live  : local MCP server on 127.0.0.1:8765 (real plans, audit, org rules)
   - demo  : the dataset below, clearly labelled as demo in the UI
   Nothing here claims a backend capability that does not exist. */
(function () {
  'use strict';
  var D = (window.DEXTRA = window.DEXTRA || {});

  var NOW = new Date('2026-11-02T14:18:00.000Z'); // Mon 2 Nov 2026, 21:18 WIB

  function iso(daysAgo, h, m) {
    var d = new Date(NOW);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    if (h !== undefined) { d.setUTCHours(h - 7, m || 0, 0, 0); }
    return d.toISOString();
  }

  /* ---------------- org & people ---------------- */
  var org = {
    org_id: 'org_kenari',
    name: 'Kenari Group',
    timezones: ['Asia/Jakarta'],
    office_hours: { start: '08:00', end: '17:00' },
    friday_prayer: { start: '11:30', end: '13:00' },
    holidays: ['2026-11-10'],
    approval_matrix_version: '1.0',
    contract_version: '1.0.0',
    policy_engine: 'deterministic'
  };

  var users = [
    { id: 'user_001', name: 'Farhan Pratama', role: 'operations_manager', title: 'Operations Manager', dept: 'Operasi', email: 'f***@kenari.co.id', last_active: iso(0, 13, 40), status: 'active' },
    { id: 'user_002', name: 'Nadia Rahman', role: 'governance_lead', title: 'Governance Lead', dept: 'Tata Kelola', email: 'n***@kenari.co.id', last_active: iso(0, 11, 5), status: 'active' },
    { id: 'user_003', name: 'Rina Kusuma', role: 'legal_reviewer', title: 'Legal Counsel', dept: 'Legal', email: 'r***@kenari.co.id', last_active: iso(1, 9, 20), status: 'active' },
    { id: 'user_004', name: 'Andi Prasetyo', role: 'finance_approver', title: 'Finance Approver', dept: 'Keuangan', email: 'a***@kenari.co.id', last_active: iso(1, 16, 10), status: 'active' },
    { id: 'user_005', name: 'Sari Wulandari', role: 'requester', title: 'HR Business Partner', dept: 'Sumber Daya Manusia', email: 's***@kenari.co.id', last_active: iso(2, 10, 0), status: 'active' },
    { id: 'user_006', name: 'Dimas Anggara', role: 'auditor', title: 'Internal Auditor', dept: 'Audit Internal', email: 'd***@kenari.co.id', last_active: iso(4, 15, 30), status: 'active' },
    { id: 'user_007', name: 'Yusuf Hidayat', role: 'org_admin', title: 'Platform Administrator', dept: 'TI', email: 'y***@kenari.co.id', last_active: iso(0, 8, 15), status: 'active' },
    { id: 'user_008', name: 'Maya Lestari', role: 'requester', title: 'Executive Secretary', dept: 'Operasi', email: 'm***@kenari.co.id', last_active: iso(6, 14, 0), status: 'invited' }
  ];

  var roles = [
    { id: 'operations_manager', name: 'Operations Manager', desc: 'Menyetujui work package operasional, menerbitkan dan mencabut mandat.', users: 1, scope: 'org_kenari' },
    { id: 'governance_lead', name: 'Governance Lead', desc: 'Meninjau kepatuhan, mengubah kebijakan, mengakses seluruh audit trail.', users: 1, scope: 'org_kenari' },
    { id: 'legal_reviewer', name: 'Legal Reviewer', desc: 'Meninjau penerima eksternal dan temuan berisiko tinggi. Tidak dapat menerbitkan mandat.', users: 1, scope: 'org_kenari' },
    { id: 'finance_approver', name: 'Finance Approver', desc: 'Menyetujui tindakan yang menyentuh data keuangan.', users: 1, scope: 'org_kenari' },
    { id: 'requester', name: 'Requester', desc: 'Mengirim permintaan dan melihat work package miliknya sendiri.', users: 2, scope: 'own' },
    { id: 'auditor', name: 'Auditor', desc: 'Akses baca penuh ke audit trail dan bukti eksekusi. Tidak dapat menulis.', users: 1, scope: 'org_kenari' },
    { id: 'org_admin', name: 'Organization Admin', desc: 'Mengelola pengguna, peran, integrasi, dan pengaturan organisasi.', users: 1, scope: 'org_kenari' }
  ];

  var specialists = [
    {
      id: 'dispatcher', name: 'Workforce Dispatcher', role: 'Routing & assignment', icon: 'hub',
      desc: 'Membaca permintaan, memecahnya menjadi work package, dan menugaskan spesialis yang tepat. Tidak menulis ke sistem eksternal.',
      status: 'active', version: 'v0.9.2', mandates: 'read-only', tags: ['routing', 'decomposition', 'no-write'],
      capabilities: ['Membaca permintaan', 'Menyusun work package', 'Menugaskan spesialis'], limits: ['Tidak menulis', 'Tidak menyetujui', 'Tidak memilih penerima final']
    },
    {
      id: 'ea', name: 'Executive Assistant', role: 'Correspondence & scheduling', icon: 'event_note',
      desc: 'Menyusun korespondensi dan jadwal atas nama manajer. Setiap keluaran adalah rencana, bukan tindakan.',
      status: 'active', version: 'v1.2.0', mandates: 'write via mandate', tags: ['email', 'calendar', 'drafting'],
      capabilities: ['Menyusun draf pesan', 'Mengusulkan jadwal', 'Meringkas notulen'], limits: ['Kirim hanya lewat mandat', 'Tanpa penerima eksternal tanpa Legal']
    },
    {
      id: 'ao', name: 'Administrative Officer', role: 'Records & document operations', icon: 'folder_managed',
      desc: 'Menangani pengarsipan, penomoran dokumen, dan operasi berkas administratif di dalam lingkup mandat.',
      status: 'active', version: 'v0.8.5', mandates: 'write via mandate', tags: ['arsip', 'dokumen', 'metadata'],
      capabilities: ['Mengarsipkan dokumen', 'Menomori surat', 'Memperbarui metadata'], limits: ['Tidak menghapus tanpa dual approval', 'Tidak menyentuh data PII']
    },
    {
      id: 'adversarial', name: 'Adversarial Reviewer', role: 'Independent challenge', icon: 'gavel',
      desc: 'Menyerang rencana sebelum manusia melihatnya: penerima ambigu, instruksi berbahaya, dan penyimpangan lingkup.',
      status: 'active', version: 'v1.0.3', mandates: 'read-only', tags: ['challenge', 'scope', 'red-team'],
      capabilities: ['Menguji lingkup', 'Menandai ambiguitas', 'Mengusulkan pemblokiran'], limits: ['Tidak dapat memblokir sendiri', 'Tidak mengeksekusi']
    },
    {
      id: 'policy_validator', name: 'Policy Validator', role: 'Deterministic policy engine', icon: 'rule',
      desc: 'Bukan spesialis AI. Mesin aturan deterministik yang mengevaluasi rencana terhadap kebijakan organisasi. Keluarannya dapat diprediksi dan dapat diuji.',
      status: 'active', version: 'engine 1.0', mandates: 'evaluate only', engine: true, tags: ['deterministik', 'bukan AI', 'dapat diuji'],
      capabilities: ['Evaluasi 8 aturan aktif', 'Menghasilkan reason code', 'Menolak eksekusi'], limits: ['Tidak menilai niat', 'Tidak menggantikan persetujuan manusia']
    }
  ];

  var contacts = [
    { contact_id: 'c_budi_fin', display_name: 'Budi Santoso', department: 'Keuangan', masked_address: 'b***@kenari.co.id', tags: ['budi', 'keuangan', 'internal'] },
    { contact_id: 'c_budi_ops', display_name: 'Budi Prakoso', department: 'Operasional', masked_address: 'b***@kenari.co.id', tags: ['budi', 'operasional', 'internal'] },
    { contact_id: 'c_sari_hr', display_name: 'Sari Wulandari', department: 'Sumber Daya Manusia', masked_address: 's***@kenari.co.id', tags: ['sari', 'hr', 'internal'] },
    { contact_id: 'c_andi_mkt', display_name: 'Andi Prasetyo', department: 'Keuangan', masked_address: 'a***@kenari.co.id', tags: ['andi', 'keuangan', 'internal'] },
    { contact_id: 'c_rina_legal', display_name: 'Rina Kusuma', department: 'Legal', masked_address: 'r***@kenari.co.id', tags: ['rina', 'legal', 'internal'] },
    { contact_id: 'c_tim_ops', display_name: 'Tim Operasional', department: 'Operasional', masked_address: 't***@kenari.co.id', tags: ['tim', 'operasional', 'grup'] }
  ];

  /* ---------------- plans / work packages ---------------- */
  function act(id, type, contactId, subject, body, risk, startAt) {
    var c = contacts.filter(function (x) { return x.contact_id === contactId; })[0] || contacts[0];
    return {
      action_id: id, action_type: type,
      target: { contact_id: c.contact_id, display_name: c.display_name, masked_address: c.masked_address, channel: type === 'schedule_event' ? 'calendar' : 'email' },
      schedule: { start_at: startAt, timezone: 'Asia/Jakarta', all_day: false },
      content: { subject: subject, body: body, locale: 'id-ID' },
      risk: risk || 'low'
    };
  }

  var plans = [
    {
      plan_id: 'WP-2041', intent: 'Kirim notulen rapat koordinasi Q4 ke Budi Santoso dan minta konfirmasi kehadiran', status: 'READY',
      created_at: iso(0, 9, 12), requester: 'Farhan Pratama', specialist: 'ea', risk: 'medium',
      plan_hash: 'a91f4c7e2b8d5a30c6f1', mandate_id: null,
      actions: [act('a1', 'send_email', 'c_budi_fin', 'Notulen Rapat Koordinasi Q4 — 2 November 2026',
        'Halo Pak Budi,\n\nBerikut notulen rapat koordinasi Q4 hari ini:\n1. Target operasional November disepakati.\n2. Anggaran perjalanan dinas menunggu persetujuan Keuangan.\n3. Tindak lanjut: konfirmasi kehadiran review anggaran Jumat.\n\nTerima kasih.', 'medium', iso(-1, 9, 0))],
      findings: [
        { code: 'RECIPIENT_MATCH', severity: 'info', message: 'Dua kontak bernama "Budi" ditemukan. Penerima dipilih berdasarkan departemen Keuangan.' }
      ],
      review: { adversarial: 'pass', policy: 'pass', notes: 'Lingkup sesuai permintaan. Tidak ada penerima eksternal.' }
    },
    {
      plan_id: 'WP-2042', intent: 'Kirim notulen rapat koordinasi Q4 ke Budi Santoso', status: 'APPROVED',
      created_at: iso(0, 6, 20), requester: 'Farhan Pratama', specialist: 'ea', risk: 'medium',
      plan_hash: 'b3f7a1c8e5d2497a6c01', mandate_id: 'MND-1188',
      actions: [act('a1', 'send_email', 'c_budi_fin', 'Notulen rapat koordinasi Q4',
        'Halo Pak Budi,\n\nBerikut notulen rapat koordinasi Q4 yang disepakati hari ini.\n\nTerima kasih.', 'medium', iso(0, 9, 0))],
      findings: [],
      review: { adversarial: 'pass', policy: 'pass', notes: 'Disetujui manusia. Mandat terbit, eksekusi belum dijalankan.' }
    },
    {
      plan_id: 'WP-2040', intent: 'Jadwalkan ulang review anggaran dengan Sari Wulandari ke Kamis pagi', status: 'NEEDS_REVIEW',
      created_at: iso(0, 8, 35), requester: 'Farhan Pratama', specialist: 'ea', risk: 'low',
      plan_hash: '7c2e9d1a4f6b8035e7d2', mandate_id: null,
      actions: [act('a1', 'schedule_event', 'c_sari_hr', 'Review Anggaran November (dijadwalkan ulang)',
        'Agenda: peninjauan anggaran operasional November. Durasi 60 menit. Lokasi: Ruang Kenari 2.', 'low', iso(-3, 2, 0))],
      findings: [
        { code: 'SLOT_CONFLICT', severity: 'warning', message: 'Slot Kamis 09:00 bertabrakan dengan agenda "Weekly Ops Sync" yang belum dikonfirmasi.' }
      ],
      review: { adversarial: 'flag', policy: 'pass', notes: 'Konflik jadwal perlu keputusan manusia.' }
    },
    {
      plan_id: 'WP-2039', intent: 'Kirim ringkasan kontrak vendor ke Rina Kusuma di Legal beserta data kontak vendor', status: 'BLOCKED',
      created_at: iso(0, 7, 50), requester: 'Sari Wulandari', specialist: 'ao', risk: 'high',
      plan_hash: 'e4b7c0f9a2d6138b5c47', mandate_id: null,
      actions: [act('a1', 'send_email', 'c_rina_legal', 'Ringkasan kontrak vendor — PT Sinar Abadi',
        'Terlampir ringkasan kontrak. Data kontak vendor: Budi Santoso, +6281211102233, NIK 3174091200010001, Jl. Kenari Raya No. 12.', 'high', iso(-1, 10, 0))],
      findings: [
        { code: 'PII_IN_CONTENT', severity: 'blocking', message: 'Isi pesan memuat NIK dan nomor telepon. Kebijakan PII-04 melarang PII dalam pesan keluar.' },
        { code: 'EXTERNAL_DATA', severity: 'blocking', message: 'Data kontak vendor tidak berada dalam lingkup mandat spesialis Administrative Officer.' }
      ],
      review: { adversarial: 'block', policy: 'block', notes: 'Dua temuan blocking. Persetujuan dinonaktifkan.' }
    },
    {
      plan_id: 'WP-2038', intent: 'Arsipkan 12 dokumen vendor lama ke folder Arsip 2024', status: 'EXECUTED',
      created_at: iso(1, 10, 20), requester: 'Farhan Pratama', specialist: 'ao', risk: 'medium',
      plan_hash: '1f8a6b3c9d0e47258a13', mandate_id: 'MND-1187', executed_at: iso(1, 11, 5),
      actions: [act('a1', 'archive_documents', 'c_tim_ops', 'Arsip dokumen vendor 2024 (12 berkas)',
        '12 dokumen dipindahkan dari /Vendor/2024 ke /Arsip/2024. Tidak ada penghapusan.', 'medium', iso(1, 11, 0))],
      findings: [], review: { adversarial: 'pass', policy: 'pass', notes: 'Operasi arsip, bukan hapus.' }
    },
    {
      plan_id: 'WP-2037', intent: 'Kirim pengingat tindak lanjut ke Tim Operasional', status: 'EXECUTED',
      created_at: iso(1, 8, 5), requester: 'Farhan Pratama', specialist: 'ea', risk: 'low',
      plan_hash: '3d5c8b1f7a2e9046b8c5', mandate_id: 'MND-1186', executed_at: iso(1, 9, 30),
      actions: [act('a1', 'send_email', 'c_tim_ops', 'Pengingat: tindak lanjut rapat 31 Oktober',
        'Rekan-rekan, mohon menyelesaikan tiga tindak lanjut berikut sebelum Jumat:\n1. Rekap absensi\n2. Update status vendor\n3. Konfirmasi jadwal review', 'low', iso(1, 9, 30))],
      findings: [], review: { adversarial: 'pass', policy: 'pass', notes: '' }
    },
    {
      plan_id: 'WP-2036', intent: 'Susun draf agenda rapat mingguan untuk Senin depan', status: 'DRAFT',
      created_at: iso(1, 16, 45), requester: 'Maya Lestari', specialist: 'ea', risk: 'low',
      plan_hash: '9b0e2a7c4f8d1356e9a0', mandate_id: null,
      actions: [act('a1', 'send_email', 'c_tim_ops', 'Draf agenda rapat mingguan', 'Draf agenda belum lengkap. Menunggu input dari pemilik agenda.', 'low', iso(-6, 1, 0))],
      findings: [{ code: 'INCOMPLETE_SCOPE', severity: 'warning', message: 'Permintaan belum menyebut peserta dan durasi. Draf tidak dapat divalidasi.' }],
      review: { adversarial: 'pending', policy: 'pending', notes: 'Menunggu klarifikasi pemohon.' }
    },
    {
      plan_id: 'WP-2035', intent: 'Kirim laporan pengeluaran Oktober ke Andi Prasetyo tanpa persetujuan Keuangan', status: 'REJECTED',
      created_at: iso(2, 13, 10), requester: 'Sari Wulandari', specialist: 'ao', risk: 'medium',
      plan_hash: '6a3f9e2b8c1d7045f2b7', mandate_id: null, rejected_at: iso(2, 14, 2), rejected_by: 'Nadia Rahman',
      actions: [act('a1', 'send_email', 'c_andi_mkt', 'Laporan pengeluaran Oktober 2026', 'Terlampir laporan pengeluaran Oktober. Mohon ditindaklanjuti.', 'medium', iso(2, 15, 0))],
      findings: [{ code: 'APPROVAL_BYPASS', severity: 'warning', message: 'Permintaan meminta pengiriman sebelum persetujuan Keuangan. Alur normal mensyaratkan persetujuan lebih dulu.' }],
      review: { adversarial: 'flag', policy: 'pass', notes: 'Ditolak manusia: alur persetujuan tidak boleh dilewati.' }
    },
    {
      plan_id: 'WP-2034', intent: 'Kirim notulen ke Budi', status: 'NEEDS_REVIEW',
      created_at: iso(2, 9, 0), requester: 'Maya Lestari', specialist: 'ea', risk: 'medium',
      plan_hash: 'c8d1f4a7b0e32695c1d8', mandate_id: null,
      actions: [act('a1', 'send_email', 'c_budi_fin', 'Notulen rapat', 'Halo Budi, berikut notulen rapat.', 'medium', iso(-1, 9, 0))],
      findings: [
        { code: 'AMBIGUOUS_RECIPIENT', severity: 'blocking', message: 'Dua kandidat "Budi" ditemukan (Keuangan dan Operasional). Penerima belum dapat dipastikan.' },
        { code: 'MISSING_CONTENT', severity: 'warning', message: 'Isi notulen tidak disertakan dalam permintaan.' }
      ],
      review: { adversarial: 'block', policy: 'pass', notes: 'Penerima ambigu harus diputuskan manusia.' }
    },
    {
      plan_id: 'WP-2033', intent: 'Eskalasi temuan audit internal ke manajemen', status: 'READY',
      created_at: iso(2, 8, 15), requester: 'Dimas Anggara', specialist: 'ao', risk: 'high',
      plan_hash: '2e7b0c5a9f3d8164b7e2', mandate_id: null,
      actions: [act('a1', 'send_email', 'c_tim_ops', 'Eskalasi temuan audit internal — tindak lanjut diperlukan',
        'Manajemen, berikut tiga temuan audit yang memerlukan keputusan:\n1. Akses berlebih pada folder Keuangan.\n2. Dokumen vendor tanpa kontrak aktif.\n3. Retensi arsip melebihi kebijakan.\n\nMohon arahan dalam 5 hari kerja.', 'high', iso(-1, 3, 0))],
      findings: [{ code: 'HIGH_RISK_SCOPE', severity: 'warning', message: 'Konten menyentuh temuan audit. Diperlukan persetujuan Governance Lead.' }],
      review: { adversarial: 'pass', policy: 'pass', notes: 'Risiko tinggi, tetapi lingkup sah.' }
    },
    {
      plan_id: 'WP-2032', intent: 'Hapus seluruh arsip email lebih dari dua tahun', status: 'BLOCKED',
      created_at: iso(3, 15, 40), requester: 'Yusuf Hidayat', specialist: 'ao', risk: 'critical',
      plan_hash: 'f0a4d7c2e9b18356a4c1', mandate_id: null,
      actions: [act('a1', 'delete_records', 'c_tim_ops', 'Penghapusan arsip email > 2 tahun', 'Menghapus 4.812 pesan dari arsip bersama.', 'critical', iso(0, 3, 0))],
      findings: [
        { code: 'DESTRUCTIVE_ACTION', severity: 'blocking', message: 'Penghapusan massal memerlukan dual approval dan tidak tercakup dalam mandat aktif.' },
        { code: 'RETENTION_POLICY', severity: 'blocking', message: 'Kebijakan retensi menetapkan arsip audit disimpan minimal 7 tahun.' }
      ],
      review: { adversarial: 'block', policy: 'block', notes: 'Tidak dapat disetujui dalam bentuk ini.' }
    },
    {
      plan_id: 'WP-2031', intent: 'Kirim undangan rapat Jumat pukul 11:45 ke Tim Operasional', status: 'BLOCKED',
      created_at: iso(3, 10, 10), requester: 'Maya Lestari', specialist: 'ea', risk: 'low',
      plan_hash: 'b5c8e1f4a7d02963e8b3', mandate_id: null,
      actions: [act('a1', 'schedule_event', 'c_tim_ops', 'Rapat koordinasi Jumat', 'Rapat koordinasi mingguan, 45 menit.', 'low', iso(-4, 4, 45))],
      findings: [{ code: 'PROTECTED_WINDOW', severity: 'blocking', message: 'Jadwal 11:45 berada di dalam jendela Salat Jumat (11:30–13:00) menurut aturan organisasi.' }],
      review: { adversarial: 'pass', policy: 'block', notes: 'Diblokir mesin kebijakan deterministik, bukan oleh AI.' }
    },
    {
      plan_id: 'WP-2030', intent: 'Rekap absensi bulanan Oktober untuk HR', status: 'EXECUTED',
      created_at: iso(4, 9, 25), requester: 'Sari Wulandari', specialist: 'ao', risk: 'low',
      plan_hash: '4a9c2e6b1f8d0357c2e9', mandate_id: 'MND-1185', executed_at: iso(4, 10, 15),
      actions: [act('a1', 'send_email', 'c_sari_hr', 'Rekap absensi Oktober 2026', 'Terlampir rekap absensi Oktober. Total 21 hari kerja, 3 hari libur.', 'low', iso(4, 10, 0))],
      findings: [], review: { adversarial: 'pass', policy: 'pass', notes: '' }
    },
    {
      plan_id: 'WP-2029', intent: 'Kirim ringkasan mingguan ke seluruh kepala departemen', status: 'EXECUTED',
      created_at: iso(5, 8, 40), requester: 'Farhan Pratama', specialist: 'ea', risk: 'low',
      plan_hash: 'd7e0b3f6a9c24518b0d7', mandate_id: 'MND-1184', executed_at: iso(5, 9, 20),
      actions: [act('a1', 'send_email', 'c_tim_ops', 'Ringkasan mingguan operasi — pekan 44', 'Ringkasan: 3 work package selesai, 2 menunggu persetujuan, 1 diblokir kebijakan.', 'low', iso(5, 9, 20))],
      findings: [], review: { adversarial: 'pass', policy: 'pass', notes: '' }
    },
    {
      plan_id: 'WP-2028', intent: 'Perbarui metadata 40 dokumen kontrak', status: 'READY',
      created_at: iso(5, 14, 5), requester: 'Rina Kusuma', specialist: 'ao', risk: 'medium',
      plan_hash: '8c1f4a7d0e3b6925f8c1', mandate_id: null,
      actions: [act('a1', 'update_metadata', 'c_rina_legal', 'Pembaruan metadata kontrak (40 dokumen)', 'Kolom "tanggal berlaku" dan "pihak kedua" diperbarui dari daftar kontrak.', 'medium', iso(-1, 2, 0))],
      findings: [], review: { adversarial: 'pass', policy: 'pass', notes: '' }
    }
  ];

  plans.forEach(function (p) {
    p.actions.forEach(function (a) { a.risk = a.risk || p.risk; });
  });

  /* ---------------- mandates ---------------- */
  var mandates = [
    { mandate_id: 'MND-1188', plan_id: 'WP-2042', scope: 'send_email · 1 penerima internal', issued_at: iso(0, 6, 40), expires_at: iso(-1, 18, 0), issued_by: 'Farhan Pratama', status: 'active', plan_hash: 'b3f7a1c8e5d2497a6c01', uses: 0, max_uses: 1 },
    { mandate_id: 'MND-1187', plan_id: 'WP-2038', scope: 'archive_documents', issued_at: iso(1, 11, 0), expires_at: iso(-6, 17, 0), issued_by: 'Farhan Pratama', status: 'active', plan_hash: '1f8a6b3c9d0e47258a13', uses: 1, max_uses: 1 },
    { mandate_id: 'MND-1186', plan_id: 'WP-2037', scope: 'send_email · 1 penerima internal', issued_at: iso(1, 9, 20), expires_at: iso(1, 17, 0), issued_by: 'Farhan Pratama', status: 'expired', plan_hash: '3d5c8b1f7a2e9046b8c5', uses: 1, max_uses: 1 },
    { mandate_id: 'MND-1185', plan_id: 'WP-2030', scope: 'send_email · 1 penerima internal', issued_at: iso(4, 10, 5), expires_at: iso(4, 17, 0), issued_by: 'Farhan Pratama', status: 'expired', plan_hash: '4a9c2e6b1f8d0357c2e9', uses: 1, max_uses: 1 },
    { mandate_id: 'MND-1184', plan_id: 'WP-2029', scope: 'send_email · 1 penerima internal', issued_at: iso(5, 9, 10), expires_at: iso(5, 17, 0), issued_by: 'Farhan Pratama', status: 'expired', plan_hash: 'd7e0b3f6a9c24518b0d7', uses: 1, max_uses: 1 },
    { mandate_id: 'MND-1183', plan_id: 'WP-2027', scope: 'send_email · 3 penerima internal', issued_at: iso(7, 10, 0), expires_at: iso(7, 17, 0), issued_by: 'Nadia Rahman', status: 'revoked', plan_hash: '5e8b1c4f7a0d3926b5e8', uses: 0, max_uses: 3, revoked_at: iso(7, 11, 30), revoke_reason: 'Lingkup penerima diperluas setelah mandat terbit.' }
  ];

  /* ---------------- executions ---------------- */
  var executions = [
    { execution_id: 'EX-5521', plan_id: 'WP-2038', action_id: 'a1', mandate_id: 'MND-1187', at: iso(1, 11, 5), result: 'sent', adapter: 'mock-archive', detail: '12 dokumen dipindahkan · batch AR-8841', duration_ms: 412 },
    { execution_id: 'EX-5518', plan_id: 'WP-2037', action_id: 'a1', mandate_id: 'MND-1186', at: iso(1, 9, 30), result: 'sent', adapter: 'mock-email', detail: 'mock_message_id: m_8841a', duration_ms: 233 },
    { execution_id: 'EX-5490', plan_id: 'WP-2030', action_id: 'a1', mandate_id: 'MND-1185', at: iso(4, 10, 15), result: 'sent', adapter: 'mock-email', detail: 'mock_message_id: m_8790c', duration_ms: 190 },
    { execution_id: 'EX-5477', plan_id: 'WP-2029', action_id: 'a1', mandate_id: 'MND-1184', at: iso(5, 9, 20), result: 'sent', adapter: 'mock-email', detail: 'mock_message_id: m_8764e', duration_ms: 208 },
    { execution_id: 'EX-5461', plan_id: 'WP-2026', action_id: 'a1', mandate_id: 'MND-1182', at: iso(6, 14, 40), result: 'failed', adapter: 'mock-email', detail: 'Adapter timeout setelah 5s — tidak ada pesan terkirim', duration_ms: 5002 },
    { execution_id: 'EX-5455', plan_id: 'WP-2025', action_id: 'a1', mandate_id: 'MND-1181', at: iso(7, 9, 5), result: 'sent', adapter: 'mock-email', detail: 'mock_message_id: m_8701b', duration_ms: 176 }
  ];

  /* ---------------- audit trail (derived + system) ---------------- */
  var audit = [];
  function ev(at, type, actor, subject, reason, detail) {
    audit.push({ at: at, type: type, actor: actor, plan_id: subject.plan, mandate_id: subject.mandate || null, action_id: subject.action || null, reason_code: reason || null, detail: detail || null });
  }

  plans.forEach(function (p) {
    var who = p.requester;
    ev(p.created_at, 'request_received', who, { plan: p.plan_id }, null, 'Permintaan diterima dari antarmuka web');
    ev(new Date(new Date(p.created_at).getTime() + 4000).toISOString(), 'intent_interpreted', 'workforce_dispatcher', { plan: p.plan_id }, null, 'Niat dipecah menjadi ' + p.actions.length + ' tindakan');
    ev(new Date(new Date(p.created_at).getTime() + 9000).toISOString(), 'specialist_assigned', 'workforce_dispatcher', { plan: p.plan_id }, null, 'Spesialis: ' + p.specialist);
    ev(new Date(new Date(p.created_at).getTime() + 15000).toISOString(), 'plan_drafted', p.specialist, { plan: p.plan_id }, null, 'plan_hash ' + p.plan_hash.slice(0, 12));
    if (p.review && p.review.adversarial !== 'pending') {
      ev(new Date(new Date(p.created_at).getTime() + 22000).toISOString(), 'adversarial_review', 'adversarial_reviewer', { plan: p.plan_id }, p.review.adversarial === 'block' ? 'SCOPE_VIOLATION' : null, 'Hasil: ' + p.review.adversarial);
    }
    (p.findings || []).forEach(function (f, i) {
      if (f.severity === 'blocking') {
        ev(new Date(new Date(p.created_at).getTime() + 26000 + i * 1000).toISOString(), 'policy_blocked', 'policy_validator', { plan: p.plan_id }, f.code, f.message);
      }
    });
    if (p.review && p.review.policy === 'pass') {
      ev(new Date(new Date(p.created_at).getTime() + 31000).toISOString(), 'policy_validated', 'policy_validator', { plan: p.plan_id }, null, 'Semua aturan aktif lulus');
    }
    if (p.status === 'REJECTED') {
      ev(p.rejected_at, 'approval_rejected', p.rejected_by || 'Nadia Rahman', { plan: p.plan_id }, 'APPROVAL_BYPASS', 'Ditolak manusia');
    }
    if (p.mandate_id) {
      ev(new Date(new Date(p.created_at).getTime() + 3600000).toISOString(), 'approval_granted', 'Farhan Pratama', { plan: p.plan_id }, null, 'Persetujuan manusia dicatat');
      ev(new Date(new Date(p.created_at).getTime() + 3605000).toISOString(), 'mandate_issued', 'mandate_engine', { plan: p.plan_id, mandate: p.mandate_id }, null, 'Mandat terikat pada plan_hash');
    }
    if (p.executed_at) {
      ev(p.executed_at, 'action_executed', 'executor', { plan: p.plan_id, mandate: p.mandate_id, action: p.actions[0].action_id }, null, 'Adapter mock');
      ev(new Date(new Date(p.executed_at).getTime() + 1200).toISOString(), 'audit_recorded', 'audit_log', { plan: p.plan_id, mandate: p.mandate_id }, null, 'Rekaman append-only ditulis');
    }
  });
  ev(iso(7, 11, 30), 'mandate_revoked', 'Nadia Rahman', { plan: 'WP-2027', mandate: 'MND-1183' }, 'SCOPE_CHANGED', 'Mandat dicabut sebelum eksekusi');
  ev(iso(6, 14, 40), 'action_blocked', 'executor', { plan: 'WP-2026', mandate: 'MND-1182' }, 'ADAPTER_TIMEOUT', 'Tidak ada pesan terkirim');
  ev(iso(0, 6, 0), 'policy_updated', 'Nadia Rahman', {}, null, 'Kebijakan PII-04 diperketat: nomor telepon kini termasuk PII');
  audit.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });

  /* ---------------- policies ---------------- */
  var policies = [
    { id: 'GOV-01', name: 'Mandat wajib untuk setiap penulisan', category: 'Eksekusi', severity: 'blocking', active: true, scope: 'Semua spesialis', desc: 'Setiap tindakan tulis harus terikat pada mandat aktif yang hash-nya cocok dengan plan_hash.', updated: iso(30, 9, 0), by: 'Nadia Rahman' },
    { id: 'GOV-02', name: 'Persetujuan manusia eksplisit', category: 'Persetujuan', severity: 'blocking', active: true, scope: 'Semua work package', desc: 'Tidak ada jalur dari agen ke executor. Persetujuan harus dilakukan pengguna dengan peran approver.', updated: iso(30, 9, 5), by: 'Nadia Rahman' },
    { id: 'PII-04', name: 'Larangan PII dalam pesan keluar', category: 'Privasi', severity: 'blocking', active: true, scope: 'Email, dokumen', desc: 'NIK, nomor telepon, alamat, dan nomor rekening dilarang muncul dalam konten keluar. Alamat penerima selalu ter-mask.', updated: iso(0, 6, 0), by: 'Nadia Rahman' },
    { id: 'EXT-02', name: 'Penerima eksternal butuh Legal', category: 'Penerima', severity: 'warning', active: true, scope: 'Email', desc: 'Penerima di luar domain organisasi memerlukan persetujuan Legal Reviewer sebelum mandat terbit.', updated: iso(14, 10, 0), by: 'Rina Kusuma' },
    { id: 'TIME-01', name: 'Jam kerja 08:00–17:00 WIB', category: 'Waktu', severity: 'warning', active: true, scope: 'Penjadwalan, pengiriman', desc: 'Tindakan tulis di luar jam kerja ditandai untuk peninjauan. Eksekusi tertunda sampai jam kerja berikutnya.', updated: iso(21, 8, 0), by: 'Nadia Rahman' },
    { id: 'TIME-03', name: 'Jendela Salat Jumat dilindungi', category: 'Waktu', severity: 'blocking', active: true, scope: 'Penjadwalan', desc: 'Jadwal 11:30–13:00 pada hari Jumat tidak dapat dibuat oleh spesialis mana pun.', updated: iso(21, 8, 10), by: 'Nadia Rahman' },
    { id: 'SAFE-05', name: 'Operasi destruktif butuh dual approval', category: 'Keamanan', severity: 'blocking', active: true, scope: 'Hapus, timpa', desc: 'Penghapusan lebih dari 10 catatan memerlukan dua approver berbeda dan tidak dapat didelegasikan.', updated: iso(10, 13, 0), by: 'Nadia Rahman' },
    { id: 'SCOPE-07', name: 'Satu penerima per tindakan', category: 'Lingkup', severity: 'warning', active: false, scope: 'Email', desc: 'Tindakan email dibatasi satu penerima kecuali templat siaran telah disetujui. Saat ini nonaktif selama uji coba.', updated: iso(3, 9, 30), by: 'Farhan Pratama' }
  ];

  /* ---------------- integrations ---------------- */
  var integrations = [
    { id: 'mcp', name: 'Local MCP Server', category: 'Runtime', status: 'connected', desc: 'Server MCP lokal pada 127.0.0.1:8765. Satu-satunya jalur eksekusi.', meta: 'loopback only · token ops terpisah', icon: 'dns', last_sync: iso(0, 14, 18) },
    { id: 'workbuddy', name: 'WorkBuddy Agent Runtime', category: 'Runtime', status: 'connected', desc: 'Runtime agen yang menjalankan spesialis dan dispatcher.', meta: 'manifest v1 · 4 skills', icon: 'smart_toy', last_sync: iso(0, 13, 55) },
    { id: 'gmail', name: 'Google Workspace', category: 'Email & Calendar', status: 'mock', desc: 'Adapter email dan kalender. Saat ini berupa mock adapter — tidak ada pesan nyata yang dikirim.', meta: 'mock adapter · tidak mengirim', icon: 'mail', last_sync: iso(0, 11, 0) },
    { id: 'slack', name: 'Slack', category: 'Notifikasi', status: 'mock', desc: 'Notifikasi approval ke kanal internal. Mock adapter, pesan hanya dicatat di log.', meta: 'mock adapter', icon: 'tag', last_sync: iso(1, 9, 0) },
    { id: 'wa', name: 'WhatsApp Business', category: 'Pesan', status: 'planned', desc: 'Belum diimplementasikan. Direncanakan untuk pengingat eksternal dengan persetujuan tambahan.', meta: 'belum tersedia', icon: 'chat', last_sync: null },
    { id: 'xero', name: 'Xero', category: 'Keuangan', status: 'planned', desc: 'Belum diimplementasikan. Direncanakan untuk verifikasi anggaran sebelum persetujuan.', meta: 'belum tersedia', icon: 'account_balance', last_sync: null },
    { id: 'sso', name: 'SAML SSO', category: 'Identitas', status: 'planned', desc: 'Belum diimplementasikan. Autentikasi saat ini memakai token ops lokal.', meta: 'belum tersedia', icon: 'key', last_sync: null }
  ];

  /* ---------------- task board ---------------- */
  var board = [
    { id: 'WP-2041', title: 'Notulen rapat koordinasi Q4', col: 'review', spec: 'Executive Assistant', risk: 'medium', due: 'Hari ini' },
    { id: 'WP-2033', title: 'Eskalasi temuan audit internal', col: 'review', spec: 'Administrative Officer', risk: 'high', due: 'Hari ini' },
    { id: 'WP-2028', title: 'Pembaruan metadata 40 kontrak', col: 'review', spec: 'Administrative Officer', risk: 'medium', due: 'Besok' },
    { id: 'WP-2040', title: 'Jadwalkan ulang review anggaran', col: 'clarify', spec: 'Executive Assistant', risk: 'low', due: 'Besok' },
    { id: 'WP-2034', title: 'Notulen untuk "Budi" (ambigu)', col: 'clarify', spec: 'Executive Assistant', risk: 'medium', due: '—' },
    { id: 'WP-2039', title: 'Ringkasan kontrak vendor', col: 'blocked', spec: 'Administrative Officer', risk: 'high', due: '—' },
    { id: 'WP-2031', title: 'Undangan rapat Jumat 11:45', col: 'blocked', spec: 'Executive Assistant', risk: 'low', due: '—' },
    { id: 'WP-2038', title: 'Arsip dokumen vendor 2024', col: 'done', spec: 'Administrative Officer', risk: 'medium', due: 'Selesai' },
    { id: 'WP-2037', title: 'Pengingat tindak lanjut', col: 'done', spec: 'Executive Assistant', risk: 'low', due: 'Selesai' },
    { id: 'WP-2030', title: 'Rekap absensi Oktober', col: 'done', spec: 'Administrative Officer', risk: 'low', due: 'Selesai' },
    { id: 'WP-2036', title: 'Draf agenda rapat mingguan', col: 'draft', spec: 'Executive Assistant', risk: 'low', due: 'Menunggu input' }
  ];

  /* ---------------- notifications ---------------- */
  var notifications = [
    { id: 'n1', type: 'approval', title: '2 work package menunggu persetujuan Anda', body: 'WP-2041 dan WP-2033 siap ditinjau.', at: iso(0, 13, 5), read: false, href: '#/approvals' },
    { id: 'n2', type: 'blocked', title: 'WP-2039 diblokir kebijakan PII-04', body: 'Konten memuat NIK dan nomor telepon.', at: iso(0, 8, 2), read: false, href: '#/work-packages/WP-2039' },
    { id: 'n3', type: 'clarify', title: 'WP-2034 butuh klarifikasi penerima', body: 'Dua kandidat bernama "Budi".', at: iso(2, 9, 4), read: false, href: '#/review/WP-2034' },
    { id: 'n4', type: 'executed', title: 'WP-2038 selesai dieksekusi', body: 'Mandat MND-1187 digunakan sekali.', at: iso(1, 11, 6), read: true, href: '#/execution' },
    { id: 'n5', type: 'policy', title: 'Kebijakan PII-04 diperbarui', body: 'Nomor telepon kini termasuk PII.', at: iso(0, 6, 5), read: true, href: '#/policies' }
  ];

  /* ---------------- permission matrix ---------------- */
  var capabilities = [
    { key: 'view_own', label: 'Lihat permintaan sendiri' },
    { key: 'view_all', label: 'Lihat semua work package' },
    { key: 'create_request', label: 'Kirim permintaan' },
    { key: 'approve', label: 'Setujui work package' },
    { key: 'issue_mandate', label: 'Terbitkan mandat' },
    { key: 'revoke_mandate', label: 'Cabut mandat' },
    { key: 'execute', label: 'Jalankan eksekusi' },
    { key: 'view_audit', label: 'Baca audit trail' },
    { key: 'edit_policy', label: 'Ubah kebijakan' },
    { key: 'manage_users', label: 'Kelola pengguna & peran' },
    { key: 'manage_integrations', label: 'Kelola integrasi' }
  ];
  var permMatrix = {
    operations_manager: { view_own: 'yes', view_all: 'yes', create_request: 'yes', approve: 'yes', issue_mandate: 'yes', revoke_mandate: 'yes', execute: 'yes', view_audit: 'yes', edit_policy: 'no', manage_users: 'no', manage_integrations: 'no' },
    governance_lead: { view_own: 'yes', view_all: 'yes', create_request: 'yes', approve: 'yes', issue_mandate: 'yes', revoke_mandate: 'yes', execute: 'no', view_audit: 'yes', edit_policy: 'yes', manage_users: 'no', manage_integrations: 'no' },
    legal_reviewer: { view_own: 'yes', view_all: 'yes', create_request: 'yes', approve: 'lim', issue_mandate: 'no', revoke_mandate: 'no', execute: 'no', view_audit: 'yes', edit_policy: 'no', manage_users: 'no', manage_integrations: 'no' },
    finance_approver: { view_own: 'yes', view_all: 'yes', create_request: 'yes', approve: 'lim', issue_mandate: 'no', revoke_mandate: 'no', execute: 'no', view_audit: 'yes', edit_policy: 'no', manage_users: 'no', manage_integrations: 'no' },
    requester: { view_own: 'yes', view_all: 'no', create_request: 'yes', approve: 'no', issue_mandate: 'no', revoke_mandate: 'no', execute: 'no', view_audit: 'no', edit_policy: 'no', manage_users: 'no', manage_integrations: 'no' },
    auditor: { view_own: 'yes', view_all: 'yes', create_request: 'no', approve: 'no', issue_mandate: 'no', revoke_mandate: 'no', execute: 'no', view_audit: 'yes', edit_policy: 'no', manage_users: 'no', manage_integrations: 'no' },
    org_admin: { view_own: 'yes', view_all: 'yes', create_request: 'yes', approve: 'no', issue_mandate: 'no', revoke_mandate: 'no', execute: 'no', view_audit: 'yes', edit_policy: 'no', manage_users: 'yes', manage_integrations: 'yes' }
  };

  /* ---------------- assistant thread (prototype) ---------------- */
  var assistantThread = [
    { role: 'user', at: iso(0, 8, 30), text: 'Siapkan notulen rapat koordinasi Q4 hari ini, kirim ke Budi Santoso, lalu jadwalkan tindak lanjut Jumat pagi.' },
    { role: 'assistant', at: iso(0, 8, 30), text: 'Saya memecah ini menjadi dua tindakan. Keduanya masih berupa rencana dan belum dijalankan.', plan_id: 'WP-2041', steps: ['Menyusun draf notulen (Executive Assistant)', 'Menjadwalkan tindak lanjut Jumat 09:00 (Executive Assistant)'] },
    { role: 'user', at: iso(0, 8, 32), text: 'Jumat jam 11:30 saja.' },
    { role: 'assistant', at: iso(0, 8, 32), text: 'Jadwal 11:30 berada di jendela Salat Jumat (11:30–13:00). Kebijakan TIME-03 memblokir penjadwalan pada rentang itu. Saya dapat mengusulkan 09:00 atau 13:15 — mana yang Anda pilih?', blocked: true }
  ];

  /* ---------------- derived helpers ---------------- */
  function stateOf(p) { return p.status; }

  D.demo = {
    org: org, users: users, roles: roles, specialists: specialists, contacts: contacts,
    plans: plans, mandates: mandates, executions: executions, audit: audit,
    policies: policies, integrations: integrations, board: board,
    notifications: notifications, capabilities: capabilities, permMatrix: permMatrix,
    assistantThread: assistantThread, now: NOW
  };
})();
