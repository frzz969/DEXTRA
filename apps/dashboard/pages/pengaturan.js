(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;
  function init() {
    var host = document.getElementById('pengaturan-root');
    if (!host) return;
    D.call('get_org_rules', { org_id: 'org_kenari' }).then(function (o) {
      host.innerHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">' +
        '<div class="p-3 rounded-lg bg-[#F7F7FC]"><b>Org ID:</b> ' + D.esc(o.org_id) + '</div>' +
        '<div class="p-3 rounded-lg bg-[#F7F7FC]"><b>Zona Waktu:</b> ' + D.esc((o.timezones || []).join(', ')) + '</div>' +
        '<div class="p-3 rounded-lg bg-[#F7F7FC]"><b>Jam Kerja:</b> ' + D.esc(o.office_hours && o.office_hours.start) + ' – ' + D.esc(o.office_hours && o.office_hours.end) + '</div>' +
        '<div class="p-3 rounded-lg bg-[#F7F7FC]"><b>Salat Jumat:</b> ' + D.esc(o.friday_prayer ? o.friday_prayer.start + ' – ' + o.friday_prayer.end : 'Tidak ada') + '</div>' +
        '<div class="p-3 rounded-lg bg-[#F7F7FC]"><b>Hari Libur:</b> ' + D.esc((o.holidays || []).join(', ') || '—') + '</div>' +
        '<div class="p-3 rounded-lg bg-[#F7F7FC]"><b>Versi Matriks:</b> ' + D.esc(o.approval_matrix_version) + ' · Kontrak ' + D.esc(o.contract_version) + '</div>' +
      '</div>' +
      '<p class="text-xs text-[#77778C] mt-3">Aturan bersifat read-only. Hanya admin organisasi yang dapat mengubahnya.</p>';
    }).catch(function (e) { host.innerHTML = '<div class="text-sm text-[#D95362]">Gagal memuat: ' + D.esc(e.message) + '</div>'; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
