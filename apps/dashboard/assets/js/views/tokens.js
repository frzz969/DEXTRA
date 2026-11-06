/* View — API Tokens (P10, live-first).
 *
 * Live: GET/POST /api/v1/tokens, POST /api/v1/tokens/{id}/revoke|rotate via
 * enterprise/api.js (window.DEXTRA.api.rest). Scope+expiry berasal dari backend.
 * Secret (token) hanya tampil sekali dari respons 201/rotate; tidak pernah
 * disimpan di store/localStorage. Demo: fixture in-memory, label DEMO jelas.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_ENTERPRISE_API.create({});

  function demoChip() { return '<span class="badge badge--outline ent-demo-chip">DEMO</span>'; }
  function liveChip() { return '<span class="badge badge--success ent-live-chip">LIVE</span>'; }
  function modeChip() { return (api.isLive ? api.isLive() : false) ? liveChip() : demoChip(); }
  var ISSUABLE_SCOPES = ['view_all', 'view_own', 'view_audit', 'create_request', 'approve', 'execute', 'manage_integrations', 'manage_users', 'export_audit', 'manage_tokens'];

  var STATUS_LABEL = { active: 'Aktif', expired: 'Kedaluwarsa', expiring: 'Kedaluwarsa', revoked: 'Dicabut' };
  var STATUS_TONE = { active: 'success', expired: 'warning', expiring: 'warning', revoked: 'danger' };

  function expiryInfo(t) {
    if (!t.expiresAt) return 'Tanpa batas';
    var d = new Date(t.expiresAt).getTime() - Date.now();
    if (d < 0) return 'Kedaluwarsa ' + U.fmtDay(t.expiresAt);
    if (d < 30 * 24 * 3600 * 1000) return 'Segera: ' + U.fmtDay(t.expiresAt);
    return U.fmtDay(t.expiresAt);
  }

  function copyText(text, okMsg) {
    var done = function () { ui.toast(okMsg, 'success'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { ui.toast('Gagal menyalin ke papan klip.', 'error'); }
      ta.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  D.views.tokens = function (root) {
    var state = {
      loading: true,
      error: null,
      tokens: [],
      query: '',
      statusFilter: 'all',
      pending: false,
      reveal: null
    };

    function load() {
      state.loading = true; state.error = null; paint();
      api.listTokens().then(function (list) {
        state.tokens = list || [];
        state.loading = false; paint();
      }).catch(function (err) {
        state.error = (err && err.message) || 'Gagal memuat inventaris token (demo).';
        state.loading = false; paint();
      });
    }

    function filtered() {
      var q = state.query.trim().toLowerCase();
      return state.tokens.filter(function (t) {
        if (state.statusFilter !== 'all' && t.status !== state.statusFilter) return false;
        if (!q) return true;
        return (t.name + ' ' + t.prefix + ' ' + (t.scopes || []).join(' ') + ' ' + (t.createdBy || '')).toLowerCase().indexOf(q) > -1;
      });
    }

    function showReveal(plaintext, tokenName, isDemo) {
      state.reveal = { plaintext: plaintext, name: tokenName, demo: !!isDemo };
      paint();
    }

    function closeReveal() {
      state.reveal = null;
      paint();
    }

    function openCreateDrawer() {
      var live = !!api.isLive && api.isLive();
      ui.drawer({
        eyebrow: 'Token API · ' + (live ? 'LIVE' : 'DEMO'),
        title: 'Terbitkan token API',
        subtitle: live ? 'Tercatat di backend (/api/v1/tokens)' : 'Demo lokal — tidak tercatat di backend',
        body:
          '<div class="stack" style="gap:12px">' +
            '<div class="field"><label class="field__label" for="ent-token-name">Nama token<span class="req">*</span></label>' +
              '<input class="input" id="ent-token-name" placeholder="mis. ci-deploy-prod"></div>' +
            '<div class="field"><label class="field__label" for="ent-token-expiry">Kedaluwarsa</label>' +
              '<select class="select" id="ent-token-expiry">' +
                '<option value="30">30 hari</option><option value="90" selected>90 hari</option><option value="365">365 hari</option>' +
              '</select></div>' +
            '<div class="field"><label class="field__label">Scope<span class="req">*</span></label><div class="ent-scope-list">' +
              ISSUABLE_SCOPES.map(function (s) { return '<label class="tiny"><input type="checkbox" class="ent-scope-cb" value="' + esc(s) + '"> ' + esc(s) + '</label>'; }).join(' ') +
            '</div><div class="field__hint">Scope tidak boleh melebihi kapabilitas pemilik (divalidasi backend, 422 bila berlebih).</div></div>' +
            '<div id="ent-token-result" aria-live="polite"></div>' +
          '</div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button><button class="btn btn--primary" id="ent-token-submit"><span class="material-symbols-outlined">key</span>Terbitkan' + (live ? '' : ' (demo)') + '</button>',
        onMount: function (node, ov) {
          node.querySelector('#ent-token-submit').addEventListener('click', function () {
            var name = node.querySelector('#ent-token-name').value.trim();
            var days = parseInt(node.querySelector('#ent-token-expiry').value, 10) || 90;
            var scopes = Array.prototype.slice.call(node.querySelectorAll('.ent-scope-cb:checked')).map(function (cb) { return cb.value; });
            var btn = node.querySelector('#ent-token-submit');
            btn.disabled = true; btn.classList.add('is-loading');
            api.issueToken({ name: name, scopes: scopes, expiresInDays: days }).then(function (r) {
              btn.disabled = false; btn.classList.remove('is-loading');
              ov.close();
              if (r.demo) ui.toast(r.message + ' — token contoh ditampilkan sekali.', 'warning');
              else ui.toast('Token diterbitkan dan tercatat di backend. Rahasia hanya tampil sekali.', 'success');
              showReveal(r.plaintext, r.token.name, r.demo);
              load();
            }).catch(function (err) {
              btn.disabled = false; btn.classList.remove('is-loading');
              var msg = (err && err.problems && err.problems.length) ? err.problems.join(' ') : (err.message || 'Gagal menerbitkan token.');
              var res = node.querySelector('#ent-token-result');
              if (res) res.innerHTML = '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div>' + esc(msg) + '</div></div>';
            });
          });
        }
      });
    }

    function confirmRevoke(t) {
      var live = !!api.isLive && api.isLive();
      ui.confirm({
        title: 'Cabut token?',
        subtitle: live ? 'Berlaku segera di backend' : 'Demo lokal — tidak tercatat di backend',
        body: 'Token <b>' + esc(t.name) + '</b> (<span class="mono">' + esc(t.prefix) + '</span>) ' +
          (live ? 'akan dicabut segera di server (<span class="mono">POST /api/v1/tokens/' + esc(t.id) + '/revoke</span>).'
               : 'akan ditandai dicabut di tab ini saja.'),
        confirmLabel: live ? 'Cabut' : 'Cabut (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.revokeToken(t.id).then(function (r) {
          state.pending = false;
          ui.toast(r.demo ? (r.message + ' — token dicabut di tab ini.') : 'Token dicabut di backend.', r.demo ? 'warning' : 'success');
          load();
        }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal mencabut token.', 'error'); paint(); });
      });
    }

    function confirmRotate(t) {
      var live = !!api.isLive && api.isLive();
      ui.confirm({
        title: 'Rotasi token?',
        subtitle: live ? 'Token lama mati, pengganti dari backend' : 'Demo lokal — tidak tercatat di backend',
        body: 'Token <b>' + esc(t.name) + '</b> akan dicabut dan diganti. Rahasia baru hanya ditampilkan sekali.' +
          (live ? ' (<span class="mono">POST /api/v1/tokens/' + esc(t.id) + '/rotate</span>)' : ''),
        confirmLabel: live ? 'Rotasi' : 'Rotasi (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.rotateToken(t.id).then(function (r) {
          state.pending = false;
          ui.toast(r.demo ? (r.message + ' — token lama dicabut, pengganti contoh ditampilkan.') : 'Rotasi selesai. Token lama dicabut, secret baru hanya tampil sekali.', r.demo ? 'warning' : 'success');
          showReveal(r.plaintext, r.token.name, r.demo);
          load();
        }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal merotasi token.', 'error'); paint(); });
      });
    }

    function openDetailDrawer(t) {
      var live = !!api.isLive && api.isLive();
      ui.drawer({
        eyebrow: 'Token API · ' + (live ? 'LIVE' : 'DEMO'),
        title: t.name,
        subtitle: t.prefix,
        body:
          '<dl class="ent-kv">' +
            '<dt>Token ID</dt><dd class="mono">' + esc(t.id) + '</dd>' +
            '<dt>Prefix</dt><dd class="mono">' + esc(t.prefix) + '</dd>' +
            '<dt>Status</dt><dd><span class="badge badge--' + (STATUS_TONE[t.status] || '') + '">' + esc(STATUS_LABEL[t.status] || t.status) + '</span></dd>' +
            '<dt>Dibuat oleh</dt><dd>' + esc(t.createdBy) + '</dd>' +
            '<dt>Dibuat</dt><dd>' + esc(U.fmtDate(t.createdAt)) + '</dd>' +
            '<dt>Kedaluwarsa</dt><dd>' + esc(expiryInfo(t)) + '</dd>' +
            '<dt>Pemakaian terakhir</dt><dd>' + esc(t.lastUsedAt ? U.fmtDate(t.lastUsedAt) : 'Belum pernah') + '</dd>' +
            '<dt>Rotasi dari</dt><dd class="mono">' + esc(t.rotatedFromId || '—') + '</dd>' +
            '<dt>Scopes</dt><dd><div class="ent-scope-list">' + (t.scopes || []).map(function (s) { return '<span class="badge badge--brand">' + esc(s) + '</span>'; }).join('') + '</div></dd>' +
            (t.serviceAccountId ? '<dt>Service account</dt><dd class="mono">' + esc(t.serviceAccountId) + '</dd>' : '') +
          '</dl>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
          (t.status === 'revoked' ? '' :
            '<button class="btn btn--secondary" id="ent-token-rotate"><span class="material-symbols-outlined">autorenew</span>Rotasi' + (live ? '' : ' (demo)') + '</button>' +
            '<button class="btn btn--danger-soft" id="ent-token-revoke"><span class="material-symbols-outlined">block</span>Cabut' + (live ? '' : ' (demo)') + '</button>'),
        onMount: function (node, ov) {
          var rv = node.querySelector('#ent-token-revoke');
          if (rv) rv.addEventListener('click', function () { ov.close(); confirmRevoke(t); });
          var rt = node.querySelector('#ent-token-rotate');
          if (rt) rt.addEventListener('click', function () { ov.close(); confirmRotate(t); });
        }
      });
    }

    function revealPanel() {
      var r = state.reveal;
      var chip = r.demo ? demoChip() : liveChip();
      var notice = r.demo
        ? '<div class="ent-warning-card"><span class="material-symbols-outlined">science</span><div>String di bawah adalah contoh lokal yang mengandung penanda <span class="mono">DEMO</span>. Tidak bisa dipakai ke server mana pun dan tidak disimpan di store.</div></div>'
        : '<div class="ent-warning-card"><span class="material-symbols-outlined">lock</span><div>Salin token ini sekarang — ia tidak akan ditampilkan lagi. Tidak disimpan di store/localStorage. GET /api/v1/tokens tidak pernah mengembalikan secret.</div></div>';
      return ui.card({
        title: (r.demo ? 'Rahasia contoh (sekali tampil) ' : 'Token baru — simpan sekarang (sekali tampil) ') + chip,
        body:
          notice +
          '<div class="field"><label class="field__label" for="ent-reveal-secret">Plaintext (sekali tampil)</label>' +
            '<input class="input mono" id="ent-reveal-secret" readonly value="' + esc(r.plaintext) + '"></div>' +
          '<div class="row" style="gap:8px;margin-top:10px">' +
            '<button class="btn btn--secondary btn--sm" id="ent-reveal-copy"><span class="material-symbols-outlined">content_copy</span>Salin' + (r.demo ? ' string DEMO' : '') + '</button>' +
            '<label class="tiny" style="display:flex;align-items:center;gap:6px"><input type="checkbox" id="ent-reveal-ack"> Saya sudah menyalin</label>' +
            '<button class="btn btn--primary btn--sm" id="ent-reveal-close" disabled>Tutup</button>' +
          '</div>'
      });
    }

    function paint() {
      if (state.loading) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P10', title: 'API Tokens', desc: 'Memuat inventaris demo…' }) + ui.skeletonTable(5, 6);
        return;
      }
      if (state.error) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P10', title: 'API Tokens' }) + ui.errorState(state.error, 'Muat ulang');
        var retry = root.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }

      var live = !!api.isLive && api.isLive();
      var head = ui.pageHead({
        eyebrow: 'Administration · P10 API Token Management',
        title: 'API Tokens',
        desc: 'Inventaris token, scope, kedaluwarsa, dan rotasi. Mode ditentukan probe: ' + (live ? 'LIVE dari backend (/api/v1/tokens).' : 'DEMO — backend tak tercapai.'),
        actions: modeChip() + ' <button class="btn btn--primary" id="ent-token-create"><span class="material-symbols-outlined">add</span>' + (live ? 'Terbitkan' : 'Terbitkan (demo)') + '</button>'
      });

      var banner = live ? '<div class="banner banner--success ent-banner"><span class="material-symbols-outlined">cloud_done</span>' +
        '<div><b>Data live.</b> Token dari backend (<span class="mono">/api/v1/tokens</span>). Penerbitan, pencabutan, dan rotasi tercatat di server. Rahasia hanya ditampilkan sekali.</div></div>'
      : '<div class="banner banner--demo ent-banner"><span class="material-symbols-outlined">science</span>' +
        '<div><b>Data demo.</b> Backend tak tercapai saat probe. Token tidak terhubung ke caller context. Penerbitan, pencabutan, dan rotasi hanya mengubah tab ini dan tidak tercatat di mana pun. Rahasia contoh tidak bisa dipakai ke server mana pun.</div></div>';

      var warning = '<div class="ent-warning-card"><span class="material-symbols-outlined">lock</span><div>Rahasia hanya ditampilkan sekali. Jangan menempelkan secret ke dokumen, tiket, atau log. ' +
        (live ? 'Pencabutan dan rotasi berlaku segera di backend.' : 'Di sini hanya mengubah daftar demo.') + '</div></div>';

      var rows = filtered();
      var filters = [['all', 'Semua'], ['active', 'Aktif'], ['expired', 'Kedaluwarsa'], ['revoked', 'Dicabut']];
      var table = ui.card({
        title: 'Inventaris token ' + modeChip(),
        flush: true,
        body:
          '<div class="ent-toolbar">' +
            '<div class="ent-search"><span class="material-symbols-outlined">search</span>' +
              '<input class="input" id="ent-token-q" placeholder="Cari nama, prefix, scope…" value="' + esc(state.query) + '" aria-label="Cari token"></div>' +
            '<div class="segmented" role="group" aria-label="Filter status">' +
              filters.map(function (f) {
                return '<button class="' + (state.statusFilter === f[0] ? 'is-active' : '') + '" data-status-filter="' + f[0] + '">' + esc(f[1]) + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Prefix</th><th>Scope</th><th>Status</th><th>Kedaluwarsa</th><th>Pemakaian terakhir</th><th class="num">Aksi</th></tr></thead><tbody>' +
            (rows.length ? rows.map(function (t) {
              return '<tr data-token-id="' + esc(t.id) + '" class="is-clickable" tabindex="0" role="button" aria-label="Detail ' + esc(t.name) + '">' +
                '<td><div class="small strong">' + esc(t.name) + '</div></td>' +
                '<td class="mono tiny">' + esc(t.prefix) + '</td>' +
                '<td><div class="ent-scope-list">' + (t.scopes || []).map(function (s) { return '<span class="badge badge--outline">' + esc(s) + '</span>'; }).join('') + '</div></td>' +
                '<td><span class="badge badge--' + (STATUS_TONE[t.status] || '') + '">' + esc(STATUS_LABEL[t.status] || t.status) + '</span></td>' +
                '<td class="small">' + esc(expiryInfo(t)) + '</td>' +
                '<td class="small">' + esc(t.lastUsedAt ? U.fmtDate(t.lastUsedAt) : 'Belum pernah') + '</td>' +
                '<td class="num">' +
                  (t.status === 'revoked'
                    ? '<span class="tiny faint">dicabut</span>'
                    : '<button class="btn btn--secondary btn--sm" data-revoke-token="' + esc(t.id) + '"><span class="material-symbols-outlined">block</span>Cabut</button> ' +
                      '<button class="btn btn--secondary btn--sm" data-rotate-token="' + esc(t.id) + '"><span class="material-symbols-outlined">autorenew</span>Rotasi</button>') +
                '</td></tr>';
            }).join('') : '<tr><td colspan="7">' + ui.empty({ title: 'Tidak ada token cocok', body: 'Ubah kata kunci atau filter status.', icon: 'search_off' }) + '</td></tr>') +
          '</tbody></table></div>' +
          '<div class="ent-empty-hint">' + rows.length + ' dari ' + state.tokens.length + ' token ditampilkan · klik baris untuk detail.</div>'
      });

      root.innerHTML = head + banner + warning + (state.reveal ? revealPanel() : '') + table;

      var q = root.querySelector('#ent-token-q');
      if (q) q.addEventListener('input', U.debounce(function () { state.query = q.value; paint(); var nq = root.querySelector('#ent-token-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 180));
      root.querySelectorAll('[data-status-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.statusFilter = b.getAttribute('data-status-filter'); paint(); });
      });
      root.querySelectorAll('[data-token-id]').forEach(function (rowEl) {
        var open = function () {
          var id = rowEl.getAttribute('data-token-id');
          var t = state.tokens.filter(function (x) { return x.id === id; })[0];
          if (t) openDetailDrawer(t);
        };
        rowEl.addEventListener('click', open);
        rowEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      root.querySelectorAll('[data-revoke-token]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = b.getAttribute('data-revoke-token');
          var t = state.tokens.filter(function (x) { return x.id === id; })[0];
          if (t) confirmRevoke(t);
        });
      });
      root.querySelectorAll('[data-rotate-token]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = b.getAttribute('data-rotate-token');
          var t = state.tokens.filter(function (x) { return x.id === id; })[0];
          if (t) confirmRotate(t);
        });
      });
      var createBtn = root.querySelector('#ent-token-create');
      if (createBtn) createBtn.addEventListener('click', openCreateDrawer);
      if (state.reveal) {
        var copyBtn = root.querySelector('#ent-reveal-copy');
        if (copyBtn) copyBtn.addEventListener('click', function () { copyText(state.reveal.plaintext, state.reveal.demo ? 'String DEMO tersalin (mengandung “DEMO”, bukan rahasia asli).' : 'Token tersalin. Simpan di tempat aman — tidak akan tampil lagi.'); });
        var ack = root.querySelector('#ent-reveal-ack');
        var closeBtn = root.querySelector('#ent-reveal-close');
        if (ack && closeBtn) ack.addEventListener('change', function () { closeBtn.disabled = !ack.checked; });
        if (closeBtn) closeBtn.addEventListener('click', closeReveal);
      }
    }

    load();
  };
})();
