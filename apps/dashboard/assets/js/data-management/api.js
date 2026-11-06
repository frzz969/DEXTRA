/* DEXTRA P7 — jembatan API.
 *
 * Tidak ada router P7 di backend (16 router di backend/dextra/main.py:67
 * tanpa database/health/tenants) dan tidak ada endpoint P7 di MCP server
 * maupun FastAPI yang menjadi kontrak persistensi dashboard. Probe() karena
 * itu tidak memanggil URL apa pun dan selalu menyatakan mode demo beserta
 * alasannya.
 *
 * Pada mode live/partial tanpa permukaan P7, metode melempar error terstruktur
 * P7_BACKEND_UNAVAILABLE. Tidak pernah fallback diam-diam ke data contoh.
 * Tidak ada token, host, atau rahasia di berkas ini.
 */
(function () {
  'use strict';

  var FIXTURES = window.DEXTRA_P7_FIXTURES;
  var CONTRACTS = window.DEXTRA_P7_CONTRACTS;

  function unavailable(method) {
    var err = new Error('Tidak ada router P7 di backend (16 router, main.py:67 tanpa P7): ' + method + ' tidak dapat dijalankan. Tidak ada fallback ke data contoh.');
    err.code = 'P7_BACKEND_UNAVAILABLE';
    err.method = method;
    return err;
  }

  window.DEXTRA_P7_API = {
    create: function (opts) {
      opts = opts || {};
      var mode = opts.mode || 'demo';

      function probe() {
        /* Tidak ada router P7 di backend (main.py:67, 16 router tanpa P7);
         * probe tetap tidak mengarang. */
        var result = {
          mode: 'demo',
          reason: 'Tidak ada router P7 di backend (16 router, main.py:67 tanpa P7). PostgreSQL belum terverifikasi dari kode. Layar berjalan dalam mode DEMO.'
        };
        return Promise.resolve(result);
      }

      function getSnapshot() {
        if (mode === 'demo') {
          if (!FIXTURES) return Promise.reject(new Error('Fixture DEMO P7 tidak dimuat (data-management/fixtures.js).'));
          return Promise.resolve(JSON.parse(JSON.stringify(FIXTURES)));
        }
        return Promise.reject(unavailable('getSnapshot'));
      }

      function exportSnapshot() {
        return getSnapshot().then(function (snap) {
          return { filename: 'dextra-p7-snapshot-demo.json', json: JSON.stringify(snap, null, 2) };
        });
      }

      function listExpectedEndpoints() {
        return (CONTRACTS && CONTRACTS.EXPECTED_ENDPOINTS) ? CONTRACTS.EXPECTED_ENDPOINTS.slice() : [];
      }

      return {
        probe: probe,
        getSnapshot: getSnapshot,
        exportSnapshot: exportSnapshot,
        listExpectedEndpoints: listExpectedEndpoints,
        mode: mode
      };
    }
  };
})();
