/* DEXTRA P8/P9/P10 — jembatan API live-first.
 *
 * Server-side kontrak: docs/API-CONTRACT-P7-P12.md §1-2,5,9.
 * Transport resmi: window.DEXTRA.api.rest(method,path,body) →
 * /api/v1/... dengan cookie + CSRF.
 *
 * Mode dipertahankan per-instance dan diputuskan oleh probe():
 * live bila GET /api/v1/auth/session dan GET /api/v1/permissions
 * berhasil (backend hidup + kredensial valid); demo bila backend
 * tak tercapai / kredensial tak valid.
 * Setelah live, kegagalan 403 dari backend dilempar ke pemanggil
 * (tidak fallback diam-diam) agar pemblokiran akses jelas.
 * Role/permission nyata dari backend: listMembers/listRoles memanggil
 * GET /api/v1/users dan /api/v1/roles yang di-proteksi manage_users;
 * listPermissions memetakan /api/v1/permissions ke matriks caller.
 * Demo memakai salinan fixture in-memory, diberi label DEMO di layar.
 * Tidak ada secret yang disimpan di localStorage.
 */
(function () {
  'use strict';

  var FIXTURES = window.DEXTRA_ENTERPRISE_FIXTURES;
  var CONTRACTS = window.DEXTRA_ENTERPRISE_CONTRACTS;

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function demoMsg(m) { return 'Demo lokal — tidak tercatat di backend' + (m ? ': ' + m : ''); }
  function D() { return window.DEXTRA || {}; }
  function client() {
    var d = D();
    var a = d.api;
    return (a && typeof a.rest === 'function') ? a : null;
  }
  function authed(method, path, body) {
    return new Promise(function (resolve, reject) {
      var a = client();
      if (!a) return reject(new Error('D.api.rest tidak tersedia'));
      a.rest(method, path, body).then(resolve, reject);
    });
  }

  function authErr(err, fallback) {
    var msg = (err && err.message) ? String(err.message) : '';
    var map = {
      unauthorized: 'Tidak terautentikasi (401). Silakan masuk kembali.',
      forbidden: 'Tidak diizinkan (403).',
      not_found: 'Tidak ditemukan atau bukan milik Anda (404).',
      conflict: 'Konflik status (409).',
      validation: 'Validasi gagal (422).',
      throttled: 'Terlalu sering diminta (429).'
    };
    if (map[msg]) return map[msg];
    if (err && err.status) return 'Backend mengembalikan HTTP ' + err.status + '.';
    return fallback || msg || 'Permintaan ke backend gagal.';
  }

  function normalizeAuthSession(d) {
    var p = (d && d.principal) || {};
    return {
      demo: false,
      user: {
        id: p.principal_id || p.id || '',
        displayName: p.display_name || p.name || '—',
        email: p.email || '',
        tenantId: p.tenant_id || '',
        tenantName: p.tenant_slug || '',
        role: p.role || '',
        roleLabel: p.role || '',
        title: p.role || '',
        dept: '',
        mfaVerified: !!d.mfa_enabled || !!p.mfa_enabled,
        authenticatedAt: null
      },
      mfa: {
        demo: false,
        enrolled: !!d.mfa_enabled || !!p.mfa_enabled,
        verified: !!d.mfa_enabled || !!p.mfa_enabled,
        status: d.mfa_enabled || p.mfa_enabled ? 'verified' : 'disabled',
        enrolledAt: null
      },
      capabilities: (d.capabilities || p.capabilities || []).slice(),
      authKind: d.auth_kind || null,
      auth_kind: d.auth_kind || null
    };
  }

  function mapSession(s) {
    return {
      id: s.id || s.session_id,
      device: (s.user_agent || s.device || '—').slice(0, 80),
      browser: '',
      os: '',
      ip: s.ip_address || s.ip || '—',
      userAgent: s.user_agent || '',
      lastSeenAt: s.last_seen_at || s.lastSeenAt || null,
      createdAt: s.issued_at || s.createdAt || null,
      current: !!s.current
    };
  }

  function mapToken(t) {
    var status = t.status === 'revoked' ? 'revoked'
      : (t.expires_at && new Date(t.expires_at) < new Date() ? 'expired' : 'active');
    return {
      id: t.id || t.token_id,
      name: t.name || '—',
      prefix: t.prefix || (t.id ? String(t.id).slice(0, 8) : ''),
      scopes: (t.scopes || []).slice(),
      status: status,
      createdBy: t.owner || t.owner_id || '',
      createdAt: t.created_at || null,
      expiresAt: t.expires_at || t.expiresAt || null,
      lastUsedAt: t.last_used_at || t.lastUsedAt || null,
      revokedAt: t.revoked_at || t.revokedAt || null,
      rotatedFromId: t.rotated_from_id || t.rotatedFromId || null,
      serviceAccountId: t.service_account_id || null,
      _raw: t
    };
  }

  function mapMember(u) {
    var st = u.status || u.membership_status || '';
    return {
      id: u.id || u.principal_id || u.user_id || '',
      displayName: u.display_name || u.displayName || u.name || '',
      email: u.email || '',
      role: u.role || (u.role_name || '') || '',
      status: st === 'suspended' || st === 'disabled' ? 'suspended'
        : (st === 'invited' ? 'invited' : 'accepted'),
      acceptedAt: u.joined_at || u.acceptedAt || u.created_at || null,
      tenantId: u.tenant_id || '',
      source: 'backend',
      isDefault: !!u.is_default
    };
  }

  function mapRole(r, enforced, unbacked) {
    var caps = (r.capabilities || []).slice();
    var u = (unbacked || []).slice();
    return {
      id: r.id || r.role_id || r.name,
      label: r.name || r.label || r.id,
      description: r.description || '',
      system: !!r.is_system,
      capabilities: caps,
      unbacked: u
    };
  }

  function roleLabelFor(r) { return r.label || r.id; }

  window.DEXTRA_ENTERPRISE_API = {
    create: function (opts) {
      opts = opts || {};
      var instanceMode = opts.mode === 'demo' ? 'demo' : 'pending';
      var probePromise = null;
      var mem = null;
      var sessionCache = null;
      var permissionsCache = null;

      function store() {
        if (!mem) {
          if (!FIXTURES) throw new Error('Fixture DEMO enterprise tidak dimuat (enterprise/fixtures.js).');
          mem = clone(FIXTURES);
        }
        return mem;
      }

      function probe() {
        if (probePromise) return probePromise;
        if (instanceMode === 'demo') {
          probePromise = Promise.resolve({ mode: 'demo', reason: 'Diminta eksplisit mode demo.' });
          return probePromise;
        }
        probePromise = authed('GET', '/api/v1/auth/session').then(function () {
          return authed('GET', '/api/v1/permissions').then(function (perm) {
            sessionCache = perm;
            instanceMode = 'live';
            return { mode: 'live', reason: 'Backend session aktif.' };
          }).catch(function () {
            sessionCache = null;
            instanceMode = 'demo';
            return { mode: 'demo', reason: 'Fallback demo: permissions probe gagal.' };
          });
        }).catch(function (err) {
          instanceMode = 'demo';
          return { mode: 'demo', reason: 'Fallback demo: ' + ((err && (err.status || err.message)) || 'unavailable') };
        });
        return probePromise;
      }
      function live() { return instanceMode === 'live'; }
      function ensure() {
        return probe().then(function (p) { return p.mode; });
      }
      function getSessionCapabilities() {
        if (sessionCache) return Promise.resolve(sessionCache);
        return authed('GET', '/api/v1/permissions').then(function (perm) {
          sessionCache = perm;
          return perm;
        }).catch(function (err) {
          var e = new Error(err && err.message ? err.message : 'forbidden');
          if (err && err.status) e.status = err.status;
          throw e;
        });
      }
      function getPermissions() {
        if (permissionsCache) return Promise.resolve(permissionsCache);
        return getSessionCapabilities().then(function (perm) {
          var caps = (perm && perm.capabilities) || [];
          permissionsCache = perm;
          return perm;
        });
      }
      function demoResult(extra) {
        var out = { demo: true, persisted: false, message: demoMsg() };
        if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
        return out;
      }
      function liveResult(extra) {
        var out = { demo: false, persisted: true };
        if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
        return out;
      }
      function listExpectedEndpoints() {
        return (CONTRACTS && CONTRACTS.EXPECTED_ENDPOINTS) ? CONTRACTS.EXPECTED_ENDPOINTS.slice() : [];
      }

      /* P8 */
      function getAuthSnapshot() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('GET', '/api/v1/auth/session').then(function (d) {
              return authed('GET', '/api/v1/auth/sessions').then(function (s) {
                var snap = normalizeAuthSession(d);
                snap.sessions = ((s && s.items) || s || []).map(mapSession);
                snap.loginActivity = [];
                return snap;
              }).catch(function () {
                var snap = normalizeAuthSession(d); snap.sessions = []; snap.loginActivity = []; return snap;
              });
            });
          }
          return clone(store().auth);
        });
      }
      function changePassword(change) {
        return ensure().then(function (m) {
          if (m === 'live') {
            change = change || {};
            return authed('POST', '/api/v1/auth/password', {
              current_password: change.current, new_password: change.next
            }).then(function (d) { return liveResult({ changed: !!(d && d.changed), sessionsRevoked: (d && d.sessions_revoked) || 0 }); });
          }
          change = change || {};
          var cur = String(change.current || ''), next = String(change.next || '');
          var problems = [];
          if (!cur) problems.push('Kata sandi saat ini wajib diisi.');
          if (next.length < 12) problems.push('Kata sandi baru minimal 12 karakter.');
          if (!/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next)) problems.push('Kombinasikan huruf besar, huruf kecil, dan angka.');
          if (next && next === cur) problems.push('Kata sandi baru harus berbeda dari yang lama.');
          if (problems.length) { var e = new Error(problems.join(' ')); e.code = 'LOCAL_VALIDATION'; e.problems = problems; return Promise.reject(e); }
          store().auth.user.passwordChangedAt = new Date().toISOString();
          return demoResult({ passwordChangedAt: store().auth.user.passwordChangedAt });
        });
      }
      function enrollMfa() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('POST', '/api/v1/auth/mfa/enroll', {}).then(function (d) {
              return liveResult({ secret: d.secret, otpauth: d.otpauth_uri || d.otpauth, active: !!d.active });
            });
          }
          var s = store(); s.auth.mfa.enrolled = true; s.auth.mfa.status = 'pending'; s.auth.mfa.verified = false;
          return demoResult({ otpauth: 'otpauth://totp/DEXTRA-DEMO:maya.lestari%40kenari.co.id?secret=DEMO-BUKAN-SECRET-ASLI&issuer=DEXTRA-DEMO' });
        });
      }
      function verifyMfa(code) {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('POST', '/api/v1/auth/mfa/verify', { code: String(code || '').trim() })
              .then(function () { return liveResult({ verified: true }); });
          }
          if (!/^\d{6}$/.test(String(code || '').trim())) { var e = new Error('Kode MFA harus 6 digit angka.'); e.code = 'LOCAL_VALIDATION'; return Promise.reject(e); }
          var s = store(); s.auth.mfa.verified = true; s.auth.mfa.status = 'verified';
          return demoResult({ verified: true });
        });
      }
      function disableMfa(password, code) {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('POST', '/api/v1/auth/mfa/disable', { password: password || '', code: code || '' })
              .then(function () { return liveResult({ disabled: true }); });
          }
          var s = store(); s.auth.mfa.enrolled = false; s.auth.mfa.verified = false; s.auth.mfa.status = 'disabled';
          return demoResult({ disabled: true });
        });
      }
      function listSessions() {
        return ensure().then(function (m) {
          if (m === 'live') return authed('GET', '/api/v1/auth/sessions').then(function (d) { return ((d && d.items) || d || []).map(mapSession); });
          return clone(store().auth.sessions);
        });
      }
      function revokeSession(id) {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('POST', '/api/v1/auth/sessions/' + encodeURIComponent(id) + '/revoke', {}).then(function () { return liveResult({ revoked: true, id: id }); });
          }
          var s = store(), before = s.auth.sessions.length;
          s.auth.sessions = s.auth.sessions.filter(function (x) { return x.id !== id || x.current; });
          return demoResult({ revoked: before !== s.auth.sessions.length });
        });
      }
      function revokeOtherSessions() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return listLiveSessions().then(function (list) {
              var others = list.filter(function (x) { return !x.current; });
              return Promise.all(others.map(function (x) { return authed('POST', '/api/v1/auth/sessions/' + encodeURIComponent(x.id) + '/revoke', {}).catch(function () { return null; }); }))
                .then(function () { return liveResult({ revokedCount: others.length, revokedIds: others.map(function (x) { return x.id; }) }); });
            });
          }
          var s = store(), kept = s.auth.sessions.filter(function (x) { return x.current; }), n = s.auth.sessions.length - kept.length;
          s.auth.sessions = kept;
          return demoResult({ revokedCount: n });
        });
      }
      function listLiveSessions() {
        return authed('GET', '/api/v1/auth/sessions').then(function (d) { return ((d && d.items) || d || []).map(mapSession); });
      }

      /* P9 */
      function listMembers() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return getSessionCapabilities().then(function (perm) {
              var caps = (perm && perm.capabilities) || [];
              var hasManageUsers = caps.indexOf('manage_users') >= 0;
              if (!hasManageUsers) {
                var err = new Error('forbidden');
                err.status = 403;
                throw err;
              }
              return authed('GET', '/api/v1/users').then(function (d) {
                var items = (d && d.items) || d || [];
                return { tenant: { id: (d && d.tenant_id) || '', name: '', slug: '' }, members: items.map(mapMember), capabilities: caps };
              });
            });
          }
          var s = store(); return { tenant: clone(s.tenant), members: clone(s.members) };
        });
      }
      function listRoles() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return getSessionCapabilities().then(function (perm) {
              var caps = (perm && perm.capabilities) || [];
              var hasManageUsers = caps.indexOf('manage_users') >= 0;
              if (!hasManageUsers) {
                var err = new Error('forbidden');
                err.status = 403;
                throw err;
              }
              var unbacked = (perm && perm.unbacked_capabilities) || [];
              return authed('GET', '/api/v1/roles').then(function (d) {
                return ((d && d.items) || d || []).map(function (r) { return mapRole(r, [], unbacked); });
              });
            });
          }
          return clone(store().roles);
        });
      }
      function listPermissions() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return getSessionCapabilities().then(function (perm) {
              var caps = (perm && perm.capabilities) || [];
              var enforced = (perm && perm.enforced_capabilities) || [];
              var unbacked = (perm && perm.unbacked_capabilities) || [];
              var all = (perm && perm.all_capabilities) || caps;
              var items = all.map(function (id) {
                var isEnforced = enforced.indexOf(id) >= 0;
                return { id: id, label: id, group: '', backed: isEnforced, note: isEnforced ? '' : 'belum tersedia' };
              });
              var matrix = {};
              items.forEach(function (p) {
                matrix[p.id] = caps.indexOf(p.id) >= 0 ? 'yes' : 'no';
              });
              return { permissions: items, matrix: matrix, capabilities: caps, enforced: enforced, unbacked: unbacked };
            });
          }
          var s = store(); return { permissions: clone(s.permissions), matrix: clone(s.permMatrix) };
        });
      }
      function getSession() {
        return ensure().then(function (m) {
          if (m === 'live') return getSessionCapabilities();
          return clone(store().auth);
        });
      }
      function deniedResult(cap) {
        return { demo: false, persisted: false, denied: true, capability: cap, status: 403 };
      }
      function updateMember(id, patch) {
        return ensure().then(function (m) {
          if (m === 'live') {
            return getSessionCapabilities().then(function (perm) {
              var caps = (perm && perm.capabilities) || [];
              if (caps.indexOf('manage_users') < 0) {
                var err = new Error('forbidden');
                err.status = 403;
                throw err;
              }
              var err = new Error('Update anggota tidak didukung router identity (tidak ada PATCH /users di backend P9).');
              err.status = 404;
              throw err;
            });
          }
          patch = patch || {};
          var s = store(), mem2 = null;
          s.members.forEach(function (x) { if (x.id === id) mem2 = x; });
          if (!mem2) { var e = new Error('Anggota tidak ditemukan di fixture demo.'); e.code = 'NOT_FOUND'; return Promise.reject(e); }
          if (patch.status && ['accepted', 'invited', 'suspended'].indexOf(patch.status) >= 0) mem2.status = patch.status;
          if (patch.role) mem2.role = patch.role;
          return demoResult({ member: clone(mem2) });
        });
      }

      /* P10 */
      function listTokens() {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('GET', '/api/v1/tokens').then(function (d) { return ((d && d.items) || d || []).map(mapToken); });
          }
          return clone(store().tokens);
        });
      }
      function issueToken(input) {
        return ensure().then(function (m) {
          if (m === 'live') {
            input = input || {};
            return authed('POST', '/api/v1/tokens', {
              name: input.name, scopes: input.scopes, expires_in_days: input.expiresInDays || 90,
              service_account_id: input.serviceAccountId || null
            }).then(function (d) {
              return liveResult({ token: mapToken(d), plaintext: d.token || '' });
            });
          }
          input = input || {};
          var name = String(input.name || '').trim(), scopes = Array.isArray(input.scopes) ? input.scopes.slice() : [];
          if (!name) { var e = new Error('Nama token wajib diisi.'); e.code = 'LOCAL_VALIDATION'; return Promise.reject(e); }
          if (!scopes.length) { var e2 = new Error('Pilih minimal satu scope.'); e2.code = 'LOCAL_VALIDATION'; return Promise.reject(e2); }
          var days = parseInt(input.expiresInDays, 10) || 90, now = new Date();
          var record = { id: 'tok_demo_' + Date.now().toString(36), name: name, prefix: 'dx_demo_' + Math.random().toString(16).slice(2, 8), scopes: scopes, status: 'active', createdBy: 'maya.lestari@kenari.co.id', createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + days * 864e5).toISOString(), lastUsedAt: null, revokedAt: null, rotatedFromId: null };
          store().tokens.unshift(record);
          return demoResult({ token: clone(record), plaintext: record.prefix + '_' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2) });
        });
      }
      function revokeToken(id) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('POST', '/api/v1/tokens/' + encodeURIComponent(id) + '/revoke', {}).then(function () { return liveResult({ revoked: true, id: id }); });
          var s = store(), t = null;
          s.tokens.forEach(function (x) { if (x.id === id) t = x; });
          if (!t) { var e = new Error('Token tidak ditemukan di fixture demo.'); e.code = 'NOT_FOUND'; return Promise.reject(e); }
          t.status = 'revoked'; t.revokedAt = new Date().toISOString();
          return demoResult({ token: clone(t) });
        });
      }
      function rotateToken(id) {
        return ensure().then(function (m) {
          if (m === 'live') {
            return authed('POST', '/api/v1/tokens/' + encodeURIComponent(id) + '/rotate', {}).then(function (d) {
              return liveResult({ token: mapToken(d), plaintext: d.token || '', revokedId: id });
            });
          }
          var s = store(), old = null;
          s.tokens.forEach(function (x) { if (x.id === id) old = x; });
          if (!old) { var e = new Error('Token tidak ditemukan di fixture demo.'); e.code = 'NOT_FOUND'; return Promise.reject(e); }
          var now = new Date(), record = { id: 'tok_demo_' + Date.now().toString(36), name: old.name + ' (rotasi)', prefix: 'dx_demo_' + Math.random().toString(16).slice(2, 8), scopes: old.scopes.slice(), status: 'active', createdBy: old.createdBy, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 90 * 864e5).toISOString(), lastUsedAt: null, revokedAt: null, rotatedFromId: old.id };
          old.status = 'revoked'; old.revokedAt = now.toISOString(); s.tokens.unshift(record);
          return demoResult({ token: clone(record), revokedId: old.id, plaintext: record.prefix + '_' + Math.random().toString(16).slice(2) });
        });
      }

      return {
        probe: probe,
        isLive: live,
        getMode: function () { return instanceMode; },
        mode: instanceMode,
        listExpectedEndpoints: listExpectedEndpoints,
        getAuthSnapshot: getAuthSnapshot,
        getSession: getSession,
        getSessionCapabilities: getSessionCapabilities,
        getPermissions: getPermissions,
        changePassword: changePassword,
        enrollMfa: enrollMfa,
        verifyMfa: verifyMfa,
        disableMfa: disableMfa,
        listSessions: listSessions,
        revokeSession: revokeSession,
        revokeOtherSessions: revokeOtherSessions,
        listMembers: listMembers,
        updateMember: updateMember,
        listRoles: listRoles,
        listPermissions: listPermissions,
        deniedResult: deniedResult,
        listTokens: listTokens,
        issueToken: issueToken,
        revokeToken: revokeToken,
        rotateToken: rotateToken
      };
    }
  };
})();
