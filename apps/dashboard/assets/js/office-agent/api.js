/* Office Agent — jembatan API.
 *
 * Satu-satunya tempat yang memutuskan apakah layar berbicara dengan server
 * atau memutar mesin demo. Probe memeriksa daftar tool yang dilaporkan server;
 * bila pipeline Office Agent belum ada, mode menjadi demo dan alasan dikembalikan
 * ke layar. Setelah probe menyatakan live, kegagalan panggilan dilempar ke atas —
 * tidak pernah diam-diam kembali ke data contoh.
 *
 * Tidak ada token, kunci, atau rahasia di berkas ini.
 */
(function () {
  'use strict';

  var C = window.DEXTRA_OFFICE_CONTRACTS;
  var TOOLS = C.TOOL_NAMES;

  /* Transport utama = REST FastAPI (cookie sesi), BUKAN MCP tools/call.
   * Mapping lama office_* -> MCP (create_plan/get_plan/...) dihapus:
   * server tidak mendaftarkan tool itu; prepare_plan/remove_tool_name adalah
   * klaim palsu. Live memakai:
   *   POST /api/v1/office-agent/plans
   *   GET  /api/v1/office-agent/plans/{plan_id}
   *   POST /api/v1/office-agent/plans/{plan_id}/actions/{action_id}/approve
   * Probing REST: GET /api/v1/office-agent/plans (view_own). */

  function delay(value, ms) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve(value); }, ms);
    });
  }

  function resolveTool(name, available) {
    return name; /* tidak ada MCP office_*; REST dipakai langsung */
  }

  function toolAvailable(name, tools) {
    return false;
  }

  /* Probe REST: true bila GET /office-agent/plans berhasil. */
  function restAvailable() {
    var d = window.DEXTRA || {};
    var a = d.api;
    return !!(a && typeof a.rest === 'function');
  }

  function classify(tools) {
    /* tools MCP tidak dipakai lagi; kelengkapan surface tidak diketahui di sini. */
    return {
      mode: 'live',
      available: ['office-agent/plans (REST)'],
      missing: [],
      reason: null,
      tools: []
    };
  }

  /* JANGAN klaim eksekusi/audit Office: tidak ada endpoint eksekusi/audit
   * khusus di backend (eksekusi lewat POST /executions, audit via
   * /audit-events — di luar layar ini). */
  window.DEXTRA_OFFICE_API = {
    create: function (opts) {
      opts = opts || {};
      var transport = opts.api;
      var fixtures = opts.fixtures;
      var engine = opts.demo && typeof opts.demo.create === 'function'
        ? opts.demo.create(fixtures)
        : null;
      var mode = null;
      var probeResult = null;
      var availableTools = [];

      function D() { return window.DEXTRA || {}; }

      function requireEngine() {
        if (!engine) throw new Error('Mesin demo Office Agent tidak dimuat.');
        return engine;
      }

      function demoResult(snapshot) {
        return delay({ demo: true, state: snapshot, patch: null }, 520);
      }

      function planToPatch(d, requestId) {
        var plan = d || {};
        var actions = Array.isArray(plan.actions) ? plan.actions : [];
        return {
          request: {
            request_id: plan.request_id || requestId,
            status: plan.status || 'DRAFT',
            created_at: plan.created_at || null,
            source: sourceMeta({ source: plan.source })
          },
          actions: actions,
          plan: {
            plan_id: plan.plan_id,
            request_id: plan.request_id || requestId,
            plan_hash: plan.plan_hash || null,
            status: plan.status || null,
            actions: actions,
            findings: plan.findings || [],
            validation: plan.validation || null
          },
          planId: plan.plan_id || null,
          status: plan.status || null
        };
      }

      function call(tool, args) {
        return transport.call(tool, args || {});
      }

      function rest(method, path, body) {
        return Promise.resolve().then(function () {
          return transport.rest(method, path, body);
        }).catch(function (err) {
          throw new Error(err && err.message ? err.message : 'Panggilan REST ' + path + ' gagal.');
        });
      }

      function liveCall(tool, args) {
        return Promise.resolve().then(function () {
          return call(tool, args);
        }).catch(function (err) {
          /* Diteruskan apa adanya: layar harus menampilkan alasan server,
             bukan berganti ke data contoh. */
          throw new Error(err && err.message ? err.message : 'Panggilan ' + tool + ' gagal.');
        });
      }

      function sourceMeta(request) {
        request = request || {};
        var src = request.source || {};
        return {
          type: src.type || (src.filename ? 'document' : 'text'),
          filename: src.filename || null,
          size_bytes: src.size_bytes === undefined ? null : src.size_bytes,
          submitted_by: src.submitted_by || null
        };
      }

      var api = {
        probe: function () {
          var d = D();
          var live = d.store && d.store.mode === 'live';
          if (!live || !restAvailable()) {
            probeResult = {
              mode: 'demo',
              available: [],
              missing: ['office-agent/plans (REST)'],
              reason: 'REST Office Agent tidak terdeteksi, jadi layar berjalan dalam mode demo.'
            };
            mode = probeResult.mode;
            return Promise.resolve(probeResult);
          }
          return rest('GET', '/api/v1/office-agent/plans').then(function () {
            probeResult = classify([]);
            availableTools = [];
            mode = probeResult.mode;
            return probeResult;
          }).catch(function (err) {
            /* Probe REST gagal tapi backend live: tetap live supaya error
               ditampilkan apa adanya, tidak jatuh ke demo diam-diam. */
            probeResult = {
              mode: 'live',
              available: [],
              missing: [],
              reason: 'Probe REST Office Agent gagal: ' + ((err && err.message) || 'unknown') + '. Transport live tetap dipakai.'
            };
            mode = probeResult.mode;
            return probeResult;
          });
        },

        getMode: function () { return mode; },
        getProbe: function () { return probeResult; },
        isDemo: function () { return mode === 'demo'; },

        /* ---------------- demo ---------------- */

        createRequest: function (input) {
          if (mode === 'demo') {
            var snapshot = requireEngine().ingest(input);
            return demoResult(snapshot);
          }
          /* REST backend: OfficePlanPayload
           * {request_id, plan_id, plan_hash, source, document, actions[],
            findings[], validation}. Tanpa actions backend menolak (422),
           * jadi live create di layar ini tidak boleh memanggil endpoint ini
           * sebagai klaim "membuat request". Petakan payload salahnya:
           * source_type/text/filename/size_bytes milik kontrak MCP yang
           * tidak ada. */
          var e = new Error(
            'Pembuatan request live melalui REST membutuhkan actions[] yang sudah ' +
            'didekomposisi (OfficePlanPayload). Layar ini belum menyusun actions, ' +
            'jadi permintaan live tidak dijalankan di sini. Gunakan mode demo, atau ' +
            'POST /api/v1/office-agent/plans langsung dari klien yang memiliki actions.'
          );
          e.code = 'OFFICE_CREATE_NEEDS_ACTIONS';
          return Promise.reject(e);
        },

        getRequest: function (requestId) {
          if (mode === 'demo') return demoResult(requireEngine().getState());
          if (!requestId) return Promise.reject(new Error('requestId kosong.'));
          /* Backend tidak punya GET by request_id — hanya GET
           * /office-agent/plans (list) dan GET /plans/{plan_id}. Ambil_plan
           * yang request_id-nya cocok dari daftar; pelajari plan_id di sini. */
          return rest('GET', '/api/v1/office-agent/plans').then(function (j) {
            var items = (j && j.items) || j || [];
            var hit = items.filter(function (p) { return p.request_id === requestId; })[0];
            if (!hit) { var e = new Error('Rencana untuk request_id tidak ditemukan.'); e.status = 404; throw e; }
            return { demo: false, state: null, patch: planToPatch(hit, requestId) };
          });
        },

        clarify: function (requestId, answers) {
          if (mode === 'demo') return demoResult(requireEngine().clarify(answers));
          var e = new Error('Klarifikasi live tidak tersedia di backend; tidak dijalankan di live mode.');
          e.code = 'OFFICE_CLARIFY_UNAVAILABLE_IN_LIVE';
          return Promise.reject(e);
        },

        getPlan: function (requestId) {
          if (mode === 'demo') return demoResult(requireEngine().getState());
          if (!requestId) return Promise.reject(new Error('requestId kosong.'));
          /* GET /office-agent/plans/{plan_id}: requestId di layar adalah
           * request_id; sudah tersimpan sebagai plan_id oleh pembuatnya.
           * Coba sebagai plan_id langsung; gagal -> cari di list. */
          return rest('GET', '/api/v1/office-agent/plans/' + encodeURIComponent(requestId)).then(function (d) {
            return { demo: false, state: null, patch: planToPatch(d, requestId) };
          }).catch(function (err) {
            if (err && err.status === 404) {
              return rest('GET', '/api/v1/office-agent/plans').then(function (j) {
                var items = (j && j.items) || j || [];
                var hit = items.filter(function (p) { return p.request_id === requestId; })[0];
                if (!hit) { var e = new Error('Rencana tidak ditemukan.'); e.status = 404; throw e; }
                return { demo: false, state: null, patch: planToPatch(hit, requestId) };
              });
            }
            throw err;
          });
        },

        approve: function (requestId, decision, reason, planHash, actionId) {
          if (mode === 'demo') return demoResult(requireEngine().approve(decision));
          /* REST: POST /plans/{plan_id}/actions/{action_id}/approve
           * body: ApproveActionRequest {reason, ttl_minutes, decision}. */
          if (!requestId) return Promise.reject(new Error('requestId kosong.'));
          if (!actionId) {
            /* Layar memanggil approve tanpa actionId (per-request). Backend
             * menyetujui per action; tanpa actionId tidak ada permukaan yang
             * benar — jangan klaim approval dibuat. */
            var e = new Error(
              'Persetujuan backend bersifat per-action ' +
              '(POST /plans/{plan_id}/actions/{action_id}/approve). ' +
              'Layar ini memanggil approve per-request tanpa actionId, ' +
              'jadi persetujuan live tidak dijalankan di sini.'
            );
            e.code = 'OFFICE_APPROVE_NEEDS_ACTION_ID';
            return Promise.reject(e);
          }
          return rest('POST',
            '/api/v1/office-agent/plans/' + encodeURIComponent(requestId) +
            '/actions/' + encodeURIComponent(actionId) + '/approve',
            {
              decision: decision === 'APPROVED' ? 'approved' : (decision === 'REJECTED' ? 'rejected' : 'approved'),
              reason: reason || ''
            }).then(function (d) {
            return {
              demo: false, state: null,
              patch: {
                approval: d.approval || { decision: decision, demo: false },
                approvals: d.approval ? [d.approval] : [],
                planStatus: d.status || null,
                status: d.status || null
              }
            };
          });
        },

        execute: function (requestId, planHash) {
          if (mode === 'demo') return demoResult(requireEngine().execute());
          var e = new Error('Eksekusi Office Agent tidak tersedia di backend di layar ini; tidak dijalankan di live mode.');
          e.code = 'OFFICE_EXECUTE_UNAVAILABLE_IN_LIVE';
          return Promise.reject(e);
        },

        getAudit: function (requestId) {
          if (mode === 'demo') return demoResult(requireEngine().getState());
          var e = new Error('Audit per-request Office Agent tidak tersedia di backend; tidak dijalankan di live mode.');
          e.code = 'OFFICE_AUDIT_UNAVAILABLE_IN_LIVE';
          return Promise.reject(e);
        },

        /* Kontrol demo. Di mode live, tidak ada varian contoh yang boleh
           ditampilkan — data server bukan skenario. */
        demoVariant: function (name) {
          if (mode !== 'demo') {
            return Promise.reject(new Error('Varian demo hanya tersedia dalam mode demo.'));
          }
          return demoResult(requireEngine().variant(name));
        },

        demoRevalidate: function (edits) {
          if (mode !== 'demo') {
            return Promise.reject(new Error('Ubah rencana belum didukung server.'));
          }
          return demoResult(requireEngine().revalidate(edits));
        },

        demoReset: function () {
          if (mode !== 'demo') return null;
          return requireEngine().create();
        }
      };

      function liveTool(name) {
        return resolveTool(name, availableTools);
      }

      return api;
    }
  };
})();
