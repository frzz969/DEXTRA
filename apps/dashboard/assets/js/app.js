/* DEXTRA Dashboard — bootstrap. */
(function () {
  'use strict';
  var D = window.DEXTRA;

  function start() {
    D.boot().then(function () {
      D.shell.init();
      D.router.start();
      if (D.store.mode === 'demo') {
        setTimeout(function () {
          D.ui.toast('Mode demo: server MCP lokal tidak terdeteksi. Data contoh, bukan operasi nyata.', 'info', 5200);
        }, 700);
      } else {
        D.ui.toast('Terhubung ke server MCP lokal. Data live.', 'success', 4200);
      }
    }).catch(function (err) {
      document.getElementById('view-root').innerHTML =
        '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div><b>Gagal memulai dashboard.</b> ' + D.util.esc(err.message) + '</div></div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
