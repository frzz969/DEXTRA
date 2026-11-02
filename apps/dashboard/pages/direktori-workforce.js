(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;
  function init() { /* Stitch page is static; hook runtime later if needed */ }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();