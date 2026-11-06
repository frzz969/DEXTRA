/* View — Workflow Orchestration (deferred module).
 *
 * Endpoint workflow ada di backend v2: router workflows
 * (backend/dextra/modules/workflows/router.py, didaftarkan di
 * backend/dextra/main.py:67) — GET/POST /api/v1/workflows, /{id}/activate,
 * /{id}/runs, /runs, /runs/{id}/gates/{step_id}/approve, /runs/{id}/resume.
 * Jembatan workflow/api.js probe-aware: live bila GET /api/v1/workflows
 * berhasil, demo (fixture in-memory berlabel DEMO) bila backend tak tercapai.
 * Mutasi demo hanya berlaku pada tab ini dan tidak tercatat di server.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_WORKFLOW_API.create();
  api.probe().then(function () { if (typeof load === 'function') load(); });
  var CONTRACTS = window.DEXTRA_WORKFLOW_CONTRACTS;

  function demoChip() { return '<span class="badge badge--outline ent-demo-chip">DEMO</span>'; }
  var STATUS_LABEL = { active: 'Aktif', draft: 'Draft', paused: 'Dijeda', failed: 'Gagal', deprecated: 'Deprecated' };
  var STATUS_TONE = { active: 'success', draft: 'outline', paused: 'warning', failed: 'danger', deprecated: 'danger' };
  var RUN_LABEL = { queued: 'Antre', running: 'Berjalan', waiting_approval: 'Menunggu approval', completed: 'Selesai', failed: 'Gagal', cancelled: 'Dibatalkan' };
  var RUN_TONE = { queued: 'outline', running: 'brand', waiting_approval: 'warning', completed: 'success', failed: 'danger', cancelled: 'outline' };
  var STEP_ICON = { agent: 'smart_toy', human_approval: 'verified_user', tool: 'build', condition: 'rule', checkpoint: 'flag' };

  D.views.workflow = function (root) {
    var state = {
      tab: 'katalog',
      loading: true,
      error: null,
      workflows: [],
      runs: [],
      checkpoints: [],
      approvalGates: [],
      selectedId: null,
      selectedRunId: null,
      query: '',
      statusFilter: 'all',
      domainFilter: 'all',
      pending: false
    };

    function load() {
      state.loading = true; state.error = null; paint();
      Promise.all([api.listWorkflows(), api.listRuns()]).then(function (res) {
        state.workflows = res[0] || [];
        state.runs = res[1] || [];
        if (state.selectedId && !state.workflows.some(function (x) { return x.id === state.selectedId; })) state.selectedId = null;
        state.loading = false; paint();
      }).catch(function (err) {
        state.error = (err && err.message) || 'Gagal memuat workflow (demo).';
        state.loading = false; paint();
      });
    }

    function domains() {
      var out = [];
      state.workflows.forEach(function (w) { if (out.indexOf(w.domain) < 0) out.push(w.domain); });
      return out.sort();
    }

    function filteredWorkflows() {
      var q = state.query.trim().toLowerCase();
      return state.workflows.filter(function (w) {
        if (state.statusFilter !== 'all' && w.status !== state.statusFilter) return false;
        if (state.domainFilter !== 'all' && w.domain !== state.domainFilter) return false;
        if (!q) return true;
        return (w.name + ' ' + w.description + ' ' + w.domain + ' ' + w.owner + ' ' + (w.triggers || []).join(' ')).toLowerCase().indexOf(q) > -1;
      });
    }

    function runsForSelected() {
      if (!state.selectedId) return [];
      return state.runs.filter(function (r) { return r.workflowId === state.selectedId; });
    }

    function openRunDrawer(run) {
      state.selectedRunId = run.runId;
      api.getTrace(run.runId).then(function (trace) {
        ui.drawer({
          eyebrow: 'Run workflow · DEMO',
          title: run.runId,
          subtitle: run.status,
          body:
            '<dl class="ent-kv">' +
              '<dt>Workflow</dt><dd>' + esc(run.workflowId) + '</dd>' +
              '<dt>Status</dt><dd><span class="badge badge--' + (RUN_TONE[run.status] || '') + '">' + esc(RUN_LABEL[run.status] || run.status) + '</span></dd>' +
              '<dt>Pemicu</dt><dd>' + esc(run.trigger) + '</dd>' +
              '<dt>Dimulai</dt><dd>' + esc(run.startedAt ? U.fmtDate(run.startedAt) : '—') + '</dd>' +
              '<dt>Durasi (DEMO)</dt><dd>' + esc(run.durationMs ? Math.round(run.durationMs / 1000) + ' dtk' : '—') + '</dd>' +
              '<dt>Langkah saat ini</dt><dd class="mono">' + esc(run.currentStep || '—') + '</dd>' +
              '<dt>Checkpoint</dt><dd>' + esc(run.checkpointDone + '/' + run.checkpointTotal) + '</dd>' +
              '<dt>Diminta oleh</dt><dd>' + esc(run.requestedBy) + '</dd>' +
              (run.error ? '<dt>Error (DEMO)</dt><dd class="small">' + esc(run.error) + '</dd>' : '') +
            '</dl>' +
            '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Linimasa eksekusi</div>' +
              '<div class="stack" style="gap:8px">' + (trace || []).map(function (t) {
                return '<div class="ent-status-line"><span class="material-symbols-outlined" style="color:var(--' + (t.status === 'ok' ? 'success' : (t.status === 'error' ? 'danger' : 'warning')) + '-600)">' + (t.status === 'ok' ? 'check_circle' : (t.status === 'error' ? 'error' : 'schedule')) + '</span>' +
                  '<span><b>' + esc(t.stepId) + '</b> · ' + esc(t.type) + ' · ' + esc(t.message) + (t.durationMs ? ' (' + Math.round(t.durationMs / 1000) + ' dtk)' : '') + '</span></div>';
              }).join('') + '</div></div>',
          footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
            (run.status === 'failed' ? '<button class="btn btn--primary" id="wf-retry"><span class="material-symbols-outlined">replay</span>Ulangi (demo)</button>' : '') +
            (run.status === 'waiting_approval' ? '<button class="btn btn--primary" id="wf-resume"><span class="material-symbols-outlined">play_arrow</span>Lanjutkan (demo)</button>' : '')
        });
        setTimeout(function () {
          var retry = document.querySelector('#wf-retry');
          if (retry) retry.addEventListener('click', function () { api.retryRun(run.runId).then(function (r) { ui.toast(r.message + ' — run diubah ke antre (demo).', 'warning'); load(); }); });
          var resume = document.querySelector('#wf-resume');
          if (resume) resume.addEventListener('click', function () { api.resumeRun(run.runId).then(function (r) { ui.toast(r.message + ' — run ditandai selesai (demo).', 'warning'); load(); }); });
        }, 0);
      }).catch(function (err) { ui.toast(err.message || 'Gagal memuat trace.', 'error'); });
    }

    function openDetailDrawer(w) {
      var rows = state.runs.filter(function (r) { return r.workflowId === w.id; });
      ui.drawer({
        eyebrow: 'Workflow · DEMO',
        title: w.name,
        subtitle: w.domain + ' · v' + w.version,
        body:
          '<dl class="ent-kv">' +
            '<dt>ID</dt><dd class="mono">' + esc(w.id) + '</dd>' +
            '<dt>Status</dt><dd><span class="badge badge--' + (STATUS_TONE[w.status] || '') + '">' + esc(STATUS_LABEL[w.status] || w.status) + '</span></dd>' +
            '<dt>Risiko</dt><dd>' + esc(w.risk) + '</dd>' +
            '<dt>Owner</dt><dd>' + esc(w.owner) + '</dd>' +
            '<dt>Pemicu</dt><dd>' + esc((w.triggers || []).join(', ')) + '</dd>' +
            '<dt>Durasi rata-rata (DEMO)</dt><dd>' + esc(w.avgDurationMs ? Math.round(w.avgDurationMs / 1000) + ' dtk' : '—') + '</dd>' +
            '<dt>Success rate (DEMO)</dt><dd>' + esc(w.successRateDemo == null ? '—' : w.successRateDemo + '%') + '</dd>' +
            '<dt>Jumlah run (DEMO)</dt><dd>' + esc(w.runCountDemo) + '</dd>' +
            '<dt>Pembaruan</dt><dd>' + esc(U.fmtDate(w.updatedAt)) + '</dd>' +
          '</dl>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Langkah</div>' +
            '<ol class="ent-stepper">' + (w.steps || []).map(function (s, i) {
              return '<li><span class="ent-stepper__icon"><span class="material-symbols-outlined">' + (STEP_ICON[s.type] || 'circle') + '</span></span>' +
                '<div><div class="small strong">' + esc(s.name) + '</div>' +
                '<div class="tiny muted">' + esc(s.type) + (s.tool ? ' · ' + esc(s.tool) : '') + (s.approverRole ? ' · approver ' + esc(s.approverRole) : '') + (s.condition ? ' · kondisi ' + esc(s.condition) : '') + '</div></div></li>';
            }).join('') + '</ol></div>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Run terkait (DEMO)</div>' +
            (rows.length ? rows.map(function (r) {
              return '<button class="btn btn--secondary btn--sm" data-run-id="' + esc(r.runId) + '" style="margin:2px"><span class="material-symbols-outlined">play_circle</span>' + esc(r.runId) + ' · ' + esc(RUN_LABEL[r.status] || r.status) + '</button>';
            }).join(' ') : '<p class="tiny muted">Belum ada run pada fixture.</p>') + '</div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>'
      });
      setTimeout(function () {
        document.querySelectorAll('[data-run-id]').forEach(function (b) {
          b.addEventListener('click', function () {
            var r = state.runs.filter(function (x) { return x.runId === b.getAttribute('data-run-id'); })[0];
            if (r) openRunDrawer(r);
          });
        });
      }, 0);
    }

    function paint() {
      if (state.loading) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Intelligence · Workflow Orchestration', title: 'Workflow Orchestration', desc: 'Memuat katalog demo…' }) + ui.skeletonTable(5, 6);
        return;
      }
      if (state.error) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Intelligence · Workflow Orchestration', title: 'Workflow Orchestration' }) + ui.errorState(state.error, 'Muat ulang');
        var retry = root.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }

      var head = ui.pageHead({
        eyebrow: 'Intelligence · Workflow Orchestration',
        title: 'Workflow Orchestration',
        desc: 'Katalog workflow, definisi langkah, run, checkpoint, dan approval gate. Endpoint ada di backend v2 (router workflows); halaman ini berlabel DEMO bila backend tak tercapai — seluruh isi adalah contoh (DEMO).',
        actions: demoChip()
      });

      var banner = '<div class="banner banner--demo ent-banner"><span class="material-symbols-outlined">science</span>' +
        '<div><b>Data demo.</b> Endpoint workflow ada di backend v2 (router workflows, backend/dextra/main.py:67); mode ini demo karena probe gagal. Tiap angka (success rate, durasi, jumlah run) adalah contoh. Mutasi hanya berlaku pada tab ini dan tidak tercatat di mana pun.</div></div>';

      var tabs = [['katalog', 'Katalog'], ['detail', 'Detail'], ['runs', 'Runs'], ['kontrak', 'Kontrak API']];
      var tabBar = '<div class="segmented ent-tabs" role="tablist" aria-label="Bagian workflow orchestration">' +
        tabs.map(function (t) {
          return '<button role="tab" aria-selected="' + (state.tab === t[0] ? 'true' : 'false') + '" class="' + (state.tab === t[0] ? 'is-active' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';

      var panel = '';
      if (state.tab === 'katalog') {
        var rows = filteredWorkflows();
        var domainList = domains();
        panel = ui.card({
          title: 'Katalog workflow ' + demoChip(),
          flush: true,
          body:
            '<div class="ent-toolbar">' +
              '<div class="ent-search"><span class="material-symbols-outlined">search</span>' +
                '<input class="input" id="wf-q" placeholder="Cari nama, domain, owner…" value="' + esc(state.query) + '" aria-label="Cari workflow"></div>' +
              '<div class="segmented" role="group" aria-label="Filter status">' +
                [['all', 'Semua'], ['active', 'Aktif'], ['draft', 'Draft'], ['paused', 'Dijeda'], ['failed', 'Gagal'], ['deprecated', 'Deprecated']].map(function (f) {
                  return '<button class="' + (state.statusFilter === f[0] ? 'is-active' : '') + '" data-status-filter="' + f[0] + '">' + esc(f[1]) + '</button>';
                }).join('') +
              '</div>' +
              '<div class="segmented" role="group" aria-label="Filter domain">' +
                [['all', 'Semua domain']].concat(domainList.map(function (d) { return [d, d]; })).map(function (f) {
                  return '<button class="' + (state.domainFilter === f[0] ? 'is-active' : '') + '" data-domain-filter="' + esc(f[0]) + '">' + esc(f[1]) + '</button>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="table-wrap"><table class="table"><thead><tr><th>Workflow</th><th>Domain</th><th>Versi</th><th>Status</th><th>Risiko</th><th>Owner</th><th>Run (DEMO)</th><th>Success (DEMO)</th></tr></thead><tbody>' +
              (rows.length ? rows.map(function (w) {
                return '<tr data-wf-id="' + esc(w.id) + '" class="is-clickable" tabindex="0" role="button" aria-label="Detail ' + esc(w.name) + '">' +
                  '<td><div class="small strong">' + esc(w.name) + '</div><div class="tiny muted">' + esc(w.description) + '</div></td>' +
                  '<td class="small">' + esc(w.domain) + '</td>' +
                  '<td class="mono tiny">' + esc(w.version) + '</td>' +
                  '<td><span class="badge badge--' + (STATUS_TONE[w.status] || '') + '">' + esc(STATUS_LABEL[w.status] || w.status) + '</span></td>' +
                  '<td><span class="badge badge--' + (w.risk === 'high' ? 'danger' : (w.risk === 'medium' ? 'warning' : 'success')) + '">' + esc(w.risk) + '</span></td>' +
                  '<td class="small">' + esc(w.owner) + '</td>' +
                  '<td class="num">' + esc(w.runCountDemo) + '</td>' +
                  '<td class="num">' + esc(w.successRateDemo == null ? '—' : w.successRateDemo + '%') + '</td></tr>';
              }).join('') : '<tr><td colspan="8">' + ui.empty({ title: 'Tidak ada workflow cocok', body: 'Ubah kata kunci atau filter.', icon: 'search_off' }) + '</td></tr>') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">' + rows.length + ' dari ' + state.workflows.length + ' workflow ditampilkan · klik baris untuk detail.</div>'
        });
      } else if (state.tab === 'detail') {
        if (!state.selectedId) {
          panel = ui.card({ title: 'Detail ' + demoChip(), body: '<p class="small muted">Pilih workflow dari tab Katalog.</p>' });
        } else {
          var sel = state.workflows.filter(function (x) { return x.id === state.selectedId; })[0];
          if (!sel) {
            panel = ui.card({ title: 'Detail ' + demoChip(), body: '<p class="small muted">Workflow tidak ditemukan di fixture demo.</p>' });
          } else {
            panel = ui.card({
              title: esc(sel.name) + ' ' + demoChip(),
              desc: esc(sel.description),
              body:
                '<dl class="ent-kv">' +
                  '<dt>ID</dt><dd class="mono">' + esc(sel.id) + '</dd>' +
                  '<dt>Domain</dt><dd>' + esc(sel.domain) + '</dd>' +
                  '<dt>Versi</dt><dd class="mono">' + esc(sel.version) + '</dd>' +
                  '<dt>Status</dt><dd><span class="badge badge--' + (STATUS_TONE[sel.status] || '') + '">' + esc(STATUS_LABEL[sel.status] || sel.status) + '</span></dd>' +
                  '<dt>Risiko</dt><dd>' + esc(sel.risk) + '</dd>' +
                  '<dt>Owner</dt><dd>' + esc(sel.owner) + '</dd>' +
                  '<dt>Pemicu</dt><dd>' + esc((sel.triggers || []).join(', ')) + '</dd>' +
                  '<dt>Run terakhir (DEMO)</dt><dd>' + esc(sel.lastRunAt ? U.fmtDate(sel.lastRunAt) : '—') + '</dd>' +
                '</dl>' +
                '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Langkah</div>' +
                  '<ol class="ent-stepper">' + (sel.steps || []).map(function (s) {
                    return '<li><span class="ent-stepper__icon"><span class="material-symbols-outlined">' + (STEP_ICON[s.type] || 'circle') + '</span></span>' +
                      '<div><div class="small strong">' + esc(s.name) + '</div>' +
                      '<div class="tiny muted">' + esc(s.type) + (s.tool ? ' · ' + esc(s.tool) : '') + (s.approverRole ? ' · approver ' + esc(s.approverRole) : '') + (s.condition ? ' · kondisi ' + esc(s.condition) : '') + (s.optional ? ' · opsional' : '') + '</div></div></li>';
                  }).join('') + '</ol></div>' +
                '<div style="margin-top:14px"><button class="btn btn--secondary btn--sm" id="wf-open-drawer"><span class="material-symbols-outlined">visibility</span>Buka laci detail</button></div>',
              foot: '<button class="btn btn--secondary" data-dismiss>Tutup</button>'
            });
          }
        }
      } else if (state.tab === 'runs') {
        var runRows = (state.selectedId ? runsForSelected() : state.runs);
        panel = ui.card({
          title: (state.selectedId ? 'Run untuk workflow terpilih ' : 'Riwayat run ') + demoChip(),
          flush: true,
          body:
            '<div class="table-wrap"><table class="table"><thead><tr><th>Run ID</th><th>Workflow</th><th>Status</th><th>Pemicu</th><th>Mulai</th><th>Durasi (DEMO)</th><th>Checkpoint</th><th class="num">Aksi</th></tr></thead><tbody>' +
              (runRows.length ? runRows.map(function (r) {
                return '<tr><td class="mono tiny">' + esc(r.runId) + '</td>' +
                  '<td class="small">' + esc(r.workflowId) + '</td>' +
                  '<td><span class="badge badge--' + (RUN_TONE[r.status] || '') + '">' + esc(RUN_LABEL[r.status] || r.status) + '</span></td>' +
                  '<td class="small">' + esc(r.trigger) + '</td>' +
                  '<td class="small">' + esc(r.startedAt ? U.fmtDay(r.startedAt) : '—') + '</td>' +
                  '<td class="small">' + esc(r.durationMs ? Math.round(r.durationMs / 1000) + ' dtk' : '—') + '</td>' +
                  '<td class="small">' + esc(r.checkpointDone + '/' + r.checkpointTotal) + '</td>' +
                  '<td class="num"><button class="btn btn--secondary btn--sm" data-run-id="' + esc(r.runId) + '"><span class="material-symbols-outlined">visibility</span>Detail</button>' +
                    (r.status === 'failed' ? ' <button class="btn btn--primary btn--sm" data-retry-run="' + esc(r.runId) + '"><span class="material-symbols-outlined">replay</span>Ulangi</button>' : '') +
                    (r.status === 'waiting_approval' ? ' <button class="btn btn--primary btn--sm" data-resume-run="' + esc(r.runId) + '"><span class="material-symbols-outlined">play_arrow</span>Lanjutkan</button>' : '') +
                  '</td></tr>';
              }).join('') : '<tr><td colspan="8">' + ui.empty({ title: 'Belum ada run', body: 'Riwayat run fixture kosong atau filter workflow belum dipilih.', icon: 'history' }) + '</td></tr>') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">' + runRows.length + ' run ditampilkan · aksi hanya mengubah tab ini (demo).</div>'
        });
      } else if (state.tab === 'kontrak') {
        panel = ui.card({
          title: 'Kontrak backend Workflow ' + demoChip(),
          flush: true,
          body:
            '<div class="table-wrap"><table class="table"><thead><tr><th>Metode</th><th>Path</th><th>Auth</th><th>Status</th><th>Dipakai untuk</th></tr></thead><tbody>' +
              (CONTRACTS && CONTRACTS.EXPECTED_ENDPOINTS ? CONTRACTS.EXPECTED_ENDPOINTS.map(function (e) {
                return '<tr><td class="mono small">' + esc(e.method) + '</td><td class="mono small">' + esc(e.path) + '</td>' +
                  '<td class="tiny">' + esc(e.auth) + '</td><td><span class="badge badge--danger">missing</span></td>' +
                  '<td class="small">' + esc(e.ui) + '</td></tr>';
              }).join('') : '<tr><td colspan="5">' + ui.empty({ title: 'Kontrak tidak dimuat', body: 'Berkas contracts.js tidak tersedia.', icon: 'description' }) + '</td></tr>') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">Semua item berstatus missing. Tidak ada URL yang dipanggil dari layar ini.</div>'
        });
      }

      root.innerHTML = head + banner + tabBar + '<div id="wf-tab-panel">' + panel + '</div>';

      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); paint(); });
      });
      root.querySelectorAll('[data-status-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.statusFilter = b.getAttribute('data-status-filter'); paint(); });
      });
      root.querySelectorAll('[data-domain-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.domainFilter = b.getAttribute('data-domain-filter'); paint(); });
      });
      var q = root.querySelector('#wf-q');
      if (q) q.addEventListener('input', U.debounce(function () { state.query = q.value; paint(); var nq = root.querySelector('#wf-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 180));
      root.querySelectorAll('[data-wf-id]').forEach(function (rowEl) {
        var open = function () {
          var id = rowEl.getAttribute('data-wf-id');
          var w = state.workflows.filter(function (x) { return x.id === id; })[0];
          if (w) { state.selectedId = id; openDetailDrawer(w); }
        };
        rowEl.addEventListener('click', open);
        rowEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      root.querySelectorAll('[data-run-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          var r = state.runs.filter(function (x) { return x.runId === b.getAttribute('data-run-id'); })[0];
          if (r) openRunDrawer(r);
        });
      });
      root.querySelectorAll('[data-retry-run]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-retry-run');
          state.pending = true; paint();
          api.retryRun(id).then(function (r) {
            state.pending = false;
            ui.toast(r.message + ' — run diubah ke antre (demo).', 'warning');
            load();
          }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal mengulang run.', 'error'); paint(); });
        });
      });
      root.querySelectorAll('[data-resume-run]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-resume-run');
          state.pending = true; paint();
          api.resumeRun(id).then(function (r) {
            state.pending = false;
            ui.toast(r.message + ' — run ditandai selesai (demo).', 'warning');
            load();
          }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal melanjutkan run.', 'error'); paint(); });
        });
      });
      var detailBtn = root.querySelector('#wf-open-drawer');
      if (detailBtn && state.selectedId) detailBtn.addEventListener('click', function () {
        var w = state.workflows.filter(function (x) { return x.id === state.selectedId; })[0];
        if (w) openDetailDrawer(w);
      });
    }

    load();
  };
})();
