/* DEXTRA P7 — kontrak backend yang DIHARAPKAN (bukan yang tersedia).
 *
 * Dasarnya tetap berlaku: tidak ada router P7 di backend (16 router di
 * backend/dextra/main.py:67 tanpa database/health/tenants) dan tidak ada
 * endpoint P7 di MCP server maupun FastAPI. Daftar di bawah adalah kontrak
 * yang dibutuhkan layar Data Management; setiap item berstatus "missing"
 * sampai backend benar-benar mengimplementasikannya dan dashboard
 * memverifikasi lewat probe.
 *
 * Tidak ada URL yang dipanggil dari berkas ini. Tidak ada token atau rahasia.
 */
(function () {
  'use strict';

  var STATUS = {
    CONNECTED: 'CONNECTED',
    DEGRADED: 'DEGRADED',
    UNAVAILABLE: 'UNAVAILABLE',
    DEMO: 'DEMO'
  };

  /**
   * @typedef {Object} P7Connection
   * @property {string} targetEngine        Mesin target, mis. 'postgresql'.
   * @property {string} currentVerifiedEngine Mesin yang benar-benar terverifikasi, mis. 'sqlite'.
   * @property {string} environment          Lingkungan, mis. 'local dev'.
   * @property {string} status               Salah satu STATUS di atas.
   * @property {boolean} databaseUrlPresent  Apakah DATABASE_URL tersedia (informasi aman, bukan isinya).
   * @property {string|null} migrationHead   Revisi migrasi teratas yang diketahui.
   * @property {string|null} lastCheckedAt   ISO waktu pemeriksaan terakhir, atau null.
   */

  /**
   * @typedef {Object} Tenant
   * @property {string} id
   * @property {string} name
   * @property {string} slug
   * @property {string} timezone
   * @property {string} status               mis. 'active'.
   * @property {string|null} createdAt
   * @property {string|null} updatedAt
   */

  /**
   * @typedef {Object} Membership
   * @property {string} userId
   * @property {string} displayName
   * @property {string} role                 mis. 'governance_lead'.
   * @property {string} status               'accepted' | 'invited'.
   * @property {string|null} acceptedAt
   * @property {string} source               Sumber data, mis. 'demo fixture'.
   */

  /**
   * @typedef {Object} DataOverview
   * @property {Record<string, number>} counts   Jumlah baris per entitas (DEMO bila dari fixture).
   * @property {boolean} demo                      true bila bukan dari server.
   * @property {string} source                     Keterangan sumber.
   */

  /**
   * @typedef {Object} MigrationStep
   * @property {string} revision
   * @property {string} description
   * @property {number} tables
   * @property {string} appliedOn            mis. 'SQLite'.
   * @property {string} postgresStatus       mis. 'unverified'.
   * @property {string[]} nextSteps
   */

  /**
   * @typedef {Object} TableStat
   * @property {string} table
   * @property {number} rows                 Jumlah baris DEMO.
   * @property {boolean} tenantScoped
   * @property {string} status               mis. 'demo'.
   */

  /**
   * @typedef {Object} P7Snapshot
   * @property {P7Connection} connection
   * @property {Tenant} tenant
   * @property {Membership[]} memberships
   * @property {DataOverview} overview
   * @property {MigrationStep} migration
   * @property {TableStat[]} tableStats
   * @property {{ postgresVerified: boolean, dataMigrated: boolean, tenantScopingEnforced: boolean, backupRestoreTested: boolean }} readiness
   * @property {string} generatedAt
   * @property {boolean} demo
   */

  /* P7 tidak punya router backend (16 router di main.py:67 tanpa P7). Status
   * 'missing' = sesuai kenyataan. /api/v1/overview yang ada TIDAK
   * tenant-scoped dan bukan kontrak P7. JANGAN dipanggil sebagai live. */
  var EXPECTED_ENDPOINTS = [
    { area: 'health', method: 'GET', path: '/api/v1/database/health',
      auth: 'cap: manage_integrations (diharapkan)', status: 'missing',
      ui: 'Menampilkan status koneksi nyata (CONNECTED/DEGRADED/UNAVAILABLE) di tab Koneksi & Kesiapan dan probe().' },

    { area: 'tenants', method: 'GET', path: '/api/v1/tenants',
      auth: 'cap: view_all atau scope tenant (diharapkan)', status: 'missing',
      ui: 'Daftar tenant untuk pemilih konteks; saat ini hanya fixture Kenari Group.' },
    { area: 'tenants', method: 'GET', path: '/api/v1/tenants/{id}',
      auth: 'cap: view_all atau anggota tenant (diharapkan)', status: 'missing',
      ui: 'Kartu identitas tenant (nama, slug, timezone, status, created/updated).' },
    { area: 'tenants', method: 'GET', path: '/api/v1/tenants/{id}/context',
      auth: 'cap: view_all atau anggota tenant (diharapkan)', status: 'missing',
      ui: 'Konteks tenant aktif yang diikat ke sesi; dipakai untuk scoping semua query.' },
    { area: 'tenants', method: 'GET', path: '/api/v1/tenants/{id}/members',
      auth: 'cap: manage_integrations atau org_admin (diharapkan)', status: 'missing',
      ui: 'Tabel anggota (nama, role, status, accepted_at, source) dengan filter.' },

    { area: 'migrations', method: 'GET', path: '/api/v1/migrations',
      auth: 'cap: manage_integrations (diharapkan)', status: 'missing',
      ui: 'Daftar revisi migrasi, status applied/pending, dan verifikasi PostgreSQL.' },

    { area: 'overview', method: 'GET', path: '/api/v1/overview?tenant_id=...',
      auth: 'cap: view_all atau anggota tenant (diharapkan)', status: 'missing',
      ui: 'Angka ringkasan tenant-scoped; /api/v1/overview yang ada TIDAK tenant-scoped dan bukan kontrak ini. JANGAN dipanggil sebagai live.' }
  ];

  window.DEXTRA_P7_CONTRACTS = {
    STATUS: STATUS,
    EXPECTED_ENDPOINTS: EXPECTED_ENDPOINTS
  };
})();
