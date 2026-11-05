/* DEXTRA P12 Security Center: probe-aware live bridge.
 *
 * Kontrak: docs/API-CONTRACT-P7-P12.md §4. Transport resmi
 * window.DEXTRA.api.rest → /api/v1/security/* (cookie + CSRF),
 * ditambah bearer ops token bila ada.
 *
 * Mode dipertahankan per-instance dan diputuskan oleh probe() (GET
 * /api/v1/security/overview). Live → semua panggilan via backend, error
 * dilempar ke pemanggil tanpa fallback diam-diam. Demo → fixture lokal
 * berlabel DEMO di layar.
 */
(function () {
  'use strict';
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function D() { return window.DEXTRA || {}; }
  function client() { var d = D(); var a = d.api; return (a && typeof a.rest === 'function') ? a : null; }
  function authed(method, path, body) {
    return new Promise(function (resolve, reject) {
      var a = client();
      if (!a) return reject(new Error('D.api.rest tidak tersedia'));
      a.rest(method, path, body).then(resolve, reject);
    });
  }

  /* JANGAN buat endpoint mati. */
  window.DEXTRA_P12_API = {
    create: function (opts) {
      opts = opts || {};
      var instanceMode = opts.mode === 'demo' ? 'demo' : 'pending';
      var probePromise = null;
      var memory = null;
      function mem() {
        if (!memory) {
          if (!window.DEXTRA_P12_FIXTURES) throw new Error('no fixtures');
          memory = clone(window.DEXTRA_P12_FIXTURES);
        }
        return memory;
      }
      function probe() {
        if (probePromise) return probePromise;
        if (instanceMode === 'demo') { probePromise = Promise.resolve({ mode: 'demo', reason: 'Diminta eksplisit mode demo.' }); return probePromise; }
        probePromise = authed('GET', '/api/v1/security/overview').then(function () {
          instanceMode = 'live';
          return { mode: 'live', available: true };
        }).catch(function (e) {
          instanceMode = 'demo';
          return { mode: 'demo', available: false, reason: e && e.message };
        });
        return probePromise;
      }
      function ensure() { return probe().then(function (p) { return p.mode; }); }
      function live() { return instanceMode === 'live'; }

      var api = {
        mode: instanceMode,
        probe: probe,
        _live: live,
        getMode: function () { return instanceMode; },
        getOverview: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/overview');
            return clone(mem().overview);
          });
        },
        listEvents: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/events').then(function (j) { return j.items || j || []; });
            return clone(mem().events);
          });
        },
        listLoginActivity: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/login-history').then(function (j) { return j.items || j || []; });
            return clone(mem().loginActivity);
          });
        },
        listSessions: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/sessions').then(function (j) { return j.items || j || []; });
            return clone(mem().sessions);
          });
        },
        revokeSession: function (id) {
          return ensure().then(function (m) {
            if (m === 'live') return authed('POST', '/api/v1/security/sessions/' + encodeURIComponent(id) + '/revoke', {});
            var f = mem(), target = null;
            f.sessions = f.sessions.map(function (s) {
              if (s.id === id) { if (s.current) { var err = new Error('current'); err.code = 'P12_DEMO_CURRENT_SESSION'; throw err; } target = Object.assign({}, s, { status: 'revoked' }); return target; }
              return s;
            });
            if (!target) { var nf = new Error('not found'); nf.code = 'P12_DEMO_NOT_FOUND'; return Promise.reject(nf); }
            return Promise.resolve({ demo: true, persisted: false, session: clone(target) });
          });
        },
        revokeOtherSessions: function () {
          return ensure().then(function (m) {
            if (m === 'live') {
              return api.listSessions().then(function (sessions) {
                var others = (sessions || []).filter(function (s) { return !s.current && s.status !== 'revoked'; });
                return Promise.all(others.map(function (s) { return api.revokeSession(s.id).catch(function () { return null; }); }))
                  .then(function () { return { revokedIds: others.map(function (s) { return s.id; }) }; });
              });
            }
            var f = mem(), revoked = [];
            f.sessions = f.sessions.map(function (s) {
              if (!s.current && s.status === 'active') { var next = Object.assign({}, s, { status: 'revoked' }); revoked.push(next.id); return next; }
              return s;
            });
            return Promise.resolve({ demo: true, persisted: false, revokedIds: revoked });
          });
        },
        getMfaStatus: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/mfa-status').then(function (j) { return j.items || j || []; });
            return clone(mem().mfaStatus);
          });
        },
        listTokenInventory: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/tokens').then(function (j) { return j.items || j || []; });
            return clone(mem().tokenInventory);
          });
        },
        listServiceIdentityInventory: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/security/service-identities').then(function (j) { return j.items || j || []; });
            return clone(mem().serviceIdentities);
          });
        },
        /* Backend tidak punya GET /security/events/{id} (hanya daftar). */
        getEvent: function (id) {
          return ensure().then(function (m) {
            if (m === 'live') return api.listEvents().then(function (events) {
              var found = (events || []).filter(function (e) { return e.id === id; })[0];
              if (!found) { var err = new Error('not found'); err.code = 'P12_NOT_FOUND'; throw err; }
              return found;
            });
            var found = mem().events.filter(function (e) { return e.id === id; })[0];
            if (!found) { var err = new Error('not found'); err.code = 'P12_DEMO_NOT_FOUND'; return Promise.reject(err); }
            return Promise.resolve(clone(found));
          });
        },
        listAccessDenied: function () {
          return ensure().then(function (m) {
            if (m !== 'live') return Promise.resolve(clone(mem().accessDenied));
            return Promise.resolve([]);
          });
        },
        listExpectedEndpoints: function () { return (window.DEXTRA_P12_CONTRACTS && window.DEXTRA_P12_CONTRACTS.EXPECTED_ENDPOINTS) ? window.DEXTRA_P12_CONTRACTS.EXPECTED_ENDPOINTS.slice() : []; }
      };
      return api;
    }
  };
})();
