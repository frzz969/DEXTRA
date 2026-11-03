/* DEXTRA API client — the one bridge between the dashboard and the MCP gateway.
 *
 * Extracted from apps/dashboard/assets/js/core.js so that the transport lives in
 * one place instead of being retyped per app. No dependencies: it uses fetch and
 * Web Storage only, and works both as a browser global and as a CommonJS module
 * for tests.
 *
 *   browser : <script src=".../api-client.js"></script>  ->  window.DEXTRA_API
 *   node    : require('./api-client.js')
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  if (root) root.DEXTRA_API = mod;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Pure: turn a JSON-RPC response body into the tool payload, or throw.
     Kept separate from the network call so it can be tested without a server. */
  function unwrap(json) {
    if (json && json.error) {
      throw new Error(json.error.message || 'Panggilan tool gagal');
    }
    var text = json && json.result && json.result.content && json.result.content[0]
      && json.result.content[0].text;
    var parsed = text ? JSON.parse(text) : {};
    if (parsed && parsed.ok === false) {
      throw new Error((parsed.error && parsed.error.message) || 'Tool menolak permintaan');
    }
    /* `parsed.data` boleh absen pada respons tanpa konten. Kembalikan objek kosong,
       bukan undefined — pemanggil melakukan `data.foo` dan undefined akan menjadi
       TypeError yang menyesatkan ("tidak bisa membaca properti dari undefined"). */
    if (!parsed || parsed.data === undefined || parsed.data === null) return {};
    return parsed.data;
  }

  function envelope(tool, args, id) {
    return {
      jsonrpc: '2.0',
      id: id,
      method: 'tools/call',
      params: { name: tool, arguments: args || {} }
    };
  }

  function create(options) {
    var opts = options || {};
    var baseUrl = opts.baseUrl || 'http://127.0.0.1:8765';
    var tokenKey = opts.tokenKey || 'dextra_ops_token';
    var fetchImpl = opts.fetch || (typeof fetch !== 'undefined' ? fetch : null);

    var api = {
      mode: 'demo',
      API: baseUrl,
      tokenKey: tokenKey,

      token: function () {
        try {
          return sessionStorage.getItem(tokenKey) || localStorage.getItem(tokenKey) || '';
        } catch (e) { return ''; }
      },

      setToken: function (t, remember) {
        try {
          sessionStorage.setItem(tokenKey, t);
          if (remember) localStorage.setItem(tokenKey, t);
        } catch (e) {}
      },

      clearToken: function () {
        try {
          sessionStorage.removeItem(tokenKey);
          localStorage.removeItem(tokenKey);
        } catch (e) {}
      },

      health: function () {
        if (!fetchImpl) return Promise.resolve(false);
        var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 1800);
        return fetchImpl(baseUrl + '/health', ctrl ? { signal: ctrl.signal } : {})
          .then(function (r) { clearTimeout(timer); return r.ok; })
          .catch(function () { clearTimeout(timer); return false; });
      },

      call: function (tool, args) {
        if (!fetchImpl) return Promise.reject(new Error('fetch tidak tersedia'));
        return fetchImpl(baseUrl + '/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + api.token()
          },
          body: JSON.stringify(envelope(tool, args, Date.now()))
        }).then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        }).then(unwrap);
      }
    };

    return api;
  }

  return { create: create, unwrap: unwrap, envelope: envelope };
});
