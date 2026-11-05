/* View — Skill Registry (live via /api/v1/skills, DEMO fallback).
 *
 * Mode ditentukan lewat probe() pada bridge skills. Bila probe menyatakan live,
 * seluruh data dan mutasi memakai backend nyata (`/api/v1/skills`); kegagalan
 * backend (mis. 409 INVALID_TRANSITION) dipancarkan dan ditampilkan ke user.
 * Bila backend tidak merespons, mode menjadi demo dan katalog/mutasi memakai
 * fixture dengan label jelas — fallback hanya untuk kasus backend belum hidup.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_SKILLS_API.create();
  var CONTRACTS = window.DEXTRA_SKILLS_CONTRACTS;

  var MODE = 'demo';
  function modeChip() { return '<span class="badge badge--' + (MODE === 'live' ? 'success' : 'outline') + ' ent-demo-chip">' + (MODE === 'live' ? 'LIVE' : 'DEMO') + '</span>'; }
  var LIFECYCLE_LABEL = { draft: 'Draft', review: 'Review', published: 'Published', deprecated: 'Deprecated', disabled: 'Disabled' };
  var LIFECYCLE_TONE = { draft: 'outline', review: 'warning', published: 'success', deprecated: 'danger', disabled: 'outline' };
  var RISK_TONE = { low: 'success', medium: 'warning', high: 'danger', critical: 'danger' };

  D.views.skills = function (root) {
    var state = {
      tab: 'katalog',
      loading: true,
      error: null,
      mode: 'demo',
      skills: [],
      query: '',
      domainFilter: 'all',
      lifecycleFilter: 'all',
      riskFilter: 'all',
      selectedId: null,
      pending: false
    };

    function load() {
      state.loading = true; state.error = null; paint();
      api.listSkills().then(function (list) {
        state.skills = list || [];
        if (state.selectedId && !state.skills.some(function (x) { return x.id === state.selectedId; })) state.selectedId = null;
        state.loading = false; paint();
      }).catch(function (err) {
        state.error = (err && err.message) || 'Gagal memuat katalog skill.';
        state.loading = false; paint();
      });
    }

    function boot() {
      state.loading = true; state.error = null; paint();
      api.probe().then(function (res) { MODE = res.mode; state.mode = res.mode; }).then(function () { return load(); });
    }

    function domains() {
      var out = [];
      state.skills.forEach(function (s) { if (out.indexOf(s.domain) < 0) out.push(s.domain); });
      return out.sort();
    }

    function filtered() {
      var q = state.query.trim().toLowerCase();
      return state.skills.filter(function (s) {
        if (state.domainFilter !== 'all' && s.domain !== state.domainFilter) return false;
        if (state.lifecycleFilter !== 'all' && s.lifecycle !== state.lifecycleFilter) return false;
        if (state.riskFilter !== 'all' && s.risk !== state.riskFilter) return false;
        if (!q) return true;
        return (s.name + ' ' + s.description + ' ' + s.domain + ' ' + (s.permissions || []).join(' ')).toLowerCase().indexOf(q) > -1;
      });
    }

    function openDetail(id) {
      state.selectedId = id;
      state.tab = 'detail';
      paint();
    }

    function openCreateDrawer() {
      ui.drawer({
        eyebrow: 'Skill Registry · ' + (MODE === 'live' ? 'LIVE' : 'DEMO'),
        title: 'Daftarkan skill baru',
        subtitle: MODE === 'live' ? 'Skill akan tercatat di backend.' : 'Demo lokal — tidak tercatat di backend',
        body:
          '<div class="stack" style="gap:12px">' +
            '<div class="field"><label class="field__label" for="sk-name">Nama (slug)<span class="req">*</span></label><input class="input mono" id="sk-name" placeholder="mis. meeting-to-action"></div>' +
            '<div class="field"><label class="field__label" for="sk-domain">Domain</label><input class="input" id="sk-domain" value="Produktivitas"></div>' +
            '<div class="field"><label class="field__label" for="sk-owner">Owner<span class="req">*</span></label><input class="input" id="sk-owner" placeholder="Tim Operasional"></div>' +
            '<div class="field"><label class="field__label" for="sk-desc">Deskripsi</label><textarea class="input" id="sk-desc" rows="3"></textarea></div>' +
            '<div class="field"><label class="field__label" for="sk-risk">Risiko</label><select class="select" id="sk-risk"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option><option value="critical">critical</option></select></div>' +
            '<div id="sk-create-result" aria-live="polite"></div>' +
          '</div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button><button class="btn btn--primary" id="sk-create-submit"><span class="material-symbols-outlined">add</span>' + (MODE === 'live' ? 'Daftarkan' : 'Daftarkan (demo)') + '</button>',
        onMount: function (node, ov) {
          node.querySelector('#sk-create-submit').addEventListener('click', function () {
            var btn = node.querySelector('#sk-create-submit');
            btn.disabled = true; btn.classList.add('is-loading');
            api.createSkill({
              slug: node.querySelector('#sk-name').value,
              name: node.querySelector('#sk-name').value,
              display_name: node.querySelector('#sk-name').value,
              domain: node.querySelector('#sk-domain').value,
              owner: node.querySelector('#sk-owner').value,
              description: node.querySelector('#sk-desc').value,
              risk: node.querySelector('#sk-risk').value
            }).then(function (r) {
              btn.disabled = false; btn.classList.remove('is-loading');
              ui.toast((r && r.message) || 'Skill terdaftarkan.', 'success');
              if (ov && ov.close) ov.close();
              load();
            }).catch(function (err) {
              btn.disabled = false; btn.classList.remove('is-loading');
              var msg = (err && err.problems && err.problems.length) ? err.problems.join(' ') : ((err && err.message) || 'Gagal mendaftarkan skill.');
              var res = node.querySelector('#sk-create-result');
              if (res) res.innerHTML = '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div>' + esc(msg) + '</div></div>';
            });
          });
        }
      });
    }

    function toggleLifecycle(id, next) {
      var s = state.skills.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      var action = next === 'active' ? api.enableSkill : api.disableSkill;
      var verb = next === 'active' ? 'Aktifkan' : 'Nonaktifkan';
      ui.confirm({
        title: verb + ' skill?',
        subtitle: MODE === 'live' ? 'Backend Skill Registry' : 'Demo lokal — tidak tercatat di backend',
        body: MODE === 'live'
          ? 'Skill <b>' + esc(s.name) + '</b> akan ditandai <b>' + esc(next) + '</b> di backend Skill Registry.'
          : 'Skill <b>' + esc(s.name) + '</b> akan ditandai <b>' + esc(next) + '</b> di tab ini. Mode demo: endpoint backend Skill Registry ada (router skills) tetapi probe gagal — aksi tidak dikirim ke server.',
        confirmLabel: MODE === 'live' ? verb : verb + ' (demo)',
        tone: next === 'active' ? 'primary' : 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        action(id).then(function (r) {
          state.pending = false;
          ui.toast(((r && r.message) || 'Status skill diubah.') + (MODE === 'live' ? ' Di backend.' : ' Di tab ini.'), MODE === 'live' ? 'success' : 'warning');
          load();
        }).catch(function (err) { state.pending = false; ui.toast((err && err.message) || 'Gagal mengubah status.', 'error'); paint(); });
      });
    }

    function openDetailDrawer(s) {
      var p = s.policy || {};
      var ts = s.testStatus || { status: 'never', passed: 0, total: 0, lastRun: null };
      var footer = '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
        (s.lifecycle === 'disabled'
          ? '<button class="btn btn--primary" id="sk-enable"><span class="material-symbols-outlined">play_circle</span>Aktifkan</button>'
          : '<button class="btn btn--danger-soft" id="sk-disable"><span class="material-symbols-outlined">pause_circle</span>Nonaktifkan</button>');
      ui.drawer({
        eyebrow: 'Skill · ' + (MODE === 'live' ? 'LIVE' : 'DEMO'),
        title: s.name,
        subtitle: s.domain + ' · v' + s.version,
        body:
          '<dl class="ent-kv">' +
            '<dt>ID</dt><dd class="mono">' + esc(s.id) + '</dd>' +
            '<dt>Lifecycle</dt><dd><span class="badge badge--' + (LIFECYCLE_TONE[s.lifecycle] || '') + '">' + esc(LIFECYCLE_LABEL[s.lifecycle] || s.lifecycle) + '</span></dd>' +
            '<dt>Status</dt><dd>' + esc(s.status) + '</dd>' +
            '<dt>Risiko</dt><dd><span class="badge badge--' + (RISK_TONE[s.risk] || '') + '">' + esc(s.risk) + '</span></dd>' +
            '<dt>Owner</dt><dd>' + esc(s.owner) + '</dd>' +
            '<dt>Versi</dt><dd class="mono">' + esc(s.version) + '</dd>' +
            '<dt>Pemakaian</dt><dd>' + esc(s.usage_count) + '</dd>' +
            '<dt>Uji terakhir</dt><dd>' + (ts.status === 'never' ? 'Belum pernah' : (ts.passed + '/' + ts.total + ' lulus')) + '</dd>' +
            '<dt>Izin</dt><dd><div class="ent-scope-list">' + (s.permissions || []).map(function (p) { return '<span class="badge badge--outline">' + esc(p) + '</span>'; }).join('') + '</div></dd>' +
            '<dt>Policy</dt><dd class="small">Review: ' + (p.reviewRequired ? 'wajib' : 'tidak') + ' · scope data: ' + esc(p.dataScope) + ' · retensi ' + esc(p.retentionDays) + ' hari · audit: ' + esc(p.auditLevel) + '</dd>' +
          '</dl>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Input schema</div><pre class="mono tiny" style="white-space:pre-wrap;margin:0">' + esc(JSON.stringify(s.inputSchema, null, 2)) + '</pre></div>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Output schema</div><pre class="mono tiny" style="white-space:pre-wrap;margin:0">' + esc(JSON.stringify(s.outputSchema, null, 2)) + '</pre></div>',
        footer: footer,
        onMount: function (node, ov) {
          var dis = node.querySelector('#sk-disable');
          if (dis) dis.addEventListener('click', function () { toggleLifecycle(state.selectedId, 'disabled'); });
          var en = node.querySelector('#sk-enable');
          if (en) en.addEventListener('click', function () { toggleLifecycle(state.selectedId, 'active'); });
        }
      });
    }

    function paint() {
      if (state.loading) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Intelligence · Skill Registry', title: 'Skill Registry', desc: MODE === 'live' ? 'Memuat katalog skill dari backend…' : 'Memuat katalog demo…' }) + ui.skeletonTable(5, 6);
        return;
      }
      if (state.error) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Intelligence · Skill Registry', title: 'Skill Registry' }) + ui.errorState(state.error, 'Muat ulang');
        var retry = root.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }

      var head = ui.pageHead({
        eyebrow: 'Intelligence · Skill Registry',
        title: 'Skill Registry',
        desc: MODE === 'live'
          ? 'Katalog skill, review, schema, dan policy dari backend Skill Registry.'
          : 'Katalog skill, review, schema, dan policy. Endpoint ada di backend v2 (router skills); mode ini demo karena probe gagal — seluruh isi halaman ini adalah contoh (DEMO).',
        actions: modeChip() + '<button class="btn btn--primary" id="sk-create"><span class="material-symbols-outlined">add</span>' + (MODE === 'live' ? 'Daftarkan' : 'Daftarkan (demo)') + '</button>'
      });

      var banner = '';
      if (MODE !== 'live') {
        banner = '<div class="banner banner--demo ent-banner"><span class="material-symbols-outlined">science</span>' +
          '<div><b>Data demo.</b> Endpoint Skill Registry ada di backend v2 (router skills, backend/dextra/main.py:67 — GET/POST /api/v1/skills, /{slug}, /{slug}/versions, /{slug}/status); mode ini demo karena probe gagal. Perubahan hanya berlaku pada tab ini dan tidak tercatat di mana pun. Tidak ada skill yang benar-benar dipublikasikan, diverifikasi, atau dijalankan.</div></div>';
      }

      var tabs = [['katalog', 'Katalog'], ['review', 'Review'], ['detail', 'Detail'], ['kontrak', 'Kontrak API']];
      var tabBar = '<div class="segmented ent-tabs" role="tablist" aria-label="Bagian skill registry">' +
        tabs.map(function (t) {
          return '<button role="tab" aria-selected="' + (state.tab === t[0] ? 'true' : 'false') + '" class="' + (state.tab === t[0] ? 'is-active' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';

      var panel = '';
      if (state.tab === 'katalog') {
        var rows = filtered();
        var domainList = domains();
        panel = ui.card({
          title: 'Katalog skill ' + modeChip(),
          flush: true,
          body:
            '<div class="ent-toolbar">' +
              '<div class="ent-search"><span class="material-symbols-outlined">search</span>' +
                '<input class="input" id="sk-q" placeholder="Cari nama, domain, izin…" value="' + esc(state.query) + '" aria-label="Cari skill"></div>' +
              '<div class="segmented" role="group" aria-label="Filter domain">' +
                [['all', 'Semua domain']].concat(domainList.map(function (d) { return [d, d]; })).map(function (f) {
                  return '<button class="' + (state.domainFilter === f[0] ? 'is-active' : '') + '" data-domain-filter="' + esc(f[0]) + '">' + esc(f[1]) + '</button>';
                }).join('') +
              '</div>' +
              '<div class="segmented" role="group" aria-label="Filter lifecycle">' +
                [['all', 'Semua'], ['draft', 'Draft'], ['review', 'Review'], ['published', 'Published'], ['deprecated', 'Deprecated'], ['disabled', 'Disabled']].map(function (f) {
                  return '<button class="' + (state.lifecycleFilter === f[0] ? 'is-active' : '') + '" data-lifecycle-filter="' + esc(f[0]) + '">' + esc(f[1]) + '</button>';
                }).join('') +
              '</div>' +
              '<div class="segmented" role="group" aria-label="Filter risiko">' +
                [['all', 'Semua risiko'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']].map(function (f) {
                  return '<button class="' + (state.riskFilter === f[0] ? 'is-active' : '') + '" data-risk-filter="' + esc(f[0]) + '">' + esc(f[1]) + '</button>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="table-wrap"><table class="table"><thead><tr><th>Skill</th><th>Domain</th><th>Versi</th><th>Lifecycle</th><th>Risiko</th><th>Owner</th><th>' + (state.mode === 'live' ? 'Pemakaian' : 'Pemakaian (DEMO)') + '</th></tr></thead><tbody>' +
              (rows.length ? rows.map(function (s) {
                return '<tr data-skill-id="' + esc(s.id) + '" class="is-clickable" tabindex="0" role="button" aria-label="Detail ' + esc(s.name) + '">' +
                  '<td><div class="small strong">' + esc(s.name) + '</div><div class="tiny muted">' + esc(s.description) + '</div></td>' +
                    '<td class="small">' + esc(s.domain) + '</td>' +
                    '<td class="mono tiny">' + esc(s.version) + '</td>' +
                    '<td><span class="badge badge--' + (LIFECYCLE_TONE[s.lifecycle] || '') + '">' + esc(LIFECYCLE_LABEL[s.lifecycle] || s.lifecycle) + '</span></td>' +
                    '<td><span class="badge badge--' + (RISK_TONE[s.risk] || '') + '">' + esc(s.risk) + '</span></td>' +
                    '<td class="small">' + esc(s.owner) + '</td>' +
                    '<td class="num">' + esc(s.usage_count) + '</td></tr>';
              }).join('') : '<tr><td colspan="7">' + ui.empty({ title: 'Tidak ada skill cocok', body: 'Ubah kata kunci atau filter.', icon: 'search_off' }) + '</td></tr>') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">' + rows.length + ' dari ' + state.skills.length + ' skill ditampilkan · klik baris untuk detail.</div>'
        });
      } else if (state.tab === 'review') {
        var pending = state.skills.filter(function (s) { return s.lifecycle === 'review'; });
        panel = ui.card({
          title: 'Antrean review ' + modeChip(),
          body: pending.length ? pending.map(function (s) {
            var c = s.reviewChecklist || {};
            return ui.card({
              title: esc(s.name) + ' ' + modeChip(),
              desc: 'v' + esc(s.version) + ' · ' + esc(s.domain) + ' · owner ' + esc(s.owner),
              body:
                '<div class="row" style="gap:10px;flex-wrap:wrap;margin-bottom:8px">' +
                  '<span class="badge ' + (c.schemaValid ? 'badge--success' : 'badge--danger') + '">Schema ' + (c.schemaValid ? 'valid' : 'invalid') + '</span>' +
                  '<span class="badge ' + (c.policySet ? 'badge--success' : 'badge--danger') + '">Policy ' + (c.policySet ? 'set' : 'belum') + '</span>' +
                  '<span class="badge ' + (c.testsPassed ? 'badge--success' : 'badge--warning') + '">Uji ' + (c.testsPassed ? 'lulus' : 'gagal/belum') + '</span>' +
                  '<span class="badge ' + (c.ownerAssigned ? 'badge--success' : 'badge--danger') + '">Owner ' + (c.ownerAssigned ? 'ada' : 'belum') + '</span>' +
                '</div>' +
                '<p class="small muted">Persetujuan memjalan status lewat endpoint backend Skill Registry.</p>',
              foot: '<button class="btn btn--secondary btn--sm" data-skill-detail="' + esc(s.id) + '"><span class="material-symbols-outlined">visibility</span>Detail</button>' +
                '<button class="btn btn--primary btn--sm" data-skill-approve="' + esc(s.id) + '"><span class="material-symbols-outlined">check</span>Setujui</button>' +
                '<button class="btn btn--danger-soft btn--sm" data-skill-reject="' + esc(s.id) + '"><span class="material-symbols-outlined">close</span>Tolak</button>'
            });
          }).join('') : ui.empty({ title: 'Tidak ada skill menunggu review', body: 'Semua skill published, draft, deprecated, atau disabled.', icon: 'fact_check' }),
        });
      } else if (state.tab === 'detail') {
        if (!state.selectedId) {
          panel = ui.card({ title: 'Detail ' + modeChip(), body: '<p class="small muted">Pilih skill dari tab Katalog.</p>' });
        } else {
          var sel = state.skills.filter(function (x) { return x.id === state.selectedId; })[0];
          if (!sel) {
            panel = ui.card({ title: 'Detail ' + modeChip(), body: '<p class="small muted">Skill tidak ditemukan.</p>' });
          } else {
            panel = ui.card({
              title: esc(sel.name) + ' ' + modeChip(),
              desc: esc(sel.description),
              body:
                '<dl class="ent-kv">' +
                  '<dt>ID</dt><dd class="mono">' + esc(sel.id) + '</dd>' +
                  '<dt>Domain</dt><dd>' + esc(sel.domain) + '</dd>' +
                  '<dt>Versi</dt><dd class="mono">' + esc(sel.version) + '</dd>' +
                  '<dt>Lifecycle</dt><dd><span class="badge badge--' + (LIFECYCLE_TONE[sel.lifecycle] || '') + '">' + esc(LIFECYCLE_LABEL[sel.lifecycle] || sel.lifecycle) + '</span></dd>' +
                  '<dt>Owner</dt><dd>' + esc(sel.owner) + '</dd>' +
                  '<dt>Pemakaian</dt><dd>' + esc(sel.usage_count) + '</dd>' +
                  '<dt>Izin</dt><dd><div class="ent-scope-list">' + (sel.permissions || []).map(function (p) { return '<span class="badge badge--outline">' + esc(p) + '</span>'; }).join('') + '</div></dd>' +
                '</dl>' +
                '<div style="margin-top:14px"><button class="btn btn--secondary btn--sm" id="sk-open-drawer"><span class="material-symbols-outlined">visibility</span>Buka laci detail</button></div>',
              foot: (sel.lifecycle === 'disabled'
                ? '<button class="btn btn--primary" id="sk-enable"><span class="material-symbols-outlined">play_circle</span>Aktifkan</button>'
                : '<button class="btn btn--danger-soft" id="sk-disable"><span class="material-symbols-outlined">pause_circle</span>Nonaktifkan</button>')
            });
          }
        }
      } else if (state.tab === 'kontrak') {
        panel = ui.card({
          title: 'Kontrak backend Skill Registry ' + modeChip(),
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

      root.innerHTML = head + banner + tabBar + '<div id="sk-tab-panel">' + panel + '</div>';

      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); paint(); });
      });
      root.querySelectorAll('[data-domain-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.domainFilter = b.getAttribute('data-domain-filter'); paint(); });
      });
      root.querySelectorAll('[data-lifecycle-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.lifecycleFilter = b.getAttribute('data-lifecycle-filter'); paint(); });
      });
      root.querySelectorAll('[data-risk-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.riskFilter = b.getAttribute('data-risk-filter'); paint(); });
      });
      var q = root.querySelector('#sk-q');
      if (q) q.addEventListener('input', U.debounce(function () { state.query = q.value; paint(); var nq = root.querySelector('#sk-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 180));
      root.querySelectorAll('[data-skill-id]').forEach(function (rowEl) {
        var open = function () {
          var id = rowEl.getAttribute('data-skill-id');
          var s = state.skills.filter(function (x) { return x.id === id; })[0];
          if (s) openDetailDrawer(s);
        };
        rowEl.addEventListener('click', open);
        rowEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      root.querySelectorAll('[data-skill-detail]').forEach(function (b) {
        b.addEventListener('click', function () {
          var s = state.skills.filter(function (x) { return x.id === b.getAttribute('data-skill-detail'); })[0];
          if (s) openDetailDrawer(s);
        });
      });
      root.querySelectorAll('[data-skill-approve]').forEach(function (b) {
        b.addEventListener('click', function () {
          var s = state.skills.filter(function (x) { return x.id === b.getAttribute('data-skill-approve'); })[0];
          if (!s) return;
          state.pending = true; paint();
          api.setStatus(s.id, 'active').then(function (r) {
            state.pending = false;
            ui.toast((r && r.message) || 'Skill ditandai aktif di backend.', 'success');
            load();
          }).catch(function (err) { state.pending = false; ui.toast((err && err.message) || 'Gagal menyetujui skill.', 'error'); paint(); });
        });
      });
      root.querySelectorAll('[data-skill-reject]').forEach(function (b) {
        b.addEventListener('click', function () {
          var s = state.skills.filter(function (x) { return x.id === b.getAttribute('data-skill-reject'); })[0];
          if (!s) return;
          state.pending = true; paint();
          api.setStatus(s.id, 'draft').then(function (r) {
            state.pending = false;
            ui.toast((r && r.message) || 'Skill dikembalikan ke draft di backend.', 'success');
            load();
          }).catch(function (err) { state.pending = false; ui.toast((err && err.message) || 'Gagal menolak skill.', 'error'); paint(); });
        });
      });
      var createBtn = root.querySelector('#sk-create');
      if (createBtn) createBtn.addEventListener('click', openCreateDrawer);
      var detailBtn = root.querySelector('#sk-open-drawer');
      if (detailBtn && state.selectedId) detailBtn.addEventListener('click', function () {
        var s = state.skills.filter(function (x) { return x.id === state.selectedId; })[0];
        if (s) openDetailDrawer(s);
      });
      var enableBtn = root.querySelector('#sk-enable');
      if (enableBtn && state.selectedId) enableBtn.addEventListener('click', function () { toggleLifecycle(state.selectedId, 'active'); });
      var disableBtn = root.querySelector('#sk-disable');
      if (disableBtn && state.selectedId) disableBtn.addEventListener('click', function () { toggleLifecycle(state.selectedId, 'disabled'); });
    }

    boot();
  };
})();
