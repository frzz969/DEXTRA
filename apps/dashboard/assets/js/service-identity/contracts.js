/* DEXTRA P11 — kontrak backend yang terdaftar (backend/dextra/main.py:67).
 *
 * Endpoint P11 ada di FastAPI v2: router service_accounts
 * (modules/service_accounts/router.py) — GET/POST /api/v1/service-accounts,
 * /{id}, /{id}/revoke. Daftar di bawah mencerminkan router yang ada; status
 * 'live' per item. Jembatan service-identity/api.js probe-aware.
 *
 * Tidak ada URL yang dipanggil dari berkas ini. Tidak ada token atau rahasia.
 */
(function () {
  'use strict';

  /**
   * @typedef {Object} ServiceAccount
   * @property {string} id               mis. 'svc_001'.
   * @property {string} name             mis. 'executive-assistant-worker' (slug unik).
   * @property {string} kind             'worker' | 'mcp' | 'agent' | 'integration'.
   * @property {string} description      Keterangan fungsi akun layanan ini.
   * @property {string} tenantId         mis. 'org_kenari'.
   * @property {string} tenantBinding    Tenant yang mengikat akun ini (scoping wajib).
   * @property {string[]} scopes         Scope yang diberikan, mis. ['view_all','execute'].
   * @property {string[]} permissions    Kapabilitas rinci yang ditegakkan backend (diharapkan).
   * @property {string} status           'active' | 'expiring' | 'disabled' | 'revoked'.
   * @property {string} owner            Penanggung jawab manusia, mis. 'farhan.pratama@kenari.co.id'.
   * @property {string} createdAt        ISO waktu pembuatan.
   * @property {string} updatedAt        ISO waktu perubahan terakhir.
   * @property {string|null} lastUsedAt  ISO waktu pemakaian terakhir, atau null bila belum pernah.
   * @property {string|null} rotatedFromId ID akun/kredensial asal rotasi, atau null.
   * @property {string} securityNotes    Catatan keamanan operasional.
   */

  /**
   * @typedef {Object} ServiceCredential
   * @property {string} id               mis. 'cred_001a'.
   * @property {string} accountId        ID ServiceAccount pemilik.
   * @property {string} label            Label manusia, mis. 'Kredensial utama'.
   * @property {string} prefix           Awal string, mis. 'dx_svc_demo_ea01' (BUKAN rahasia).
   * @property {string} status           'active' | 'expiring' | 'revoked' | 'rotated'.
   * @property {string} createdAt        ISO waktu penerbitan.
   * @property {string|null} expiresAt   ISO waktu kedaluwarsa, atau null bila tanpa batas.
   * @property {string|null} lastUsedAt  ISO waktu pemakaian terakhir, atau null.
   * @property {string|null} revokedAt   ISO waktu pencabutan, atau null.
   * @property {string|null} rotatedFromId ID kredensial asal rotasi, atau null.
   */

  /**
   * @typedef {Object} WorkerIdentity
   * @property {string} id               mis. 'wkr_001'.
   * @property {string} accountId        ID ServiceAccount yang dipakai worker.
   * @property {string} workerName       mis. 'executive-assistant-worker'.
   * @property {string} runtime          mis. 'mcp-server-lokal' | 'queue-worker'.
   * @property {string} tenantId         mis. 'org_kenari'.
   * @property {string[]} scopes         Scope efektif saat runtime.
   * @property {string} attestation      'none' | 'signed' (diharapkan; belum diverifikasi).
   * @property {string} registeredAt     ISO waktu registrasi identitas worker.
   * @property {string|null} lastSeenAt  ISO waktu heartbeat terakhir, atau null.
   */

  /* Kontrak ini mencerminkan router yang ada (modules/service_accounts/router.py).
   * PATCH, /disable, /rotate, /credentials, /last-used TIDAK ada di backend
   * dan dihapus. Rotasi kredensial memakai /api/v1/tokens (modules/tokens). */
  var EXPECTED_ENDPOINTS = [
    { area: 'P11', method: 'GET', path: '/api/v1/service-accounts',
      auth: 'manage_integrations', status: 'live',
      ui: 'Inventaris akun layanan.' },
    { area: 'P11', method: 'POST', path: '/api/v1/service-accounts',
      auth: 'manage_integrations', status: 'live',
      ui: 'Membuat akun layanan baru.' },
    { area: 'P11', method: 'GET', path: '/api/v1/service-accounts/{id}',
      auth: 'manage_integrations', status: 'live',
      ui: 'Detail satu akun layanan.' },
    { area: 'P11', method: 'POST', path: '/api/v1/service-accounts/{id}/revoke',
      auth: 'manage_integrations', status: 'live',
      ui: 'Mencabut akun layanan; kredensial ikut dicabut.' }
  ];

  window.DEXTRA_P11_CONTRACTS = {
    EXPECTED_ENDPOINTS: EXPECTED_ENDPOINTS
  };
})();
