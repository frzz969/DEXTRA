/* View — Data Management (P7).
 *
 * Jujur tentang status: tidak ada router P7 di backend (16 router di
 * backend/dextra/main.py:67), PostgreSQL belum terverifikasi dari kode,
 * data/*.json belum dimigrasikan. Seluruh angka dan daftar di halaman ini
 * adalah contoh (DEMO) karena mode demo selalu dipakai untuk P7. Tidak ada
 * klaim koneksi, tidak ada "berhasil terhubung".
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_P7_API.create({ mode: 'demo' });
  var CONTRACTS = window.DEXTRA_P7_CONTRACTS;

  function demoChip() { return '<span class="badge badge--outline p7-demo-chip">DEMO</span>'; }
  function missingBadge() { return '<span class="badge badge--warning">Belum tersedia</span>'; }
  function stateBadge(s) {
    if (s === 'missing') return '<span class="badge badge--danger">missing</span>';
    if (s === 'demo') return '<span class="badge badge--outline">demo</span>';
    return '<span class="badge badge--outline">' + esc(s) + '</span>';
  }

  D.views.dataManagement = function (root) {
    var state = {
      tab: 'ringkasan',
      snapshot: null,
      probe: null,
      loading: true,
      error: null,
      memberQuery: '',
      memberStatus: 'all',
      tableQuery: ''
    };

    function load() {
      state.loading = true; state.error = null;
      paint();
      api.getSnapshot().then(function (snap) {
        state.snapshot = snap; state.loading = false;
        paint();
      }).catch(function (err) {
        state.error = (err && err.message) || 'Gagal memuat snapshot P7.'; state.loading = false;
        paint();
      });
    }

    function rerunProbe() {
      state.probe = null;
      api.probe().then(function (res) {
        state.probe = res;
        paint();
        ui.toast(res.mode === 'demo'
          ? 'Verifikasi ulang: mode DEMO — tidak ada router P7 di backend (16 router, main.py:67).'
          : 'Probe selesai: ' + res.mode, res.mode === 'demo' ? 'warning' : 'info');
      });
    }

    function exportJson() {
      api.exportSnapshot().then(function (out) {
        U.download(out.filename, out.json, 'application/json');
        ui.toast('Ringkasan JSON diunduh (data DEMO).', 'success');
      }).catch(function (err) {
        ui.toast((err && err.message) || 'Ekspor gagal.', 'error');
      });
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else fallback();
    }

    function copyContracts() {
      copyText(JSON.stringify(api.listExpectedEndpoints(), null, 2), 'Kontrak endpoint disalin sebagai JSON.');
    }

    function fmtDate(iso) { return iso ? U.fmtDate(iso) : '—'; }

    /* ---------- panels ---------- */

    function ringkasanPanel() {
      var s = state.snapshot;
      var stats = ui.statstrip([
        { label: 'Target DB', value: esc(s.connection.targetEngine) + ' ' + demoChip() },
        { label: 'Status', value: 'Belum terverifikasi ' + demoChip(), tone: 'warning' },
        { label: 'Tabel', value: s.migration.tables + ' ' + demoChip() },
        { label: 'Migrasi', value: '1 ' + demoChip() },
        { label: 'Data dipindahkan', value: 'Belum ' + demoChip(), tone: 'warning' }
      ], { className: 'p7-statstrip' });

      var truth = ui.card({
        title: 'Sumber kebenaran saat ini',
        desc: 'Apa yang benar-benar dipakai, bukan target',
        body:
          '<dl class="def-list">' +
            '<dt>Terverifikasi</dt><dd><b>' + esc(s.currentVerifiedStore.label) + '</b><br><span class="tiny muted">' + esc(s.currentVerifiedStore.detail) + '</span></dd>' +
            '<dt>Target</dt><dd>PostgreSQL (migrasi ' + esc(s.migration.revision) + ') ' + demoChip() + '</dd>' +
            '<dt>Status perpindahan</dt><dd><span class="badge badge--warning">Belum beralih</span><br><span class="tiny muted">MCP server lokal masih membaca berkas JSON. Tidak ada koneksi PostgreSQL yang aktif dari dashboard.</span></dd>' +
          '</dl>'
      });

      var scope = ui.card({
        title: 'Cakupan P7',
        desc: 'Ketersediaan tiap bagian, apa adanya',
        body: '<ul class="p7-scope">' + s.p7Scope.map(function (item) {
          return '<li class="p7-scope__item"><div class="p7-scope__main"><b>' + esc(item.label) + '</b>' +
            '<span class="tiny muted">' + esc(item.note) + '</span></div>' + stateBadge(item.state) + '</li>';
        }).join('') + '</ul>'
      });

      var actions =
        '<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:4px">' +
          '<button class="btn btn--secondary" id="p7-export"><span class="material-symbols-outlined">download</span>Ekspor ringkasan JSON</button>' +
          '<button class="btn btn--secondary" id="p7-reprobe"><span class="material-symbols-outlined">refresh</span>Verifikasi ulang</button>' +
        '</div>' +
        (state.probe
          ? '<div class="banner banner--demo" style="margin-top:12px"><span class="material-symbols-outlined">science</span><div><b>Hasil verifikasi ulang: mode ' + esc(String(state.probe.mode).toUpperCase()) + '.</b><br>' + esc(state.probe.reason) + '</div></div>'
          : '');

      return stats + '<div class="p7-grid">' + truth + scope + '</div>' + actions;
    }

    function membersPanel() {
      var s = state.snapshot;
      var t = s.tenant;
      var tenantCard = ui.card({
        title: 'Tenant ' + demoChip(),
        desc: 'Identitas tenant dari fixture DEMO',
        body:
          '<dl class="def-list">' +
            '<dt>Nama</dt><dd><b>' + esc(t.name) + '</b></dd>' +
            '<dt>ID</dt><dd class="mono mono--wrap">' + esc(t.id) + '</dd>' +
            '<dt>Slug</dt><dd class="mono">' + esc(t.slug) + '</dd>' +
            '<dt>Timezone</dt><dd>' + esc(t.timezone) + '</dd>' +
            '<dt>Status</dt><dd><span class="badge badge--success">' + esc(t.status) + '</span> ' + demoChip() + '</dd>' +
            '<dt>Dibuat</dt><dd>' + esc(fmtDate(t.createdAt)) + '</dd>' +
            '<dt>Diubah</dt><dd>' + esc(fmtDate(t.updatedAt)) + '</dd>' +
          '</dl>' +
          '<p class="tiny muted" style="margin-top:10px">Data identitas ini contoh. Tidak ada endpoint tenant di backend (tidak ada router P7); jangan dipakai sebagai acuan operasional.</p>'
      });

      var q = state.memberQuery.trim().toLowerCase();
      var rows = s.memberships.filter(function (m) {
        if (state.memberStatus !== 'all' && m.status !== state.memberStatus) return false;
        if (!q) return true;
        return (m.displayName + ' ' + m.role + ' ' + m.userId).toLowerCase().indexOf(q) >= 0;
      });

      var tableHost = '<div id="p7-members-table"></div>';
      var membersCard = ui.card({
        title: 'Anggota & peran ' + demoChip(),
        desc: '5 pengguna contoh · filter pencarian dan status',
        flush: true,
        body:
          '<div class="p7-toolbar">' +
            '<div class="p7-search"><span class="material-symbols-outlined">search</span>' +
              '<input type="text" id="p7-member-q" class="input" placeholder="Cari nama, peran, atau ID…" value="' + U.attr(state.memberQuery) + '" aria-label="Cari anggota">' +
            '</div>' +
            '<div class="segmented" id="p7-member-status">' +
              [['all', 'Semua'], ['accepted', 'Accepted'], ['invited', 'Invited']].map(function (o) {
                return '<button data-s="' + o[0] + '" class="' + (state.memberStatus === o[0] ? 'is-active' : '') + '">' + o[1] + '</button>';
              }).join('') +
            '</div>' +
          '</div>' + tableHost +
          '<p class="tiny muted" style="padding:10px 16px 0">Tidak ada tombol undang/ubah: tidak ada router P7 di backend (member/tenant bukan permukaan P7 yang ada), jadi aksi itu tidak ditampilkan.</p>'
      });

      return '<div class="p7-grid p7-grid--wide-left">' + tenantCard + membersCard + '</div>';
    }

    function mountMembersTable() {
      var host = root.querySelector('#p7-members-table');
      if (!host) return;
      var s = state.snapshot;
      var q = state.memberQuery.trim().toLowerCase();
      var rows = s.memberships.filter(function (m) {
        if (state.memberStatus !== 'all' && m.status !== state.memberStatus) return false;
        if (!q) return true;
        return (m.displayName + ' ' + m.role + ' ' + m.userId).toLowerCase().indexOf(q) >= 0;
      });
      host.innerHTML = '';
      if (!rows.length) {
        host.innerHTML = ui.empty({ icon: 'search_off', title: 'Tidak ada anggota cocok', body: 'Ubah kata kunci atau filter status.' });
        return;
      }
      host.appendChild(ui.table({
        rows: rows,
        pageSize: 10,
        columns: [
          { key: 'displayName', label: 'Nama', sortable: true, render: function (r) { return '<b>' + esc(r.displayName) + '</b><br><span class="tiny muted mono">' + esc(r.userId) + '</span> ' + demoChip(); } },
          { key: 'role', label: 'Peran', sortable: true, render: function (r) { return '<span class="mono">' + esc(r.role) + '</span>'; } },
          { key: 'status', label: 'Status', sortable: true, render: function (r) { return r.status === 'accepted' ? '<span class="badge badge--success">accepted</span>' : '<span class="badge badge--warning">invited</span>'; } },
          { key: 'acceptedAt', label: 'Diterima pada', sortable: true, render: function (r) { return esc(fmtDate(r.acceptedAt)); } },
          { key: 'source', label: 'Sumber', render: function (r) { return esc(r.source) + ' ' + demoChip(); } }
        ]
      }));
    }

    function migrationPanel() {
      var s = state.snapshot;
      var m = s.migration;
      var migCard = ui.card({
        title: 'Migrasi awal ' + demoChip(),
        desc: 'Status sebenarnya, bukan yang diinginkan',
        body:
          '<dl class="def-list">' +
            '<dt>Revisi</dt><dd class="row" style="gap:8px;align-items:center"><code class="mono mono--wrap p7-code">' + esc(m.revision) + '</code>' +
              '<button class="icon-btn" id="p7-copy-rev" title="Salin revisi" aria-label="Salin revisi"><span class="material-symbols-outlined">content_copy</span></button></dd>' +
            '<dt>Tabel</dt><dd>' + esc(m.tables) + ' tabel</dd>' +
            '<dt>Diterapkan di</dt><dd>' + esc(m.appliedOn) + '</dd>' +
            '<dt>PostgreSQL</dt><dd><span class="badge badge--danger">Belum diverifikasi</span><br><span class="tiny muted">' + esc(m.statusText) + '</span></dd>' +
            '<dt>Perintah cek</dt><dd><code class="mono p7-code">alembic current</code><br><span class="tiny muted">Hanya contoh perintah — tidak dijalankan oleh dashboard.</span></dd>' +
          '</dl>' +
          '<div class="divider"></div><div class="small strong" style="margin-bottom:6px">Langkah verifikasi berikutnya</div>' +
          '<ol class="p7-steps">' + m.nextSteps.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>'
      });

      var q = state.tableQuery.trim().toLowerCase();
      var trows = s.tableStats.filter(function (r) { return !q || r.table.toLowerCase().indexOf(q) >= 0; });

      var tableCard = ui.card({
        title: 'Statistik tabel (representatif) ' + demoChip(),
        desc: '10 dari 21 tabel · jumlah baris DEMO, bukan dari database',
        flush: true,
        body:
          '<div class="p7-toolbar"><div class="p7-search"><span class="material-symbols-outlined">search</span>' +
            '<input type="text" id="p7-table-q" class="input" placeholder="Cari tabel…" value="' + U.attr(state.tableQuery) + '" aria-label="Cari tabel">' +
          '</div></div><div id="p7-tables-table"></div>'
      });

      var gaps = ui.card({
        title: 'Celah yang harus ditutup',
        desc: 'Setiap celah beserta konsekuensinya',
        body: '<ul class="p7-gaps">' + [
          { gap: 'Overview belum tenant-scoped', why: 'Tanpa scoping, angka satu tenant bisa bocor ke tenant lain atau tercampur.' },
          { gap: 'Data belum dimigrasikan dari data/*.json', why: 'MCP server masih membaca berkas JSON; PostgreSQL kosong sampai migrasi dijalankan dan diverifikasi.' },
          { gap: 'PostgreSQL belum diverifikasi', why: 'Migrasi hanya terbukti di SQLite; perilaku constraint, tipe, dan indeks di PostgreSQL belum diketahui.' },
          { gap: 'Backup/restore belum diuji', why: 'Tanpa uji restore, kehilangan data tidak bisa dipulihkan dengan pasti.' }
        ].map(function (g) {
          return '<li class="p7-gaps__item"><span class="material-symbols-outlined">warning</span><div><b>' + esc(g.gap) + '</b><br><span class="tiny muted">Konsekuensi: ' + esc(g.why) + '</span></div></li>';
        }).join('') + '</ul>'
      });

      return migCard + tableCard + gaps;
    }

    function mountTablesTable() {
      var host = root.querySelector('#p7-tables-table');
      if (!host) return;
      var q = state.tableQuery.trim().toLowerCase();
      var rows = state.snapshot.tableStats.filter(function (r) { return !q || r.table.toLowerCase().indexOf(q) >= 0; });
      host.innerHTML = '';
      if (!rows.length) {
        host.innerHTML = ui.empty({ icon: 'search_off', title: 'Tidak ada tabel cocok', body: 'Ubah kata kunci pencarian.' });
        return;
      }
      host.appendChild(ui.table({
        rows: rows,
        pageSize: 10,
        columns: [
          { key: 'table', label: 'Tabel', sortable: true, render: function (r) { return '<code class="mono">' + esc(r.table) + '</code>'; } },
          { key: 'rows', label: 'Baris (DEMO)', sortable: true, align: 'right', render: function (r) { return esc(r.rows) + ' ' + demoChip(); } },
          { key: 'tenantScoped', label: 'Tenant-scoped?', sortable: true, render: function (r) { return r.tenantScoped ? '<span class="badge badge--info">ya</span>' : '<span class="badge badge--outline">tidak</span>'; } },
          { key: 'status', label: 'Status', render: function (r) { return '<span class="badge badge--outline">' + esc(r.status) + '</span>'; } }
        ]
      }));
    }

    function connectionPanel() {
      var s = state.snapshot;
      var c = s.connection;
      var conn = ui.card({
        title: 'Koneksi ' + demoChip(),
        desc: 'Fakta aman saja; tidak ada kredensial yang ditampilkan',
        body:
          '<dl class="def-list">' +
            '<dt>Mesin target</dt><dd>' + esc(c.targetEngine) + '</dd>' +
            '<dt>Mesin terverifikasi</dt><dd>' + esc(c.currentVerifiedEngine) + '</dd>' +
            '<dt>DATABASE_URL</dt><dd>Tidak tersedia di dashboard<br><span class="tiny muted">Keberadaan variabel hanya boleh dilaporkan backend; peramban tidak membacanya.</span></dd>' +
            '<dt>Migration head</dt><dd class="mono mono--wrap">' + esc(c.migrationHead || '—') + '</dd>' +
            '<dt>Pemeriksaan terakhir</dt><dd>' + esc(c.lastCheckedAt ? fmtDate(c.lastCheckedAt) : 'Belum pernah (tidak ada probe backend)') + '</dd>' +
            '<dt>Lingkungan</dt><dd>' + esc(c.environment) + '</dd>' +
            '<dt>Status</dt><dd><span class="badge badge--warning">' + esc(c.statusLabel || c.status) + '</span></dd>' +
          '</dl>'
      });

      var checks = [
        { label: 'PostgreSQL terverifikasi', ok: s.readiness.postgresVerified },
        { label: 'Data dimigrasikan dari data/*.json', ok: s.readiness.dataMigrated },
        { label: 'Tenant scoping diterapkan & diuji', ok: s.readiness.tenantScopingEnforced },
        { label: 'Backup/restore diuji', ok: s.readiness.backupRestoreTested }
      ];
      var readiness = ui.card({
        title: 'Kesiapan produksi',
        desc: 'Tidak ada yang boleh dicentang sebelum terbukti',
        body: '<ul class="p7-checklist">' + checks.map(function (chk) {
          return '<li class="p7-checklist__item ' + (chk.ok ? 'is-pass' : 'is-fail') + '">' +
            '<span class="material-symbols-outlined">' + (chk.ok ? 'check_circle' : 'cancel') + '</span>' +
            '<div><b>' + esc(chk.label) + '</b><br><span class="tiny muted">' + (chk.ok ? 'Lulus' : 'Belum / tidak diketahui — dianggap gagal sampai terbukti') + '</span></div></li>';
        }).join('') + '</ul>'
      });

      var endpoints = api.listExpectedEndpoints();
      var contractCard = ui.card({
        title: 'Kontrak endpoint yang dibutuhkan',
        desc: 'Semua status "Belum tersedia" sampai backend mengimplementasikan dan probe memverifikasi',
        flush: true,
        body:
          '<div class="table-wrap"><table class="table table--compact"><thead><tr><th>Metode</th><th>Path</th><th>Auth</th><th>Status</th><th>Dibutuhkan untuk</th></tr></thead><tbody>' +
            endpoints.map(function (e) {
              return '<tr><td><code class="mono">' + esc(e.method) + '</code></td>' +
                '<td class="mono mono--wrap">' + esc(e.path) + '</td>' +
                '<td class="tiny">' + esc(e.auth) + '</td>' +
                '<td>' + missingBadge() + '</td>' +
                '<td class="tiny">' + esc(e.ui) + '</td></tr>';
            }).join('') +
          '</tbody></table></div>' +
          '<div class="p7-toolbar" style="border-top:1px solid var(--border)"><button class="btn btn--secondary btn--sm" id="p7-copy-contracts"><span class="material-symbols-outlined">content_copy</span>Salin kontrak endpoint</button></div>'
      });

      var sec = ui.card({
        title: 'Catatan keamanan',
        body: '<div class="banner banner--warning" style="margin:0"><span class="material-symbols-outlined">lock</span><div><b>Frontend tidak pernah menyambung ke database.</b><br>Tidak ada kredensial, host, port, atau string koneksi yang dibaca, disimpan, atau ditampilkan peramban. Semua koneksi harus terjadi di backend; dashboard hanya menampilkan hasil probe yang aman. Bila backend kelak tersedia, halaman ini tetap tidak boleh meminta atau menampilkan secret.</div></div>'
      });

      return conn + readiness + contractCard + sec;
    }

    /* ---------- shell ---------- */

    function paint() {
      var demoBanner =
        '<div class="banner banner--demo p7-banner"><span class="material-symbols-outlined">science</span>' +
        '<div><b>Mode DEMO — PostgreSQL belum tersambung/terverifikasi.</b><br>Semua angka dan daftar adalah contoh; tidak ada database yang diubah. Bila backend P7 kelak tersedia, halaman ini hanya menampilkan hasil probe — tidak ada klaim koneksi tanpa bukti.</div></div>';

      var tabs = [['ringkasan', 'Ringkasan'], ['tenant', 'Tenant & Anggota'], ['schema', 'Schema & Migrasi'], ['koneksi', 'Koneksi & Kesiapan']];

      root.innerHTML =
        ui.pageHead({
          eyebrow: 'Administration · Data Management',
          title: 'Data Management',
          desc: 'Status PostgreSQL, tenant, membership, dan migrasi — apa adanya, tanpa klaim yang belum terbukti.'
        }) +
        demoBanner +
        '<div class="segmented p7-tabs" id="p7-tabs" role="tablist">' +
          tabs.map(function (t) {
            return '<button data-tab="' + t[0] + '" role="tab" class="' + (state.tab === t[0] ? 'is-active' : '') + '">' + esc(t[1]) + '</button>';
          }).join('') +
        '</div>' +
        '<div id="p7-panel" class="p7-panel"></div>';

      var panel = root.querySelector('#p7-panel');

      if (state.loading) {
        panel.innerHTML =
          '<div class="card card--pad"><div class="skeleton skeleton-line" style="width:45%"></div><div class="skeleton skeleton-line" style="width:70%"></div><div class="skeleton skeleton-line" style="width:60%"></div></div>' +
          ui.skeletonTable(5, 5);
      } else if (state.error) {
        panel.innerHTML = ui.errorState(state.error, 'Coba lagi');
        var retry = panel.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
      } else if (!state.snapshot) {
        panel.innerHTML = ui.empty({ icon: 'inbox', title: 'Snapshot kosong', body: 'Fixture DEMO tidak mengembalikan data.' });
      } else {
        if (state.tab === 'ringkasan') panel.innerHTML = ringkasanPanel();
        else if (state.tab === 'tenant') panel.innerHTML = membersPanel();
        else if (state.tab === 'schema') panel.innerHTML = migrationPanel();
        else panel.innerHTML = connectionPanel();

        if (state.tab === 'tenant') mountMembersTable();
        if (state.tab === 'schema') mountTablesTable();

        var ex = panel.querySelector('#p7-export'); if (ex) ex.addEventListener('click', exportJson);
        var rp = panel.querySelector('#p7-reprobe'); if (rp) rp.addEventListener('click', rerunProbe);
        var cr = panel.querySelector('#p7-copy-rev'); if (cr) cr.addEventListener('click', function () { copyText(state.snapshot.migration.revision, 'Revisi disalin.'); });
        var cc = panel.querySelector('#p7-copy-contracts'); if (cc) cc.addEventListener('click', copyContracts);

        var mq = panel.querySelector('#p7-member-q');
        if (mq) mq.addEventListener('input', U.debounce(function () { state.memberQuery = mq.value; mountMembersTable(); }, 160));
        panel.querySelectorAll('#p7-member-status button').forEach(function (b) {
          b.addEventListener('click', function () { state.memberStatus = b.getAttribute('data-s'); paint(); });
        });
        var tq = panel.querySelector('#p7-table-q');
        if (tq) tq.addEventListener('input', U.debounce(function () { state.tableQuery = tq.value; mountTablesTable(); }, 160));
      }

      root.querySelectorAll('#p7-tabs button').forEach(function (b) {
        b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); paint(); });
      });
    }

    load();
  };
})();
