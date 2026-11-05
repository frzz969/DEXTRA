/* DEXTRA API client */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  if (root) root.DEXTRA_API = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /* DEXTRA API client — dua jenis kredensial, JANGAN dicampur:
   *
   * 1) Manusia (REST, /api/v1): TIDAK ada token di storage. Backend menerbitkan
   *    cookie sesi httpOnly (+ CSRF) saat POST /auth/login; cookie dihapus
   *    server saat POST /auth/logout. Session restoration = GET /auth/session
   *    dengan credentials:'include' (lihat core.js boot via session_info).
   * 2) MCP (JSON-RPC, :8765): Authorization: Bearer <ops token>. Token ops
   *    disimpan HANYA di sessionStorage (hilang saat tab ditutup), tidak pernah
   *    di localStorage. api.token()/setToken()/clearToken() hanya untuk bearer MCP.
   */
  'use strict';
  function unwrap(json) {
    if (json && json.error) throw new Error(json.error.message || 'Panggilan tool gagal');
    var text = json && json.result && json.result.content && json.result.content[0] && json.result.content[0].text;
    var parsed = text ? JSON.parse(text) : {};
    if (parsed && parsed.ok === false) throw new Error((parsed.error && parsed.error.message) || 'Tool menolak permintaan');
    if (!parsed || parsed.data === undefined || parsed.data === null) return {};
    return parsed.data;
  }
  function envelope(tool, args, id) { return { jsonrpc: '2.0', id: id, method: 'tools/call', params: { name: tool, arguments: args || {} } }; }
  function backendBase(mcpBase) { return String(mcpBase || '').replace(/:8765\b/, ':8000').replace(/\/$/, ''); }
  function csrfToken() { try { var m = document.cookie.match(/(?:^|; )dextra_csrf=([^;]*)/); return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } }
  function normalizeError(status) { var map = { 401:'unauthorized',403:'forbidden',404:'not_found',409:'conflict',422:'validation',429:'throttled' }; return map[status] || ('http_' + status); }
  function create(options) {
    var opts = options || {};
    var baseUrl = opts.baseUrl || 'http://127.0.0.1:8765';
    var restUrl = opts.restUrl || backendBase(baseUrl);
    var tokenKey = opts.tokenKey || 'dextra_ops_token';
    var fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var api = {
      mode: 'demo', API: baseUrl, restBase: restUrl, tokenKey: tokenKey,
      /* MCP bearer ops token: sessionStorage saja. REST memakai cookie httpOnly
       * dari backend (tanpa entri storage). */
      token: function () { try { return sessionStorage.getItem(tokenKey) || ''; } catch (e) { return ''; } },
      setToken: function (t) { try { if (t) sessionStorage.setItem(tokenKey, t); else sessionStorage.removeItem(tokenKey); } catch (e) {} },
      clearToken: function () { try { sessionStorage.removeItem(tokenKey); } catch (e) {} },
      health: function () { if (!fetchImpl) return Promise.resolve(false); var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null; var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 1800); return fetchImpl(baseUrl + '/health', ctrl ? { signal: ctrl.signal } : {}).then(function (r) { clearTimeout(timer); return r.ok; }).catch(function () { clearTimeout(timer); return false; }); },
      call: function (tool, args) { if (!fetchImpl) return Promise.reject(new Error('fetch tidak tersedia')); return fetchImpl(baseUrl + '/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + api.token() }, body: JSON.stringify(envelope(tool, args, Date.now())) }).then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }).then(unwrap); },
      /* REST memakai cookie sesi (credentials:'include'); bearer MCP di bawah
       * (call) memakai Authorization: Bearer untuk JSON-RPC :8765. */
      rest: function (method, path, body) {
        if (!fetchImpl) return Promise.reject(new Error('fetch tidak tersedia'));
        var m = String(method || 'GET').toUpperCase();
        var headers = { 'Content-Type': 'application/json' };
        if (['POST','PUT','PATCH','DELETE'].indexOf(m) >= 0) { var c = csrfToken(); if (c) headers['X-CSRF-Token'] = c; }
        return fetchImpl(restUrl + path, { method: m, headers: headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined })
          .then(function (res) { if (!res.ok) { var e = new Error(normalizeError(res.status)); e.status = res.status; throw e; } return res.status === 204 ? null : res.json(); });
      }
    };
    api.auth = {
      login: function (email, password, tenant) { return api.rest('POST','/api/v1/auth/login', { email: email, password: password, tenant: tenant }); },
      logout: function () { return api.rest('POST','/api/v1/auth/logout', {}); },
      getSession: function () { return api.rest('GET','/api/v1/auth/session'); },
      mfaEnroll: function () { return api.rest('POST','/api/v1/auth/mfa/enroll', {}); },
      mfaActivate: function (code) { return api.rest('POST','/api/v1/auth/mfa/activate', { code: code }); },
      mfaVerify: function (code) { return api.rest('POST','/api/v1/auth/mfa/verify', { code: code }); },
      mfaDisable: function (password, code) { return api.rest('POST','/api/v1/auth/mfa/disable', { password: password, code: code }); },
      /* Backend: POST /auth/password {current_password, new_password}.
       * POST /auth/sessions/{id}/revoke tanpa body (backend tidak punya body). */
      changePassword: function (current, neu) { return api.rest('POST','/api/v1/auth/password', { current_password: current, new_password: neu }); },
      listSessions: function () { return api.rest('GET','/api/v1/auth/sessions'); },
      revokeSession: function (id) { return api.rest('POST','/api/v1/auth/sessions/' + encodeURIComponent(id) + '/revoke', {}); }
    };
    return api;
  }
  return { create: create, unwrap: unwrap, envelope: envelope };
});