/* DEXTRA — Skill Registry: kontrak backend yang terdaftar (backend/dextra/main.py:67).
 *
 * Endpoint katalog skill ada di FastAPI v2: router skills
 * (modules/skills/router.py) — GET/POST /api/v1/skills, /{slug},
 * /{slug}/versions, /{slug}/status. Daftar di bawah mencerminkan router
 * yang ada; status 'live' per item. Jembatan skills/api.js probe-aware:
 * live bila GET /api/v1/skills berhasil.
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
   * @typedef {Object} Skill
   * @property {string} id                Identitas skill, mis. 'skill_meeting_to_action'.
   * @property {string} name              Nama tampilan skill.
   * @property {string} description       Deskripsi singkat fungsi skill.
   * @property {string} domain            Domain bisnis, mis. 'Produktivitas'.
   * @property {string} version           Versi semver terpasang (dari rilis terakhir).
   * @property {string} lifecycle         'draft' | 'review' | 'published' | 'deprecated' | 'disabled'.
   * @property {string} status            Status operasional ringkas, mis. 'active' | 'paused'.
   * @property {string} risk              'low' | 'medium' | 'high' | 'critical'.
   * @property {string[]} permissions     Izin yang diminta skill, mis. 'calendar:read'.
   * @property {SkillSchema} inputSchema  Ringkasan JSON Schema input.
   * @property {SkillSchema} outputSchema Ringkasan JSON Schema output.
   * @property {string} owner             Pemilik skill (nama/tim).
   * @property {string} updated_at        ISO waktu pembaruan terakhir.
   * @property {number} usage_count       Jumlah pemakaian (DEMO di peramban).
   * @property {SkillTestStatus} testStatus Hasil uji terakhir (DEMO).
   */

  /**
   * @typedef {Object} SkillVersion
   * @property {string} version    Versi semver, mis. '1.4.0'.
   * @property {string} releasedAt ISO waktu rilis.
   * @property {string} author     Pembuat rilis.
   * @property {string} notes      Catatan perubahan singkat.
   * @property {string} state      'current' | 'previous' | 'deprecated'.
   */

  /**
   * @typedef {Object} SkillSchema
   * @property {string} type       Selalu 'object' untuk kontrak ini.
   * @property {string} summary    Ringkasan manusiawi isi payload.
   * @property {string[]} required Properti wajib.
   * @property {Object<string, {type:string, description:string}>} properties Properti utama.
   */

  /**
   * @typedef {Object} SkillPolicy
   * @property {boolean} reviewRequired   Apakah perubahan wajib melewati review.
   * @property {string} approverRole      Peran yang berwenang menyetujui.
   * @property {string} dataScope         Batas data yang boleh diakses skill.
   * @property {number} retentionDays     Lama retensi log pemakaian (hari).
   * @property {string[]} allowedDomains  Domain yang boleh memanggil skill.
   * @property {string} auditLevel        'minimal' | 'standard' | 'full'.
   */

  /**
   * @typedef {Object} SkillTestStatus
   * @property {string} status   'passed' | 'failed' | 'never'.
   * @property {number} passed   Jumlah kasus uji lulus.
   * @property {number} total    Jumlah kasus uji.
   * @property {string|null} lastRun ISO waktu uji terakhir, atau null.
   */

  /* Kontrak ini mencerminkan router yang ada (modules/skills/router.py).
   * Path detail memakai {slug}; PATCH/skill/{id}/enable/disable/schema/policy
   * TIDAK ada di backend dan dihapus dari daftar ini. */
  var EXPECTED_ENDPOINTS = [
    { area: 'catalog', method: 'GET', path: '/api/v1/skills',
      auth: 'view_all atau view_own', status: 'live',
      ui: 'Memuat tabel katalog skill.' },
    { area: 'catalog', method: 'POST', path: '/api/v1/skills',
      auth: 'manage_integrations', status: 'live',
      ui: 'Mendaftarkan skill baru.' },
    { area: 'catalog', method: 'GET', path: '/api/v1/skills/{slug}',
      auth: 'view_all atau view_own', status: 'live',
      ui: 'Detail skill.' },
    { area: 'versions', method: 'POST', path: '/api/v1/skills/{slug}/versions',
      auth: 'manage_integrations', status: 'live',
      ui: 'Menerbitkan versi baru skill.' },
    { area: 'lifecycle', method: 'POST', path: '/api/v1/skills/{slug}/status',
      auth: 'manage_integrations', status: 'live',
      ui: 'Mengubah status lifecycle skill.' }
  ];

  window.DEXTRA_SKILLS_CONTRACTS = {
    STATUS: STATUS,
    EXPECTED_ENDPOINTS: EXPECTED_ENDPOINTS
  };
})();
