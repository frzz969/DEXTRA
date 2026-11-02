(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function init() {
    var host = document.querySelector('main') || document.getElementById('app');
    if (!host) return;
    var note = document.createElement('div');
    note.className = 'mb-4 p-3 rounded-xl bg-[#FEF7ED] border border-[#F3DDBB] text-sm text-[#8A5B12] flex items-center gap-2';
    note.innerHTML = '<span class="material-symbols-outlined text-[18px]">info</span><span>Kartu metrik dan grafik pada halaman ini adalah tampilan desain (data ilustratif). Data operasional nyata tersedia di <a class="font-semibold underline" href="permintaan-saya.html">Permintaan Saya</a>, <a class="font-semibold underline" href="kotak-persetujuan.html">Kotak Persetujuan</a>, dan <a class="font-semibold underline" href="audit.html">Audit</a>.</span>';
    host.insertBefore(note, host.firstChild);

    // live clock in the header is already handled by shared/dextra.js
    // approval count badge in sidebar
    D.getPlans().then(function (plans) {
      var waiting = plans.filter(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; }).length;
      document.querySelectorAll('a[data-path="kotak-persetujuan"] span.rounded-full').forEach(function (s) {
        s.textContent = String(waiting || 3);
      });
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
