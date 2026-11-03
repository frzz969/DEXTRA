/* Views — My Requests, My Work. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var STATUS_OPTS = [
    { value: 'all', label: 'Semua status' },
    { value: 'READY', label: 'Siap ditinjau' },
    { value: 'NEEDS_REVIEW', label: 'Perlu tinjauan' },
    { value: 'BLOCKED', label: 'Diblokir' },
    { value: 'DRAFT', label: 'Draf' },
    { value: 'EXECUTED', label: 'Terlaksana' },
    { value: 'REJECTED', label: 'Ditolak' }
  ];

  D.views.requests = function (root) {
    var filter = { q: '', status: 'all', specialist: 'all' };

    /* Ownership is only knowable when the source records it. Demo data does;
     * list_plans does not. When nothing is attributed, we show the whole
     * workspace and say so — a wrong "mine" is worse than an honest "all". */
    var attributed = store.plans.filter(function (p) { return p.requester; });
    var ownershipKnown = attributed.length > 0;
    var scope = ownershipKnown
      ? attributed.filter(function (p) { return p.requester === D.session.user.name; })
      : store.plans;

    var specOpts = store.hasAttribution() ? [{ value: 'all', label: 'Semua spesialis' }].concat(store.specialists.map(function (s) { return { value: s.id, label: s.name }; })) : null;

    function count(statuses) {
      /* Count by the derived state, not raw `status`: an approved or executed
         plan is no longer "awaiting a decision" even though the contract keeps
         its status at READY. */
      return scope.filter(function (p) { return statuses.indexOf(store.displayStatus(p)) !== -1; }).length;
    }

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workspace · My Requests',
        title: 'My Requests',
        desc: ownershipKnown
          ? 'Permintaan yang saya kirim beserta status rencananya. Permintaan berhenti di persetujuan manusia sebelum apa pun dijalankan.'
          : 'Permintaan di workspace ini beserta status rencananya. Permintaan berhenti di persetujuan manusia sebelum apa pun dijalankan.',
        actions: '<button class="btn btn--secondary" id="export"><span class="material-symbols-outlined">download</span>Ekspor CSV</button>' +
          '<a class="btn btn--primary" href="#/assistant"><span class="material-symbols-outlined">add</span>Buat permintaan</a>'
      }) +
      ui.demoBanner() +
      (ownershipKnown ? '' : ui.partialBanner(
        'Server tidak mencatat siapa pemohon tiap rencana — autentikasi MCP memakai scope (<span class="mono">agent</span>/<span class="mono">ops</span>), bukan identitas orang. ' +
        'Daftar ini menampilkan <b>semua</b> permintaan di workspace, bukan hanya milik satu orang.')) +
      '<div style="margin-bottom:16px">' + ui.statstrip([
        { label: 'Menunggu keputusan', value: count(['READY', 'NEEDS_REVIEW']), tone: 'warning', hint: 'Butuh persetujuan manusia' },
        { label: 'Diblokir kebijakan', value: count(['BLOCKED']), tone: 'danger', hint: 'Tidak dapat disetujui apa adanya' },
        { label: 'Draf', value: count(['DRAFT']), hint: 'Belum diajukan' },
        { label: 'Terlaksana', value: count(['EXECUTED']), tone: 'success', hint: 'Dieksekusi dengan mandat' },
        { label: 'Ditolak', value: count(['REJECTED']), hint: 'Versi rencana ditutup' }
      ]) + '</div>' +
      '<div class="card" style="margin-bottom:16px"><div class="card__body" style="padding:12px 16px">' +
        '<div class="row row--wrap" style="gap:10px">' +
          '<div class="input-wrap" style="flex:1 1 260px;max-width:340px"><span class="material-symbols-outlined">search</span>' +
            '<input class="input input--icon" id="q" placeholder="Cari ID atau isi permintaan…"></div>' +
          ui.select('status', STATUS_OPTS, 'all', 'style="width:auto;min-width:150px"') +
          (specOpts ? ui.select('specialist', specOpts, 'all', 'style="width:auto;min-width:170px"') : '') +
          '<button class="btn btn--ghost btn--sm" id="reset"><span class="material-symbols-outlined">restart_alt</span>Reset</button>' +
          '<div class="spacer"></div>' +
          '<span class="tiny muted" id="count"></span>' +
        '</div>' +
      '</div></div>' +
      '<div class="card"><div id="table-host"></div></div>' +
      '<div class="grid grid--2" style="margin-top:16px">' +
        lifecycleCard() +
        attentionCard() +
      '</div>';

    /* what actually happens after submitting — the requester's main open question */
    function lifecycleCard() {
      var steps = [
        ['Draf', 'Permintaan disusun bersama spesialis. Belum ada wewenang apa pun.'],
        ['Validasi kebijakan', 'Policy Validator memeriksa aturan. Temuan memblokir tidak dapat dilewati.'],
        ['Keputusan manusia', 'Anda atau approver lain menyetujui, meminta revisi, atau menolak.'],
        ['Mandat terbit', 'Wewenang diberikan untuk tindakan persis yang ditinjau, bukan untuk niat umum.'],
        ['Eksekusi terekam', 'Executor memvalidasi mandat lalu menjalankan. Setiap langkah masuk audit trail.']
      ];
      return ui.card({
        className: 'card--fill',
        title: 'Alur setelah pengajuan',
        desc: 'Lima tahap yang dilalui setiap permintaan',
        body: '<div class="steps">' + steps.map(function (s, i) {
          return '<div class="step"><span class="step__num">' + (i + 1) + '</span>' +
            '<div style="min-width:0"><div class="step__title">' + esc(s[0]) + '</div>' +
            '<div class="step__desc">' + esc(s[1]) + '</div></div></div>';
        }).join('') + '</div>'
      });
    }

    /* requests of mine that are waiting on me specifically */
    function attentionCard() {
      var items = scope.filter(function (p) {
        var st = store.displayStatus(p);
        return st === 'READY' || st === 'NEEDS_REVIEW' || st === 'BLOCKED';
      }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 4);

      return ui.card({
        className: 'card--fill',
        title: 'Perlu tindakan',
        desc: ownershipKnown ? 'Dari permintaan Anda sendiri' : 'Dari permintaan di workspace ini',
        flush: true,
        body: items.length
          ? items.map(function (p) { return ui.planRow(p, { action: true }); }).join('')
          : '<div style="padding:26px 16px">' + ui.empty({
              icon: 'task_alt', title: 'Tidak ada yang menunggu',
              body: 'Semua permintaan Anda sudah diputuskan atau sedang berjalan.'
            }) + '</div>',
        foot: items.length
          ? '<span class="tiny muted">Hanya item yang menunggu keputusan manusia.</span>' +
            '<div class="spacer"></div><a class="btn btn--secondary btn--sm" href="#/approvals">Approval inbox</a>'
          : ''
      });
    }

    var host = root.querySelector('#table-host');

    function paint() {
      var rows = scope.filter(function (p) {
        if (filter.status !== 'all' && store.displayStatus(p) !== filter.status) return false;
        if (filter.specialist !== 'all' && p.specialist !== filter.specialist) return false;
        if (filter.q && (p.plan_id + ' ' + p.intent).toLowerCase().indexOf(filter.q.toLowerCase()) < 0) return false;
        return true;
      });
      root.querySelector('#count').textContent = rows.length + ' dari ' + scope.length + ' permintaan';
      host.innerHTML = '';
      host.appendChild(ui.table({
        columns: [
          { key: 'plan_id', label: 'ID', width: '106px', render: function (p) { return '<span class="mono faint">' + esc(p.plan_id) + '</span>'; } },
          { key: 'intent', label: 'Permintaan', render: function (p) {
            return '<div class="cell-title truncate" style="max-width:420px">' + esc(p.intent) + '</div>' +
              '<div class="cell-sub">' + esc((store.specialist(p.specialist) || {}).name || '—') + ' · ' + (p.actions || []).length + ' tindakan</div>';
          }},
          { key: 'risk', label: 'Risiko', width: '120px', render: function (p) { return D.riskBadge(p.risk); } },
          { key: 'status', label: 'Status', width: '136px', render: function (p) { return D.planStatusBadge(p); } },
          { key: 'mandate_id', label: 'Mandat', width: '104px', render: function (p) {
            return p.mandate_id ? '<span class="mono tiny">' + esc(p.mandate_id) + '</span>' : '<span class="faint tiny">belum ada</span>';
          }},
          { key: 'created_at', label: 'Dikirim', width: '104px', align: 'right', render: function (p) { return '<span class="tiny muted">' + U.rel(p.created_at) + '</span>'; } }
        ],
        rows: rows,
        pageSize: 10,
        onRowClick: function (p) {
          D.router.go(p.status === 'READY' || p.status === 'NEEDS_REVIEW' ? '/review/' + p.plan_id : '/work-packages/' + p.plan_id);
        },
        empty: ui.empty({
          icon: 'send', title: 'Belum ada permintaan',
          body: 'Permintaan yang Anda kirim akan muncul di sini beserta status rencananya.',
          action: '<a class="btn btn--primary" href="#/assistant">Buat permintaan pertama</a>'
        })
      }));
    }

    /*
     * The specialist filter only exists when the store can attribute a plan to a
     * specialist. In live mode it cannot — the Plan contract carries no such
     * field — so the select is not rendered at all. Attaching its listener
     * unconditionally threw on every live visit to this page and took the whole
     * route down with it. Resolve each control once and skip the ones that are
     * genuinely absent, rather than assuming the markup is fixed.
     */
    var qEl = root.querySelector('#q');
    var statusEl = root.querySelector('#status');
    var specEl = root.querySelector('#specialist');
    var exportEl = root.querySelector('#export');

    qEl.addEventListener('input', U.debounce(function (e) { filter.q = e.target.value; paint(); }, 180));
    statusEl.addEventListener('change', function (e) { filter.status = e.target.value; paint(); });
    if (specEl) specEl.addEventListener('change', function (e) { filter.specialist = e.target.value; paint(); });
    root.querySelector('#reset').addEventListener('click', function () {
      filter = { q: '', status: 'all', specialist: 'all' };
      qEl.value = '';
      statusEl.value = 'all';
      if (specEl) specEl.value = 'all';
      paint();
    });
    if (exportEl) exportEl.addEventListener('click', function () {
      var rows = [['ID', 'Permintaan', 'Spesialis', 'Risiko', 'Status', 'Mandat', 'Dikirim']];
      scope.forEach(function (p) {
        rows.push([p.plan_id, p.intent, (store.specialist(p.specialist) || {}).name || '', p.risk, p.status, p.mandate_id || '', p.created_at]);
      });
      U.download('dextra-permintaan.csv', U.csv(rows));
      ui.toast('Ekspor CSV dibuat dari data yang tampil (' + scope.length + ' baris).', 'success');
    });

    paint();
  };

  /* ---------------- My Work ---------------- */
  D.views.myWork = function (root) {
    /* Same limitation as /requests: there is no assignment or ownership field
     * server-side, so this queue is derived from plan status across the whole
     * workspace. Say that plainly rather than implying it is personal. */
    var ownershipKnown = store.plans.some(function (p) { return p.requester; });

    var awaiting = store.plans.filter(function (p) { return store.displayStatus(p) === 'READY'; });
    var needs = store.plans.filter(function (p) { return store.displayStatus(p) === 'NEEDS_REVIEW'; });
    var blocked = store.plans.filter(function (p) { return store.displayStatus(p) === 'BLOCKED'; });
    var drafts = store.plans.filter(function (p) { return store.displayStatus(p) === 'DRAFT'; });

    function group(title, desc, items, icon, tone, cta) {
      return ui.card({
        title: title + ' <span class="badge badge--' + tone + '" style="margin-left:6px">' + items.length + '</span>',
        desc: desc,
        flush: true,
        body: items.length ? items.map(function (p) { return ui.planRow(p, { action: true }); }).join('')
          : '<div style="padding:22px 16px" class="tiny muted">Tidak ada item.</div>',
        foot: items.length && cta ? '<a class="btn btn--secondary btn--sm" href="' + cta.href + '">' + esc(cta.label) + '<span class="material-symbols-outlined">arrow_forward</span></a>' : ''
      });
    }

    /* what changed recently on the items sitting in my queue */
    function recentActivityCard() {
      var ids = awaiting.concat(needs, blocked).map(function (p) { return p.plan_id; });
      var rows = store.audit
        .filter(function (e) { return ids.indexOf(e.plan_id) !== -1; })
        .sort(function (a, b) { return new Date(b.at) - new Date(a.at); })
        .slice(0, 5);

      return ui.card({
        title: 'Aktivitas terbaru',
        desc: 'Pada item di antrean Anda',
        flush: true,
        body: rows.length ? rows.map(function (e) {
          var tone = U.eventTone(e.type);
          return '<a class="row" href="#/work-packages/' + encodeURIComponent(e.plan_id) + '" style="padding:9px 16px;border-bottom:1px solid var(--border);gap:8px;align-items:flex-start">' +
            '<span class="dot dot--' + (tone || 'neutral') + '" style="margin-top:5px"></span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="tiny strong">' + esc(U.eventLabel(e.type)) + '</div>' +
              '<div class="tiny muted truncate">' + esc(e.plan_id) + ' · ' + esc(U.actorName(e.actor)) + '</div>' +
            '</div>' +
            '<span class="tiny faint" style="white-space:nowrap">' + esc(U.rel(e.at)) + '</span></a>';
        }).join('') : '<div style="padding:22px 16px" class="tiny muted">Belum ada aktivitas.</div>',
        foot: '<a class="btn btn--ghost btn--sm" href="#/audit" style="padding-left:0">Audit trail<span class="material-symbols-outlined">arrow_forward</span></a>'
      });
    }

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workspace · My Work',
        title: 'My Work',
        desc: ownershipKnown
          ? 'Pekerjaan yang membutuhkan perhatian Anda — bukan seluruh workspace. Hanya item yang menunggu tindakan manusia.'
          : 'Pekerjaan yang menunggu tindakan manusia di workspace ini. Penugasan per orang belum dicatat server.',
        actions: '<a class="btn btn--secondary" href="#/work-packages"><span class="material-symbols-outlined">layers</span>Semua work package</a>'
      }) +
      ui.demoBanner() +
      (ownershipKnown ? '' : ui.partialBanner(
        'Antrean ini disusun dari status rencana, bukan dari penugasan. Server belum menyimpan siapa yang ditugaskan pada tiap work package, ' +
        'jadi yang tampil adalah seluruh item terbuka di workspace.')) +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">' +
        '<div class="stack">' +
          group(ownershipKnown ? 'Menunggu keputusan Anda' : 'Menunggu keputusan', 'Lolos validasi kebijakan, siap disetujui atau ditolak.', awaiting, 'pending_actions', 'warning', { href: '/approvals', label: 'Buka approval inbox' }) +
          group('Butuh klarifikasi', 'Ada temuan yang hanya dapat diputuskan manusia.', needs, 'help', 'info', { href: '/review', label: 'Buka review & validation' }) +
          group('Diblokir kebijakan', 'Tidak dapat disetujui dalam bentuk sekarang. Perlu perubahan lingkup.', blocked, 'block', 'danger') +
          group('Draf saya', 'Belum diajukan untuk validasi.', drafts, 'edit_note', 'outline') +
        '</div>' +
        '<div class="stack rail">' +
          ui.card({
            title: 'Ringkasan beban',
            body: '<div class="stack" style="gap:12px">' +
              [['Menunggu keputusan', awaiting.length, 'var(--warning-600)'],
               ['Butuh klarifikasi', needs.length, 'var(--info-600)'],
               ['Diblokir', blocked.length, 'var(--danger-600)'],
               ['Draf', drafts.length, 'var(--faint)']].map(function (r) {
                return '<div class="row"><span class="small muted" style="flex:1">' + r[0] + '</span>' +
                  '<span class="strong" style="font-size:15px">' + r[1] + '</span></div>';
              }).join('') +
              '<div class="divider" style="margin:4px 0"></div>' +
              '<div class="tiny muted" style="line-height:1.5">Beban dihitung dari work package yang menunggu tindakan manusia, bukan dari jumlah pekerjaan yang sedang berjalan di spesialis.</div>' +
            '</div>'
          }) +
          recentActivityCard() +
          ui.card({
            title: 'Wewenang Anda',
            desc: D.session.roleLabel(),
            body: '<div class="stack" style="gap:8px">' +
              store.capabilities.map(function (c) {
                var st = D.session.capState(c.key);
                var lim = D.session.limited(c.key);
                var icon = st === 'granted' ? (lim ? 'remove_done' : 'check_circle') : st === 'unavailable' ? 'construction' : 'cancel';
                var tone = st === 'granted' ? 'var(--success-600)' : st === 'unavailable' ? 'var(--warning-600)' : 'var(--faint)';
                var suffix = lim ? ' <span class="tiny faint">(terbatas)</span>'
                  : st === 'unavailable' ? ' <span class="tiny faint">(belum ada di server)</span>' : '';
                return '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:' + tone + '">' + icon + '</span>' +
                  '<span class="small ' + (st === 'granted' ? '' : 'muted') + '">' + esc(c.label) + suffix + '</span></div>';
              }).join('') +
              '<div class="tiny faint" style="line-height:1.5;margin-top:2px">' + esc(D.session.identityLine()) + '</div>' +
              '<a class="btn btn--ghost btn--sm" href="#/permissions" style="justify-content:flex-start;padding-left:0">Lihat izin<span class="material-symbols-outlined">arrow_forward</span></a>' +
            '</div>'
          }) +
          ui.card({
            title: 'Pengingat tata kelola',
            body: '<div class="banner banner--warning"><span class="material-symbols-outlined">schedule</span><div>Jendela Salat Jumat <b>11:30–13:00</b> tidak dapat dijadwalkan. Hari libur organisasi berikutnya: <b>10 Nov 2026</b>.</div></div>'
          }) +
        '</div>' +
      '</div>';
  };
})();
