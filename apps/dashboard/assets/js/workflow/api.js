/* DEXTRA Workflow — probe-aware live bridge.
 *
 * Kontrak: docs/API-CONTRACT-P7-P12.md §7. Transport resmi
 * window.DEXTRA.api.rest → /api/v1/workflows (cookie + CSRF), ditambah
 * bearer ops token bila ada (D.api.token()).
 *
 * Mode per-instance diputuskan probe(): live bila GET /api/v1/workflows
 * berhasil; demo bila backend tak tercapai. Setelah live, kegagalan
 * dilempar ke pemanggil (tanpa fallback diam-diam ke fixture). Retry bukan
 * endpoint backend — di live ditolak jelas.
 */
(function () {
  'use strict';
  var FIXTURES = window.DEXTRA_WORKFLOW_FIXTURES;
  var CONTRACTS = window.DEXTRA_WORKFLOW_CONTRACTS;
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
  function mapWorkflow(w) {
    return {
      id: w.id, name: w.name || w.id || '', description: w.description || '',
      domain: w.domain || '', status: w.status || 'draft', risk: w.risk || 'low',
      owner: w.owner || '', version: w.version || '0.1.0',
      steps: (w.steps || []).map(function (s) { return { id: s.id, name: s.name || s.id, type: s.type || 'noop', tool: s.tool, approverRole: s.approver_role, depends_on: s.depends_on }; }),
      triggers: w.triggers || [],
      createdAt: w.created_at, updatedAt: w.updated_at,
      runCountDemo: w.run_count || 0, successRateDemo: w.success_rate || 0,
      avgDurationMs: w.avg_duration_ms || 0, lastRunAt: w.last_run_at || null
    };
  }
  function mapRun(r) {
    return {
      runId: r.id || r.run_id, workflowId: r.workflow_id,
      status: r.status || 'running', trigger: r.trigger || r.idempotency_key || '',
      startedAt: r.started_at, durationMs: r.duration_ms || null,
      checkpointDone: r.checkpoint_done != null ? r.checkpoint_done : 0,
      checkpointTotal: r.checkpoint_total != null ? r.checkpoint_total : 0,
      currentStep: r.current_step || null, requestedBy: r.requested_by || '',
      error: r.error || null, steps: r.steps || [],
      state: r.state || {}, checkpoint_at: r.checkpoint_at || null,
      inputs: r.inputs || {}
    };
  }

  window.DEXTRA_WORKFLOW_API = {
    create: function (opts) {
      opts = opts || {};
      var instanceMode = opts.mode === 'demo' ? 'demo' : 'pending';
      var probePromise = null;
      var memory = null;
      function mem() { if (!memory) { if (!FIXTURES) throw new Error('Fixture DEMO Workflow tidak dimuat.'); memory = clone(FIXTURES); } return memory; }
      function probe() {
        if (probePromise) return probePromise;
        if (instanceMode === 'demo') { probePromise = Promise.resolve({ mode: 'demo', reason: 'Diminta eksplisit mode demo.' }); return probePromise; }
        probePromise = authed('GET', '/api/v1/workflows').then(function () { instanceMode = 'live'; return { mode: 'live', available: true }; })
          .catch(function (e) { instanceMode = 'demo'; return { mode: 'demo', available: false, reason: e && e.message }; });
        return probePromise;
      }
      function ensure() { return probe().then(function (p) { return p.mode; }); }
      function live() { return instanceMode === 'live'; }
      var api = { mode: instanceMode, probe: probe, _live: live, getMode: function () { return instanceMode; } };
      api.listWorkflows = function () {
        return ensure().then(function (m) {
          if (m === 'live') return authed('GET', '/api/v1/workflows').then(function (j) { return ((j && j.items) || j || []).map(mapWorkflow); });
          return clone(mem().workflows);
        });
      };
      api.getWorkflow = function (id) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('GET', '/api/v1/workflows/' + encodeURIComponent(id)).then(mapWorkflow);
          var found = mem().workflows.filter(function (x) { return x.id === id; })[0];
          if (!found) { var e = new Error('not found'); e.status = 404; return Promise.reject(e); }
          return clone(found);
        });
      };
      api.createWorkflow = function (body) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('POST', '/api/v1/workflows', body || {}).then(mapWorkflow);
          var wf = Object.assign({}, body || {}, { id: 'wf-demo-' + Date.now(), status: 'draft' });
          mem().workflows.push(wf);
          return Promise.resolve({ demo: true, persisted: false, workflow: clone(wf) });
        });
      };
      api.activateWorkflow = function (id) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('POST', '/api/v1/workflows/' + encodeURIComponent(id) + '/activate', {});
          var w = mem().workflows.filter(function (x) { return x.id === id; })[0];
          if (w) w.status = 'active';
          return Promise.resolve({ demo: true, persisted: false });
        });
      };
      api.listRuns = function (workflowId) {
        return ensure().then(function (m) {
          if (m === 'live') {
            var path = '/api/v1/workflows/runs' + (workflowId ? '?workflow_id=' + encodeURIComponent(workflowId) : '');
            return authed('GET', path).then(function (j) { return ((j && j.items) || j || []).map(mapRun); });
          }
          var runs = clone(mem().runs);
          if (workflowId) runs = runs.filter(function (r) { return r.workflowId === workflowId; });
          return Promise.resolve(runs);
        });
      };
      api.getRun = function (id) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('GET', '/api/v1/workflows/runs/' + encodeURIComponent(id)).then(mapRun);
          var found = mem().runs.filter(function (x) { return x.runId === id; })[0];
          if (!found) { var e = new Error('not found'); e.status = 404; return Promise.reject(e); }
          return Promise.resolve(clone(found));
        });
      };
      api.startRun = function (id, body) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('POST', '/api/v1/workflows/' + encodeURIComponent(id) + '/runs', body || {}).then(mapRun);
          var run = { runId: 'run-demo-' + Date.now(), workflowId: id, status: 'queued' };
          mem().runs.push(run);
          return Promise.resolve({ demo: true, persisted: false, run: clone(run) });
        });
      };
      api.approveGate = function (runId, stepId, body) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('POST', '/api/v1/workflows/runs/' + encodeURIComponent(runId) + '/gates/' + encodeURIComponent(stepId) + '/approve', body || {});
          return Promise.resolve({ demo: true, persisted: false });
        });
      };
      api.resumeRun = function (id) {
        return ensure().then(function (m) {
          if (m === 'live') return authed('POST', '/api/v1/workflows/runs/' + encodeURIComponent(id) + '/resume', {});
          var run = mem().runs.filter(function (x) { return x.runId === id; })[0];
          if (!run) { var e = new Error('not found'); e.status = 404; return Promise.reject(e); }
          run.status = 'completed';
          return Promise.resolve({ demo: true, persisted: false, run: clone(run) });
        });
      };
      api.retryRun = function (id) {
        return ensure().then(function (m) {
          if (m === 'live') {
            var e = new Error('Retry tidak ada endpoint-nya di router workflows (mulai ulang via POST /api/v1/workflows/{id}/runs); tidak dijalankan di live mode.');
            e.code = 'WORKFLOW_RETRY_UNAVAILABLE';
            return Promise.reject(e);
          }
          var run = mem().runs.filter(function (x) { return x.runId === id; })[0];
          if (!run) { var e2 = new Error('not found'); e2.status = 404; return Promise.reject(e2); }
          run.status = 'queued';
          return Promise.resolve({ demo: true, persisted: false, run: clone(run) });
        });
      };
      api.listCheckpoints = function (runId) {
        return ensure().then(function (m) {
          if (m === 'live') {
            var e = new Error('Endpoint checkpoints tidak tersedia di backend; tidak dijalankan di live mode.');
            e.code = 'WORKFLOW_CHECKPOINTS_UNAVAILABLE';
            return Promise.reject(e);
          }
          return Promise.resolve(clone(mem().checkpoints.filter(function (c) { return c.runId === runId; })));
        });
      };
      api.getTrace = function (runId) {
        return ensure().then(function (m) {
          if (m === 'live') {
            var e = new Error('Endpoint trace tidak tersedia di backend; tidak dijalankan di live mode.');
            e.code = 'WORKFLOW_TRACE_UNAVAILABLE';
            return Promise.reject(e);
          }
          var trace = mem().traces[runId];
          if (!trace) { var e = new Error('not found'); e.status = 404; return Promise.reject(e); }
          return Promise.resolve(clone(trace));
        });
      };
      api.listExpectedEndpoints = function () { return (CONTRACTS && CONTRACTS.EXPECTED_ENDPOINTS) ? CONTRACTS.EXPECTED_ENDPOINTS.slice() : []; };
      return api;
    }
  };
})();
