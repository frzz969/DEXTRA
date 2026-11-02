(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function card(p) {
    var acts = p.actions || [];
    var risk = acts.reduce(function (m, a) { return a.risk === 'critical' ? 'critical' : (a.risk === 'high' && m !== 'critical') ? 'high' : (a.risk === 'medium' && m === 'low') ? 'medium' : m; }, acts[0] ? acts[0].risk : 'medium');
    var target = (acts[0] && acts[0].target) ? acts[0].target.masked_address : '—';
    var href = (p._state === 'READY' || p._state === 'NEEDS_REVIEW') ? 'tinjau.html?plan=' + encodeURIComponent(p.plan_id) : 'work-package.html?plan=' + encodeURIComponent(p.plan_id);
    return '<a href="' + href + '" class="block bg-white border border-[#EAE9F1] rounded-2xl p-5 hover:shadow-[0_8px_24px_-4px_rgba(115,87,232,.08)] transition-all">' +
      '<div class="flex items-start justify-between gap-3">' +
        '<div class="min-w-0">' +
          '<div class="text-sm font-semibold text-[#1A1A2C] truncate">' + D.esc(p.intent || 'Tanpa judul') + '</div>' +
          '<div class="text-xs text-[#77778C] mt-1">' + D.esc(p.plan_id) + ' · ' + acts.length + ' tindakan · ' + D.esc(target) + '</div>' +
        '</div>' +
        D.statusBadge(p._state) +
      '</div>' +
      '<div class="mt-3 flex items-center justify-between">' +
        D.riskBadge(risk) +
        '<span class="text-xs text-[#77778C]">' + D.relTime(p.created_at) + '</span>' +
      '</div>' +
    '</a>';
  }

  function init() {
    var root = document.querySelector('main') || document.getElementById('app');
    var listHost = document.getElementById('ps-list');
    if (!listHost) { listHost = document.createElement('div'); listHost.id = 'ps-list'; (root || document.body).appendChild(listHost); }

    function paint(plans) {
      var q = (document.getElementById('ps-search') || {}).value || '';
      var filter = (document.querySelector('[data-ps-filter].is-active') || {}).getAttribute ? (document.querySelector('[data-ps-filter].is-active').getAttribute('data-ps-filter')) : 'all';
      q = q.trim().toLowerCase();
      var rows = plans.filter(function (p) {
        if (filter !== 'all' && p._state !== filter) return false;
        if (q && !(p.intent || '').toLowerCase().includes(q)) return false;
        return true;
      });
      if (!plans.length) {
        listHost.innerHTML = '<div class="text-center py-12 text-[#77778C] text-sm">Belum ada work package. <a class="text-[#7357E8] font-semibold" href="buat-permintaan.html">Buat permintaan baru</a>.</div>';
        return;
      }
      if (!rows.length) {
        listHost.innerHTML = '<div class="text-center py-12 text-[#77778C] text-sm">Tidak ada hasil. Ubah filter atau kata kunci.</div>';
        return;
      }
      listHost.innerHTML = '<div class="grid gap-3">' + rows.map(card).join('') + '</div>';

      // update counters if present
      var counters = document.querySelectorAll('[data-ps-count]');
      counters.forEach(function (c) { var k = c.getAttribute('data-ps-count'); c.textContent = String(plans.filter(function (p) { return k === 'all' ? true : p._state === k; }).length); });
    }

    Promise.all([D.getPlans(), D.call('get_audit_log', { limit: 200 }).catch(function () { return { events: [] }; })])
      .then(function (res) {
        var plans = D.annotate(res[0], res[1].events || []);
        paint(plans);
        var search = document.getElementById('ps-search');
        if (search) search.addEventListener('input', function () { paint(plans); });
        document.querySelectorAll('[data-ps-filter]').forEach(function (b) {
          b.addEventListener('click', function () {
            document.querySelectorAll('[data-ps-filter]').forEach(function (x) { x.classList.remove('is-active'); });
            b.classList.add('is-active');
            paint(plans);
          });
        });
      })
      .catch(function (e) { D.toast('Gagal memuat: ' + e.message, 'error'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
