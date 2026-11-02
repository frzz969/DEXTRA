(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function init() {
    var host = document.querySelector('main') || document.getElementById('app');
    D.call('get_audit_log', { limit: 500 }).then(function (a) {
      var events = (a.events || []).filter(function (e) { return e.type === 'approval_granted' && e.mandate_id; });
      // dedupe by mandate_id
      var seen = {};
      var rows = [];
      events.forEach(function (e) { if (!seen[e.mandate_id]) { seen[e.mandate_id] = true; rows.push(e); } });
      rows.sort(function (x, y) { return new Date(y.at) - new Date(x.at); });

      if (!host) return;
      var card = document.createElement('div');
      card.className = 'mb-6 p-6 rounded-2xl bg-white border border-[#EAE9F1] shadow-[0_2px_8px_-2px_rgba(32,32,51,.04)]';
      if (!rows.length) {
        card.innerHTML = '<h2 class="text-lg font-semibold text-[#1A1A2C] mb-2">Direktori Mandat</h2><p class="text-sm text-[#77778C]">Belum ada mandat. Mandat terbit setelah persetujuan manusia.</p>';
      } else {
        card.innerHTML = '<h2 class="text-lg font-semibold text-[#1A1A2C] mb-4">Direktori Mandat (' + rows.length + ')</h2>' +
          '<div class="space-y-3">' + rows.map(function (e) {
            return '<div class="p-4 rounded-xl bg-[#F7F7FC] border border-[#EAE9F1]">' +
              '<div class="flex items-start justify-between gap-3">' +
                '<div>' +
                  '<div class="font-mono text-sm text-[#1A1A2C]">' + D.esc(e.mandate_id) + '</div>' +
                  '<div class="text-xs text-[#77778C] mt-1">Plan: ' + D.esc(e.plan_id) + ' · Diterbitkan ' + D.fmtDate(e.at) + '</div>' +
                  '<div class="text-xs text-[#77778C]">Hash: ' + D.esc((e.plan_hash || '').slice(0, 18)) + '…</div>' +
                '</div>' +
                '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E8F7F1] text-[#269B72]">Aktif</span>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>' +
          '<p class="text-xs text-[#77778C] mt-4">Pencabutan mandat dilakukan dari detail work package. Mandat yang sudah dicabut tidak dapat dieksekusi ulang.</p>';
      }
      host.insertBefore(card, host.firstChild);
    }).catch(function (e) { D.toast('Gagal memuat mandat: ' + e.message, 'error'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
