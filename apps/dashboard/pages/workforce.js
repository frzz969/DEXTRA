(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;
  function init() {
    var host = document.querySelector('main') || document.getElementById('app');
    if (!host) return;
    var note = document.createElement('div');
    note.className = 'mb-4 p-3 rounded-xl bg-[#FEF7ED] border border-[#F3DDBB] text-sm text-[#8A5B12]';
    note.textContent = 'Halaman ini mendeskripsikan lima spesialis MVP. Utilisasi, status "sedang bekerja", dan metrik performa pada tampilan asli tidak ditampilkan karena tidak ada sumber datanya di backend.';
    host.insertBefore(note, host.firstChild);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
