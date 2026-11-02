(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  var params = new URLSearchParams(location.search);
  var planId = params.get('plan');

  function init() {
    var root = document.querySelector('main') || document.getElementById('app');
    if (!planId) {
      if (root) root.insertAdjacentHTML('afterbegin', '<div class="mb-4 p-4 rounded-xl bg-[#FEF7ED] text-sm text-[#8A5B12]">Pilih work package dari <a class="font-semibold underline" href="permintaan-saya.html">Permintaan Saya</a>.</div>');
      return;
    }
    D.call('get_plan', { plan_id: planId }).then(function (d) {
      var p = d.plan;
      // timeline step states derived from real evidence
      var steps = [
        'Permintaan Diterima', 'Permintaan Diinterpretasi', 'Spesialis Ditugaskan',
        'Work Package Disusun', 'Tinjauan Adversarial', 'Validasi Kebijakan',
        'Persetujuan Manusia', 'Mandat Diterbitkan', 'Eksekusi Mock', 'Audit Dicatat'
      ];
      var doneCount = 0;
      if (p) doneCount = 5;
      if (p && p.status === 'BLOCKED') doneCount = 5;
      D.call('get_audit_log', { limit: 200 }).then(function (a) {
        var evs = (a.events || []).filter(function (e) { return e.plan_id === planId; });
        var hasApproval = evs.some(function (e) { return e.type === 'approval_granted'; });
        var hasExecution = evs.some(function (e) { return e.type === 'action_executed'; });
        var hasBlock = evs.some(function (e) { return e.type === 'action_blocked'; }) || p.status === 'BLOCKED';
        var execEvidence = evs.filter(function (e) { return e.type === 'action_executed'; });
        if (hasApproval) doneCount = 8;
        if (hasExecution) doneCount = 10;
        if (hasBlock && !hasApproval) doneCount = 6;

        // render audit list if a container exists
        var auditHost = document.getElementById('wp-audit');
        if (auditHost) {
          if (!evs.length) auditHost.innerHTML = '<div class="text-sm text-[#77778C]">Belum ada event audit untuk rencana ini.</div>';
          else auditHost.innerHTML = '<div class="space-y-2">' + evs.slice().reverse().map(function (e) {
            return '<div class="flex items-start gap-3 p-3 rounded-lg bg-[#F7F7FC]">' +
              '<span class="material-symbols-outlined text-[18px] text-[#7357E8]">verified_user</span>' +
              '<div class="flex-1">' +
                '<div class="text-sm font-medium text-[#1A1A2C]">' + D.esc(e.type) + '</div>' +
                '<div class="text-xs text-[#77778C]">' + D.esc(e.actor || 'sistem') + ' · ' + D.fmtDate(e.at) + (e.reason_code ? ' · ' + D.esc(e.reason_code) : '') + '</div>' +
              '</div>' +
            '</div>';
          }).join('') + '</div>';
        }

        var execHost = document.getElementById('wp-exec');
        if (execHost) {
          if (execEvidence.length) {
            execHost.innerHTML = '<div class="p-3 rounded-lg bg-[#E8F7F1] text-sm text-[#269B72]">' +
              'Eksekusi mock berhasil. ' + execEvidence.map(function (e) {
                return '<div class="text-xs mt-1 font-mono">' + D.esc(e.detail && e.detail.mock_message_id ? e.detail.mock_message_id : (e.action_id + ' · ' + D.fmtDate(e.at))) + '</div>';
              }).join('') + '</div>';
          } else {
            execHost.innerHTML = '<div class="text-sm text-[#77778C]">Belum ada eksekusi. Terbitkan mandat lalu jalankan dari halaman tinjau.</div>';
          }
        }

        // update timeline dots if present
        document.querySelectorAll('[data-wp-step]').forEach(function (node, i) {
          node.classList.remove('bg-[#E8F7F1]', 'border-[#269B72]', 'text-[#269B72]', 'bg-[#F1EEFF]', 'border-[#7357E8]', 'text-[#7357E8]');
          if (i < doneCount) { node.classList.add('bg-[#E8F7F1]', 'border-[#269B72]', 'text-[#269B72]'); }
          else if (i === doneCount) { node.classList.add('bg-[#F1EEFF]', 'border-[#7357E8]', 'text-[#7357E8]'); }
        });
      }).catch(function () {});

      // replace intent placeholders if any
      document.querySelectorAll('[data-wp-intent]').forEach(function (n) { n.textContent = p.intent || '—'; });
      document.querySelectorAll('[data-wp-planid]').forEach(function (n) { n.textContent = p.plan_id; });
      document.querySelectorAll('[data-wp-hash]').forEach(function (n) { n.textContent = p.plan_hash || '—'; });
    }).catch(function (e) { D.toast('Gagal memuat: ' + e.message, 'error'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
