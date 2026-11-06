/* DEXTRA P8/P9/P10 — data contoh (DEMO).
 *
 * Semua yang ada di sini adalah contoh tertulis, bukan hasil server. Tidak ada
 * endpoint P8/P9/P10 di backend; daftar ini hanya untuk mengisi layar yang
 * diberi label DEMO. Tidak ada kredensial, host, atau rahasia di berkas ini.
 * Secret MFA di bawah adalah placeholder yang sengaja tidak valid.
 */
(function () {
  'use strict';

  /* ---------------- P8 — Human Authentication (demo) ---------------- */
  var authSnapshot = {
    demo: true,
    user: {
      id: 'demo_maya_001',
      displayName: 'Maya Lestari',
      email: 'maya.lestari@kenari.co.id',
      tenantId: 'org_kenari',
      tenantName: 'Kenari Group',
      role: 'governance_lead',
      roleLabel: 'Governance Lead',
      title: 'Governance Lead',
      dept: 'Tata Kelola',
      mfaVerified: true,
      passwordChangedAt: '2026-10-12T09:20:00+07:00',
      authenticatedAt: '2026-11-04T08:02:00+07:00'
    },
    mfa: {
      demo: true,
      enrolled: true,
      verified: true,
      method: 'totp',
      enrolledAt: '2026-09-15T10:00:00+07:00',
      status: 'verified',
      /* Placeholder DEMO — bukan secret asli, tidak bisa dipakai untuk apa pun. */
      otpauthPlaceholder: 'otpauth://totp/DEXTRA-DEMO:maya.lestari%40kenari.co.id?secret=DEMO-BUKAN-SECRET-ASLI&issuer=DEXTRA-DEMO'
    },
    sessions: [
      { id: 'sess_demo_1', device: 'Chrome di Windows', browser: 'Chrome 130', os: 'Windows 11', ip: '203.0.113.24', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36', lastSeenAt: '2026-11-04T08:41:00+07:00', createdAt: '2026-11-04T08:02:00+07:00', current: true },
      { id: 'sess_demo_2', device: 'Edge di macOS', browser: 'Edge 130', os: 'macOS 15', ip: '203.0.113.87', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Edg/130.0.0.0', lastSeenAt: '2026-11-03T19:12:00+07:00', createdAt: '2026-11-02T07:45:00+07:00', current: false },
      { id: 'sess_demo_3', device: 'Mobile (Android)', browser: 'Chrome Mobile', os: 'Android 15', ip: '198.51.100.41', userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/130.0.0.0 Mobile Safari/537.36', lastSeenAt: '2026-11-01T21:30:00+07:00', createdAt: '2026-10-28T06:10:00+07:00', current: false }
    ],
    loginActivity: [
      { id: 'act_demo_1', at: '2026-11-04T08:02:00+07:00', event: 'Login berhasil (MFA terverifikasi)', device: 'Chrome di Windows', ip: '203.0.113.24', result: 'success' },
      { id: 'act_demo_2', at: '2026-11-03T07:58:00+07:00', event: 'Login berhasil (MFA terverifikasi)', device: 'Edge di macOS', ip: '203.0.113.87', result: 'success' },
      { id: 'act_demo_3', at: '2026-11-02T22:14:00+07:00', event: 'Percobaan login gagal (password salah)', device: 'Tidak dikenal', ip: '198.51.100.203', result: 'failed' },
      { id: 'act_demo_4', at: '2026-11-02T07:45:00+07:00', event: 'Login berhasil (MFA terverifikasi)', device: 'Edge di macOS', ip: '203.0.113.87', result: 'success' },
      { id: 'act_demo_5', at: '2026-10-31T18:05:00+07:00', event: 'Password diganti', device: 'Chrome di Windows', ip: '203.0.113.24', result: 'success' },
      { id: 'act_demo_6', at: '2026-10-28T06:10:00+07:00', event: 'Login berhasil (MFA terverifikasi)', device: 'Mobile (Android)', ip: '198.51.100.41', result: 'success' }
    ]
  };

  /* ---------------- P9 — Authorization (demo) ---------------- */
  var tenant = {
    id: 'org_kenari',
    name: 'Kenari Group',
    slug: 'kenari',
    timezone: 'Asia/Jakarta',
    status: 'active'
  };

  var members = [
    { id: 'mem_001', tenantId: 'org_kenari', userId: 'user_maya', displayName: 'Maya Lestari', email: 'maya.lestari@kenari.co.id', role: 'governance_lead', status: 'accepted', acceptedAt: '2026-09-02T09:15:00+07:00', source: 'demo fixture', createdAt: '2026-09-02T09:15:00+07:00' },
    { id: 'mem_002', tenantId: 'org_kenari', userId: 'user_farhan', displayName: 'Farhan Pratama', email: 'farhan.pratama@kenari.co.id', role: 'operations_manager', status: 'accepted', acceptedAt: '2026-09-02T10:05:00+07:00', source: 'demo fixture', createdAt: '2026-09-02T10:05:00+07:00' },
    { id: 'mem_003', tenantId: 'org_kenari', userId: 'user_sari', displayName: 'Sari Wulandari', email: 'sari.wulandari@kenari.co.id', role: 'finance_approver', status: 'accepted', acceptedAt: '2026-09-03T13:40:00+07:00', source: 'demo fixture', createdAt: '2026-09-03T13:40:00+07:00' },
    { id: 'mem_004', tenantId: 'org_kenari', userId: 'user_rina', displayName: 'Rina Kusuma', email: 'rina.kusuma@kenari.co.id', role: 'auditor', status: 'accepted', acceptedAt: '2026-09-03T15:20:00+07:00', source: 'demo fixture', createdAt: '2026-09-03T15:20:00+07:00' },
    { id: 'mem_005', tenantId: 'org_kenari', userId: 'user_dimas', displayName: 'Dimas Aryo', email: 'dimas.aryo@kenari.co.id', role: 'requester', status: 'invited', acceptedAt: null, source: 'demo fixture', createdAt: '2026-10-20T11:00:00+07:00' },
    { id: 'mem_006', tenantId: 'org_kenari', userId: 'user_lestari', displayName: 'Lestari Handayani', email: 'lestari.handayani@kenari.co.id', role: 'operations_manager', status: 'accepted', acceptedAt: '2026-09-04T08:30:00+07:00', source: 'demo fixture', createdAt: '2026-09-04T08:30:00+07:00' },
    { id: 'mem_007', tenantId: 'org_kenari', userId: 'user_bimo', displayName: 'Bimo Aji', email: 'bimo.aji@kenari.co.id', role: 'requester', status: 'suspended', acceptedAt: '2026-09-05T14:00:00+07:00', source: 'demo fixture', createdAt: '2026-09-05T14:00:00+07:00' },
    { id: 'mem_008', tenantId: 'org_kenari', userId: 'user_nadia', displayName: 'Nadia Prameswari', email: 'nadia.prameswari@kenari.co.id', role: 'auditor', status: 'invited', acceptedAt: null, source: 'demo fixture', createdAt: '2026-10-29T09:45:00+07:00' }
  ];

  /* 11 kapabilitas yang dikenal layar; `backed:false` berarti server belum
   * menegakkannya — ditampilkan sebagai "tidak tersedia", bukan sebagai izin. */
  var permissions = [
    { id: 'view_all', label: 'Lihat seluruh workspace', group: 'Tata Kelola', backed: true, note: 'Ditegakkan server (scope token).' },
    { id: 'view_own', label: 'Lihat pekerjaan sendiri', group: 'Tata Kelola', backed: true, note: 'Ditegakkan server (scope token).' },
    { id: 'view_audit', label: 'Lihat audit trail', group: 'Tata Kelola', backed: true, note: 'Ditegakkan server (scope token).' },
    { id: 'create_request', label: 'Membuat permintaan', group: 'Operasional', backed: true, note: 'Ditegakkan server (scope token).' },
    { id: 'approve', label: 'Menyetujui / menolak rencana', group: 'Persetujuan', backed: true, note: 'Ditegakkan server (scope token).' },
    { id: 'execute', label: 'Mengeksekusi tindakan', group: 'Persetujuan', backed: true, note: 'Ditegakkan server (scope token).' },
    { id: 'manage_integrations', label: 'Kelola integrasi', group: 'Administrasi', backed: false, note: 'Belum diimplementasikan server.' },
    { id: 'manage_users', label: 'Kelola anggota & peran', group: 'Administrasi', backed: false, note: 'Belum diimplementasikan server.' },
    { id: 'manage_policies', label: 'Kelola kebijakan', group: 'Administrasi', backed: false, note: 'Belum diimplementasikan server.' },
    { id: 'export_audit', label: 'Ekspor audit (P4)', group: 'Administrasi', backed: false, note: 'Belum diimplementasikan server.' },
    { id: 'manage_tokens', label: 'Kelola token API', group: 'Administrasi', backed: false, note: 'Belum diimplementasikan server.' }
  ];

  var roles = [
    { id: 'governance_lead', label: 'Governance Lead', description: 'Menetapkan mandat, meninjau dan menyetujui rencana berisiko tinggi.', system: true,
      capabilities: ['view_all', 'view_own', 'view_audit', 'create_request', 'approve', 'execute', 'manage_policies', 'export_audit'],
      unbacked: ['manage_policies', 'export_audit'] },
    { id: 'operations_manager', label: 'Operations Manager', description: 'Menjalankan operasi harian; menyetujui dalam batas mandat.', system: true,
      capabilities: ['view_all', 'view_own', 'create_request', 'approve', 'execute'],
      unbacked: [] },
    { id: 'auditor', label: 'Auditor', description: 'Akses baca penuh ke audit dan rekaman; tanpa wewenang tulis.', system: true,
      capabilities: ['view_all', 'view_own', 'view_audit', 'export_audit'],
      unbacked: ['export_audit'] },
    { id: 'requester', label: 'Requester', description: 'Mengajukan permintaan dan melihat pekerjaan sendiri.', system: true,
      capabilities: ['view_own', 'create_request'],
      unbacked: [] }
  ];

  /* Matriks role × permission: 'yes' | 'lim' (terbatas) | 'no'. */
  var permMatrix = {
    governance_lead:    { view_all: 'yes', view_own: 'yes', view_audit: 'yes', create_request: 'yes', approve: 'yes', execute: 'yes', manage_integrations: 'no',  manage_users: 'lim', manage_policies: 'lim', export_audit: 'lim', manage_tokens: 'no' },
    operations_manager: { view_all: 'yes', view_own: 'yes', view_audit: 'no',  create_request: 'yes', approve: 'lim', execute: 'lim', manage_integrations: 'no',  manage_users: 'no',  manage_policies: 'no',  export_audit: 'no',  manage_tokens: 'no' },
    auditor:            { view_all: 'yes', view_own: 'yes', view_audit: 'yes', create_request: 'no',  approve: 'no',  execute: 'no',  manage_integrations: 'no',  manage_users: 'no',  manage_policies: 'no',  export_audit: 'lim', manage_tokens: 'no' },
    finance_approver:   { view_all: 'yes', view_own: 'yes', view_audit: 'no',  create_request: 'yes', approve: 'lim', execute: 'no',  manage_integrations: 'no',  manage_users: 'no',  manage_policies: 'no',  export_audit: 'no',  manage_tokens: 'no' },
    requester:          { view_all: 'no',  view_own: 'yes', view_audit: 'no',  create_request: 'yes', approve: 'no',  execute: 'no',  manage_integrations: 'no',  manage_users: 'no',  manage_policies: 'no',  export_audit: 'no',  manage_tokens: 'no' }
  };

  /* ---------------- P10 — API Token Management (demo) ---------------- */
  var tokens = [
    { id: 'tok_001', name: 'CI — deploy dashboard', prefix: 'dx_demo_ci01', scopes: ['view_all', 'execute'], status: 'active', createdBy: 'maya.lestari@kenari.co.id', createdAt: '2026-09-10T09:00:00+07:00', expiresAt: '2027-03-10T09:00:00+07:00', lastUsedAt: '2026-11-03T22:15:00+07:00', revokedAt: null, rotatedFromId: null },
    { id: 'tok_002', name: 'Integrasi ERP (read-only)', prefix: 'dx_demo_erp2', scopes: ['view_all'], status: 'active', createdBy: 'farhan.pratama@kenari.co.id', createdAt: '2026-08-18T13:30:00+07:00', expiresAt: '2026-12-31T23:59:00+07:00', lastUsedAt: '2026-11-04T06:05:00+07:00', revokedAt: null, rotatedFromId: null },
    { id: 'tok_003', name: 'Audit eksternal Q3', prefix: 'dx_demo_aud3', scopes: ['view_audit'], status: 'expiring', createdBy: 'maya.lestari@kenari.co.id', createdAt: '2026-08-01T10:00:00+07:00', expiresAt: '2026-11-18T10:00:00+07:00', lastUsedAt: '2026-10-30T16:40:00+07:00', revokedAt: null, rotatedFromId: 'tok_000' },
    { id: 'tok_004', name: 'Sandbox eksperimen', prefix: 'dx_demo_sbx4', scopes: ['create_request'], status: 'active', createdBy: 'dimas.aryo@kenari.co.id', createdAt: '2026-10-05T15:20:00+07:00', expiresAt: '2027-10-05T15:20:00+07:00', lastUsedAt: null, revokedAt: null, rotatedFromId: null },
    { id: 'tok_005', name: 'Legacy notifikasi', prefix: 'dx_demo_lgy5', scopes: ['view_own'], status: 'revoked', createdBy: 'maya.lestari@kenari.co.id', createdAt: '2026-06-12T08:00:00+07:00', expiresAt: '2026-12-12T08:00:00+07:00', lastUsedAt: '2026-09-28T11:22:00+07:00', revokedAt: '2026-10-02T09:00:00+07:00', rotatedFromId: null },
    { id: 'tok_006', name: 'Rotasi — mandate watcher', prefix: 'dx_demo_rot6', scopes: ['view_all', 'view_audit'], status: 'active', createdBy: 'maya.lestari@kenari.co.id', createdAt: '2026-10-28T17:45:00+07:00', expiresAt: '2027-04-28T17:45:00+07:00', lastUsedAt: '2026-11-02T08:30:00+07:00', revokedAt: null, rotatedFromId: 'tok_002' }
  ];

  window.DEXTRA_ENTERPRISE_FIXTURES = {
    demo: true,
    generatedAt: '2026-11-04T00:00:00+07:00',
    auth: authSnapshot,
    tenant: tenant,
    members: members,
    permissions: permissions,
    roles: roles,
    permMatrix: permMatrix,
    tokens: tokens
  };
})();
