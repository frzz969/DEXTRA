/* View — Analytics.
 *
 * Everything on this page is a count or a sum over execution records the server
 * already stored. There is no model, no forecast, and no price table: if a
 * number was not measured, the page says "tidak diukur" instead of showing zero.
 * The difference matters — zero looks like a result, absence is a fact.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  function num(x) { return typeof x === 'number' ? x.toLocaleString('id-ID') : '—'; }
  function ms(x) { return typeof x === 'number' ? x + ' ms' : '—'; }

  /* A measurement that did not happen is not zero. */
  function measured(measuredCount, value, unit) {
    if (!measuredCount) return '<span class="faint">tidak diukur</span>';
    return esc(String(value)) + (unit ? ' <span class="tiny muted">' + esc(unit) + '</span>' : '');
  }

  D.views.analytics = function (root) {
    var s = store.executionSummary;
    var live = store.mode === 'live';

    if (!s) {
      root.innerHTML =
        ui.pageHead({
          eyebrow: 'Intelligence · Analytics',
          title: 'Analytics',
          desc: 'Ringkasan eksekusi dihitung server dari rekaman yang benar-benar tersimpan.'
        }) +
        (live
          ? ui.empty({
              icon: 'query_stats',
              title: 'Ringkasan belum tersedia',
              body: 'Server belum mengirim ringkasan eksekusi. Halaman ini tidak menghitung sendiri dari sebagian data, karena angka yang dihitung dari potongan akan berbeda dengan angka server.'
            })
          : ui.demoBanner('Mode demo: tidak ada eksekusi nyata, jadi tidak ada yang bisa diringkas.') );
      return;
    }

    var latencyFoot = s.latency.measured
      ? s.latency.measured + ' dari ' + s.total + ' eksekusi punya pengukuran waktu'
      : 'belum ada eksekusi yang mengukur waktu';

    var tokenFoot = s.tokens.measured
      ? s.tokens.measured + ' eksekusi melaporkan pemakaian token'
      : 'adapter saat ini tidak memanggil model, jadi token tidak diukur';

    var costFoot = s.cost_usd.measured
      ? s.cost_usd.measured + ' eksekusi melaporkan biaya'
      : 'biaya tidak dapat dihitung tanpa pemakaian token';

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Intelligence · Analytics',
        title: 'Analytics',
        desc: 'Dihitung server dari ' + s.total + ' rekaman eksekusi. Tidak ada angka yang diperkirakan: yang tidak terukur ditandai, bukan diisi nol.',
        actions: '<a class="btn btn--secondary" href="#/execution"><span class="material-symbols-outlined">play_circle</span>Rekaman eksekusi</a>'
      }) +
      '<div class="banner banner--info" style="margin-bottom:16px"><span class="material-symbols-outlined">help</span><div>' +
        '<b>"Diterima adapter" bukan "pekerjaan selesai".</b> Status <span class="mono">sent</span> berarti adapter menerima permintaan dan mengembalikan id. ' +
        'Adapter sekarang tiruan, jadi tidak ada pesan yang benar-benar keluar dari sistem. Angka ini mengukur penerimaan, bukan hasil akhir pekerjaan — ' +
        'DEXTRA belum punya sinyal yang membuktikan sebuah tugas mencapai tujuannya.' +
      '</div></div>' +
      '<div class="grid grid--4" style="margin-bottom:16px">' +
        ui.kpi({ label: 'Total eksekusi', value: num(s.total), icon: 'bolt', foot: '<span class="tiny muted">seluruh rekaman tersimpan</span>' }) +
        ui.kpi({
          label: 'Diterima adapter',
          value: s.dispatch_rate === null ? '—' : pct(s.dispatch_rate),
          icon: 'check_circle',
          tone: s.dispatch_rate === null ? '' : (s.dispatch_rate >= 0.9 ? 'success' : s.dispatch_rate >= 0.6 ? 'warning' : 'danger'),
          foot: '<span class="tiny muted">' + s.by_result.sent + ' dari ' + s.total + ' · bukan penyelesaian tugas</span>'
        }) +
        ui.kpi({ label: 'Latensi p50', value: ms(s.latency.p50_ms), icon: 'speed', foot: '<span class="tiny muted">' + esc(latencyFoot) + '</span>' }) +
        ui.kpi({ label: 'Latensi p95', value: ms(s.latency.p95_ms), icon: 'timer', foot: '<span class="tiny muted">maks ' + ms(s.latency.max_ms) + '</span>' }) +
      '</div>' +

      '<div class="grid grid--2" style="gap:16px">' +
        ui.card({
          title: 'Distribusi hasil',
          desc: 'Setiap eksekusi berakhir di salah satu dari empat keadaan ini.',
          body: ui.bars([
            { label: 'Berhasil', value: s.by_result.sent, color: 'var(--color-success, #3B6D11)' },
            { label: 'Diblokir', value: s.by_result.blocked, color: 'var(--color-warning, #BA7517)' },
            { label: 'Gagal', value: s.by_result.failed, color: 'var(--color-danger, #A32D2D)' },
            { label: 'Antre', value: s.by_result.queued, color: 'var(--color-text-tertiary, #888780)' }
          ])
        }) +
        ui.card({
          title: 'Apa yang benar-benar terukur',
          desc: 'Kolom tengah menyebut berapa rekaman yang mendukung tiap angka.',
          body: '<dl class="def-list">' +
            '<dt>Latensi</dt><dd>' + measured(s.latency.measured, s.latency.p50_ms, 'ms (p50)') + ' <span class="tiny muted">· hanya pemanggilan adapter</span></dd>' +
            '<dt>Token masuk</dt><dd>' + measured(s.tokens.measured, num(s.tokens.input), 'token') + '</dd>' +
            '<dt>Token keluar</dt><dd>' + measured(s.tokens.measured, num(s.tokens.output), 'token') + '</dd>' +
            '<dt>Biaya</dt><dd>' + measured(s.cost_usd.measured, '$' + s.cost_usd.total.toFixed(4), 'USD') + '</dd>' +
            '<dt>Asal biaya</dt><dd>' +
              (s.cost_usd.measured
                ? s.cost_usd.by_source.provider_reported + ' dilaporkan provider · ' + s.cost_usd.by_source.rate_card + ' dari tarif · ' + s.cost_usd.by_source.unknown + ' tanpa sumber'
                : '<span class="faint">belum ada biaya untuk dilacak asalnya</span>') +
            '</dd>' +
            '</dl>' +
            '<div class="banner banner--info" style="margin-top:14px"><span class="material-symbols-outlined">science</span><div>' +
              '<b>Kenapa token dan biaya kosong.</b> Adapter yang berjalan sekarang adalah tiruan: tidak ada model yang dipanggil, jadi tidak ada token yang dipakai. ' +
              'Menulis 0 di sini akan terlihat seperti penghematan, padahal artinya tidak ada pengukuran. ' +
              'Angka ini terisi sendiri begitu adapter provider sungguhan dipasang.' +
            '</div></div>',
          foot: '<span class="tiny muted">' + esc(tokenFoot) + ' · ' + esc(costFoot) + '</span>'
        }) +
      '</div>';
  };
})();
