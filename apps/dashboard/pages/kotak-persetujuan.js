(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function planCard(p) {
    var acts = p.actions || [];
    var risk = acts.reduce(function (max, a) { return (a.risk === 'critical' || (a.risk === 'high' && max !== 'critical') || (a.risk === 'medium' && max === 'low')) ? a.risk : max; }, acts[0] ? acts[0].risk : 'medium');
    var blocked = p.status === 'BLOCKED';
    var findings = (p.findings || []).map(function (f) { return '<div class="text-xs text-[#D95362]">• ' + D.esc(f.code) + ' — ' + D.esc(f.message) + '</div>'; }).join('');
    return '<div class="bg-white border border-[#EAE9F1] rounded-2xl p-5 shadow-[0_2px_8px_-2px_rgba(32,32,51,.04)] ' + (blocked ? 'border-l-4 border-l-[#D95362]' : '') + '">' +
      '<div class="flex items-start justify-between gap-3 mb-3">' +
        '<div class="min-w-0">' +
          '<div class="text-sm font-semibold text-[#1A1A2C] truncate">' + D.esc(p.intent || 'Tanpa judul') + '</div>' +
          '<div class="text-xs text-[#77778C] mt-1">' + D.esc(p.plan_id) + ' · ' + D.relTime(p.created_at) + ' · ' + acts.length + ' tindakan</div>' +
        '</div>' +
        D.statusBadge(p.status) +
      '</div>' +
      '<div class="flex items-center gap-2 mb-3">' + D.riskBadge(risk) + '<span class="text-xs text-[#77778C]">Penerima: ' + D.esc(acts[0] && acts[0].target ? acts[0].target.masked_address : '—') + '</span></div>' +
      (blocked ? '<div class="mb-3 p-3 rounded-lg bg-[#FDF2F3] text-xs text-[#D95362]">' + (findings || 'Diblokir oleh Policy Validator.') + '</div>' : '') +
      '<div class="flex justify-end gap-2">' +
        '<a class="inline-flex items-center px-3 py-1.5 rounded-lg bg-[#F1EEFF] text-[#7357E8] text-xs font-semibold hover:bg-[#E4DEFE]" href="tinjau.html?plan=' + encodeURIComponent(p.plan_id) + '">Tinjau</a>' +
      '</div>' +
    '</div>';
  }

  function render(list) {
    var root = document.querySelector('main') || document.getElementById('app');
    if (!root) return;

    var awaiting = list.filter(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; });
    var blocked = list.filter(function (p) { return p.status === 'BLOCKED'; });
    var decided = list.filter(function (p) { return p.status !== 'READY' && p.status !== 'NEEDS_REVIEW' && p.status !== 'BLOCKED'; });

    var host = document.getElementById('kp-list');
    if (!host) {
      // fallback: append into main
      host = document.createElement('div');
      host.id = 'kp-list';
      root.appendChild(host);
    }
    host.innerHTML = (awaiting.length || blocked.length || decided.length)
      ? '<div class="space-y-4">' +
          (awaiting.length ? '<div><h3 class="text-sm font-semibold text-[#1A1A2C] mb-2">Menunggu Keputusan (' + awaiting.length + ')</h3><div class="space-y-3">' + awaiting.map(planCard).join('') + '</div></div>' : '') +
          (blocked.length ? '<div><h3 class="text-sm font-semibold text-[#D95362] mb-2">Diblokir Kebijakan (' + blocked.length + ')</h3><div class="space-y-3">' + blocked.map(planCard).join('') + '</div></div>' : '') +
          (decided.length ? '<div><h3 class="text-sm font-semibold text-[#77778C] mb-2">Sudah Diputuskan (' + decided.length + ')</h3><div class="space-y-3">' + decided.map(planCard).join('') + '</div></div>' : '') +
        '</div>'
      : '<div class="text-center py-12 text-[#77778C] text-sm">Tidak ada permintaan. <a class="text-[#7357E8] font-semibold" href="buat-permintaan.html">Buat permintaan baru</a>.</div>';

    // update badge counts in sidebar
    document.querySelectorAll('a[data-path="kotak-persetujuan"] span').forEach(function (s) {
      if (/^\d+$/.test(s.textContent.trim())) s.textContent = String(awaiting.length);
    });
  }

  function load() {
    Promise.all([D.getPlans(), D.call('get_audit_log', { limit: 200 }).catch(function () { return { events: [] }; })])
      .then(function (res) { render(D.annotate(res[0], res[1].events || [])); })
      .catch(function (e) { D.toast('Gagal memuat kotak persetujuan: ' + e.message, 'error'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
