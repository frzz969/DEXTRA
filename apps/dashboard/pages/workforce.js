(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;
  function init() {
    // Replace fake metric numbers with "—" (no backend data source)
    var metricNodes = document.querySelectorAll('[data-metric]');
    metricNodes.forEach(function (n) { n.textContent = '—'; });
    // Generic: any standalone numeric in metric cards → leave design; mark N/A via title
    var host = document.querySelector('main') || document.getElementById('app');
    if (host) {
      var note = document.createElement('div');
      note.className = 'mb-4 p-3 rounded-xl bg-[#FEF7ED] border border-[#F3DDBB] text-sm text-[#8A5B12]';
      note.textContent = 'Metrik utilisasi/performa ditampilkan sebagai "—" karena tidak ada sumber data backend.';
      host.insertBefore(note, host.firstChild);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();