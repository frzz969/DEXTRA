/* DEXTRA Dashboard — global shell: navigation, topbar, breadcrumbs, tabs, search. */
(function () {
  'use strict';
  var D = window.DEXTRA;
  var U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store, session = D.session;

  var NAV = [
    { group: 'Workspace', items: [
      { path: '/overview', title: 'Overview', icon: 'space_dashboard', view: 'overview', cap: 'view_all', desc: 'Ringkasan operasi, persetujuan, dan tata kelola' },
      { path: '/assistant', title: 'AI Assistant', icon: 'forum', view: 'assistant', cap: 'create_request', desc: 'Menyusun rencana dari permintaan bebas' },
      { path: '/requests', title: 'My Requests', icon: 'send', view: 'requests', cap: 'view_own', desc: 'Permintaan yang saya kirim' },
      { path: '/my-work', title: 'My Work', icon: 'assignment_ind', view: 'myWork', cap: 'view_own', desc: 'Pekerjaan yang menunggu saya' }
    ]},
    { group: 'Work Management', items: [
      { path: '/work-packages', title: 'Work Packages', icon: 'layers', view: 'workPackages', cap: 'view_all', desc: 'Seluruh work package' },
      { path: '/board', title: 'Task Board', icon: 'view_kanban', view: 'board', cap: 'view_all', desc: 'Papan kerja per tahap' },
      { path: '/execution', title: 'Execution History', icon: 'play_circle', view: 'execution', cap: 'view_all', desc: 'Rekaman eksekusi' }
    ]},
    { group: 'Workforce', items: [
      { path: '/workforce', title: 'Workforce', icon: 'groups', view: 'workforce', cap: 'view_all', desc: 'Roster spesialis dari berkas definisi agen' }
    ]},
    { group: 'Intelligence', items: [
      { path: '/analytics', title: 'Analytics', icon: 'query_stats', view: 'analytics', cap: 'view_all', desc: 'Ringkasan eksekusi yang benar-benar terukur' }
    ]},
    { group: 'Governance', items: [
      { path: '/approvals', title: 'Approval Inbox', icon: 'assignment_turned_in', view: 'approvals', cap: 'approve', desc: 'Menunggu keputusan manusia', count: 'awaiting' },
      { path: '/review', title: 'Review & Validation', icon: 'fact_check', view: 'reviewQueue', cap: 'view_all', desc: 'Tinjau rencana, lingkup, dan hasil' },
      { path: '/mandates', title: 'Mandates', icon: 'verified_user', view: 'mandates', cap: 'view_all', desc: 'Batas wewenang yang terbit' },
      { path: '/security', title: 'Security Center', icon: 'shield', view: 'security', cap: 'view_audit', desc: 'Penolakan, karantina, dan integritas rekaman' },
      { path: '/audit', title: 'Audit Trail', icon: 'receipt_long', view: 'audit', cap: 'view_audit', desc: 'Rekaman append-only' },
      { path: '/policies', title: 'Policies', icon: 'policy', view: 'policies', cap: 'view_all', desc: 'Aturan operasional dan batasannya' }
    ]},
    { group: 'Administration', items: [
      { path: '/permissions', title: 'Permissions', icon: 'key', view: 'permissions', cap: 'view_own', desc: 'Kapabilitas yang benar-benar dipegang token ini' },
      { path: '/integrations', title: 'Integrations', icon: 'extension', view: 'integrations', cap: 'manage_integrations', desc: 'Koneksi sistem eksternal' },
      { path: '/settings', title: 'Settings', icon: 'settings', view: 'settings', cap: 'view_all', desc: 'Konfigurasi organisasi' }
    ]}
  ];

  var EXTRA_ROUTES = [
    { path: '/work-packages/:id', title: 'Work Package', view: 'workPackageDetail', cap: 'view_all', parent: '/work-packages' },
    { path: '/review/:id', title: 'Review', view: 'review', cap: 'view_all', parent: '/review' },
    { path: '/login', title: 'Masuk', view: 'login', bare: true },
    { path: '/forbidden', title: 'Akses ditolak', view: 'forbidden', bare: true },
    { path: '/unavailable', title: 'Belum tersedia', view: 'unavailable', bare: true },
    { path: '/not-found', title: 'Tidak ditemukan', view: 'notFound', bare: true }
  ];

  var flatNav = [];
  NAV.forEach(function (g) { g.items.forEach(function (i) { i.group = g.group; flatNav.push(i); }); });

  D.router.register(flatNav.concat(EXTRA_ROUTES));

  function routeFor(path) {
    for (var i = 0; i < flatNav.length; i++) if (flatNav[i].path === path) return flatNav[i];
    return null;
  }
  function crumbsFor(path) {
    var hit = D.router.resolve('#' + path);
    if (!hit.route) return [{ label: 'DEXTRA', path: '/overview' }];
    var out = [{ label: 'DEXTRA', path: '/overview' }];
    var parentPath = hit.route.parent;
    if (parentPath) {
      var p = routeFor(parentPath);
      if (p) out.push({ label: p.title, path: p.path });
      out.push({ label: hit.params.id || hit.route.title });
    } else {
      var self = routeFor(hit.route.path);
      out.push({ label: self ? self.title : hit.route.title });
    }
    return out;
  }

  /* ---------------- tabs (vue-element-admin style) ---------------- */
  var TABS_KEY = 'dextra_tabs';
  function readTabs() { try { return JSON.parse(sessionStorage.getItem(TABS_KEY) || '[]'); } catch (e) { return []; } }
  function writeTabs(t) { try { sessionStorage.setItem(TABS_KEY, JSON.stringify(t.slice(-8))); } catch (e) {} }
  function titleFor(path) {
    var hit = D.router.resolve('#' + path);
    if (!hit.route) return 'Halaman';
    if (hit.params.id) {
      var p = routeFor(hit.route.parent || '');
      return (p ? p.title.replace(/s$/, '') : hit.route.title) + ' ' + hit.params.id;
    }
    return hit.route.title;
  }
  function pushTab(path) {
    if (path === '/login' || path === '/forbidden' || path === '/not-found') return;
    var tabs = readTabs();
    if (!tabs.some(function (t) { return t.path === path; })) {
      tabs.push({ path: path, title: titleFor(path) });
      writeTabs(tabs);
    }
    paintTabs();
  }
  function paintTabs() {
    var host = document.getElementById('tabsbar');
    if (!host) return;
    var tabs = readTabs();
    var current = '/' + (location.hash.replace(/^#/, '').split('?')[0] || '/overview').replace(/^\//, '');
    host.innerHTML = tabs.map(function (t) {
      return '<a class="tab' + (t.path === current ? ' is-active' : '') + '" href="#' + t.path + '" data-tab="' + esc(t.path) + '">' +
        '<span>' + esc(t.title) + '</span><span class="tab__x" data-close-tab="' + esc(t.path) + '" title="Tutup"><span class="material-symbols-outlined">close</span></span></a>';
    }).join('') + (tabs.length ? '<div class="spacer"></div><button class="tab" data-close-all style="color:var(--faint)">Tutup semua</button>' : '');
    host.querySelectorAll('[data-close-tab]').forEach(function (x) {
      x.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var p = x.getAttribute('data-close-tab');
        var next = readTabs().filter(function (t) { return t.path !== p; });
        writeTabs(next);
        if (p === current) {
          D.router.go(next.length ? next[next.length - 1].path : '/overview');
        } else paintTabs();
      });
    });
    var all = host.querySelector('[data-close-all]');
    if (all) all.addEventListener('click', function () {
      writeTabs([]); paintTabs(); D.router.go('/overview');
    });
  }

  /* ---------------- sidebar ---------------- */
  function navItem(item) {
    var allowed = session.can(item.cap);
    var count = '';
    if (item.count === 'awaiting') {
      var n = store.counts().awaiting;
      if (n) count = '<span class="nav-item__count">' + n + '</span>';
    }
    if (!allowed) {
      return '<button class="nav-item is-disabled" data-denied="' + esc(item.title) + '" title="Peran Anda tidak memiliki akses ke halaman ini">' +
        '<span class="material-symbols-outlined">' + item.icon + '</span><span class="nav-item__label">' + esc(item.title) + '</span>' +
        '<span class="material-symbols-outlined" style="font-size:15px">lock</span></button>';
    }
    return '<a class="nav-item" href="#' + item.path + '" data-nav="' + item.path + '">' +
      '<span class="material-symbols-outlined">' + item.icon + '</span><span class="nav-item__label">' + esc(item.title) + '</span>' + count + '</a>';
  }

  function paintSidebar() {
    var host = document.getElementById('sidebar');
    if (!host) return;
    host.innerHTML =
      '<div class="sidebar__brand">' +
        '<div class="brand-mark">D</div>' +
        '<div class="brand-text"><b>DEXTRA</b><span>Governed AI Workforce</span></div>' +
      '</div>' +
      '<button class="sidebar-toggle" id="sidebar-toggle" aria-label="Ciutkan sidebar" title="Ciutkan sidebar"><span class="material-symbols-outlined">chevron_left</span></button>' +
      '<div class="sidebar__scroll">' +
        NAV.map(function (g) {
          return '<div class="nav-group"><span class="nav-group__label">' + esc(g.group) + '</span>' +
            g.items.map(navItem).join('') + '</div>';
        }).join('') +
        '<div class="nav-group" style="margin-bottom:4px">' +
          '<div style="margin:0 10px;padding:7px 9px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;gap:6px" title="Semua layanan listen di 127.0.0.1. Token ops tidak disimpan di dashboard.">' +
            '<span class="material-symbols-outlined" style="font-size:14px;color:var(--success-600)">shield_lock</span>' +
            '<span style="font-size:10.5px;font-weight:600;color:var(--muted)">Local-only · 127.0.0.1</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="sidebar__foot">' + userChip() + '</div>';

    host.querySelectorAll('[data-denied]').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.toast('Peran ' + session.roleLabel() + ' tidak memiliki akses ke ' + b.getAttribute('data-denied') + '.', 'warning');
      });
    });
    var toggle = document.getElementById('sidebar-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      document.body.classList.toggle('is-collapsed');
      try { localStorage.setItem('dextra_sidebar', document.body.classList.contains('is-collapsed') ? 'collapsed' : 'open'); } catch (e) {}
    });
    var chip = host.querySelector('[data-user-menu]');
    if (chip) chip.addEventListener('click', userMenu);
  }

  function userChip() {
    return '<button class="user-chip" data-user-menu>' +
      '<span class="avatar">' + esc(U.initials(session.displayName())) + '</span>' +
      '<span class="user-chip__meta"><b>' + esc(session.displayName()) + '</b><span>' + esc(session.subtitle()) + '</span></span>' +
      '<span class="material-symbols-outlined" style="font-size:16px;color:var(--faint);margin-left:auto">unfold_more</span>' +
      '</button>';
  }

  function userMenu() {
    var anchor = document.querySelector('[data-user-menu]');
    if (!anchor) return;
    var roles = ['operations_manager', 'governance_lead', 'legal_reviewer', 'finance_approver', 'requester', 'auditor', 'org_admin'];
    ui.menu(anchor, [
      { label: 'Akun' },
      { text: 'Profil & preferensi', icon: 'person', onClick: function () { D.router.go('/settings'); } },
      { text: 'Ganti tema', icon: 'contrast', onClick: function () { D.theme.toggle(); paintAll(); } },
      { sep: true },
      { label: 'Prototipe — lihat sebagai' },
      { text: 'Operations Manager' + (session.user.role === 'operations_manager' ? ' ✓' : ''), icon: 'engineering', onClick: function () { switchRole('operations_manager'); } },
      { text: 'Governance Lead' + (session.user.role === 'governance_lead' ? ' ✓' : ''), icon: 'policy', onClick: function () { switchRole('governance_lead'); } },
      { text: 'Requester' + (session.user.role === 'requester' ? ' ✓' : ''), icon: 'send', onClick: function () { switchRole('requester'); } },
      { text: 'Auditor (read-only)' + (session.user.role === 'auditor' ? ' ✓' : ''), icon: 'receipt_long', onClick: function () { switchRole('auditor'); } },
      { text: 'Organization Admin' + (session.user.role === 'org_admin' ? ' ✓' : ''), icon: 'admin_panel_settings', onClick: function () { switchRole('org_admin'); } },
      { sep: true },
      { text: 'Keluar', icon: 'logout', danger: true, onClick: function () { D.router.go('/login'); } }
    ], { head: '<div class="menu__head"><div class="small strong">' + esc(session.displayName()) + '</div><div class="tiny muted">' + esc(session.contactLine()) + ' · ' + esc(session.roleLabel()) + '</div></div>' });
    void roles;
  }

  function switchRole(role) {
    session.user.role = role;
    try { localStorage.setItem('dextra_role', role); } catch (e) {}
    paintAll();
    D.router.render();
    ui.toast('Peran prototipe diubah ke ' + session.roleLabel() + '. Navigasi menyesuaikan izin.', 'info');
  }

  /* ---------------- topbar ---------------- */
  function paintTopbar() {
    var host = document.getElementById('topbar');
    if (!host) return;
    var mode = store.mode;
    var envLabel = mode === 'live' ? 'Live · local MCP' : 'Demo data';
    host.innerHTML =
      '<div class="topbar__left">' +
        '<button class="icon-btn menu-btn" id="mobile-menu" aria-label="Buka navigasi"><span class="material-symbols-outlined">menu</span></button>' +
        '<nav class="breadcrumbs" id="crumbs"></nav>' +
        '<span class="env-pill" id="env-pill" data-state="' + (mode === 'live' ? 'live' : 'demo') + '"><i class="dot"></i>' + envLabel + '</span>' +
      '</div>' +
      '<div class="topbar__right">' +
        '<button class="copilot-trigger" id="copilot-trigger" title="Copilot (Ctrl+J)" aria-label="Buka Copilot">' +
          '<span class="material-symbols-outlined">auto_awesome</span><span class="label">Copilot</span><kbd>⌘J</kbd></button>' +
        '<button class="search-trigger" id="search-trigger" aria-label="Pencarian global"><span class="material-symbols-outlined">search</span><span class="label">Cari work package, mandat, kebijakan…</span><kbd>⌘K</kbd></button>' +
        '<button class="icon-btn" id="theme-toggle" aria-label="Ganti tema" title="Ganti tema"><span class="material-symbols-outlined">' + (D.theme.get() === 'dark' ? 'light_mode' : 'dark_mode') + '</span></button>' +
        '<button class="icon-btn" id="notif-btn" aria-label="Notifikasi" title="Notifikasi"><span class="material-symbols-outlined">notifications</span>' +
          (store.unreadCount() ? '<span class="icon-btn__dot"></span>' : '') + '</button>' +
        '<div class="vdivider" style="height:24px;margin:0 4px"></div>' +
        '<button class="user-chip" id="topbar-user" style="padding-right:2px"><span class="avatar">' + esc(U.initials(session.displayName())) + '</span>' +
          '<span class="user-chip__meta hide-sm"><b>' + esc(session.displayName()) + '</b><span>' + esc(session.subtitle()) + '</span></span>' +
          '<span class="material-symbols-outlined" style="font-size:16px;color:var(--faint)">expand_more</span></button>' +
      '</div>';

    document.getElementById('theme-toggle').addEventListener('click', function () {
      D.theme.toggle(); paintTopbar(); paintAll();
    });
    document.getElementById('notif-btn').addEventListener('click', notifMenu);
    document.getElementById('topbar-user').addEventListener('click', userMenu);
    document.getElementById('search-trigger').addEventListener('click', openSearch);
    var cp = document.getElementById('copilot-trigger');
    if (cp) cp.addEventListener('click', function () { if (D.copilotPanel) D.copilotPanel.toggle(); });
    var mb = document.getElementById('mobile-menu');
    if (mb) mb.addEventListener('click', function () { document.body.classList.add('is-mobile-open'); paintScrim(); });
    paintCrumbs();
  }

  function paintCrumbs() {
    var host = document.getElementById('crumbs');
    if (!host) return;
    var path = '/' + (location.hash.replace(/^#/, '').split('?')[0] || '/overview').replace(/^\//, '');
    var crumbs = crumbsFor(path);
    host.innerHTML = crumbs.map(function (c, i) {
      var last = i === crumbs.length - 1;
      var label = '<span class="' + (last ? 'current' : '') + '">' + esc(c.label) + '</span>';
      var node = (!last && c.path) ? '<a href="#' + c.path + '">' + label + '</a>' : label;
      return node + (last ? '' : '<span class="sep">/</span>');
    }).join('');
  }

  function notifMenu() {
    var anchor = document.getElementById('notif-btn');
    var items = store.notifications.map(function (n) {
      return { text: n.title, icon: n.read ? 'notifications' : 'circle', hint: U.rel(n.at), onClick: function () { n.read = true; D.router.go(n.href.replace('#', '')); paintTopbar(); } };
    });
    items.push({ sep: true });
    items.push({ text: 'Tandai semua dibaca', icon: 'done_all', onClick: function () { store.notifications.forEach(function (n) { n.read = true; }); paintTopbar(); ui.toast('Semua notifikasi ditandai dibaca.', 'success'); } });
    ui.menu(anchor, items, {
      head: '<div class="menu__head row"><div style="flex:1"><div class="small strong">Notifikasi</div><div class="tiny muted">' + store.unreadCount() + ' belum dibaca</div></div></div>'
    });
  }

  function paintScrim() {
    var old = document.querySelector('.mobile-scrim');
    if (old) old.remove();
    if (document.body.classList.contains('is-mobile-open')) {
      var s = U.h('div', { class: 'mobile-scrim' });
      s.addEventListener('click', function () { document.body.classList.remove('is-mobile-open'); s.remove(); });
      document.body.appendChild(s);
    }
  }

  /* ---------------- command palette ---------------- */
  function openSearch() {
    var results = [];
    function build(q) {
      var ql = (q || '').toLowerCase().trim();
      var items = [];
      flatNav.forEach(function (n) {
        if (!session.can(n.cap)) return;
        if (!ql || n.title.toLowerCase().indexOf(ql) > -1 || (n.desc || '').toLowerCase().indexOf(ql) > -1) {
          items.push({ kind: 'Halaman', title: n.title, icon: n.icon, path: n.path });
        }
      });
      if (ql) {
        store.plans.forEach(function (p) {
          if ((p.plan_id + ' ' + p.intent).toLowerCase().indexOf(ql) > -1) {
            items.push({ kind: 'Work package', title: p.plan_id + ' · ' + p.intent, icon: 'layers', path: '/work-packages/' + p.plan_id });
          }
        });
        store.mandates.forEach(function (m) {
          if ((m.mandate_id + ' ' + (m.plan_id || '')).toLowerCase().indexOf(ql) > -1) {
            items.push({ kind: 'Mandat', title: m.mandate_id + ' · ' + m.plan_id, icon: 'verified_user', path: '/mandates' });
          }
        });
        store.policies.forEach(function (p) {
          if ((p.id + ' ' + p.name).toLowerCase().indexOf(ql) > -1) {
            items.push({ kind: 'Kebijakan', title: p.id + ' · ' + p.name, icon: 'policy', path: '/policies' });
          }
        });
      }
      return items.slice(0, 12);
    }
    var ov = ui.modal({
      title: '', body: '',
      onMount: function (node, handle) {
        node.classList.remove('modal'); node.classList.add('cmdk'); node.style.maxWidth = '560px';
        node.innerHTML = '<input class="cmdk__input" placeholder="Cari halaman, work package, mandat, kebijakan…" id="cmdk-input">' +
          '<div class="cmdk__list" id="cmdk-list"></div>' +
          '<div class="card__foot" style="border-top:1px solid var(--border);border-bottom:0;border-radius:0 0 16px 16px">' +
          '<span class="tiny faint">↑↓ pilih · ↵ buka · esc tutup</span><div class="spacer"></div><span class="tiny faint">Pencarian lokal</span></div>';
        var input = node.querySelector('#cmdk-input');
        var list = node.querySelector('#cmdk-list');
        var active = 0;
        function paint() {
          var items = build(input.value);
          if (!items.length) { list.innerHTML = '<div class="empty" style="padding:28px"><p class="small muted">Tidak ada hasil untuk "' + esc(input.value) + '".</p></div>'; return; }
          var lastKind = null;
          list.innerHTML = items.map(function (it, i) {
            var head = it.kind !== lastKind ? '<div class="cmdk__group">' + esc(it.kind) + '</div>' : '';
            lastKind = it.kind;
            return head + '<div class="cmdk__item' + (i === active ? ' is-active' : '') + '" data-i="' + i + '"><span class="material-symbols-outlined">' + it.icon + '</span>' + esc(it.title) + '<span class="path">' + esc(it.path) + '</span></div>';
          }).join('');
          list.querySelectorAll('[data-i]').forEach(function (el) {
            el.addEventListener('click', function () { go(items[parseInt(el.getAttribute('data-i'), 10)]); });
          });
          results = items;
        }
        function go(it) { handle.close(); D.router.go(it.path); }
        input.addEventListener('input', function () { active = 0; paint(); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowDown') { active = Math.min(active + 1, results.length - 1); paint(); e.preventDefault(); }
          else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); paint(); e.preventDefault(); }
          else if (e.key === 'Enter' && results[active]) { go(results[active]); }
        });
        paint();
      }
    });
    setTimeout(function () { var i = document.querySelector('#cmdk-input'); if (i) i.focus(); }, 40);
    return ov;
  }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });

  /* ---------------- after render ---------------- */
  function paintActive() {
    var path = '/' + (location.hash.replace(/^#/, '').split('?')[0] || '/overview').replace(/^\//, '');
    var hit = D.router.resolve('#' + path);
    var activePath = hit.route && hit.route.parent ? hit.route.parent : path;
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      a.classList.toggle('is-active', a.getAttribute('data-nav') === activePath);
    });
    paintCrumbs();
    pushTab(path);
    document.body.classList.remove('is-mobile-open');
    paintScrim();
  }

  function paintAll() {
    paintSidebar();
    paintTopbar();
    paintActive();
  }

  var shell = {
    nav: NAV,
    init: function () {
      var savedSidebar = 'open';
      var savedRole = 'operations_manager';
      try {
        savedSidebar = localStorage.getItem('dextra_sidebar') || 'open';
        savedRole = localStorage.getItem('dextra_role') || 'operations_manager';
      } catch (e) {}
      if (savedSidebar === 'collapsed' && window.innerWidth > 1080) document.body.classList.add('is-collapsed');
      session.user.role = savedRole;
      var qRole = U.qs('role', null);
      if (qRole) session.user.role = qRole;
      paintAll();
      window.addEventListener('resize', U.debounce(function () { paintActive(); }, 150));
    },
    afterRender: function (route) {
      var bare = !!(route && route.bare);
      document.body.classList.toggle('is-bare', bare);
      if (!bare) paintActive();
      /* The panel is mounted once and survives navigation; sync() only re-scopes
         it to the new route and closes it on bare pages (login, errors). */
      if (D.copilotPanel) {
        if (!D._copilotMounted) { D.copilotPanel.mount(); D._copilotMounted = true; }
        D.copilotPanel.sync();
      }
    },
    paintAll: paintAll,
    refresh: function () { paintSidebar(); paintTopbar(); }
  };

  D.shell = shell;
})();
