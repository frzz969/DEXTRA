(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function fmtNow() {
    var d = new Date();
    var hari = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][d.getDay()];
    var bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()];
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return hari + ', ' + d.getDate() + ' ' + bulan + ' ' + d.getFullYear() + ' · ' + hh + ':' + mm + ' WIB';
  }

  function init() {
    // live clock in header date indicator
    var dateEl = null;
    document.querySelectorAll('header span').forEach(function (s) {
      if (/\d{2}:\d{2}/.test(s.textContent) && s.textContent.indexOf('·') > -1) dateEl = s;
    });
    function tick() { if (dateEl) dateEl.textContent = fmtNow(); }
    tick(); setInterval(tick, 30000);

    // real KPI numbers from system (no invented operational data)
    Promise.all([D.getPlans(), D.call('get_audit_log', { limit: 500 }).catch(function () { return { events: [] }; })])
      .then(function (res) {
        var plans = D.annotate(res[0], res[1].events || []);
        var total = plans.length;
        var awaiting = plans.filter(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; }).length;
        var blocked = plans.filter(function (p) { return p.status === 'BLOCKED'; }).length;

        // update KPI numbers by label matching
        document.querySelectorAll('p').forEach(function (p) {
          var t = (p.textContent || '').trim().toUpperCase();
          if (t === 'TOTAL WORK PACKAGES') {
            var num = p.parentElement.querySelector('span.font-display');
            if (num) num.textContent = String(total || 0);
          }
          if (t === 'AWAITING APPROVAL') {
            var num2 = p.parentElement.querySelector('span.font-display');
            if (num2) num2.textContent = String(awaiting);
          }
          if (t === 'BLOCKED ACTIONS') {
            var num3 = p.parentElement.querySelector('span.font-display');
            if (num3) num3.textContent = String(blocked);
          }
        });

        // sidebar badge
        document.querySelectorAll('a[data-path="kotak-persetujuan"] span.rounded-full, a[data-path="kotak-persetujuan"] span.bg-\\[\\#7357E8\\]').forEach(function (s) {
          if (/^\d+$/.test(s.textContent.trim())) s.textContent = String(awaiting);
        });
      })
      .catch(function () {});

    // Log Audit Sesi button → audit page
    document.querySelectorAll('button').forEach(function (b) {
      if ((b.textContent || '').toLowerCase().includes('log audit sesi')) {
        b.addEventListener('click', function () { location.href = 'audit.html'; });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();