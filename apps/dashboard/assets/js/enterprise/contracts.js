/* DEXTRA P8/P9/P10 — kontrak backend yang-terdaftar (backend/dextra/main.py:67).
 *
 * Endpoint P8/P9/P10 ada di FastAPI v2: auth (modules/auth/router.py),
 * identity (modules/identity/router.py), tokens (modules/tokens/router.py).
 * Daftar di bawah mencerminkan router yang ada; status 'live' per item.
 * Jembatan enterprise/api.js probe-aware: live bila probe() berhasil.
 *
 * Tidak ada URL yang dipanggil dari berkas ini. Tidak ada token atau rahasia.
 */
(function () {
  'use strict';

  /**
   * @typedef {Object} UserSession
   * @property {string} userId           Identitas pengguna (server-side).
   * @property {string} displayName
   * @property {string} email
   * @property {string} tenantId         mis. 'org_kenari'.
   * @property {string} role             mis. 'governance_lead'.
   * @property {boolean} mfaVerified     Apakah sesi ini lolos verifikasi MFA.
   * @property {string} passwordChangedAt ISO waktu ganti password terakhir.
   * @property {string|null} authAt      ISO waktu autentikasi.
   */

  /**
   * @typedef {Object} ActiveSession
   * @property {string} id
   * @property {string} device           mis. 'Chrome di Windows'.
   * @property {string} browser
   * @property {string} os
   * @property {string} ip
   * @property {string} userAgent
   * @property {string} lastSeenAt       ISO waktu aktivitas terakhir.
   * @property {boolean} current         Apakah ini sesi yang sedang berjalan.
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} MfaState
   * @property {boolean} enrolled
   * @property {boolean} verified        Terverifikasi untuk sesi ini.
   * @property {string} method           mis. 'totp'.
   * @property {string|null} enrolledAt
   * @property {string} status           'verified' | 'pending' | 'disabled'.
   */

  /**
   * @typedef {Object} Role
   * @property {string} id               mis. 'governance_lead'.
   * @property {string} label            mis. 'Governance Lead'.
   * @property {string} description
   * @property {string[]} capabilities
   * @property {string[]} unbacked       Kapabilitas yang belum diimplementasikan server.
   * @property {boolean} system          Peran sistem, tidak bisa dihapus.
   */

  /**
   * @typedef {Object} Permission
   * @property {string} id               mis. 'approve'.
   * @property {string} label
   * @property {string} group            mis. 'governance'.
   * @property {boolean} backed          Apakah server benar-benar menegakkan izin ini.
   * @property {string} note
   */

  /**
   * @typedef {Object} Membership
   * @property {string} id               mis. 'mem_001'.
   * @property {string} tenantId
   * @property {string} userId
   * @property {string} displayName
   * @property {string} email
   * @property {string} role
   * @property {string} status           'accepted' | 'invited' | 'suspended'.
   * @property {string|null} acceptedAt
   * @property {string} source           Sumber data, mis. 'demo fixture'.
   * @property {string} createdAt
   */

  /**
   * @typedef {Object} ApiToken
   * @property {string} id               mis. 'tok_001'.
   * @property {string} name
   * @property {string} prefix           mis. 'dx_demo_9f3a…' (BUKAN rahasia).
   * @property {string[]} scopes
   * @property {string} status           'active' | 'expiring' | 'revoked'.
   * @property {string} createdBy
   * @property {string} createdAt
   * @property {string|null} expiresAt
   * @property {string|null} lastUsedAt
   * @property {string|null} revokedAt
   * @property {string|null} rotatedFromId
   */

  /* Kontrak ini sekarang mencerminkan router FastAPI yang SUDAH ada
   * (backend/dextra/modules/*). Status dipertahankan sebagai label tampilan;
   * ini bukan daftar klaim endpoint mati. */
  var EXPECTED_ENDPOINTS = [
    /* ---- P8 Human Authentication — backend: modules/auth/router.py ---- */
    { area: 'P8', method: 'POST', path: '/api/v1/auth/login',
      auth: 'publik (rate-limited)', status: 'live', purpose: 'Login email+password; menerbitkan sesi manusia (cookie httpOnly).' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/logout',
      auth: 'sesi manusia', status: 'live', purpose: 'Mencabut sesi saat ini; cookie dihapus server.' },
    { area: 'P8', method: 'GET', path: '/api/v1/auth/session',
      auth: 'sesi manusia', status: 'live', purpose: 'Identitas + status MFA untuk sesi berjalan (session restoration).' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/mfa/enroll',
      auth: 'sesi manusia', status: 'live', purpose: 'Memulai pendaftaran MFA (TOTP); menerbitkan otpauth URL.' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/mfa/activate',
      auth: 'sesi manusia', status: 'live', purpose: 'Mengaktifkan MFA dengan kode TOTP.' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/mfa/verify',
      auth: 'sesi manusia', status: 'live', purpose: 'Memverifikasi kode TOTP.' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/mfa/disable',
      auth: 'sesi manusia + password', status: 'live', purpose: 'Menonaktifkan MFA setelah konfirmasi.' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/password',
      auth: 'sesi manusia', status: 'live', purpose: 'Mengganti password {current_password, new_password}; mencabut sesi lain dan merotasi sesi saat ini.' },
    { area: 'P8', method: 'GET', path: '/api/v1/auth/sessions',
      auth: 'sesi manusia', status: 'live', purpose: 'Daftar sesi aktif milik pengguna.' },
    { area: 'P8', method: 'POST', path: '/api/v1/auth/sessions/{id}/revoke',
      auth: 'sesi manusia (pemilik sesi)', status: 'live', purpose: 'Mencabut satu sesi milik pengguna (POST, tanpa body).' },

    /* ---- P9 Authorization — backend: modules/identity/router.py ---- */
    { area: 'P9', method: 'GET', path: '/api/v1/users',
      auth: 'cap: manage_users', status: 'live', purpose: 'Daftar pengguna.' },
    { area: 'P9', method: 'GET', path: '/api/v1/roles',
      auth: 'cap: manage_users atau view_all', status: 'live', purpose: 'Daftar peran sistem.' },
    { area: 'P9', method: 'GET', path: '/api/v1/permissions',
      auth: 'kapabilitas pemanggil (dari server)', status: 'live', purpose: 'Kapabilitas pemanggil + unbacked_capabilities dari server.' },

    /* ---- P10 API Token Management — backend: modules/tokens/router.py ---- */
    { area: 'P10', method: 'GET', path: '/api/v1/tokens',
      auth: 'cap: manage_users', status: 'live', purpose: 'Inventaris token API (tanpa rahasia).' },
    { area: 'P10', method: 'POST', path: '/api/v1/tokens',
      auth: 'cap: manage_users', status: 'live', purpose: 'Menerbitkan token; rahasia ditampilkan SEKALI.' },
    { area: 'P10', method: 'POST', path: '/api/v1/tokens/{id}/revoke',
      auth: 'cap: manage_users', status: 'live', purpose: 'Mencabut token secara permanen.' },
    { area: 'P10', method: 'POST', path: '/api/v1/tokens/{id}/rotate',
      auth: 'cap: manage_users', status: 'live', purpose: 'Mencabut token lama dan menerbitkan pengganti.' }
  ];

  window.DEXTRA_ENTERPRISE_CONTRACTS = {
    EXPECTED_ENDPOINTS: EXPECTED_ENDPOINTS
  };
})();
