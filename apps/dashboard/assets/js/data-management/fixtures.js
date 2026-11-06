/* DEXTRA P7 — data contoh (DEMO).
 *
 * Semua yang ada di sini adalah contoh tertulis, bukan hasil server dan bukan
 * hasil koneksi database. PostgreSQL belum pernah diverifikasi di mesin ini;
 * data/*.json belum dimigrasikan; tidak ada router P7 di backend (tidak ada
 * endpoint tenant/membership/persistensi P7).
 * Tidak ada kredensial, host, atau rahasia di berkas ini.
 */
(function () {
  'use strict';

  var tenant = {
    id: 'org_kenari',
    name: 'Kenari Group',
    slug: 'kenari',
    timezone: 'Asia/Jakarta',
    status: 'active',
    createdAt: '2026-09-01T08:00:00+07:00',
    updatedAt: '2026-10-30T17:30:00+07:00'
  };

  var memberships = [
    { userId: 'user_001', displayName: 'Farhan Pratama', role: 'operations_manager', status: 'accepted', acceptedAt: '2026-09-02T09:15:00+07:00', source: 'demo fixture' },
    { userId: 'user_002', displayName: 'Sari Wulandari', role: 'governance_lead', status: 'accepted', acceptedAt: '2026-09-02T10:05:00+07:00', source: 'demo fixture' },
    { userId: 'user_003', displayName: 'Rina Kusuma', role: 'auditor', status: 'accepted', acceptedAt: '2026-09-03T13:40:00+07:00', source: 'demo fixture' },
    { userId: 'user_004', displayName: 'Dimas Aryo', role: 'requester', status: 'invited', acceptedAt: null, source: 'demo fixture' },
    { userId: 'user_005', displayName: 'Lestari Handayani', role: 'operations_manager', status: 'invited', acceptedAt: null, source: 'demo fixture' }
  ];

  var tableStats = [
    { table: 'tenants', rows: 1, tenantScoped: false, status: 'demo' },
    { table: 'memberships', rows: 5, tenantScoped: true, status: 'demo' },
    { table: 'users', rows: 5, tenantScoped: false, status: 'demo' },
    { table: 'roles', rows: 7, tenantScoped: false, status: 'demo' },
    { table: 'permissions', rows: 24, tenantScoped: false, status: 'demo' },
    { table: 'sessions', rows: 3, tenantScoped: true, status: 'demo' },
    { table: 'plans', rows: 128, tenantScoped: true, status: 'demo' },
    { table: 'approvals', rows: 96, tenantScoped: true, status: 'demo' },
    { table: 'mandates', rows: 74, tenantScoped: true, status: 'demo' },
    { table: 'audit_logs', rows: 1042, tenantScoped: true, status: 'demo' }
  ];

  var migration = {
    revision: 'd9cd32b89961_initial_schema',
    description: 'initial schema — 21 tabel',
    tables: 21,
    appliedOn: 'SQLite',
    postgresStatus: 'unverified',
    statusText: 'applied on SQLite; unverified on PostgreSQL',
    nextSteps: [
      'Jalankan alembic upgrade head terhadap instance PostgreSQL uji, lalu alembic current untuk membandingkan revisi.',
      'Verifikasi seluruh 21 tabel terbentuk (information_schema) dan constraint/indeks cocok dengan baseline SQLite.',
      'Migrasikan data/*.json ke PostgreSQL dengan skrip migrasi yang diaudit; cocokkan jumlah baris per tabel.',
      'Uji backup dan restore (pg_dump / restore ke instance kosong) sebelum menyatakan siap produksi.',
      'Terapkan tenant scoping di level query/RLS dan verifikasi dengan dua tenant uji.'
    ]
  };

  var readiness = {
    postgresVerified: false,
    dataMigrated: false,
    tenantScopingEnforced: false,
    backupRestoreTested: false
  };

  var overview = {
    counts: {
      plans: 128, approvals: 96, mandates: 74, audit_events: 1042,
      users: 5, memberships: 5, tables: 21, migrations: 1
    },
    demo: true,
    source: 'fixture DEMO di peramban — bukan dari server, bukan dari database'
  };

  var connection = {
    targetEngine: 'PostgreSQL',
    currentVerifiedEngine: 'sqlite (via SQLAlchemy, default lokal)',
    environment: 'local dev',
    status: 'DEMO',
    statusLabel: 'NOT CONNECTED / NOT VERIFIED',
    databaseUrlPresent: null, /* tidak diketahui di peramban; ditampilkan sebagai "Tidak tersedia di dashboard" */
    migrationHead: 'd9cd32b89961_initial_schema',
    lastCheckedAt: null
  };

  var currentVerifiedStore = {
    label: 'JSON file store (data/*.json)',
    detail: 'packages/store — penyimpanan berkas JSON yang dipakai MCP server lokal saat ini.',
    switched: false
  };

  window.DEXTRA_P7_FIXTURES = {
    demo: true,
    generatedAt: '2026-11-04T00:00:00+07:00',
    connection: connection,
    tenant: tenant,
    memberships: memberships,
    overview: overview,
    migration: migration,
    tableStats: tableStats,
    readiness: readiness,
    currentVerifiedStore: currentVerifiedStore,
    p7Scope: [
      { key: 'persistence', label: 'Persistensi PostgreSQL', state: 'missing', note: 'Tidak ada router/health P7 (16 router, main.py:67 tanpa P7); PostgreSQL belum terverifikasi dari kode.' },
      { key: 'tenant', label: 'Tenant / workspace', state: 'demo', note: 'Model tenant ada di migrasi; belum ada endpoint tenant-scoped untuk dashboard.' },
      { key: 'membership', label: 'Membership & peran', state: 'demo', note: 'Tabel membership ada di migrasi; belum ada endpoint anggota.' },
      { key: 'overview', label: 'Data overview tenant-scoped', state: 'missing', note: '/api/v1/overview yang ada tidak tenant-scoped dan bukan kontrak P7.' }
    ]
  };
})();
