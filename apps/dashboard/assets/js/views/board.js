/* View — Task Board (kanban over work packages). */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var COLS = [
    { key: 'draft', label: 'Draf', tone: 'var(--faint)', desc: 'Belum diajukan' },
    { key: 'clarify', label: 'Butuh klarifikasi', tone: 'var(--info-600)', desc: 'Menunggu jawaban manusia' },
    { key: 'review', label: 'Menunggu persetujuan', tone: 'var(--warning-600)', desc: 'Siap diputuskan' },
    { key: 'blocked', label: 'Diblokir', tone: 'var(--danger-600)', desc: 'Kebijakan menolak' },
    { key: 'done', label: 'Selesai', tone: 'var(--success-600)', desc: 'Dieksekusi dengan mandat' }
  ];

  /* In live mode cards are derived from server plans on every paint, so a drag
     needs an explicit per-session override or it would snap back immediately. */
  var liveMove = {};

  var STATUS_COL = {
    DRAFT: 'draft', READY: 'review', NEEDS_REVIEW: 'review',
    BLOCKED: 'blocked', EXECUTED: 'done', REJECTED: 'blocked'
  };

  D.views.board = function (root) {
    var q = '';
    var spec = 'all';

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Work Management · Task Board',
        title: 'Task Board',
        desc: 'Tampilan papan dari work package yang sama. Kolom menunjukkan posisi dalam rantai tata kelola, bukan prioritas bebas.',
        actions: '<a class="btn btn--secondary" href="#/work-packages"><span class="material-symbols-outlined">table_rows</span>Tampilan tabel</a>' +
          '<a class="btn btn--primary" href="#/assistant"><span class="material-symbols-outlined">add</span>Buat permintaan</a>'
      }) +
      (store.mode === 'live' ? ui.prototypeBanner('Kartu dibaca dari work package di server; kolom mengikuti statusnya. Memindahkan kartu hanya mengubah tampilan di peramban ini — status tata kelola tidak berubah tanpa persetujuan dan mandat.') : ui.prototypeBanner('Memindahkan kartu hanya mengubah tampilan lokal di peramban ini. Status tata kelola sebuah work package tidak berubah tanpa persetujuan dan mandat.')) +
      '<div class="card" style="margin-bottom:16px"><div class="card__body" style="padding:10px 14px">' +
        '<div class="row row--wrap" style="gap:10px">' +
          '<div class="input-wrap" style="flex:1 1 220px;max-width:300px"><span class="material-symbols-outlined">search</span>' +
            '<input class="input input--icon" id="q" placeholder="Cari kartu…" style="height:32px"></div>' +
          ui.select('spec', [{ value: 'all', label: 'Semua spesialis' }].concat(store.specialists.map(function (s) { return { value: s.id, label: s.name }; })), 'all', 'style="width:auto;height:32px;font-size:12px"') +
          '<div class="spacer"></div>' +
          '<span class="tiny muted">Seret kartu antar kolom · ' + cards().length + ' kartu</span>' +
        '</div>' +
      '</div></div>' +
      '<div class="kanban" id="kanban"></div>';

    var kanban = root.querySelector('#kanban');

    /* demo: curated board · live: derived from the plans the server returns */
    function cards() {
      if (store.mode !== 'live') return store.board;
      return store.plans.map(function (p) {
        var specialist = store.specialists.filter(function (x) { return x.id === p.specialist; })[0];
        return {
          id: p.plan_id,
          title: p.intent,
          col: liveMove[p.plan_id] || STATUS_COL[p.status] || 'draft',
          spec: specialist ? specialist.name : 'Workforce Dispatcher',
          risk: p.risk || 'medium',
          due: '—'
        };
      });
    }

    function visible(card) {
      if (spec !== 'all' && store.plans.some(function (p) { return p.plan_id === card.id && p.specialist !== spec; })) return false;
      if (q && (card.id + ' ' + card.title).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
      return true;
    }

    function paint() {
      kanban.innerHTML = COLS.map(function (col) {
        var inCol = cards().filter(function (c) { return c.col === col.key && visible(c); });
        return '<section class="kcol" data-col="' + col.key + '">' +
          '<div class="kcol__head"><span style="width:7px;height:7px;border-radius:50%;background:' + col.tone + '"></span>' +
            '<span class="kcol__title">' + esc(col.label) + '</span><span class="kcol__count">' + inCol.length + '</span></div>' +
          '<div class="kcol__body">' +
            (inCol.length ? inCol.map(function (c) {
              var plan = store.plan(c.id);
              return '<article class="kcard" draggable="true" data-id="' + esc(c.id) + '" tabindex="0">' +
                '<div class="row" style="gap:6px;margin-bottom:5px"><span class="mono tiny faint">' + esc(c.id) + '</span>' +
                  '<span class="spacer"></span>' + (plan ? D.statusBadge(plan.status) : '') + '</div>' +
                '<div class="kcard__title">' + esc(c.title) + '</div>' +
                '<div class="kcard__meta">' + D.riskBadge(c.risk) +
                  '<span class="tag">' + esc(c.spec.split(' ').map(function (w) { return w[0]; }).join('')) + '</span>' +
                  '<span class="tiny faint" style="margin-left:auto">' + esc(c.due) + '</span></div>' +
                '</article>';
            }).join('') : '<div class="tiny faint" style="padding:14px;text-align:center">Kosong</div>') +
          '</div></section>';
      }).join('');

      kanban.querySelectorAll('.kcard').forEach(function (el) {
        el.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData('text/plain', el.getAttribute('data-id'));
          e.dataTransfer.effectAllowed = 'move';
          el.classList.add('is-dragging');
        });
        el.addEventListener('dragend', function () { el.classList.remove('is-dragging'); });
        el.addEventListener('click', function () {
          var id = el.getAttribute('data-id');
          var plan = store.plan(id);
          if (!plan) return;
          D.router.go(plan.status === 'READY' || plan.status === 'NEEDS_REVIEW' ? '/review/' + id : '/work-packages/' + id);
        });
        el.addEventListener('keydown', function (e) { if (e.key === 'Enter') el.click(); });
      });

      kanban.querySelectorAll('.kcol').forEach(function (col) {
        col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-over'); });
        col.addEventListener('dragleave', function () { col.classList.remove('is-over'); });
        col.addEventListener('drop', function (e) {
          e.preventDefault();
          col.classList.remove('is-over');
          var id = e.dataTransfer.getData('text/plain');
          var card = cards().filter(function (c) { return c.id === id; })[0];
          if (!card) return;
          var target = col.getAttribute('data-col');
          if (card.col === target) return;
          var targetLabel = (COLS.filter(function (c) { return c.key === target; })[0] || {}).label;
          if (store.mode === 'live') {
            /* the server still owns the status; this only moves the card on screen */
            liveMove[id] = target;
          } else {
            card.col = target;
          }
          paint();
          ui.toast(id + ' dipindahkan ke "' + targetLabel + '" (tampilan lokal saja — status tata kelola tidak berubah).', 'info');
        });
      });
    }

    root.querySelector('#q').addEventListener('input', U.debounce(function (e) { q = e.target.value; paint(); }, 150));
    root.querySelector('#spec').addEventListener('change', function (e) { spec = e.target.value; paint(); });
    paint();
  };
})();
