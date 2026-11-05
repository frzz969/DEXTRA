/* View — Access Management (P9 Authorization).
 *
 * LIVE: anggota dan peran dari backend via window.DEXTRA.api.rest
 * (GET /api/v1/users, GET /api/v1/roles — keduanya mewajibkan capability
 * manage_users di server; tanpa itu backend mengembalikan 403 dan layar
 * menampilkan penolakan akses sesuai respons backend, bukan fallback diam-diam).
 * Matriks izin LIVE berasal dari GET /api/v1/permissions (capabilities
 * pemanggil + enforced/unbacked_capabilities dari server).
 * DEMO: bila backend tak tercapai, fixture lokal dipakai dan diberi label DEMO
 * jelas; mutasi hanya berlaku pada tab ini. Tidak ada secret yang disimpan
 * di localStorage. Keputusan otorisasi nyata tetap berada di server.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_ENTERPRISE_API.create({});

  function demoChip() { return '<span class="badge badge--outline ent-demo-chip">DEMO</span>'; }
  function liveChip() { return '<span class="badge badge--success ent-live-chip">LIVE</span>'; }
  function modeChip() { return (api.isLive ? api.isLive() : false) ? liveChip() : demoChip(); }
  function unbackedBadge() { return '<span class="badge badge--outline" title="Server belum menegakkan kapabilitas ini">tidak tersedia</span>'; }
  function capLabel(cap) {
    var map = { view_all: 'Lihat seluruh workspace', view_own: 'Lihat pekerjaan sendiri', view_audit: 'Lihat audit trail', create_request: 'Membuat permintaan', approve: 'Menyetujui / menolak', execute: 'Mengeksekusi tindakan', manage_integrations: 'Kelola integrasi', manage_users: 'Kelola anggota & peran', manage_policies: 'Kelola kebijakan', export_audit: 'Ekspor audit', manage_tokens: 'Kelola token' };
    return map[cap] || cap;
  }

  var STATUS_LABEL = { accepted: 'Accepted', invited: 'Invited', suspended: 'Suspended' };
  var STATUS_TONE = { accepted: 'success', invited: 'warning', suspended: 'danger' };

  D.views.access = function (root) {
    var state = {
      tab: 'anggota',
      loading: true,
      error: null,
      denied: false,
      deniedCap: null,
      tenant: null,
      members: [],
      roles: [],
      permissions: [],
      matrix: {},
      capabilities: [],
      enforced: [],
      unbacked: [],
      query: '',
      statusFilter: 'all',
      pending: false
    };

    function load() {
      state.loading = true; state.error = null; state.denied = false; state.deniedCap = null; paint();
      Promise.all([api.listMembers(), api.listRoles(), api.listPermissions()]).then(function (res) {
        state.tenant = res[0].tenant;
        state.members = res[0].members || [];
        state.roles = res[1] || [];
        state.permissions = res[2].permissions || [];
        state.matrix = res[2].matrix || {};
        state.capabilities = res[2].capabilities || res[0].capabilities || [];
        state.enforced = res[2].enforced || [];
        state.unbacked = res[2].unbacked || [];
        state.loading = false; paint();
      }).catch(function (err) {
        if (err && err.status === 403) {
          state.denied = true;
          state.deniedCap = 'manage_users';
          state.error = null;
        } else {
          state.error = (err && err.message) || 'Gagal memuat data akses.';
        }
        state.loading = false; paint();
      });
    }

    function filteredMembers() {
      var q = state.query.trim().toLowerCase();
      return state.members.filter(function (m) {
        if (state.statusFilter !== 'all' && m.status !== state.statusFilter) return false;
        if (!q) return true;
        return (m.displayName + ' ' + m.email + ' ' + m.role).toLowerCase().indexOf(q) > -1;
      });
    }

    function roleLabel(id) {
      var r = null;
      state.roles.forEach(function (x) { if (x.id === id) r = x; });
      if (r) return r.label;
      var map = { finance_approver: 'Finance Approver', operations_manager: 'Operations Manager', governance_lead: 'Governance Lead', auditor: 'Auditor', requester: 'Requester' };
      return map[id] || id;
    }

    function toggleMemberStatus(m) {
      var live = !!api.isLive && api.isLive();
      var next = m.status === 'suspended' ? 'accepted' : 'suspended';
      var verb = next === 'suspended' ? 'Suspend' : 'Aktifkan';
      if (live) {
        ui.confirm({
          title: verb + ' anggota?',
          subtitle: 'Backend P9 belum menyediakan endpoint perubahan anggota',
          body: 'Backend tidak menyediakan endpoint perubahan anggota (router hanya punya GET /api/v1/users). ' +
            'Perubahan tidak dapat diterapkan di live mode.',
          confirmLabel: 'OK',
          tone: 'danger'
        }).then(function () {});
        return;
      }
      ui.confirm({
        title: verb + ' anggota?',
        subtitle: 'Demo lokal — tidak tercatat di backend',
        body: 'Keanggotaan <b>' + esc(m.displayName) + '</b> (' + esc(m.email) + ') akan ditandai <b>' + esc(STATUS_LABEL[next]) + '</b> di tab ini saja (demo).',
        confirmLabel: verb + ' (demo)',
        tone: next === 'suspended' ? 'danger' : 'primary'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.updateMember(m.id, { status: next }).then(function (r) {
          state.pending = false;
          ui.toast(r.message + ' — status diubah di tab ini.', 'warning');
          load();
        }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal mengubah status.', 'error'); paint(); });
      });
    }

    function openMemberDrawer(m) {
      var live = !!api.isLive && api.isLive();
      var caps = [];
      var role = null;
      state.roles.forEach(function (r) { if (r.id === m.role) role = r; });
      if (role) caps = role.capabilities.slice();
      var unbacked = role ? role.unbacked : [];
      ui.drawer({
        eyebrow: live ? 'Anggota · LIVE' : 'Anggota · DEMO',
        title: m.displayName,
        subtitle: m.email,
        body:
          '<dl class="ent-kv">' +
            '<dt>Membership ID</dt><dd class="mono">' + esc(m.id) + '</dd>' +
            '<dt>Tenant</dt><dd>' + esc(state.tenant && state.tenant.id ? state.tenant.id : 'Kenari Group') + '</dd>' +
            '<dt>Peran</dt><dd>' + esc(roleLabel(m.role)) + ' <span class="mono tiny faint">' + esc(m.role) + '</span></dd>' +
            '<dt>Status</dt><dd><span class="badge badge--' + (STATUS_TONE[m.status] || '') + '">' + esc(STATUS_LABEL[m.status] || m.status) + '</span></dd>' +
            '<dt>Accepted at</dt><dd>' + esc(m.acceptedAt ? U.fmtDate(m.acceptedAt) : '— (undangan belum diterima)') + '</dd>' +
            '<dt>Sumber</dt><dd>' + esc(m.source || (live ? 'backend' : 'demo fixture')) + '</dd>' +
          '</dl>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Kapabilitas peran</div>' +
            (caps.length
              ? '<div class="ent-scope-list">' + caps.map(function (c) {
                  var isUnbacked = unbacked.indexOf(c) >= 0;
                  return '<span class="badge ' + (isUnbacked ? 'badge--outline ent-unbacked' : 'badge--brand') + '">' + esc(c) + (isUnbacked ? ' · belum tersedia' : '') + '</span>';
                }).join('') + '</div>'
              : '<p class="small muted">Peran ini belum punya kapabilitas terdaftar.</p>') +
          '</div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
          (live ? '' : (m.status === 'suspended'
            ? '<button class="btn btn--primary" id="ent-member-toggle"><span class="material-symbols-outlined">person_check</span>Aktifkan (demo)</button>'
            : '<button class="btn btn--danger-soft" id="ent-member-toggle"><span class="material-symbols-outlined">person_off</span>Suspend (demo)</button>')),
        onMount: function (node, ov) {
          var btn = node.querySelector('#ent-member-toggle');
          if (btn) btn.addEventListener('click', function () { ov.close(); toggleMemberStatus(m); });
        }
      });
    }

    function openRoleDrawer(role) {
      var live = !!api.isLive && api.isLive();
      ui.drawer({
        eyebrow: live ? 'Peran · LIVE' : 'Peran · DEMO',
        title: role.label,
        subtitle: role.description,
        body:
          '<dl class="ent-kv"><dt>Role ID</dt><dd class="mono">' + esc(role.id) + '</dd>' +
            '<dt>Tipe</dt><dd>' + (role.system ? 'Peran sistem' : 'Peran kustom') + '</dd>' +
            '<dt>Kapabilitas</dt><dd>' + role.capabilities.length + ' terdaftar' + (role.unbacked.length ? ', ' + role.unbacked.length + ' belum tersedia di server' : '') + '</dd></dl>' +
          '<div style="margin-top:14px"><div class="small strong" style="margin-bottom:6px">Kapabilitas</div>' +
            '<div class="ent-scope-list">' + role.capabilities.map(function (c) {
              var isUnbacked = role.unbacked.indexOf(c) >= 0;
              return '<span class="badge ' + (isUnbacked ? 'badge--outline ent-unbacked' : 'badge--brand') + '">' + esc(c) + (isUnbacked ? ' · belum tersedia' : '') + '</span>';
            }).join('') + '</div></div>' +
          '<div class="ent-warning-card" style="margin-top:14px"><span class="material-symbols-outlined">rule</span><div>Keputusan otorisasi nyata tetap di server.</div></div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>'
      });
    }

    function paint() {
      if (state.loading) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P9', title: 'Access Management', desc: 'Memuat data…' }) + ui.skeletonTable(5, 6);
        return;
      }
      if (state.denied) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P9 Authorization', title: 'Access Management', desc: 'Akses ditolak berdasarkan respons backend.' , actions: liveChip()}) +
          '<div class="banner banner--danger ent-banner"><span class="material-symbols-outlined">block</span>' +
          '<div><b>Akses ditolak (403).</b> Pemanggil tidak memiliki capability <span class="mono">' + esc(state.deniedCap || 'manage_users') + '</span>. ' +
          'Backend menolak GET <span class="mono">/api/v1/users</span> dan <span class="mono">/api/v1/roles</span>. ' +
          'Keputusan ini dibuat server, bukan ditentukan UI.</div></div>' +
          ui.errorState('Backend mengembalikan 403 forbidden untuk endpoint P9.', 'Muat ulang');
        var retry2 = root.querySelector('[data-retry]');
        if (retry2) retry2.addEventListener('click', load);
        return;
      }
      if (state.error) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Administration · P9', title: 'Access Management' }) + ui.errorState(state.error, 'Muat ulang');
        var retry = root.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }

      var live = !!api.isLive && api.isLive();
      var head = ui.pageHead({
        eyebrow: 'Administration · P9 Authorization',
        title: 'Access Management',
        desc: 'Anggota tenant, peran, dan matriks izin. Mode ditentukan probe: ' + (live ? 'LIVE dari backend (/api/v1/users, /api/v1/roles).' : 'DEMO — backend tak tercapai.'),
        actions: modeChip()
      });

      var banner = live ? '<div class="banner banner--success ent-banner"><span class="material-symbols-outlined">cloud_done</span>' +
        '<div><b>Data live.</b> Anggota dan peran dari backend (<span class="mono">/api/v1/users</span>, <span class="mono">/api/v1/roles</span>). ' +
        'Keputusan otorisasi nyata tetap di server.</div></div>'
      : '<div class="banner banner--demo ent-banner"><span class="material-symbols-outlined">science</span>' +
        '<div><b>Data demo.</b> Backend tak tercapai saat probe. Perubahans hanya berlaku pada tab ini dan tidak tercatat di mana pun.</div></div>';

      var tenantCard = ui.card({
        title: 'Konteks tenant ' + (live ? liveChip() : demoChip()),
        body:
          '<dl class="ent-kv">' +
            '<dt>Tenant</dt><dd>' + esc(state.tenant && state.tenant.id ? state.tenant.id : (live ? 'dari backend' : 'Kenari Group')) + (state.tenant && state.tenant.id ? ' <span class="mono tiny faint">' + esc(state.tenant.id) + '</span>' : '') + '</dd>' +
            (live ? '<dt>Sumber</dt><dd>Backend <span class="mono">/api/v1/auth/session</span> · <span class="mono">/api/v1/users</span></dd>' : '<dt>Slug</dt><dd class="mono">kenari</dd><dt>Zona waktu</dt><dd>Asia/Jakarta</dd><dt>Status</dt><dd><span class="badge badge--success">Active</span></dd>') +
          '</dl>'
      });

      var tabs = [['anggota', 'Anggota'], ['peran', 'Peran'], ['matriks', 'Matriks izin']];
      var tabBar = '<div class="segmented ent-tabs" role="tablist" aria-label="Bagian akses">' +
        tabs.map(function (t) {
          return '<button role="tab" aria-selected="' + (state.tab === t[0] ? 'true' : 'false') + '" class="' + (state.tab === t[0] ? 'is-active' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';

      var panel = '';
      if (state.tab === 'anggota') {
        var rows = filteredMembers();
        var filters = [['all', 'Semua'], ['accepted', 'Accepted'], ['invited', 'Invited'], ['suspended', 'Suspended']];
        panel = ui.card({
          title: 'Anggota ' + (live ? liveChip() : demoChip()),
          flush: true,
          body:
            '<div class="ent-toolbar">' +
              '<div class="ent-search"><span class="material-symbols-outlined">search</span>' +
                '<input class="input" id="ent-member-q" placeholder="Cari nama, email, atau peran…" value="' + esc(state.query) + '" aria-label="Cari anggota"></div>' +
              '<div class="segmented" role="group" aria-label="Filter status">' +
                filters.map(function (f) {
                  return '<button class="' + (state.statusFilter === f[0] ? 'is-active' : '') + '" data-status-filter="' + f[0] + '">' + esc(f[1]) + '</button>';
                }).join('') +
              '</div>' +
              '<button class="btn btn--secondary" disabled title="Backend P9: belum ada endpoint undang/PATCH"><span class="material-symbols-outlined">person_add</span>Undang</button>' +
            '</div>' +
            '<div class="table-wrap"><table class="table"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Status</th><th>Accepted at</th><th>Sumber</th></tr></thead><tbody>' +
              (rows.length
                ? rows.map(function (m) {
                    return '<tr data-member-id="' + esc(m.id) + '" class="is-clickable" tabindex="0" role="button" aria-label="Detail ' + esc(m.displayName) + '">' +
                      '<td><div class="small strong">' + esc(m.displayName) + '</div></td>' +
                      '<td class="mono tiny">' + esc(m.email) + '</td>' +
                      '<td class="small">' + esc(roleLabel(m.role)) + '</td>' +
                      '<td><span class="badge badge--' + (STATUS_TONE[m.status] || '') + '">' + esc(STATUS_LABEL[m.status] || m.status) + '</span></td>' +
                      '<td class="small">' + esc(m.acceptedAt ? U.fmtDay(m.acceptedAt) : '—') + '</td>' +
                      '<td class="tiny muted">' + esc(m.source) + '</td></tr>';
                  }).join('')
                : '<tr><td colspan="6">' + ui.empty({ title: 'Tidak ada anggota cocok', body: 'Ubah kata kunci atau filter status.', icon: 'search_off' }) + '</td></tr>') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">' + rows.length + ' dari ' + state.members.length + ' anggota ditampilkan · klik baris untuk detail · aksi suspend/aktifkan hanya di mode demo.</div>'
        });
      } else if (state.tab === 'peran') {
        panel = '<div class="ent-grid ent-grid--wide">' + state.roles.map(function (r) {
          return ui.card({
            title: esc(r.label) + ' ' + (live ? liveChip() : demoChip()),
            desc: esc(r.description),
            body:
              '<div class="row" style="gap:14px;margin-bottom:10px">' +
                '<div><div class="kpi__label">Kapabilitas</div><div class="kpi__value" style="font-size:22px">' + r.capabilities.length + '</div></div>' +
                '<div><div class="kpi__label">Belum tersedia</div><div class="kpi__value" style="font-size:22px;color:var(--warning-600)">' + r.unbacked.length + '</div></div>' +
              '</div>' +
              (r.unbacked.length ? '<div class="tiny muted">Belum tersedia di server: ' + esc(r.unbacked.join(', ')) + '</div>' : '<div class="tiny muted">Semua kapabilitas peran ini didukung server.</div>'),
            foot: '<button class="btn btn--secondary btn--sm" data-role-id="' + esc(r.id) + '"><span class="material-symbols-outlined">visibility</span>Detail peran</button>'
          });
        }).join('') + '</div>' +
        '<div class="ent-warning-card" style="margin-top:12px"><span class="material-symbols-outlined">block</span><div>Membuat atau mengubah peran dinonaktifkan: belum ada endpoint backend POST/PATCH /roles. Tidak ada tombol simpan yang berpura-pura berfungsi.</div></div>';
      } else if (state.tab === 'matriks') {
        var cols = state.permissions;
        var roleIds = live ? state.roles.map(function (r) { return r.id; }) : ['governance_lead', 'operations_manager', 'auditor', 'finance_approver', 'requester'];
        panel = ui.card({
          title: 'Matriks izin ' + (live ? liveChip() : demoChip()),
          body:
            '<div class="ent-matrix-wrap"><table class="matrix"><thead><tr><th>Kapabilitas</th>' +
              roleIds.map(function (r) { return '<th>' + esc(roleLabel(r)) + '</th>'; }).join('') +
            '</tr></thead><tbody>' +
              cols.map(function (p) {
                var cells = roleIds.map(function (r) {
                  var v = (state.matrix[r] || {})[p.id] || (live ? (state.capabilities.indexOf(p.id) >= 0 ? 'yes' : 'no') : 'no');
                  var cls = v === 'yes' ? 'yes' : (v === 'lim' ? 'lim' : 'no');
                  var label = v === 'yes' ? '✓' : (v === 'lim' ? 'terbatas' : '—');
                  return '<td class="' + cls + '">' + label + '</td>';
                }).join('');
                return '<tr class="' + (p.backed ? '' : 'ent-unbacked') + '"><td>' + esc(p.label || p.id) +
                  (p.backed ? '' : ' <span class="tiny faint">(belum tersedia)</span>') + '</td>' + cells + '</tr>';
              }).join('') +
            '</tbody></table></div>' +
            '<p class="ent-matrix-note">' + (live ? '✓ = capability dipegang pemanggil (server: /api/v1/permissions) · — = tidak dipegang. Baris redup = capability belum punya penegak server (unbacked), bukan ditolak. Keputusan otorisasi nyata tetap dibuat server.' : '✓ = diizinkan (fixture) · terbatas = dibatasi mandat/konteks · — = tidak diizinkan. Baris redup belum diimplementasikan server (“belum tersedia”), bukan ditolak. Keputusan otorisasi nyata tetap dibuat server, bukan peramban.') + '</p>'
        });
      }

      root.innerHTML = head + banner + tenantCard + tabBar + '<div id="ent-tab-panel">' + panel + '</div>';

      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); paint(); });
      });
      var q = root.querySelector('#ent-member-q');
      if (q) q.addEventListener('input', U.debounce(function () { state.query = q.value; paint(); var nq = root.querySelector('#ent-member-q'); if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); } }, 180));
      root.querySelectorAll('[data-status-filter]').forEach(function (b) {
        b.addEventListener('click', function () { state.statusFilter = b.getAttribute('data-status-filter'); paint(); });
      });
      root.querySelectorAll('[data-member-id]').forEach(function (rowEl) {
        var open = function () {
          var id = rowEl.getAttribute('data-member-id');
          var m = state.members.filter(function (x) { return x.id === id; })[0];
          if (m) openMemberDrawer(m);
        };
        rowEl.addEventListener('click', open);
        rowEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
      root.querySelectorAll('[data-role-id]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-role-id');
          var r = state.roles.filter(function (x) { return x.id === id; })[0];
          if (r) openRoleDrawer(r);
        });
      });
    }

    load();
  };
})();
