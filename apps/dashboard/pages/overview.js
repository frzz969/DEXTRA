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
    var dateEl = null;
    document.querySelectorAll('header span').forEach(function (s) {
      if (/\d{2}:\d{2}/.test(s.textContent) && s.textContent.indexOf('·') > -1) dateEl = s;
    });
    function tick() { if (dateEl) dateEl.textContent = fmtNow(); }
    tick(); setInterval(tick, 30000);

    Promise.all([D.getPlans(), D.call('get_audit_log', { limit: 500 }).catch(function () { return { events: [] }; })])
      .then(function (res) {
        var plans = D.annotate(res[0], res[1].events || []);
        var total = plans.length;
        var awaiting = plans.filter(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; }).length;
        var blocked = plans.filter(function (p) { return p.status === 'BLOCKED'; }).length;

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

        document.querySelectorAll('a[data-path="kotak-persetujuan"] span.rounded-full, a[data-path="kotak-persetujuan"] span.bg-\\[\\#7357E8\\]').forEach(function (s) {
          if (/^\d+$/.test(s.textContent.trim())) s.textContent = String(awaiting);
        });
      })
      .catch(function () {});

    // Button wiring
    document.querySelectorAll('button').forEach(function (b) {
      var t = (b.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
      if (t.includes('log audit sesi')) {
        b.addEventListener('click', function () { location.href = 'audit.html'; });
      } else if (t.includes('tinjau mandat') || t === 'tinjau' || t.includes('tinjau')) {
        b.addEventListener('click', function () { location.href = 'kotak-persetujuan.html'; });
      } else if (t.includes('investigasi log')) {
        b.addEventListener('click', function () { location.href = 'audit.html'; });
      } else if (t.includes('beri klarifikasi')) {
        b.addEventListener('click', function () { D.toast('Belum tersedia di MVP', 'info'); });
      } else if (t.includes('perbesar') || t.includes('open_in_full')) {
        b.addEventListener('click', function () { D.toast('Belum tersedia di MVP', 'info'); });
      } else if (t.includes('tinjau rencana')) {
        b.addEventListener('click', function () { location.href = 'kotak-persetujuan.html'; });
      } else if (t.includes('buka kotak persetujuan')) {
        b.addEventListener('click', function () { location.href = 'kotak-persetujuan.html'; });
      }
    });

    // Anchor buttons with data-path handled by shared wireNav; ensure + Buat Permintaan works (data-path already)
    document.querySelectorAll('a[data-path="buat-permintaan"]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); location.href = 'buat-permintaan.html'; });
    });

    // WP filter tabs
    var tabs = document.querySelectorAll('.flex.items-center.gap-1\\.5.p-1.bg-\\[\\#F7F7FC\\] button');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('bg-white','text-[#7357E8]','shadow-xs'); t.classList.add('text-[#797586]'); });
        tab.classList.add('bg-white','text-[#7357E8]','shadow-xs');
        tab.classList.remove('text-[#797586]');
        D.toast('Filter diterapkan: ' + tab.textContent.trim(), 'info');
      });
    });

    // Search input filter
    var searchInput = document.querySelector('header input[type="text"]');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var q = (searchInput.value || '').toLowerCase();
        document.querySelectorAll('[class*="WP-00"]').forEach(function () {}); // noop placeholder
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();