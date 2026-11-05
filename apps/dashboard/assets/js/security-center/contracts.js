/* DEXTRA P12 — kontrak backend yang terdaftar (backend/dextra/main.py:67).
 *
 * Endpoint keamanan ada di FastAPI v2: router security_center
 * (modules/security_center/router.py) — GET /api/v1/security/overview,
 * /events, /login-history, /sessions, /tokens, /service-identities,
 * /mfa-status. Daftar EXPECTED_ENDPOINTS mencerminkan router yang ada;
 * status 'live' per item. Jembatan security-center/api.js probe-aware.
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
   * @typedef {Object} SecurityEvent
   * @property {string} id            ID event, mis. 'evt_p12_001'.
   * @property {string} type          mis. 'auth.login_failed'.
   * @property {'critical'|'high'|'medium'|'low'|'info'} severity
   * @property {string} actor         Identitas aktor, mis. 'user_002' atau 'system'.
   * @property {string} tenant        ID tenant, mis. 'org_kenari'.
   * @property {string} target        Target tindakan, mis. 'session:sess_001'.
   * @property {string} at            ISO 8601 waktu kejadian (fixture tetap).
   * @property {Object} metadata      Detail tambahan bebas-rahasia.
   * @property {'verified'|'unverified'|'not_applicable'} integrityStatus
   *   Status integritas rantai hash; 'not_applicable' bila event lama tanpa hash.
   * @property {string} source        Sumber data, mis. 'demo fixture'.
   */

  /**
   * @typedef {Object} LoginActivity
   * @property {string} id
   * @property {string} identifier    Email/username yang dicoba, mis. 'sari.w@kenari.example'.
   * @property {'success'|'failed'|'blocked'} result
   * @property {string} ip            Alamat IP sumber.
   * @property {string} userAgent     Agen peramban/perangkat.
   * @property {string} at            ISO 8601.
   * @property {string|null} reason   Kode alasan bila gagal/ditolak, mis. 'invalid_password'.
   * @property {string} tenant
   */

  /**
   * @typedef {Object} ActiveSession
   * @property {string} id
   * @property {string} userId
   * @property {string} displayName
   * @property {string} device        Label perangkat, mis. 'MacBook Pro · Chrome'.
   * @property {string} ip
   * @property {string} lastSeenAt    ISO 8601.
   * @property {boolean} current      true bila sesi ini milik pengguna yang membuka halaman.
   * @property {string} createdAt     ISO 8601.
   * @property {'active'|'revoked'} status  Status pada salinan in-memory (demo).
   */

  /**
   * @typedef {Object} MfaStatus
   * @property {string} userId
   * @property {string} displayName
   * @property {boolean} enrolled     Apakah MFA terdaftar.
   * @property {'totp'|'webauthn'|'sms'|null} method
   * @property {string|null} lastVerifiedAt  ISO 8601 atau null.
   * @property {'ok'|'pending'|'missing'} state
   */

  /**
   * @typedef {Object} TokenInventory
   * @property {string} id
   * @property {string} name          Label token, mis. 'ci-deploy-prod'.
   * @property {string} owner         Pemilik/pembuat token.
   * @property {string[]} scopes      Scope yang dimiliki token.
   * @property {string} createdAt     ISO 8601.
   * @property {string} expiresAt     ISO 8601.
   * @property {string|null} lastUsedAt  ISO 8601 atau null.
   * @property {'active'|'expiring'|'expired'|'revoked'} status
   * @property {boolean} rotationDue  true bila rotasi sudah jatuh tempo.
   */

  /**
   * @typedef {Object} ServiceIdentityInventory
   * @property {string} id
   * @property {string} name          Nama identitas layanan, mis. 'svc-billing-sync'.
   * @property {string} purpose       Kegunaan singkat.
   * @property {string[]} scopes
   * @property {string} createdAt     ISO 8601.
   * @property {string|null} lastUsedAt  ISO 8601 atau null.
   * @property {'active'|'disabled'|'review'} status
   * @property {boolean} rotationDue
   */

  /**
   * @typedef {Object} AccessDeniedEvent
   * @property {string} id
   * @property {string} at            ISO 8601.
   * @property {string} actor
   * @property {string} tenant
   * @property {string} resource      Sumber daya yang ditolak, mis. 'mandate:mnd_118'.
   * @property {string} action        Tindakan yang ditolak, mis. 'execute'.
   * @property {string} reason        Kode alasan, mis. 'missing_capability'.
   * @property {'low'|'medium'|'high'} severity
   */

  /* Kontrak ini mencerminkan router yang ada (modules/security_center/router.py).
   * /security/login-activity, /security/mfa/status, DELETE /security/sessions/{id},
   * /security/events/{id} TIDAK ada di backend dan dihapus. */
  var EXPECTED_ENDPOINTS = [
    { area: 'overview', method: 'GET', path: '/api/v1/security/overview',
      auth: 'view_audit', status: 'live',
      ui: 'Angka ringkasan keamanan.' },
    { area: 'login-activity', method: 'GET', path: '/api/v1/security/login-history',
      auth: 'view_audit', status: 'live',
      ui: 'Tabel aktivitas login.' },
    { area: 'sessions', method: 'GET', path: '/api/v1/security/sessions',
      auth: 'view_audit', status: 'live',
      ui: 'Daftar sesi aktif.' },
    { area: 'sessions', method: 'POST', path: '/api/v1/security/sessions/{id}/revoke',
      auth: 'view_audit', status: 'live',
      ui: 'Mencabut sesi tertentu (POST).' },
    { area: 'mfa', method: 'GET', path: '/api/v1/security/mfa-status',
      auth: 'view_audit', status: 'live',
      ui: 'Cakupan MFA.' },
    { area: 'tokens', method: 'GET', path: '/api/v1/security/tokens',
      auth: 'manage_users', status: 'live',
      ui: 'Inventaris token API.' },
    { area: 'service-identities', method: 'GET', path: '/api/v1/security/service-identities',
      auth: 'manage_integrations', status: 'live',
      ui: 'Inventaris identitas layanan.' },
    { area: 'events', method: 'GET', path: '/api/v1/security/events',
      auth: 'view_audit', status: 'live',
      ui: 'Tabel peristiwa keamanan.' }
  ];

  window.DEXTRA_P12_CONTRACTS = {
    STATUS: STATUS,
    EXPECTED_ENDPOINTS: EXPECTED_ENDPOINTS
  };
})();
