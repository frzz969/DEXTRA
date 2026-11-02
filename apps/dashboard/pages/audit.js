(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;
  function init() {
    var host = document.getElementById('audit-root');
    D.call('get_audit_log', { limit: 200 }).then(function (d) {
      var evs = (d.events || []).slice().reverse();
      if (!evs.length) { host.innerHTML = '<div class="text-sm text-[#77778C]">Belum ada event audit.</div>'; return; }
      host.innerHTML = '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-[11px] uppercase text-[#77778C] border-b border-[#EAE9F1]"><th class="py-2 pr-3">Waktu</th><th class="py-2 pr-3">Tipe</th><th class="py-2 pr-3">Pelaku</th><th class="py-2 pr-3">Subjek</th><th class="py-2 pr-3">Alasan</th></tr></thead><tbody>' +
        evs.map(function (e) {
          return '<tr class="border-b border-[#EAE9F1] hover:bg-[#F7F7FC]">' +
            '<td class="py-2 pr-3 text-xs font-mono text-[#77778C]">' + D.fmtDate(e.at) + '</td>' +
            '<td class="py-2 pr-3"><span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F3F2F9] text-[#484554]">' + D.esc(e.type) + '</span></td>' +
            '<td class="py-2 pr-3 text-xs">' + D.esc(e.actor || '—') + '</td>' +
            '<td class="py-2 pr-3 font-mono text-xs">' + D.esc(e.plan_id || e.mandate_id || e.action_id || '—') + '</td>' +
            '<td class="py-2 pr-3">' + (e.reason_code ? '<span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FDF2F3] text-[#D95362]">' + D.esc(e.reason_code) + '</span>' : '—') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="text-xs text-[#77778C] mt-3">Total ' + evs.length + ' event. Log append-only.</p>';
    }).catch(function (e) { host.innerHTML = '<div class="text-sm text-[#D95362]">Gagal memuat: ' + D.esc(e.message) + '</div>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
