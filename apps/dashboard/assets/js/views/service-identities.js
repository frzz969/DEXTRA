/* View — Service Identity (P11, live + DEMO fallback).
 *
 * Layer pembaca/penulis backend nyata lewat DEXTRA_P11_API:
 *   GET    /api/v1/service-accounts              -> inventaris
 *   POST   /api/v1/service-accounts              -> buat akun layanan
 *   GET    /api/v1/service-accounts/{id}        -> detail (termasuk tokens[])
 *   POST   /api/v1/service-accounts/{id}/revoke -> cabut identitas + kredensial
 *   POST   /api/v1/tokens                        -> mint kredensial (service_account_id)
 *   POST   /api/v1/tokens/{id}/rotate           -> rotasi kredensial
 *
 * Mode ditentukan lewat probe() pada bridge: live -> render data backend dan
 * mutasi memanggil endpoint live (error server ditampilkan apa adanya, tanpa
 * fallback diam-diam ke demo). Backend tidak dapat dihubungi -> mode demo dan
 * seluruh isi halaman berlabel jelas DEMO dari fixture lokal.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_P11_API.create();
  var CONTRACTS = window.DEXTRA_P11_CONTRACTS;

  function demoChip() { return '<span class="badge badge--outline ent-demo-chip">DEMO</span>'; }
  var KIND_LABEL = { worker: 'Worker', mcp: 'MCP', agent: 'Agent', integration: 'Integrasi' };
  var STATUS_LABEL = { active: 'Aktif', expiring: 'Kedaluwarsa', disabled: 'Nonaktif', revoked: 'Dicabut', rotated: 'Rotasi' };
  var STATUS_TONE = { active: 'success', expiring: 'warning', disabled: 'outline', revoked: 'danger', rotated: 'outline' };
  var STATUS_FALLBACK_TONE = 'outline';
  var SCOPES = ['view_all', 'view_own', 'view_audit', 'create_request', 'approve', 'execute', 'manage_integrations', 'manage_users', 'export_audit'];

  function statusBadgeHtml(s) {
    var tone = STATUS_TONE[s] || STATUS_FALLBACK_TONE;
    return '<span class="badge badge--' + tone + '">' + esc(STATUS_LABEL[s] || s) + '</span>';
  }

  function errMsg(err) {
    if (err && err.problems && err.problems.length) { return err.problems.map(function (p) { return (p && p.msg) || 'Permintaan tidak valid.'; }).join(' '); }
    if (err && err.detail) { if (typeof err.detail === 'string') return err.detail; if (Array.isArray(err.detail) && err.detail.length) return errMsg({ problems: err.detail }); }
    return (err && err.message) || 'Gagal memproses permintaan.';
  }

  D.views.serviceIdentities = function (root) {
    var state = {
      tab: 'inventaris',
      loading: true,
      error: null,
      mode: 'demo',
      identities: [],
      query: '',
      kindFilter: 'all',
      statusFilter: 'all',
      selectedId: null,
      pending: false
    };

    function load() {
      state.loading = true; state.error = null; paint();
      api.probe().then(function (res) {
        state.mode = (res && res.mode) || 'demo';
        return api.listIdentities();
      }).then(function (list) {
        state.identities = list || [];
        if (state.selectedId && !state.identities.some(function (x) { return x.id === state.selectedId; })) state.selectedId = null;
        state.loading = false; paint();
      }).catch(function (err) {
        state.error = errMsg(err) || 'Gagal memuat inventaris akun layanan.';
        state.loading = false; paint();
      });
    }

    function filtered() {
      var q = state.query.trim().toLowerCase();
      return state.identities.filter(function (x) {
        if (state.kindFilter !== 'all' && x.kind !== state.kindFilter) return false;
        if (state.statusFilter !== 'all' && x.status !== state.statusFilter) return false;
        if (!q) return true;
        return ((x.name || '') + ' ' + (x.description || '') + ' ' + (x.owner || '') + ' ' + ((x.scopes || []).join(' '))).toLowerCase().indexOf(q) > -1;
      });
    }

    function openDetail(identity, liveIdentity) {
      var sel = liveIdentity || identity;
      var creds = sel.credentials || [];
      ui.drawer({
        eyebrow: state.mode === 'live' ? 'Akun layanan · LIVE' : 'Akun layanan · DEMO',
        title: sel.name,
        subtitle: KIND_LABEL[sel.kind] || sel.kind,
        body:
          '<dl class="ent-kv">' +
            '<dt>ID</dt><dd class="mono">' + esc(sel.id) + '</dd>' +
            '<dt>Jenis</dt><dd>' + esc(KIND_LABEL[sel.kind] || sel.kind) + '</dd>' +
            '<dt>Tenant binding</dt><dd class="mono">' + esc(sel.tenantBinding) + '</dd>' +
            '<dt>Status</dt><dd>' + '<span class="badge badge--' + (STATUS_TONE[sel.status] || STATUS_FALLBACK_TONE) + '">' + esc(STATUS_LABEL[sel.status] || sel.status) + '</span>' + '</dd>' +
            '<dt>Owner</dt><dd>' + esc(sel.owner) + '</dd>' +
            '<dt>Dibuat</dt><dd>' + esc(U.fmtDate(sel.createdAt)) + '</dd>' +
            '<dt>Pemakaian terakhir</dt><dd>' + esc(sel.lastUsedAt ? U.fmtDate(sel.lastUsedAt) : 'Belum pernah') + '</dd>' +
            '<dt>Rotasi dari</dt><dd class="mono">' + esc(sel.rotatedFromId || '—') + '</dd>' +
            '<dt>Catatan keamanan</dt><dd class="small">' + esc(sel.securityNotes || '—') + '</dd>' +
          '</dl>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Kredensial (prefix saja)</div>' +
            '<div class="table-wrap"><table class="table"><thead><tr><th>Label</th><th>Prefix</th><th>Status</th><th>Kedaluwarsa</th><th class="num">Aksi</th></tr></thead><tbody>' +
              (creds.length ? creds.map(function (c) {
                return '<tr><td class="small">' + esc(c.label) + '</td><td class="mono tiny">' + esc(c.prefix) + '</td>' +
                  '<td>' + statusBadgeHtml(c.status) + '</td>' +
                  '<td class="small">' + esc(c.expiresAt ? U.fmtDay(c.expiresAt) : 'Tanpa batas') + '</td>' +
                  '<td class="num">' + (sel.status === 'revoked' || sel.status === 'disabled'
                    ? '<span class="tiny faint">tidak tersedia</span>'
                    : '<button class="btn btn--secondary btn--sm" data-rotate-cred="' + esc(c.id) + '"><span class="material-symbols-outlined">autorenew</span>Rotasi</button>') + '</td></tr>';
              }).join('') : '<tr><td colspan="5">' + ui.empty({ title: 'Belum ada kredensial', body: (state.mode === 'live' ? 'Akun layanan ini belum memiliki kredensial pada backend.' : 'Akun layanan ini belum memiliki kredensial pada fixture.'), icon: 'key_off' }) + '</td></tr>') +
            '</tbody></table></div></div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
          (sel.status === 'revoked' ? '' :
            '<button class="btn btn--danger-soft" id="p11-disable">' + (state.mode === 'live' ? '<span class="material-symbols-outlined">pause_circle</span>Nonaktifkan' : '<span class="material-symbols-outlined">pause_circle</span>Nonaktifkan (demo)') + '</button>' +
            '<button class="btn btn--danger" id="p11-revoke">' + (state.mode === 'live' ? '<span class="material-symbols-outlined">block</span>Cabut' : '<span class="material-symbols-outlined">block</span>Cabut (demo)') + '</button>'),
        onMount: function (node, ov) {
          node.querySelectorAll('[data-rotate-cred]').forEach(function (b) {
            b.addEventListener('click', function () { ov.close(); rotateCredential(sel, creds.filter(function (c) { return c.id === b.getAttribute('data-rotate-cred'); })[0]); });
          });
          var disable = node.querySelector('#p11-disable');
          if (disable) disable.addEventListener('click', function () { ov.close(); confirmDisable(sel.id, sel.name); });
          var revoke = node.querySelector('#p11-revoke');
          if (revoke) revoke.addEventListener('click', function () { ov.close(); confirmRevoke(sel.id, sel.name); });
        }
      });
    }

    function openDetailDrawer(id) {
      var identity = state.identities.filter(function (x) { return x.id === id; })[0];
      if (!identity) return;
      if (api._live && api._live()) {
        return api.getIdentity(id).then(function (det) { openDetail(identity, det); }).catch(function (err) { ui.toast(errMsg(err) || 'Gagal memuat detail akun layanan.', 'error'); });
      }
      openDetail(identity);
    }

    function openCreateDrawer() {
      ui.drawer({
        eyebrow: state.mode === 'live' ? 'Akun layanan · LIVE' : 'Akun layanan · DEMO',
        title: 'Buat akun layanan',
        subtitle: state.mode === 'live' ? 'Membuat akun di backend — kredensial pertama ditampilkan sekali setelah token diterbitkan.' : 'Demo lokal — tidak tercatat di backend',
        body:
          '<div class="stack" style="gap:12px">' +
            '<div class="field"><label class="field__label" for="p11-name">Nama (slug)<span class="req">*</span></label>' +
              '<input class="input mono" id="p11-name" placeholder="mis. executive-assistant-worker"></div>' +
            '<div class="field"><label class="field__label" for="p11-kind">Jenis<span class="req">*</span></label>' +
              '<select class="select" id="p11-kind">' +
                ['worker', 'mcp', 'agent', 'integration'].map(function (k) { return '<option value="' + k + '">' + KIND_LABEL[k] + '</option>'; }).join('') +
              '</select></div>' +
            '<div class="field"><label class="field__label" for="p11-owner">Owner manusia<span class="req">*</span></label>' +
              '<input class="input" id="p11-owner" placeholder="farhan.pratama@kenari.co.id"></div>' +
            '<div class="field"><label class="field__label" for="p11-desc">Deskripsi</label>' +
              '<textarea class="input" id="p11-desc" rows="3"></textarea></div>' +
            '<div class="field"><label class="field__label">Scope</label><div class="ent-scope-list">' +
              SCOPES.map(function (s) { return '<label class="tiny"><input type="checkbox" class="ent-scope-cb" value="' + esc(s) + '"> ' + esc(s) + '</label>'; }).join(' ') +
            '</div></div>' +
            '<div id="p11-create-result" aria-live="polite"></div>' +
          '</div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button><button class="btn btn--primary" id="p11-create-submit"><span class="material-symbols-outlined">add</span>' + (state.mode === 'live' ? 'Buat akun' : 'Buat (demo)') + '</button>',
        onMount: function (node, ov) {
          node.querySelector('#p11-create-submit').addEventListener('click', function () {
            var scopes = Array.prototype.slice.call(node.querySelectorAll('.ent-scope-cb:checked')).map(function (cb) { return cb.value; });
            var btn = node.querySelector('#p11-create-submit');
            btn.disabled = true; btn.classList.add('is-loading');
            var payload = {
              name: node.querySelector('#p11-name').value.trim(),
              kind: node.querySelector('#p11-kind').value,
              description: node.querySelector('#p11-desc').value.trim(),
              scopes: scopes
            };
            if (!api._live || !api._live()) payload.owner = node.querySelector('#p11-owner').value.trim();
            api.createIdentity(payload).then(function (r) {
              btn.disabled = false; btn.classList.remove('is-loading');
              if (api._live && api._live()) {
                ui.toast('Akun layanan ' + (r && r.id ? r.id : '') + ' dibuat di backend.', 'success');
                ov.close(); load();
              } else {
                ui.toast(r.message + ' — akun layanan ditambahkan di tab ini.', 'warning');
                ov.close(); load();
              }
            }).catch(function (err) {
              btn.disabled = false; btn.classList.remove('is-loading');
              var msg = errMsg(err);
              var res = node.querySelector('#p11-create-result');
              if (res) res.innerHTML = '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div>' + esc(msg) + '</div></div>';
            });
          });
        }
      });
    }

    /* JANGAN klaim POST /service-accounts/{id}/disable (tidak ada di backend).
     * Di live, tombol "Nonaktifkan" hanya menjelaskan; di demo, hanya menandai. */
    function confirmDisable(id, name) {
      var live = state.mode === 'live';
      ui.confirm({
        title: 'Nonaktifkan akun layanan?',
        subtitle: live ? 'Tidak tersedia di backend' : 'Demo lokal — tidak tercatat di backend',
        body: live
          ? 'Backend hanya menyediakan POST /service-accounts/{id}/revoke (cabut permanen). ' +
            'Nonaktifkan sementara tidak tersedia; tidak dijalankan di live mode.'
          : 'Akun <b>' + esc(name) + '</b> akan ditandai nonaktif di tab ini (demo).',
        confirmLabel: live ? 'OK' : 'Nonaktifkan (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        if (live) { return; }
        api.disableIdentity(id).then(function () {
          ui.toast('Akun ditandai nonaktif (demo).', 'warning');
          load();
        }).catch(function (err) { ui.toast(errMsg(err) || err.message, 'error'); });
      });
    }

    function confirmRevoke(id, name) {
      ui.confirm({
        title: 'Cabut akun layanan permanen?',
        subtitle: state.mode === 'live' ? 'Backend akan mencabut identitas dan seluruh kredensialnya.' : 'Demo lokal — tidak tercatat di backend',
        body: state.mode === 'live'
          ? 'Akun <b>' + esc(name) + '</b> dan seluruh kredensialnya akan dicabut permanen di backend. Tindakan ini memerlukan <span class="mono">manage_integrations</span>.'
          : 'Akun <b>' + esc(name) + '</b> dan seluruh kredensialnya akan ditandai dicabut di tab ini (demo).',
        confirmLabel: 'Cabut permanen',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.revokeIdentity(id).then(function (r) {
          state.pending = false;
          ui.toast((r && r.id ? 'Akun ' + r.id + ' ' : 'Akun ') + 'dicabut di backend.', 'warning');
          load();
        }).catch(function (err) { state.pending = false; ui.toast(errMsg(err) || 'Gagal mencabut.', 'error'); paint(); });
      });
    }

    function rotateCredential(identity, cred) {
      if (!cred) { ui.toast('Pilih kredensial yang akan diputar.', 'error'); return; }
      ui.confirm({
        title: 'Rotasi kredensial?',
        subtitle: state.mode === 'live' ? 'Backend akan mencabut kredensial lama dan menerbitkan penggantinya.' : 'Demo lokal — tidak tercatat di backend',
        body: state.mode === 'live'
          ? 'Kredensial <b>' + esc(cred.label) + '</b> akan dicabut dan diganti di backend. Rahasia baru hanya ditampilkan sekali dan tidak disimpan server.'
          : 'Kredensial <b>' + esc(cred.label) + '</b> akan dicabut dan diganti contoh lokal. Rahasia baru hanya ditampilkan sekali.',
        confirmLabel: state.mode === 'live' ? 'Rotasi di backend' : 'Rotasi (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.rotateCredential(identity.id, cred.id, { name: (identity.name || 'service-credential') + ' (rotasi)', scopes: identity.scopes, expiresInDays: 90 }).then(function (r) {
          state.pending = false;
          if (state.mode === 'live') {
            if (!r || !r.plaintext) { ui.toast('Rotasi berhasil, tetapi rahasia tidak tersedia.', 'error'); return load(); }
            ui.modal({
              title: 'Kredensial baru (sekali tampil)',
              subtitle: 'Rotasi berhasil di backend — simpan token ini sekarang.',
              body:
                '<div class="ent-warning-card"><span class="material-symbols-outlined">lock</span><div>Rahasia baru hanya ditampilkan sekali. Jangan menempelkan token ke dokumen atau log.</div></div>' +
                '<div class="field"><label class="field__label">Plaintext (sekali tampil)</label><input class="input mono" id="p11-plain" readonly value="' + esc(r.plaintext) + '"></div>',
              footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button><button class="btn btn--secondary btn--sm" id="p11-copy-plain"><span class="material-symbols-outlined">content_copy</span>Salin</button>',
              onMount: function (node) {
                var btn = node.querySelector('#p11-copy-plain');
                if (btn) btn.addEventListener('click', function () { var v = node.querySelector('#p11-plain').value; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function () { ui.toast('Kredensial tersalin.', 'success'); }, function () { ui.toast('Gagal menyalin.', 'error'); }); else ui.toast('Gagal menyalin.', 'error'); });
              }
            });
            return load();
          }
          ui.modal({
            title: 'Rahasia contoh (sekali tampil)',
            subtitle: 'Demo lokal — bukan kredensial asli',
            body:
              '<div class="ent-warning-card"><span class="material-symbols-outlined">science</span><div>String di bawah adalah contoh lokal yang mengandung penanda <span class="mono">DEMO</span>. Tidak bisa dipakai ke server mana pun.</div></div>' +
              '<div class="field"><label class="field__label">Plaintext (sekali tampil)</label><input class="input mono" id="p11-plain" readonly value="' + esc(r.plaintext) + '"></div>',
            footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>',
            onMount: function (node) {
              var btn = node.querySelector('#p11-copy-plain');
              if (btn) btn.addEventListener('click', function () { var v = node.querySelector('#p11-plain').value; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(function () { ui.toast('String DEMO tersalin.', 'success'); }, function () { ui.toast('Gagal menyalin.', 'error'); }); else ui.toast('Gagal menyalin.', 'error'); });
            }
          });
          load();
        }).catch(function (err) { state.pending = false; ui.toast(errMsg(err) || 'Gagal merotasi.', 'error'); paint(); });
      });
    }

    function paint() {
      if (state.loading) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P11', title: 'Service Identity', desc: 'Memuat inventaris akun layanan…' }) + ui.skeletonTable(5, 6);
        return;
      }
      if (state.error) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P11', title: 'Service Identity' }) + ui.errorState(state.error, 'Muat ulang');
        var retry = root.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }

      var live = state.mode === 'live';
      var head = ui.pageHead({
        eyebrow: 'Administration · P11 Service Identity',
        title: 'Service Identity',
        desc: live
          ? 'Akun layanan, kredensial, dan rotasi melalui backend (/api/v1/service-accounts, /api/v1/tokens). Semua tindakan memerlukan manage_integrations.'
          : 'Backend tidak dapat dihubungi — menampilkan inventaris akun layanan contoh (DEMO).',
        actions: (live ? '' : demoChip()) + ' <button class="btn btn--primary" id="p11-create"><span class="material-symbols-outlined">add</span>' + (live ? 'Buat akun' : 'Buat akun (demo)') + '</button>'
      });

      var banner = '';
      if (!live) {
        banner = '<div class="banner banner--demo ent-banner"><span class="material-symbols-outlined">science</span>' +
          '<div><b>Data demo.</b> Backend tidak dapat dihubungi, sehingga layar ini menampilkan akun layanan contoh lokal yang ditandai DEMO. Tidak ada akun layanan nyata yang ditampilkan atau dimutasi di sini.</div></div>';
      }

      var stats = ui.statstrip([
        { label: 'Total', value: state.identities.length },
        { label: 'Aktif', value: state.identities.filter(function (x) { return x.status === 'active'; }).length, tone: 'ok' },
        { label: 'Nonaktif/cabut', value: state.identities.filter(function (x) { return x.status === 'disabled' || x.status === 'revoked'; }).length, tone: 'danger' },
        { label: 'Rotasi diperlukan', value: state.identities.filter(function (x) { return x.status === 'expiring'; }).length, tone: 'warn' }
      ]);

      var tabs = [['inventaris', 'Inventaris'], ['detail', 'Detail'], ['kontrak', 'Kontrak API']];
      var tabBar = '<div class="segmented ent-tabs" role="tablist" aria-label="Bagian service identity">' +
        tabs.map(function (t) {
          return '<button role="tab" aria-selected="' + (state.tab === t[0] ? 'true' : 'false') + '" class="' + (state.tab === t[0] ? 'is-active' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';

      var panel = '';
      if (state.tab === 'inventaris') {
        var rows = filtered();
        var kinds = [['all', 'Semua jenis'], ['worker', 'Worker'], ['mcp', 'MCP'], ['agent', 'Agent'], ['integration', 'Integrasi']];
        var statuses = [['all', 'Semua status'], ['active', 'Aktif'], ['expiring', 'Kedaluwarsa'], ['disabled', 'Nonaktif'], ['revoked', 'Dicabut']];
        panel = ui.card({
          title: 'Inventaris akun layanan' + (live ? '' : demoChip()),
          flush: true,
          body:
            '<div class="ent-toolbar">' +
              '<div class="ent-search"><span class="material-symbols-outlined">search</span>' +
                '<input class="input" id="p11-q" placeholder="Cari nama, owner, scope…" value="' + esc(state.query) + '" aria-label="Cari akun layanan"></div>' +
              '<div class="segmented" role="group" aria-label="Filter jenis">' +
                kinds.map(function (k) { return '<button class="' + (state.kindFilter === k[0] ? 'is-active' : '') + '" data-kind-filter="' + k[0] + '">' + esc(k[1]) + '</button>'; }).join('') +
              '</div>' +
              '<div class="segmented" role="group" aria-label="Filter status">' +
                statuses.map(function (s) { return '<button class="' + (state.statusFilter === s[0] ? 'is-active' : '') + '" data-status-filter="' + s[0] + '">' + esc(s[1]) + '</button>'; }).join('') +
              '</div>' +
            '</div>' +
            '<div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Jenis</th><th>Status</th><th>Scope</th><th>Owner</th><th>Pemakaian terakhir</th></tr></thead><tbody>' +
              (rows.length ? rows.map(function (x) {
                return '<tr data-svc-id="' + esc(x.id) + '" class="is-clickable" tabindex="0" role="button" aria-label="Detail ' + esc(x.name) + '">' +
                  '<td><div class="small strong">' + esc(x.name) + '</div><div class="tiny muted">' + esc(x.description) + '</div></td>' +
                  '<td><span class="badge badge--outline">' + esc(KIND_LABEL[x.kind] || x.kind) + '</span></td>' +
                  '<td>' + statusBadgeHtml(x.status) + '</td>' +
                  '<td><div class="ent-scope-list">' + (x.scopes || []).map(function (s) { return '<span class="badge badge--outline">' + esc(s) + '</span>'; }).join('') + '</div></td>' +
                  '<td class="small">' + esc(x.owner) + '</td>' +
                  '<td class="small">' + esc(x.lastUsedAt ? U.fmtDate(x.lastUsedAt) : 'Belum pernah') + '</td></tr>';
              }).join('') : '<tr><td colspan="6">' + ui.empty({ title: 'Tidak ada akun layanan cocok', body: 'Ubah kata kunci atau filter.', icon: 'search_off' }) + '</td></tr>') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">' + rows.length + ' dari ' + state.identities.length + ' akun ditampilkan · klik baris untuk detail · mutasi memerlukan manage_integrations.</div>'
        });
      } else if (state.tab === 'detail') {
        if (!state.selectedId) {
          panel = ui.card({ title: 'Detail ' + (live ? '' : demoChip()), body: '<p class="small muted">' + (live ? 'Pilih akun layanan dari tab Inventaris.' : 'Pilih akun layanan dari tab Inventaris.') + '</p>' });
        } else {
          var sel = state.identities.filter(function (x) { return x.id === state.selectedId; })[0];
          if (!sel) {
            panel = ui.card({ title: 'Detail ' + (live ? '' : demoChip()), body: '<p class="small muted">Akun layanan tidak ditemukan.</p>' });
          } else {
            panel = ui.card({
              title: esc(sel.name) + ' ' + (live ? '' : demoChip()),
              desc: esc(sel.description),
              body:
                '<dl class="ent-kv">' +
                  '<dt>ID</dt><dd class="mono">' + esc(sel.id) + '</dd>' +
                  '<dt>Jenis</dt><dd>' + esc(KIND_LABEL[sel.kind] || sel.kind) + '</dd>' +
                  '<dt>Tenant binding</dt><dd class="mono">' + esc(sel.tenantBinding) + '</dd>' +
                  '<dt>Status</dt><dd>' + statusBadgeHtml(sel.status) + '</dd>' +
                  '<dt>Owner</dt><dd>' + esc(sel.owner) + '</dd>' +
                  '<dt>Dibuat</dt><dd>' + esc(U.fmtDate(sel.createdAt)) + '</dd>' +
                  '<dt>Pemakaian terakhir</dt><dd>' + esc(sel.lastUsedAt ? U.fmtDate(sel.lastUsedAt) : 'Belum pernah') + '</dd>' +
                  '<dt>Rotasi dari</dt><dd class="mono">' + esc(sel.rotatedFromId || '—') + '</dd>' +
                  '<dt>Catatan keamanan</dt><dd class="small">' + esc(sel.securityNotes || '—') + '</dd>' +
                '</dl>' +
                '<div style="margin-top:14px"><button class="btn btn--secondary btn--sm" id="p11-open-drawer"><span class="material-symbols-outlined">visibility</span>Buka laci detail</button></div>',
              foot: (sel.status === 'revoked' ? '' :
                '<button class="btn btn--danger-soft" id="p11-disable">' + (live ? '<span class="material-symbols-outlined">pause_circle</span>Nonaktifkan' : '<span class="material-symbols-outlined">pause_circle</span>Nonaktifkan (demo)') + '</button>' +
                '<button class="btn btn--danger" id="p11-revoke">' + (live ? '<span class="material-symbols-outlined">block</span>Cabut' : '<span class="material-symbols-outlined">block</span>Cabut (demo)') + '</button>')
            });
          }
        }
      } else if (state.tab === 'kontrak') {
        panel = ui.card({
          title: 'Kontrak backend P11 ' + (live ? '' : demoChip()),
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

      root.innerHTML = head + banner + stats + tabBar + '<div id="p11-tab-panel">' + panel + '</div>';

      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); paint(); });
      });
      root.querySelectorAll('[data-kind-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.kindFilter = b.getAttribute('data-kind-filter'); paint(); });
      });
      root.querySelectorAll('[data-status-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.statusFilter = b.getAttribute('data-status-filter'); paint(); });
      });
      var q = root.querySelector('#p11-q');
      if (q) q.addEventListener('input', U.debounce(function () { state.query = q.value; paint(); var nq = root.querySelector('#p11-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 180));
      root.querySelectorAll('[data-svc-id]').forEach(function (rowEl) {
        var open = function () { openDetailDrawer(rowEl.getAttribute('data-svc-id')); };
        rowEl.addEventListener('click', open);
        rowEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      var createBtn = root.querySelector('#p11-create');
      if (createBtn) createBtn.addEventListener('click', openCreateDrawer);
      var detailBtn = root.querySelector('#p11-open-drawer');
      if (detailBtn && state.selectedId) detailBtn.addEventListener('click', function () { openDetailDrawer(state.selectedId); });
      var disableBtn = root.querySelector('#p11-disable');
      if (disableBtn && state.selectedId) disableBtn.addEventListener('click', function () { var s = state.identities.filter(function (x) { return x.id === state.selectedId; })[0]; if (s) confirmDisable(s.id, s.name); });
      var revokeBtn = root.querySelector('#p11-revoke');
      if (revokeBtn && state.selectedId) revokeBtn.addEventListener('click', function () { var s = state.identities.filter(function (x) { return x.id === state.selectedId; })[0]; if (s) confirmRevoke(s.id, s.name); });
    }

    load();
  };
})();
