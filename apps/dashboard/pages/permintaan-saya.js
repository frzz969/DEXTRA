(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  var STATE_KEY = 'ps_filter_state';

  function loadState() { try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}'); } catch (_) { return {}; } }
  function saveState(s) { try { sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch (_) {} }

  function card(p) {
    var acts = p.actions || [];
    var risk = acts.reduce(function (m, a) { return a.risk === 'critical' ? 'critical' : (a.risk === 'high' && m !== 'critical') ? 'high' : (a.risk === 'medium' && m === 'low') ? 'medium' : m; }, acts[0] ? acts[0].risk : 'medium');
    var target = (acts[0] && acts[0].target) ? acts[0].target.masked_address : '—';
    var href = (p._state === 'READY' || p._state === 'NEEDS_REVIEW') ? 'tinjau.html?plan=' + encodeURIComponent(p.plan_id) : 'work-package.html?plan=' + encodeURIComponent(p.plan_id);
    return '<a data-action="open-detail" data-plan="' + D.esc(p.plan_id) + '" href="' + href + '" class="block bg-white border border-[#EAE9F1] rounded-2xl p-5 hover:shadow-[0_8px_24px_-4px_rgba(115,87,232,.08)] transition-all">' +
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
    var listHost = document.getElementById('ps-list');
    if (!listHost) return;
    var search = document.getElementById('ps-search');
    var statusFilter = document.getElementById('ps-status-filter');
    var resetBtn = document.getElementById('ps-reset-filter');

    var st = loadState();
    if (search && st.q) search.value = st.q;
    if (statusFilter && st.status) statusFilter.value = st.status;

    listHost.innerHTML = '<div class="text-center py-12 text-[#77778C] text-sm">Memuat permintaan…</div>';

    D.getPlans().then(function (plans) {
      return D.call('get_audit_log', { limit: 200 }).catch(function () { return { events: [] }; }).then(function (d) {
        return D.annotate(plans, (d && d.events) || []);
      });
    }).then(function (plans) {
      function paint() {
        var q = (search && search.value || '').trim().toLowerCase();
        var status = (statusFilter && statusFilter.value) || 'all';
        if (status === 'Status: Semua Status') status = 'all';
        saveState({ q: search ? search.value : '', status: status });
        var rows = plans.filter(function (p) {
          if (status !== 'all' && p._state !== status) return false;
          if (q && !(p.intent || '').toLowerCase().includes(q) && !(p.plan_id || '').toLowerCase().includes(q)) return false;
          return true;
        });
        if (!plans.length) {
          listHost.innerHTML = '<div class="text-center py-12 text-[#77778C] text-sm">Belum ada work package. <a class="text-[#7357E8] font-semibold" href="buat-permintaan.html">Buat permintaan baru</a>.</div>';
          return;
        }
        if (!rows.length) {
          listHost.innerHTML = '<div class="text-center py-12 text-[#77778C] text-sm">Tidak ada hasil. Ubah filter atau kata kunci. <button data-action="reset-filters" class="text-[#7357E8] font-semibold ml-2">Reset</button></div>';
          return;
        }
        listHost.innerHTML = '<div class="grid gap-3">' + rows.map(card).join('') + '</div>';
      }
      paint();
      if (search) search.addEventListener('input', paint);
      if (statusFilter) statusFilter.addEventListener('change', paint);
      if (resetBtn) resetBtn.addEventListener('click', function () {
        if (search) search.value = '';
        if (statusFilter) statusFilter.value = 'all';
        saveState({});
        paint();
        D.toast('Filter direset', 'info');
      });
      listHost.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-action="reset-filters"]');
        if (btn) { if (search) search.value = ''; if (statusFilter) statusFilter.value = 'all'; saveState({}); paint(); }
      });
    }).catch(function (e) {
      listHost.innerHTML = '<div class="text-center py-12 text-[#D95362] text-sm">Gagal memuat: ' + D.esc(e.message) + '</div>';
      D.toast('Gagal memuat: ' + e.message, 'error');
    });

    // Non-MVP controls
    document.querySelectorAll('[data-action="export-log"]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); D.toast('Ekspor log belum tersedia di MVP', 'info'); });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();