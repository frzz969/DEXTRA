/* DEXTRA P11 — Service Identity: probe-aware live bridge.
 *
 * Kontrak: docs/API-CONTRACT-P7-P12.md §3. Transport resmi
 * window.DEXTRA.api.rest(method,path,body) → /api/v1 (cookie + CSRF),
 * ditambah bearer ops token bila ada (D.api.token()).
 *
 * Mode dipertahankan per-instance dan diputuskan oleh probe():
 * live bila GET /api/v1/service-accounts berhasil; demo bila backend tak
 * tercapai. Setelah live, kegagalan dilempar ke pemanggil (tanpa fallback
 * diam-diam ke fixture). Demo memakai salinan fixture in-memory berlabel DEMO.
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
  function mapAccount(a) {
    return {
      id: a.id, name: a.name || '', kind: a.kind || '', description: a.description || '',
      status: a.status || 'active', scopes: (a.scopes || []).slice(),
      token_count: a.token_count != null ? a.token_count : (a.active_tokens || 0),
      createdAt: a.created_at || a.createdAt || null,
      revokedAt: a.revoked_at != null ? a.revoked_at : null,
      revoke_reason: a.revoke_reason || null,
      credentials: (a.tokens || []).map(function (t) {
        return { id: t.id, label: t.name || t.id, prefix: t.prefix || '', status: t.status || 'active', expiresAt: t.expires_at || null };
      }),
      _raw: a
    };
  }

  window.DEXTRA_P11_API = {
    create: function (opts) {
      opts = opts || {};
      var instanceMode = opts.mode === 'demo' ? 'demo' : 'pending';
      var probePromise = null;
      var memory = null;
      function mem() {
        if (!memory) {
          if (!window.DEXTRA_P11_FIXTURES) throw new Error('Fixture P11 tidak dimuat.');
          memory = clone(window.DEXTRA_P11_FIXTURES);
        }
        return memory;
      }
      function probe() {
        if (probePromise) return probePromise;
        if (instanceMode === 'demo') { probePromise = Promise.resolve({ mode: 'demo', reason: 'Diminta eksplisit mode demo.' }); return probePromise; }
        probePromise = authed('GET', '/api/v1/service-accounts').then(function () {
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
        listIdentities: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/service-accounts').then(function (j) { return ((j && j.items) || j || []).map(mapAccount); });
            var f = mem(); return clone(f.identities || f || []);
          });
        },
        getIdentity: function (id) {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/service-accounts/' + encodeURIComponent(id)).then(mapAccount);
            var f = mem(), found = (f.identities || f || []).filter(function (x) { return x.id === id; })[0];
            if (!found) { var e = new Error('not found'); e.status = 404; return Promise.reject(e); }
            return clone(found);
          });
        },
        createIdentity: function (payload) {
          return ensure().then(function (m) {
            payload = payload || {};
            if (m === 'live') {
              return authed('POST', '/api/v1/service-accounts', {
                name: payload.name, kind: payload.kind, description: payload.description || '', scopes: payload.scopes || []
              }).then(mapAccount);
            }
            var f = mem(), list = f.identities || (f.identities = []);
            var item = Object.assign({ id: 'demo-' + Date.now(), status: 'active', credentials: [], createdAt: new Date().toISOString() }, payload);
            list.unshift(item);
            return { demo: true, message: 'demo', identity: clone(item) };
          });
        },
        disableIdentity: function (id) {
          if (live()) {
            var e = new Error('Penonaktifan tidak didukung router service_accounts (tidak ada POST /service-accounts/{id}/disable di backend). Pakai Cabut.');
            e.status = 404; return Promise.reject(e);
          }
          return probe().then(function (p) {
            if (p.mode === 'live') {
              var e2 = new Error('Penonaktifan tidak didukung router service_accounts (tidak ada POST /service-accounts/{id}/disable di backend). Pakai Cabut.');
              e2.status = 404; return Promise.reject(e2);
            }
            var f = mem(), list = f.identities || [];
            list = list.map(function (x) { if (x.id === id) x.status = 'disabled'; return x; });
            f.identities = list;
            return Promise.resolve({ demo: true, message: 'demo' });
          });
        },
        revokeIdentity: function (id) {
          return ensure().then(function (m) {
            if (m === 'live') return authed('POST', '/api/v1/service-accounts/' + encodeURIComponent(id) + '/revoke', { reason: 'revoked_by_user' }).then(mapAccount);
            var f = mem(), list = f.identities || [];
            list = list.map(function (x) { if (x.id === id) x.status = 'revoked'; return x; });
            f.identities = list;
            return Promise.resolve({ demo: true, message: 'demo' });
          });
        },
        rotateCredential: function (identityId, credId) {
          return ensure().then(function (m) {
            if (m === 'live') {
              if (credId) {
                return authed('POST', '/api/v1/tokens/' + encodeURIComponent(credId) + '/rotate', { service_account_id: identityId }).then(function (d) {
                  return { plaintext: d.token || '', token: mapTokenPlain(d) };
                });
              }
              return authed('POST', '/api/v1/tokens', { service_account_id: identityId }).then(function (d) {
                return { plaintext: d.token || '', token: mapTokenPlain(d) };
              });
            }
            return Promise.resolve({ plaintext: 'DEMO-secret-' + Date.now() });
          });
        }
      };
      function mapTokenPlain(d) {
        return { id: d.id, name: d.name, prefix: d.prefix, status: d.status, scopes: d.scopes, expires_at: d.expires_at };
      }
      return api;
    }
  };
})();
