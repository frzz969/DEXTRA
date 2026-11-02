/* View — Execution History. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var RESULT = {
    sent: { label: 'Berhasil', tone: 'success', icon: 'check_circle' },
    failed: { label: 'Gagal', tone: 'danger', icon: 'error' },
    blocked: { label: 'Diblokir', tone: 'warning', icon: 'block' }
  };

  D.views.execution = function (root) {
    var filter = { result: 'all', q: '' };

    function rows() {
      return store.executions.filter(function (e) {
        if (filter.result !== 'all' && e.result !== filter.result) return false;
        if (filter.q && (e.execution_id + ' ' + e.plan_id + ' ' + (e.mandate_id || '')).toLowerCase().indexOf(filter.q.toLowerCase()) < 0) return false;
        return true;
      }).slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    }

    var ok = store.executions.filter(function (e) { return e.result === 'sent'; }).length;
    var fail = store.executions.filter(function (e) { return e.result === 'failed'; }).length;
    var avg = Math.round(store.executions.reduce(function (a, e) { return a + (e.duration_ms || 0); }, 0) / (store.executions.length || 1));

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Work Management · Execution History',
        title: 'Execution History',
        desc: 'Setiap baris di sini berarti mandat benar-benar dipakai oleh executor. Tidak ada eksekusi tanpa mandat aktif yang hash-nya cocok.',
        actions: '<button class="btn btn--secondary" id="export"><span class="material-symbols-outlined">download</span>Ekspor</button>' +
          '<a class="btn btn--secondary" href="#/audit"><span class="material-symbols-outlined">receipt_long</span>Audit trail</a>'
      }) +
      ui.demoBanner() +
      '<div class="grid grid--4" style="margin-bottom:16px">' +
        ui.kpi({ label: 'Total eksekusi', value: store.executions.length, icon: 'play_circle', tone: 'accent', foot: '<span class="material-symbols-outlined">verified_user</span>Semua dengan mandat' }) +
        ui.kpi({ label: 'Berhasil', value: ok, icon: 'check_circle', tone: 'success', foot: '<span class="material-symbols-outlined">thumb_up</span>' + Math.round((ok / (store.executions.length || 1)) * 100) + '% tingkat keberhasilan' }) +
        ui.kpi({ label: 'Gagal', value: fail, icon: 'error', tone: 'danger', foot: '<span class="material-symbols-outlined">info</span>Tidak ada pesan terkirim' }) +
        ui.kpi({ label: 'Durasi rata-rata', value: avg, unit: 'ms', icon: 'timer', foot: '<span class="material-symbols-outlined">bolt</span>Adapter mock' }) +
      '</div>' +
      '<div class="card">' +
        '<div class="card__head"><div><h2>Aktivitas eksekusi</h2><p>Diurutkan dari yang terbaru</p></div><div class="spacer"></div>' +
          '<div class="input-wrap" style="width:220px"><span class="material-symbols-outlined">search</span>' +
          '<input class="input input--icon" id="q" placeholder="Cari ID…" style="height:32px"></div>' +
          ui.select('result', [{ value: 'all', label: 'Semua hasil' }, { value: 'sent', label: 'Berhasil' }, { value: 'failed', label: 'Gagal' }], 'all', 'style="width:auto;height:32px;font-size:12px"') +
        '</div>' +
        '<div id="host"></div>' +
      '</div>';

    var host = root.querySelector('#host');
    function paint() {
      host.innerHTML = '';
      host.appendChild(ui.table({
        columns: [
          { key: 'execution_id', label: 'Eksekusi', width: '110px', render: function (e) { return '<span class="mono faint">' + esc(e.execution_id) + '</span>'; } },
          { key: 'plan_id', label: 'Work package', width: '150px', render: function (e) {
            if (!e.plan_id) {
              return '<span class="cell-sub">tidak tercatat</span>' +
                '<div class="tiny faint">mandat ' + esc(e.mandate_id || '—') + '</div>';
            }
            var p = store.plan(e.plan_id);
            return '<a href="#/work-packages/' + encodeURIComponent(e.plan_id) + '" class="cell-title" style="color:var(--brand-600)">' + esc(e.plan_id) + '</a>' +
              '<div class="cell-sub truncate" style="max-width:220px">' + esc(p ? p.intent : '—') + '</div>';
          }},
          { key: 'mandate_id', label: 'Mandat', width: '110px', render: function (e) { return '<span class="mono tiny">' + esc(e.mandate_id || '—') + '</span>'; } },
          { key: 'adapter', label: 'Adapter', width: '130px', render: function (e) { return '<span class="badge badge--outline">' + esc(e.adapter) + '</span>'; } },
          { key: 'result', label: 'Hasil', width: '110px', render: function (e) {
            var r = RESULT[e.result] || RESULT.failed;
            return '<span class="badge badge--' + r.tone + '"><span class="material-symbols-outlined" style="font-size:13px">' + r.icon + '</span>' + r.label + '</span>';
          }},
          { key: 'duration_ms', label: 'Durasi', width: '84px', align: 'right', render: function (e) { return '<span class="tiny muted">' + (e.duration_ms || 0) + ' ms</span>'; } },
          { key: 'at', label: 'Waktu', width: '150px', align: 'right', render: function (e) { return '<span class="tiny muted">' + U.fmtDate(e.at) + '</span>'; } }
        ],
        rows: rows(), pageSize: 8,
        onRowClick: function (e) { detail(e); },
        empty: ui.empty({ icon: 'play_circle', title: 'Belum ada eksekusi', body: 'Eksekusi hanya tercatat setelah mandat dipakai oleh executor.' })
      }));
    }

    function detail(e) {
      var p = store.plan(e.plan_id);
      var r = RESULT[e.result] || RESULT.failed;
      ui.drawer({
        eyebrow: 'Eksekusi ' + e.execution_id,
        title: (e.plan_id || e.execution_id) + ' · ' + r.label,
        subtitle: U.fmtDate(e.at),
        body:
          '<div class="banner banner--' + r.tone + '" style="margin-bottom:14px"><span class="material-symbols-outlined">' + r.icon + '</span>' +
          '<div>' + (e.result === 'sent' ? 'Tindakan dijalankan oleh adapter dan bukti ditulis ke audit.' : 'Tidak ada perubahan yang terjadi. Kegagalan tercatat dan mandat tidak terpakai.') + '</div></div>' +
          '<dl class="def-list">' +
            '<dt>Work package</dt><dd>' + esc(e.plan_id || '— (mandat ' + (e.mandate_id || '?') + ')') + '</dd>' +
            '<dt>Intent</dt><dd>' + esc(p ? p.intent : '—') + '</dd>' +
            '<dt>Tindakan</dt><dd class="mono">' + esc(e.action_id) + '</dd>' +
            '<dt>Mandat</dt><dd class="mono">' + esc(e.mandate_id || '—') + '</dd>' +
            '<dt>Adapter</dt><dd>' + esc(e.adapter) + '</dd>' +
            '<dt>Durasi</dt><dd>' + (e.duration_ms || 0) + ' ms</dd>' +
            '<dt>Bukti</dt><dd class="mono tiny" style="word-break:break-all">' + esc(e.detail) + '</dd>' +
          '</dl>' +
          (e.result === 'failed' ? '<div class="banner banner--warning" style="margin-top:14px"><span class="material-symbols-outlined">replay</span><div>Untuk mencoba lagi, ajukan work package baru. Mandat lama tidak dapat dipakai ulang.</div></div>' : '')
        ,
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
          (e.plan_id ? '<a class="btn btn--primary" href="#/work-packages/' + encodeURIComponent(e.plan_id) + '">Buka work package</a>' : '')
      });
    }

    root.querySelector('#q').addEventListener('input', U.debounce(function (e) { filter.q = e.target.value; paint(); }, 180));
    root.querySelector('#result').addEventListener('change', function (e) { filter.result = e.target.value; paint(); });
    root.querySelector('#export').addEventListener('click', function () {
      var data = [['Eksekusi', 'Work package', 'Mandat', 'Adapter', 'Hasil', 'Durasi (ms)', 'Waktu']];
      store.executions.forEach(function (e) { data.push([e.execution_id, e.plan_id, e.mandate_id || '', e.adapter, e.result, e.duration_ms, e.at]); });
      U.download('dextra-eksekusi.csv', U.csv(data));
      ui.toast('Ekspor eksekusi dibuat.', 'success');
    });

    paint();
  };
})();
