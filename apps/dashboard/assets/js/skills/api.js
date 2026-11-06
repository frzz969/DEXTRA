/* DEXTRA Skills — ID probe-aware live bridge.
 *
 * Transport resmi: window.DEXTRA.api.rest → /api/v1/skills (+sub-resource).
 * Mode diputuskan probe(): live bila GET /api/v1/skills berhasil; demo bila
 * backend tak tercapai (fixture in-memory berlabel DEMO). Setelah live,
 * kegagalan dilempar ke pemanggil (tidak fallback diam-diam ke fixture).
 */
(function () {
  'use strict';
  var FIXTURES = window.DEXTRA_SKILLS_FIXTURES;
  var CONTRACTS = window.DEXTRA_SKILLS_CONTRACTS;
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
  function mapSkill(b) {
    return {
      id: b.slug, slug: b.slug, name: b.display_name || b.slug, description: b.description || '',
      status: b.status || 'draft', lifecycle: b.status === 'published' ? 'published' : (b.status || 'draft'),
      version: b.latest_version || '0.1.0', latest_version: b.latest_version,
      is_system: !!b.is_system, created_at: b.created_at, owner: b.owner || '', domain: b.domain || '',
      risk: b.risk || 'low', permissions: b.permissions || [], usage_count: b.usage_count || 0,
      inputSchema: {}, outputSchema: {}, versions: (b.versions || []).map(function (v) {
        return { version: v.version, releasedAt: v.created_at, author: v.author, notes: v.notes, input_schema: v.input_schema, output_schema: v.output_schema, required_capabilities: v.required_capabilities };
      }),
      input_schema: (b.versions && b.versions[0] && b.versions[0].input_schema) || null,
      output_schema: (b.versions && b.versions[0] && b.versions[0].output_schema) || null
    };
  }

  window.DEXTRA_SKILLS_API = {
    create: function (opts) {
      opts = opts || {};
      var mode = opts.mode === 'demo' ? 'demo' : 'pending';
      var probePromise = null;
      var memory = null;
      function mem() { if (!memory) { if (!FIXTURES) throw new Error('no fixtures'); memory = clone(FIXTURES); } return memory; }
      function probe() {
        if (probePromise) return probePromise;
        if (mode === 'demo') { probePromise = Promise.resolve({ mode: 'demo', reason: 'Diminta eksplisit mode demo.' }); return probePromise; }
        probePromise = authed('GET', '/api/v1/skills').then(function () { mode = 'live'; return { mode: 'live', available: true, reason: 'live' }; })
          .catch(function (e) { mode = 'demo'; return { mode: 'demo', available: false, reason: e && e.message }; });
        return probePromise;
      }
      function ensure() { return probe().then(function (p) { return p.mode; }); }
      function live() { return mode === 'live'; }
      return {
        probe: probe,
        _live: live,
        getMode: function () { return mode; },
        mode: mode,
        listExpectedEndpoints: function () { return (CONTRACTS && CONTRACTS.EXPECTED_ENDPOINTS) ? CONTRACTS.EXPECTED_ENDPOINTS.slice() : []; },
        listSkills: function () {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/skills').then(function (d) { return ((d && d.items) || d || []).map(mapSkill); });
            return clone(mem().skills);
          });
        },
        getSkill: function (slug) {
          return ensure().then(function (m) {
            if (m === 'live') return authed('GET', '/api/v1/skills/' + encodeURIComponent(slug)).then(mapSkill);
            var found = (mem().skills || []).filter(function (x) { return x.slug === slug || x.id === slug; })[0];
            if (!found) { var e = new Error('not found'); e.status = 404; return Promise.reject(e); }
            return clone(found);
          });
        },
        createSkill: function (input) {
          return ensure().then(function (m) {
            input = input || {};
            if (m === 'live') {
              return authed('POST', '/api/v1/skills', {
                slug: input.slug || input.name, display_name: input.display_name || input.name,
                description: input.description || '', version: input.version || '0.1.0',
                input_schema: input.input_schema || {}, output_schema: input.output_schema || {},
                required_capabilities: input.required_capabilities || []
              }).then(mapSkill);
            }
            var e = new Error('Membuat skill hanya tersedia pada mode live (backend).'); e.code = 'DEMO_READONLY'; return Promise.reject(e);
          });
        },
        addVersion: function (slug, v) {
          return ensure().then(function (m) {
            if (m === 'live') return authed('POST', '/api/v1/skills/' + encodeURIComponent(slug) + '/versions', v || {});
            var e = new Error('Menambah versi hanya tersedia pada mode live (backend).'); e.code = 'DEMO_READONLY'; return Promise.reject(e);
          });
        },
        setStatus: function (slug, status) {
          return ensure().then(function (m) {
            if (m === 'live') return authed('POST', '/api/v1/skills/' + encodeURIComponent(slug) + '/status', { status: status }).then(mapSkill);
            var e = new Error('Mengubah status hanya tersedia pada mode live (backend).'); e.code = 'DEMO_READONLY'; return Promise.reject(e);
          });
        },
        /* Endpoint backend untuk operasi ini memang tidak ada (router skills
         * hanya: GET/POST /api/v1/skills, /{slug}, /{slug}/versions,
         * /{slug}/status). Pesan jujur: operasi tidak didukung router — bukan
         * pesan jujur di bawah: operasi tidak didukung router tersebut. */
        updateSkill: function () { var e = new Error('updateSkill tidak didukung router skills (tidak ada PATCH /skills di backend).'); e.code = 'UNSUPPORTED'; return Promise.reject(e); },
        enableSkill: function () { var e = new Error('enableSkill tidak didukung router skills (tidak ada /enable di backend; gunakan /{slug}/status).'); e.code = 'UNSUPPORTED'; return Promise.reject(e); },
        disableSkill: function () { var e = new Error('disableSkill tidak didukung router skills (tidak ada /disable di backend; gunakan /{slug}/status).'); e.code = 'UNSUPPORTED'; return Promise.reject(e); },
        listVersions: function () { var e = new Error('listVersions tidak didukung router skills (versi dibaca via GET /skills/{slug}).'); e.code = 'UNSUPPORTED'; return Promise.reject(e); },
        getSchema: function () { var e = new Error('getSchema tidak didukung router skills (skema dibaca via GET /skills/{slug}).'); e.code = 'UNSUPPORTED'; return Promise.reject(e); },
        getPolicy: function () { var e = new Error('getPolicy tidak didukung router skills (tidak ada endpoint policy di backend).'); e.code = 'UNSUPPORTED'; return Promise.reject(e); }
      };
    }
  };
})();
