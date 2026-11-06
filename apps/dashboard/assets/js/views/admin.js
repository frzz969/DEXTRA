/* Views — Administration: Permissions, Integrations, Settings. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  /* ---------------- Permissions ----------------
   *
   * This page used to render a role × capability matrix. The matrix was demo
   * data: no server endpoint produced it, and the identity model has no per-user
   * roles at all — a token carries a scope, not a person. Showing a matrix
   * implied a permission system that does not exist, so it is gone.
   *
   * What remains is the one thing the server actually states: the capabilities
   * this token holds, and the ones nobody implements yet.
   */
  D.views.permissions = function (root) {
    var live = D.session.serverCapabilities !== null;
    var caps = D.session.serverCapabilities || [];
    var unbacked = D.session.serverUnbacked || [];
    var tools = D.session.serverTools || [];

    if (!live) {
      root.innerHTML =
        ui.pageHead({
          eyebrow: 'Administration · Permissions',
          title: 'Permissions',
          desc: 'Kapabilitas yang dipegang token ini, dinyatakan oleh server.'
        }) +
        '<div class="card card--pad" style="max-width:680px">' +
          '<div class="row" style="gap:10px;align-items:flex-start">' +
            '<span class="material-symbols-outlined" style="color:var(--warning-600)">cloud_off</span>' +
            '<div><div class="small strong">Butuh server MCP</div>' +
            '<p class="small muted" style="margin-top:4px;line-height:1.6">Kapabilitas hanya bisa dinyatakan server lewat <span class="mono">get_caller_context</span>. Tanpa server, halaman ini tidak menampilkan matriks pengganti — matriks per peran memang tidak pernah ada di backend.</p>' +
            '<p class="small muted" style="margin-top:8px">Navigasi tetap bisa dijelajahi: di mode tanpa server ia memakai model prototipe, dan itu dinyatakan di menu pengguna.</p>' +
            '</div></div></div>';
      return;
    }

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Administration · Permissions',
        title: 'Permissions',
        desc: 'Dinyatakan server untuk token ini. Bukan matriks per peran — model identitas DEXTRA tidak punya peran per pengguna.',
        actions: '<a class="btn btn--secondary" href="#/audit"><span class="material-symbols-outlined">receipt_long</span>Audit Trail</a>'
      }) +
      '<div style="margin-bottom:16px">' + ui.statstrip([
        { label: 'Scope token', value: D.session.scope || '—', hint: 'Satu-satunya identitas yang dikenali server' },
        { label: 'Kapabilitas', value: caps.length, hint: 'Dipegang token ini', tone: 'success' },
        { label: 'Tool diizinkan', value: tools.length, hint: 'Turunan dari kapabilitas', tone: 'info' },
        { label: 'Tidak didukung', value: unbacked.length, hint: 'Belum diimplementasikan, bukan ditolak', tone: 'warn' }
      ]) + '</div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;align-items:start">' +
        '<div class="stack">' +
          ui.card({ title: 'Kapabilitas yang dipegang', body:
            '<div class="stack" style="gap:6px">' + caps.map(function (c) {
              return '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--success-600)">check_circle</span>' +
                '<span class="small mono">' + esc(c) + '</span></div>';
            }).join('') + '</div>'
          }) +
          ui.card({ title: 'Tool yang boleh dipanggil', body:
            (tools.length
              ? '<div class="tag-row">' + tools.map(function (t) { return '<span class="tag mono">' + esc(t) + '</span>'; }).join('') + '</div>'
              : '<p class="small muted">Server tidak melaporkan daftar tool.</p>')
          }) +
          ui.card({ title: 'Tidak didukung server', body:
            '<p class="small muted" style="line-height:1.6">Kapabilitas di bawah ada dalam kosakata kontrak, tetapi tidak ada scope yang memberikannya dan tidak ada tool yang menopangnya.</p>' +
            '<div class="stack" style="gap:6px;margin-top:10px">' + (unbacked.length ? unbacked.map(function (c) {
              return '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--faint)">remove</span>' +
                '<span class="small mono muted">' + esc(c) + '</span></div>';
            }).join('') : '<p class="small muted">Tidak ada.</p>') + '</div>' +
            '<div class="banner banner--info" style="margin-top:12px"><span class="material-symbols-outlined">info</span>' +
            '<div>Bedanya penting: "ditolak" berarti server memutuskan Anda tidak berhak. "Tidak didukung" berarti server belum punya kemampuannya. Halaman ini tidak pernah menampilkan yang pertama untuk keadaan kedua.</div></div>'
          }) +
        '</div>' +
        '<div class="stack">' +
          ui.card({ title: 'Mengapa tidak ada matriks per peran', body:
            '<p class="small muted" style="line-height:1.6">Token membawa <b>scope</b>, bukan nama orang. Server tidak tahu siapa Anda, dan tidak menyimpannya. Karena itu matriks "peran × kemampuan" tidak bisa dihasilkan dari server — dan matriks yang dulu ada di halaman ini berasal dari data contoh.</p>' +
            '<p class="small muted" style="line-height:1.6;margin-top:8px">Halaman ini menggantikannya dengan satu hal yang benar-benar dijawab server: daftar kapabilitas token Anda.</p>'
          }) +
          ui.card({ title: 'Apa yang mengikuti daftar ini', body:
            '<div class="stack" style="gap:8px">' +
              ['Navigasi menandai halaman yang tidak dapat dibuka.', 'Tombol yang butuh kapabilitas tidak muncul atau dinonaktifkan.', 'Server tetap memeriksa ulang setiap panggilan tool.'].map(function (t) {
                return '<div class="row" style="align-items:flex-start;gap:8px"><span class="material-symbols-outlined" style="font-size:14px;color:var(--brand-600);margin-top:2px">check</span><span class="tiny muted" style="line-height:1.5">' + esc(t) + '</span></div>';
              }).join('') +
            '</div>'
          }) +
        '</div>' +
      '</div>';
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
          '<dt>Token ops (MCP)</dt><dd>' + (D.api.token() ? 'ada di sessionStorage' : 'belum diisi') + '</dd>' +
          '<dt>Sesi manusia (REST)</dt><dd>cookie httpOnly (dihapus server saat logout)</dd>' +
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
          var done = function () { D.api.clearToken(); D.router.go('/login'); };
          if (D.api.auth && typeof D.api.auth.logout === 'function') {
            Promise.resolve().then(function () { return D.api.auth.logout(); })
              .then(function () { ui.toast('Anda telah keluar. Sesi server sudah dicabut.', 'success'); })
              .catch(function (err) { ui.toast('Logout server gagal: ' + ((err && err.message) || 'network'), 'warning'); })
              .then(done);
          } else { done(); }
        });
      }
      if (tab === 'data') {
        root.querySelector('#export-all').addEventListener('click', function () {
          U.download('dextra-dashboard-data.json', JSON.stringify({
            org: store.org, plans: store.plans, mandates: store.mandates, audit: store.audit,
            executions: store.executions, policies: store.policies, mode: store.mode
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
