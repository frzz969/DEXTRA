/* Views — Administration: Users & Roles, Permissions, Integrations, Settings. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var STATUS_TONE = { active: 'success', invited: 'warning', disabled: 'outline' };
  var STATUS_LABEL = { active: 'Aktif', invited: 'Diundang', disabled: 'Nonaktif' };

  /* ---------------- Users & Roles ---------------- */
  D.views.users = function (root) {
    var canManage = D.session.can('manage_users');

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Administration · Users & Roles',
        title: 'Users & Roles',
        desc: 'Peran menentukan apa yang dapat diputuskan seseorang. Tidak ada peran yang dapat menyetujui dan mengeksekusi atas namanya sendiri tanpa mandat.',
        actions: (canManage ? '<button class="btn btn--primary" id="invite"><span class="material-symbols-outlined">person_add</span>Undang pengguna</button>' : '') +
          '<a class="btn btn--secondary" href="#/permissions"><span class="material-symbols-outlined">key</span>Matriks izin</a>'
      }) +
      ui.demoBanner() +
      '<div class="grid grid--4" style="margin-bottom:16px">' +
        ui.kpi({ label: 'Pengguna', value: store.users.length, icon: 'group', tone: 'accent', foot: '<span class="material-symbols-outlined">apartment</span>' + esc(store.org ? store.org.name : 'Kenari Group') }) +
        ui.kpi({ label: 'Aktif', value: store.users.filter(function (u) { return u.status === 'active'; }).length, icon: 'check_circle', tone: 'success', foot: '<span class="material-symbols-outlined">login</span>Dapat masuk' }) +
        ui.kpi({ label: 'Diundang', value: store.users.filter(function (u) { return u.status === 'invited'; }).length, icon: 'mail', tone: 'warn', foot: '<span class="material-symbols-outlined">hourglass</span>Belum aktivasi' }) +
        ui.kpi({ label: 'Peran', value: store.roles.length, icon: 'badge', foot: '<span class="material-symbols-outlined">policy</span>Termasuk read-only' }) +
      '</div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card__head"><div><h2>Pengguna</h2><p>Anggota organisasi dan peran yang dipegang</p></div>' +
        '<div class="spacer"></div><span class="badge badge--outline">' + store.users.length + ' akun</span></div><div id="users-host"></div></div>' +
      '<div class="grid grid--3">' + store.roles.map(function (r) {
        var count = store.users.filter(function (u) { return u.role === r.id; }).length;
        var caps = store.capabilities.filter(function (c) { return (store.permMatrix[r.id] || {})[c.key] === 'yes'; }).length;
        return '<article class="card card--pad card--hover" style="cursor:pointer" data-role="' + esc(r.id) + '">' +
          '<div class="row" style="gap:9px;margin-bottom:6px">' +
            '<span class="spec-avatar" style="width:32px;height:32px;border-radius:9px"><span class="material-symbols-outlined" style="font-size:17px">' +
            (r.id === 'auditor' ? 'visibility' : r.id === 'org_admin' ? 'admin_panel_settings' : r.id === 'requester' ? 'send' : 'verified_user') + '</span></span>' +
            '<div style="flex:1"><div class="small strong">' + esc(r.name) + '</div><div class="tiny muted">' + count + ' pengguna</div></div>' +
            '<span class="badge badge--outline">' + caps + ' izin</span>' +
          '</div>' +
          '<p class="tiny muted" style="line-height:1.5">' + esc(r.desc) + '</p>' +
        '</article>';
      }).join('') + '</div>';

    var host = root.querySelector('#users-host');
    host.appendChild(ui.table({
      columns: [
        { key: 'name', label: 'Pengguna', render: function (u) {
          return '<div class="row" style="gap:9px"><span class="avatar">' + esc(U.initials(u.name)) + '</span>' +
            '<div><div class="cell-title">' + esc(u.name) + '</div><div class="cell-sub">' + esc(u.email) + '</div></div></div>';
        }},
        { key: 'role', label: 'Peran', width: '190px', render: function (u) {
          var r = store.role(u.role);
          return '<span class="badge badge--brand">' + esc(r ? r.name : u.role) + '</span>';
        }},
        { key: 'dept', label: 'Departemen', width: '180px', render: function (u) { return '<span class="small">' + esc(u.dept) + '</span>'; } },
        { key: 'last_active', label: 'Aktivitas terakhir', width: '150px', render: function (u) { return '<span class="tiny muted">' + U.rel(u.last_active) + '</span>'; } },
        { key: 'status', label: 'Status', width: '110px', render: function (u) {
          return '<span class="badge badge--' + (STATUS_TONE[u.status] || '') + '">' + (STATUS_LABEL[u.status] || u.status) + '</span>';
        }},
        { key: 'act', label: '', width: '56px', align: 'right', render: function (u) {
          return '<button class="icon-btn" data-user-menu="' + esc(u.id) + '" aria-label="Aksi pengguna"><span class="material-symbols-outlined">more_vert</span></button>';
        }}
      ],
      rows: store.users.slice(), pageSize: 8,
      empty: ui.empty({ icon: 'group', title: 'Belum ada pengguna', body: 'Undang anggota organisasi untuk mulai bekerja.' })
    }));

    host.querySelectorAll('[data-user-menu]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var u = store.users.filter(function (x) { return x.id === btn.getAttribute('data-user-menu'); })[0];
        ui.menu(btn, [
          { text: 'Lihat profil', icon: 'person', onClick: function () { ui.toast('Profil pengguna belum tersedia di prototipe.', 'info'); } },
          { text: 'Ubah peran', icon: 'badge', onClick: function () { changeRole(u); } },
          { sep: true },
          { text: 'Nonaktifkan akun', icon: 'block', danger: true, onClick: function () {
            ui.confirm({ title: 'Nonaktifkan ' + u.name + '?', tone: 'danger', confirmLabel: 'Nonaktifkan',
              body: 'Akun tidak dapat masuk, tetapi rekam jejak audit dan persetujuan yang pernah ia berikan tetap tersimpan.' })
              .then(function (r) {
                if (!r || !r.ok) return;
                if (!canManage) { ui.toast('Peran Anda tidak dapat mengubah pengguna.', 'warning'); return; }
                u.status = 'disabled';
                ui.toast(u.name + ' dinonaktifkan (demo).', 'success');
                D.router.render();
              });
          }}
        ]);
      });
    });

    root.querySelectorAll('[data-role]').forEach(function (card) {
      card.addEventListener('click', function () { D.router.go('/permissions'); });
    });

    function changeRole(u) {
      if (!canManage) { ui.toast('Peran Anda tidak dapat mengubah pengguna.', 'warning'); return; }
      ui.modal({
        title: 'Ubah peran — ' + u.name,
        subtitle: 'Perubahan berlaku segera setelah disimpan',
        body: '<div class="field"><label class="field__label">Peran</label>' +
          '<select class="select" id="role-select">' + store.roles.map(function (r) {
            return '<option value="' + r.id + '"' + (r.id === u.role ? ' selected' : '') + '>' + esc(r.name) + '</option>';
          }).join('') + '</select>' +
          '<div class="field__hint">Peran menentukan kemampuan menyetujui, menerbitkan mandat, dan membaca audit.</div></div>' +
          '<div class="banner banner--warning" style="margin-top:12px"><span class="material-symbols-outlined">warning</span>' +
          '<div>Menaikkan peran memberi wewenang nyata. Perubahan dicatat di audit trail.</div></div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Batal</button><button class="btn btn--primary" id="save-role">Simpan</button>',
        onMount: function (node, ov) {
          node.querySelector('#save-role').addEventListener('click', function () {
            var next = node.querySelector('#role-select').value;
            ov.close();
            if (store.mode === 'live') { ui.toast('Perubahan peran belum tersedia di API lokal.', 'warning'); return; }
            u.role = next;
            store.audit.unshift({ at: new Date().toISOString(), type: 'role_changed', actor: D.session.user.name, plan_id: null, mandate_id: null, reason_code: null, detail: u.name + ' → ' + (store.role(next) || {}).name });
            ui.toast('Peran ' + u.name + ' diubah menjadi ' + (store.role(next) || {}).name + ' (demo).', 'success');
            D.router.render();
          });
        }
      });
    }

    var invite = root.querySelector('#invite');
    if (invite) invite.addEventListener('click', function () {
      ui.modal({
        title: 'Undang pengguna', subtitle: 'Undangan dikirim oleh administrator',
        body: '<div class="stack" style="gap:12px">' +
          '<div class="field"><label class="field__label">Nama lengkap <span class="req">*</span></label><input class="input" id="inv-name" placeholder="Nama pengguna"></div>' +
          '<div class="field"><label class="field__label">Email kantor <span class="req">*</span></label><input class="input" id="inv-email" placeholder="nama@kenari.co.id" type="email"><div class="field__hint">Domain harus sesuai organisasi.</div></div>' +
          '<div class="field"><label class="field__label">Peran</label><select class="select" id="inv-role">' +
            store.roles.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('') + '</select></div>' +
          '</div><div class="banner banner--warning" style="margin-top:12px"><span class="material-symbols-outlined">construction</span>' +
          '<div>Prototipe: formulir ini tidak mengirim email. Pengiriman undangan memerlukan backend.</div></div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Batal</button><button class="btn btn--primary" id="send-invite">Kirim undangan</button>',
        onMount: function (node, ov) {
          node.querySelector('#send-invite').addEventListener('click', function () {
            var name = node.querySelector('#inv-name').value.trim();
            var email = node.querySelector('#inv-email').value.trim();
            if (!name || !email) { ui.toast('Nama dan email wajib diisi.', 'error'); return; }
            ov.close();
            store.users.push({ id: 'user_' + (store.users.length + 1), name: name, role: node.querySelector('#inv-role').value, title: 'Anggota baru', dept: '—', email: email.replace(/^(.?).*@/, '$1***@'), last_active: null, status: 'invited' });
            ui.toast('Undangan dicatat secara lokal (demo). Tidak ada email terkirim.', 'info', 4800);
            D.router.render();
          });
        }
      });
    });
  };

  /* ---------------- Permissions ---------------- */
  D.views.permissions = function (root) {
    var canManage = D.session.can('manage_users');
    var head = '<tr><th style="text-align:left">Kemampuan</th>' + store.roles.map(function (r) {
      return '<th>' + esc(r.name) + '</th>';
    }).join('') + '</tr>';
    var body = store.capabilities.map(function (c) {
      return '<tr><td>' + esc(c.label) + '</td>' + store.roles.map(function (r) {
        var v = (store.permMatrix[r.id] || {})[c.key];
        if (v === 'yes') return '<td class="yes"><span class="material-symbols-outlined" style="font-size:17px;display:inline-block">check_circle</span></td>';
        if (v === 'lim') return '<td class="lim">terbatas</td>';
        return '<td class="no"><span class="material-symbols-outlined" style="font-size:17px;display:inline-block">remove</span></td>';
      }).join('') + '</tr>';
    }).join('');

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Administration · Permissions',
        title: 'Permissions',
        desc: 'Matriks kemampuan per peran. Ini sumber kebenaran untuk navigasi dan tombol yang aktif di seluruh dashboard.',
        actions: (canManage ? '<button class="btn btn--secondary" id="edit-perm"><span class="material-symbols-outlined">edit</span>Ubah matriks</button>' : '') +
          '<a class="btn btn--secondary" href="#/users"><span class="material-symbols-outlined">group</span>Pengguna</a>'
      }) +
      ui.demoBanner() +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start">' +
        '<div class="card"><div class="card__head"><div><h2>Matriks izin</h2><p>Peran × kemampuan</p></div><div class="spacer"></div>' +
          '<div class="chart-legend"><span><span class="material-symbols-outlined" style="font-size:14px;color:var(--success-600)">check_circle</span>penuh</span>' +
          '<span class="lim">terbatas</span><span><span class="material-symbols-outlined" style="font-size:14px;color:var(--faint)">remove</span>tidak ada</span></div></div>' +
          '<div class="card__body card__body--flush" style="overflow-x:auto"><table class="matrix"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div></div>' +
        '<div class="stack">' +
          ui.card({ title: 'Peran Anda', body:
            '<div class="row" style="gap:9px"><span class="avatar avatar--lg">' + esc(U.initials(D.session.user.name)) + '</span>' +
            '<div><div class="small strong">' + esc(D.session.user.name) + '</div><div class="tiny muted">' + esc(D.session.roleLabel()) + '</div></div></div>' +
            '<div class="divider"></div>' +
            '<div class="stack" style="gap:6px">' + store.capabilities.map(function (c) {
              var v = (store.permMatrix[D.session.user.role] || {})[c.key];
              return '<div class="row" style="gap:7px"><span class="material-symbols-outlined" style="font-size:14px;color:' +
                (v === 'yes' ? 'var(--success-600)' : v === 'lim' ? 'var(--warning-600)' : 'var(--faint)') + '">' +
                (v === 'yes' ? 'check_circle' : v === 'lim' ? 'error' : 'remove') + '</span>' +
                '<span class="tiny ' + (v === 'no' ? 'muted' : '') + '">' + esc(c.label) + '</span></div>';
            }).join('') + '</div>'
          }) +
          ui.card({ title: 'Catatan desain', body:
            '<p class="small muted" style="line-height:1.6">Navigasi menyembunyikan halaman yang tidak dapat diakses, tetapi item tetap terlihat dengan ikon kunci agar orang tahu halaman itu ada dan mengapa ia terkunci.</p>' +
            '<p class="small muted" style="line-height:1.6;margin-top:8px">Izin "terbatas" berarti tindakan hanya berlaku pada kondisi tertentu — misalnya approver Legal hanya untuk penerima eksternal.</p>'
          }) +
        '</div>' +
      '</div>';

    var ep = root.querySelector('#edit-perm');
    if (ep) ep.addEventListener('click', function () {
      ui.toast('Pengeditan matriks izin memerlukan backend tata kelola. Prototipe ini hanya menampilkan matriks.', 'warning', 4600);
    });
  };

  /* ---------------- Integrations ---------------- */
  D.views.integrations = function (root) {
    var canManage = D.session.can('manage_integrations');
    var SRC = D.sources;
    var summary = SRC.summary();
    var STATE_TONE = { live: 'success', partial: 'warning', demo: 'outline', none: 'outline' };
    var groups = {};
    store.integrations.forEach(function (i) { (groups[i.category] = groups[i.category] || []).push(i); });
    var TONE = { connected: 'success', mock: 'warning', planned: 'outline' };
    var LABEL = { connected: 'Terhubung', mock: 'Mock adapter', planned: 'Direncanakan' };

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Administration · Integrations',
        title: 'Integrations',
        desc: 'Sistem yang dapat dijangkau DEXTRA. Hanya server MCP lokal yang benar-benar mengeksekusi; adapter lain masih mock atau belum tersedia.',
        actions: '<a class="btn btn--secondary" href="#/execution"><span class="material-symbols-outlined">play_circle</span>Riwayat eksekusi</a>'
      }) +
      '<div class="banner banner--info" style="margin-bottom:16px"><span class="material-symbols-outlined">info</span>' +
        '<div><b>Status di halaman ini jujur apa adanya.</b> "Mock adapter" berarti tidak ada pesan nyata yang dikirim. "Direncanakan" berarti belum ada implementasi sama sekali.</div></div>' +
      ui.demoBanner() +
      '<div class="card" style="margin-bottom:16px">' +
        '<div class="card__head"><div><h2>Pemetaan rute → backend</h2>' +
          '<p>' + SRC.routes.length + ' rute · ' + summary.live + ' terhubung penuh · ' +
          summary.partial + ' sebagian · ' + summary.demo + ' data contoh · ' +
          summary.none + ' bukan rute data</p></div>' +
          '<span class="badge badge--outline" title="Tool MCP yang benar-benar dipanggil oleh rute di atas">' + SRC.tools().length + ' tool dipakai</span></div>' +
        '<div id="route-map-host"></div>' +
      '</div>' +
      Object.keys(groups).map(function (g) {
        return '<div class="card" style="margin-bottom:16px">' +
          '<div class="card__head"><div><h2>' + esc(g) + '</h2><p>' + groups[g].length + ' koneksi</p></div></div>' +
          '<div class="card__body card__body--flush">' + groups[g].map(function (i) {
            return '<div class="int-row" data-int="' + esc(i.id) + '">' +
              '<span class="spec-avatar' + (i.status === 'planned' ? ' spec-avatar--engine' : '') + '"><span class="material-symbols-outlined">' + i.icon + '</span></span>' +
              '<div class="int-row__main">' +
                '<div class="row" style="gap:8px"><span class="small strong">' + esc(i.name) + '</span>' +
                  '<span class="badge badge--' + TONE[i.status] + '">' + LABEL[i.status] + '</span></div>' +
                '<div class="tiny muted" style="margin-top:1px">' + esc(i.meta) + '</div>' +
                '<p class="int-row__desc">' + esc(i.desc) + '</p>' +
              '</div>' +
              '<div class="int-row__side">' +
                (i.last_sync ? '<span class="tiny faint">sync ' + U.rel(i.last_sync) + '</span>' : '<span class="tiny faint">belum pernah sync</span>') +
                (i.status === 'planned'
                  ? '<button class="btn btn--secondary btn--sm" disabled>Belum tersedia</button>'
                  : '<button class="btn btn--secondary btn--sm">' + (i.status === 'mock' ? 'Lihat konfigurasi' : 'Kelola') + '</button>') +
              '</div>' +
            '</div>';
          }).join('') + '</div></div>';
      }).join('');

    root.querySelector('#route-map-host').appendChild(ui.table({
      compact: true,
      pageSize: 0,
      columns: [
        { key: 'route', label: 'Rute', width: '210px', render: function (r) {
          return '<div class="cell-title mono">' + esc(r.route) + '</div>' +
            '<div class="cell-sub">' + esc(r.label) + '</div>';
        }},
        { key: 'state', label: 'Status', width: '130px', render: function (r) {
          return '<span class="badge badge--' + STATE_TONE[r.state] + '">' + esc(SRC.stateLabel(r.state)) + '</span>';
        }},
        { key: 'tools', label: 'Tool MCP', width: '240px', render: function (r) {
          if (!r.tools.length) return '<span class="tiny faint">tidak ada</span>';
          return r.tools.map(function (t) { return '<span class="chip mono">' + esc(t) + '</span>'; }).join(' ');
        }},
        { key: 'modules', label: 'Modul repo', render: function (r) {
          var mods = r.modules.map(function (m) {
            return '<span class="chip" title="' + esc((SRC.modules[m] || {}).path || '') + '">' + esc(m) + '</span>';
          }).join(' ');
          return (mods || '<span class="tiny faint">—</span>') +
            '<div class="tiny muted" style="margin-top:3px">' + esc(r.note) + '</div>';
        }}
      ],
      rows: SRC.routes
    }));

    root.querySelectorAll('[data-int]').forEach(function (card) {
      card.addEventListener('click', function () {
        var i = store.integrations.filter(function (x) { return x.id === card.getAttribute('data-int'); })[0];
        ui.drawer({
          eyebrow: 'Integrasi', title: i.name, subtitle: i.category,
          body:
            '<div class="row" style="gap:8px;margin-bottom:12px"><span class="badge badge--' + TONE[i.status] + '">' + LABEL[i.status] + '</span>' +
              '<span class="badge badge--outline">' + esc(i.meta) + '</span></div>' +
            '<p class="small" style="line-height:1.6;color:var(--text-2)">' + esc(i.desc) + '</p>' +
            '<div class="divider"></div>' +
            '<dl class="def-list">' +
              '<dt>Kategori</dt><dd>' + esc(i.category) + '</dd>' +
              '<dt>Status</dt><dd>' + LABEL[i.status] + '</dd>' +
              '<dt>Sinkron terakhir</dt><dd>' + (i.last_sync ? U.fmtDate(i.last_sync) : '—') + '</dd>' +
              (i.id === 'mcp' ? '<dt>Endpoint</dt><dd class="mono tiny">http://127.0.0.1:8765</dd><dt>Binding</dt><dd class="mono tiny">loopback only</dd><dt>Token</dt><dd>ops (tidak disimpan di dashboard)</dd>' : '') +
            '</dl>' +
            (i.status === 'planned' ? '<div class="banner banner--warning" style="margin-top:14px"><span class="material-symbols-outlined">construction</span>' +
              '<div>Integrasi ini belum diimplementasikan. Tidak ada kredensial, endpoint, atau adapter yang tersedia.</div></div>' : '') +
            (i.status === 'mock' ? '<div class="banner banner--info" style="margin-top:14px"><span class="material-symbols-outlined">science</span>' +
              '<div>Adapter mock mencatat tindakan di log tanpa menghubungi layanan eksternal. Hasil eksekusi berstatus "sent" hanya di lingkungan demo.</div></div>' : '')
          ,
          footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
            (i.status === 'planned' || !canManage ? '' : '<button class="btn btn--primary" id="int-save">Simpan konfigurasi</button>')
        });
        var sv = document.getElementById('int-save');
        if (sv) sv.addEventListener('click', function () { ui.toast('Konfigurasi integrasi belum dapat diubah dari prototipe.', 'info'); });
      });
    });
  };

  /* ---------------- Settings ---------------- */
  D.views.settings = function (root) {
    var tab = 'org';
    var org = store.org || {};

    /* visualises the protected window that TIME-03 enforces — the rule most often
       hit by requesters, so it is worth showing rather than describing */
    function scheduleCard() {
      var oh = org.office_hours || { start: '08:00', end: '17:00' };
      var fp = org.friday_prayer;
      function mins(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
      var start = mins(oh.start), end = mins(oh.end), span = Math.max(1, end - start);
      var seg = fp ? {
        left: ((mins(fp.start) - start) / span) * 100,
        width: ((mins(fp.end) - mins(fp.start)) / span) * 100
      } : null;

      return '<div class="card" style="margin-top:16px"><div class="card__head"><div><h2>Jendela waktu terlindungi</h2>' +
        '<p>Ditegakkan kebijakan TIME-03</p></div></div><div class="card__body">' +
        '<div class="timebar"><div class="timebar__track">' +
          (seg ? '<span class="timebar__blocked" style="left:' + seg.left + '%;width:' + seg.width + '%"></span>' : '') +
        '</div>' +
        '<div class="timebar__scale">' +
          '<span>' + esc(oh.start) + '</span>' +
          (fp ? '<span style="left:' + seg.left + '%">' + esc(fp.start) + '</span><span style="left:' + (seg.left + seg.width) + '%">' + esc(fp.end) + '</span>' : '') +
          '<span style="left:100%">' + esc(oh.end) + '</span>' +
        '</div></div>' +
        '<div class="row row--wrap" style="gap:16px;margin-top:14px">' +
          '<span class="row" style="gap:6px"><span class="dot dot--brand"></span><span class="tiny muted">Jam kerja</span></span>' +
          (fp ? '<span class="row" style="gap:6px"><span class="dot dot--danger"></span><span class="tiny muted">Salat Jumat ' + esc(fp.start) + '–' + esc(fp.end) + ' · tidak dapat dijadwalkan</span></span>' : '') +
        '</div>' +
        ((org.holidays || []).length
          ? '<div class="divider" style="margin:14px 0 10px"></div>' +
            '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--muted)">event_busy</span>' +
            '<span class="tiny muted" style="flex:1">Hari libur mendatang</span>' +
            org.holidays.map(function (h) { return '<span class="badge badge--outline">' + esc(h) + '</span>'; }).join('') + '</div>'
          : '') +
        '</div></div>';
    }

    function orgPanel() {
      return '<div class="card"><div class="card__head"><div><h2>Aturan organisasi</h2><p>Sumber: server lokal (read-only)</p></div>' +
        '<div class="spacer"></div><span class="badge badge--outline"><span class="material-symbols-outlined" style="font-size:13px">lock</span>Read-only</span></div>' +
        '<div class="card__body"><div class="grid grid--2" style="gap:16px">' +
          [['Organisasi', org.name || '—'], ['Org ID', org.org_id || '—'], ['Zona waktu', (org.timezones || []).join(', ') || '—'],
           ['Jam kerja', (org.office_hours ? org.office_hours.start + ' – ' + org.office_hours.end : '—')],
           ['Salat Jumat', (org.friday_prayer ? org.friday_prayer.start + ' – ' + org.friday_prayer.end : 'tidak ada')],
           ['Hari libur', (org.holidays || []).join(', ') || '—'],
           ['Versi matriks persetujuan', org.approval_matrix_version || '—'],
           ['Versi kontrak', org.contract_version || '—']].map(function (r) {
            return '<div><div class="tiny muted">' + esc(r[0]) + '</div><div class="small strong" style="margin-top:2px">' + esc(r[1]) + '</div></div>';
          }).join('') +
        '</div>' +
        '<div class="banner banner--info" style="margin-top:16px"><span class="material-symbols-outlined">info</span>' +
        '<div>Aturan ini dibaca dari server. Untuk mengubahnya diperlukan akses administrator organisasi dan backend tata kelola.</div></div>' +
        '</div></div>' +
        scheduleCard() +
        '<div class="card" style="margin-top:16px"><div class="card__head"><div><h2>Kebijakan aktif</h2><p>Ringkas, kelola di halaman Policies</p></div>' +
        '<div class="spacer"></div><a class="btn btn--secondary btn--sm" href="#/policies">Buka policies</a></div>' +
        '<div class="card__body card__body--flush">' + store.policies.slice(0, 4).map(function (p) {
          return '<div class="row" style="padding:11px 16px;border-bottom:1px solid var(--border)">' +
            '<span class="mono tiny faint" style="width:64px">' + esc(p.id) + '</span>' +
            '<span class="small" style="flex:1">' + esc(p.name) + '</span>' +
            (p.active ? '<span class="badge badge--success">aktif</span>' : '<span class="badge badge--outline">nonaktif</span>') + '</div>';
        }).join('') + '</div></div>';
    }

    function securityPanel() {
      return '<div class="card"><div class="card__head"><div><h2>Model keamanan</h2><p>Klaim yang dapat diverifikasi, bukan pemasaran</p></div></div>' +
        '<div class="card__body"><div class="stack" style="gap:14px">' +
          [['Local-only service exposure', 'Semua layanan listen di 127.0.0.1 (loopback). Tidak terbuka ke jaringan.', 'check_circle'],
           ['Scoped execution authorization', 'Token agent (read/plan) terpisah dari token ops (write/execute). Ditegakkan di server, bukan di prompt.', 'check_circle'],
           ['Mandat terikat plan_hash', 'Executor memvalidasi hash rencana sebelum mengeksekusi. Rencana yang berubah tidak dapat memakai mandat lama.', 'check_circle'],
           ['Token ops tidak disimpan di dashboard', 'Token hanya ada di sessionStorage setelah login manual; dashboard tidak menuliskan token ke halaman.', 'check_circle']].map(function (r) {
            return '<div class="row" style="align-items:flex-start;gap:10px"><span class="material-symbols-outlined" style="font-size:18px;color:var(--success-600);margin-top:1px">' + r[2] + '</span>' +
              '<div><div class="small strong">' + esc(r[0]) + '</div><div class="tiny muted" style="line-height:1.5">' + esc(r[1]) + '</div></div></div>';
          }).join('') +
          '<div class="divider" style="margin:2px 0"></div>' +
          '<div class="row" style="align-items:flex-start;gap:10px"><span class="material-symbols-outlined" style="font-size:18px;color:var(--warning-600);margin-top:1px">info</span>' +
          '<div><div class="small strong">Bukan jaminan absolut</div><div class="tiny muted" style="line-height:1.5">Ini bukan klaim "anti-eksfiltrasi 100%". MCP server hanya menerima caller terotorisasi; endpoint approval dilindungi origin/CSRF; error tidak membocorkan data sensitif.</div></div></div>' +
        '</div></div></div>' +
        '<div class="card" style="margin-top:16px"><div class="card__head"><div><h2>Sesi saat ini</h2></div></div><div class="card__body">' +
          '<dl class="def-list"><dt>Peran</dt><dd>' + esc(D.session.roleLabel()) + '</dd>' +
          '<dt>Mode data</dt><dd>' + (store.mode === 'live' ? 'Live · MCP lokal' : 'Demo · dataset lokal') + '</dd>' +
          '<dt>Token ops</dt><dd>' + (D.api.token() ? 'ada di sesi' : 'belum diisi') + '</dd>' +
          '<dt>Jalur</dt><dd class="mono tiny">' + esc(D.api.mode === 'live' ? '127.0.0.1:8765' : 'peramban saja') + '</dd></dl>' +
          '<button class="btn btn--danger-soft btn--sm" id="logout" style="margin-top:12px"><span class="material-symbols-outlined">logout</span>Keluar dari sesi</button>' +
        '</div></div>';
    }

    function appearancePanel() {
      var t = D.theme.get();
      return '<div class="card"><div class="card__head"><div><h2>Tampilan</h2><p>Preferensi tersimpan di peramban ini</p></div></div>' +
        '<div class="card__body"><div class="grid grid--2">' +
          [['light', 'Terang', 'Permukaan putih, kontras tinggi untuk ruang kerja terang.'],
           ['dark', 'Gelap', 'Permukaan gelap untuk kerja malam dan layar besar.']].map(function (o) {
            return '<button class="card card--pad" data-theme-opt="' + o[0] + '" style="text-align:left;border-color:' + (t === o[0] ? 'var(--brand-500)' : 'var(--border)') + '">' +
              '<div class="row" style="gap:8px;margin-bottom:8px">' +
                '<span style="width:38px;height:26px;border-radius:6px;border:1px solid var(--border);background:' + (o[0] === 'dark' ? '#16161f' : '#ffffff') + '"></span>' +
                '<span class="small strong">' + o[1] + '</span>' +
                (t === o[0] ? '<span class="spacer"></span><span class="badge badge--brand">aktif</span>' : '') +
              '</div><p class="tiny muted" style="line-height:1.5">' + esc(o[2]) + '</p></button>';
          }).join('') +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="row"><div style="flex:1"><div class="small strong">Sidebar ringkas</div><div class="tiny muted">Ciutkan navigasi menjadi ikon saja.</div></div>' +
          '<label class="switch"><input type="checkbox" id="collapse-pref" ' + (document.body.classList.contains('is-collapsed') ? 'checked' : '') + '><span class="switch__track"></span></label></div>' +
        '</div></div>';
    }

    function dataPanel() {
      return '<div class="card"><div class="card__head"><div><h2>Data & prototipe</h2><p>Transparansi sumber data</p></div></div>' +
        '<div class="card__body">' +
          '<div class="banner banner--' + (store.mode === 'live' ? 'success' : 'demo') + '" style="margin-bottom:14px"><span class="material-symbols-outlined">' +
            (store.mode === 'live' ? 'cloud_done' : 'science') + '</span><div><b>' + (store.mode === 'live' ? 'Terhubung ke MCP lokal' : 'Mode demo') + '</b><br>' +
            (store.mode === 'live' ? 'Data berasal dari server pada 127.0.0.1:8765.' : 'Dataset contoh dimuat di peramban. Tidak ada panggilan jaringan, tidak ada tindakan nyata.') + '</div></div>' +
          '<dl class="def-list"><dt>Work package</dt><dd>' + store.plans.length + '</dd>' +
          '<dt>Event audit</dt><dd>' + store.audit.length + '</dd>' +
          '<dt>Mandat</dt><dd>' + store.mandates.length + '</dd>' +
          '<dt>Eksekusi</dt><dd>' + store.executions.length + '</dd></dl>' +
          '<div class="divider"></div>' +
          '<div class="row" style="gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn--secondary btn--sm" id="export-all"><span class="material-symbols-outlined">download</span>Ekspor seluruh data (JSON)</button>' +
            '<button class="btn btn--danger-soft btn--sm" id="reset-demo"><span class="material-symbols-outlined">restart_alt</span>Muat ulang data demo</button>' +
          '</div>' +
          '<p class="tiny muted" style="margin-top:10px;line-height:1.5">Perubahan yang Anda lakukan pada prototipe ini hanya hidup di memori peramban dan hilang saat halaman dimuat ulang.</p>' +
        '</div></div>';
    }

    function paint() {
      root.innerHTML =
        ui.pageHead({
          eyebrow: 'Administration · Settings',
          title: 'Settings',
          desc: 'Konfigurasi organisasi, keamanan, tampilan, dan transparansi data.',
          actions: '<a class="btn btn--secondary" href="#/integrations"><span class="material-symbols-outlined">extension</span>Integrasi</a>'
        }) +
        '<div class="segmented" id="tabs" style="margin-bottom:16px">' +
          [['org', 'Organisasi'], ['security', 'Keamanan'], ['appearance', 'Tampilan'], ['data', 'Data']].map(function (t) {
            return '<button data-t="' + t[0] + '" class="' + (tab === t[0] ? 'is-active' : '') + '">' + t[1] + '</button>';
          }).join('') + '</div>' +
        '<div id="panel"></div>';

      var panel = root.querySelector('#panel');
      panel.innerHTML = tab === 'org' ? orgPanel() : tab === 'security' ? securityPanel() : tab === 'appearance' ? appearancePanel() : dataPanel();

      root.querySelectorAll('#tabs button').forEach(function (b) {
        b.addEventListener('click', function () { tab = b.getAttribute('data-t'); paint(); });
      });

      if (tab === 'appearance') {
        root.querySelectorAll('[data-theme-opt]').forEach(function (b) {
          b.addEventListener('click', function () {
            D.theme.apply(b.getAttribute('data-theme-opt'));
            D.shell.refresh();
            paint();
            ui.toast('Tema diterapkan.', 'success');
          });
        });
        var cp = root.querySelector('#collapse-pref');
        if (cp) cp.addEventListener('change', function () {
          document.body.classList.toggle('is-collapsed', cp.checked);
          try { localStorage.setItem('dextra_sidebar', cp.checked ? 'collapsed' : 'open'); } catch (e) {}
        });
      }
      if (tab === 'security') {
        var lo = root.querySelector('#logout');
        if (lo) lo.addEventListener('click', function () {
          D.api.clearToken();
          ui.toast('Token sesi dihapus.', 'success');
          D.router.go('/login');
        });
      }
      if (tab === 'data') {
        root.querySelector('#export-all').addEventListener('click', function () {
          U.download('dextra-dashboard-data.json', JSON.stringify({
            org: store.org, plans: store.plans, mandates: store.mandates, audit: store.audit,
            executions: store.executions, policies: store.policies, users: store.users, mode: store.mode
          }, null, 2), 'application/json');
          ui.toast('Seluruh data diekspor sebagai JSON.', 'success');
        });
        root.querySelector('#reset-demo').addEventListener('click', function () {
          ui.confirm({ title: 'Muat ulang data demo?', tone: 'danger', confirmLabel: 'Muat ulang', body: 'Perubahan lokal pada prototipe (persetujuan, pencabutan, perubahan kebijakan) akan hilang.' })
            .then(function (r) {
              if (!r || !r.ok) return;
              store.hydrateDemo();
              store.mode = 'demo';
              D.shell.refresh();
              D.router.render();
              ui.toast('Data demo dimuat ulang.', 'success');
            });
        });
      }
    }
    paint();
  };
})();
