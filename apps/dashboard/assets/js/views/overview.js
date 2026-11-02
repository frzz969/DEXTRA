/* View — Overview dashboard. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  function daysBack(n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      out.push(d);
    }
    return out;
  }
  function dayKey(d) { return d.toISOString().slice(0, 10); }
  function sameDay(iso, d) {
    if (!iso) return false;
    var x = new Date(iso);
    return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
  }
  function series(type, days) {
    return days.map(function (d) {
      return store.audit.filter(function (e) { return e.type === type && sameDay(e.at, d); }).length;
    });
  }

  function kpis() {
    var c = store.counts();
    var days = daysBack(7);
    var execSeries = series('action_executed', days);
    var apprSeries = series('approval_granted', days);
    var exec7 = execSeries.reduce(function (a, b) { return a + b; }, 0);
    var blockedReasons = {};
    store.plans.filter(function (p) { return p.status === 'BLOCKED'; }).forEach(function (p) {
      (p.findings || []).forEach(function (f) { if (f.severity === 'blocking') blockedReasons[f.code] = 1; });
    });
    var reasons = Object.keys(blockedReasons).slice(0, 3).join(' · ');

    return '<div class="grid grid--4">' +
      ui.kpi({
        label: 'Work package aktif', value: c.total, icon: 'layers', tone: 'accent',
        foot: '<span class="material-symbols-outlined">schedule</span>' + (c.awaiting + c.draft) + ' masih dalam proses',
        spark: ui.spark([3, 5, 4, 7, 6, 9, c.total], 'var(--brand-500)')
      }) +
      ui.kpi({
        label: 'Menunggu persetujuan', value: c.awaiting, icon: 'pending_actions', tone: 'warn',
        foot: '<span class="material-symbols-outlined">person</span>Butuh keputusan manusia',
        spark: ui.spark(apprSeries, 'var(--warning-600)')
      }) +
      ui.kpi({
        label: 'Diblokir kebijakan', value: c.blocked, icon: 'block', tone: 'danger',
        foot: '<span class="material-symbols-outlined">policy</span>' + (reasons || 'Tidak ada temuan') ,
        spark: ui.spark([1, 0, 2, 1, 2, 2, c.blocked], 'var(--danger-600)')
      }) +
      ui.kpi({
        label: 'Dieksekusi 7 hari', value: exec7, icon: 'task_alt', tone: 'success',
        foot: '<span class="material-symbols-outlined">verified_user</span>Seluruhnya dengan mandat',
        spark: ui.spark(execSeries, 'var(--success-600)')
      }) +
      '</div>';
  }

  function activityCard() {
    var days = daysBack(7);
    var labels = days.map(function (d) { return d.getDate() + '/' + (d.getMonth() + 1); });
    var exec = series('action_executed', days);
    var appr = series('approval_granted', days);
    var blocked = series('policy_blocked', days);
    return ui.card({
      title: 'Aktivitas eksekusi &amp; keputusan',
      desc: 'Tujuh hari terakhir, dihitung dari audit log',
      actions: '<span class="badge badge--outline"><span class="material-symbols-outlined" style="font-size:13px">receipt_long</span>Sumber: audit trail</span>',
      body: '<div class="chart-legend" style="margin-bottom:10px">' +
          '<span><i style="background:var(--brand-500)"></i>Dieksekusi</span>' +
          '<span><i style="background:var(--success-600)"></i>Disetujui</span>' +
          '<span><i style="background:var(--danger-600)"></i>Diblokir</span>' +
          '<span class="spacer"></span>' +
          '<span class="tiny faint">Klik titik untuk detail nilai</span>' +
        '</div>' +
        ui.areaChart({
          labels: labels, height: 200,
          series: [
            { name: 'Dieksekusi', color: 'var(--brand-500)', values: exec },
            { name: 'Disetujui', color: 'var(--success-600)', values: appr },
            { name: 'Diblokir', color: 'var(--danger-600)', values: blocked }
          ]
        }) +
        '<div class="row" style="margin-top:14px;gap:18px;flex-wrap:wrap">' +
          '<div><div class="tiny muted">Total dieksekusi</div><div class="strong" style="font-size:16px">' + exec.reduce(function (a, b) { return a + b; }, 0) + '</div></div>' +
          '<div><div class="tiny muted">Total disetujui</div><div class="strong" style="font-size:16px">' + appr.reduce(function (a, b) { return a + b; }, 0) + '</div></div>' +
          '<div><div class="tiny muted">Diblokir kebijakan</div><div class="strong" style="font-size:16px">' + blocked.reduce(function (a, b) { return a + b; }, 0) + '</div></div>' +
          '<div class="spacer"></div>' +
          '<a class="btn btn--ghost btn--sm" href="#/audit">Buka audit trail<span class="material-symbols-outlined">arrow_forward</span></a>' +
        '</div>'
    });
  }

  function packagesTable() {
    var rows = store.plans.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }).slice(0, 6);
    return ui.table({
      columns: [
        { key: 'plan_id', label: 'ID', width: '106px', render: function (p) { return '<span class="mono faint">' + esc(p.plan_id) + '</span>'; } },
        { key: 'intent', label: 'Work package', render: function (p) {
          return '<div class="cell-title truncate" style="max-width:340px">' + esc(p.intent) + '</div>' +
            '<div class="cell-sub">' + esc((store.specialist(p.specialist) || {}).name || '—') + ' · ' + esc(p.requester || '—') + '</div>';
        }},
        { key: 'risk', label: 'Risiko', width: '116px', render: function (p) { return D.riskBadge(p.risk); } },
        { key: 'status', label: 'Status', width: '132px', render: function (p) { return D.statusBadge(p.status); } },
        { key: 'created_at', label: 'Diperbarui', width: '108px', align: 'right', render: function (p) { return '<span class="tiny muted">' + U.rel(p.created_at) + '</span>'; } }
      ],
      rows: rows,
      onRowClick: function (p) {
        D.router.go(p.status === 'READY' || p.status === 'NEEDS_REVIEW' ? '/review/' + p.plan_id : '/work-packages/' + p.plan_id);
      }
    });
  }

  function packagesCard() {
    return ui.card({
      title: 'Work package terbaru',
      desc: 'Enam pembaruan terakhir di seluruh workspace',
      actions: '<a class="btn btn--secondary btn--sm" href="#/work-packages">Lihat semua</a>',
      flush: true, body: '<div id="wp-table-host"></div>'
    });
  }

  function queueCard() {
    var awaiting = store.plans.filter(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; });
    var body = awaiting.length
      ? awaiting.slice(0, 4).map(function (p) { return ui.planRow(p); }).join('')
      : ui.empty({ icon: 'done_all', title: 'Antrean bersih', body: 'Tidak ada work package yang menunggu keputusan Anda.' });
    return ui.card({
      title: 'Antrean persetujuan',
      desc: awaiting.length + ' menunggu keputusan manusia',
      actions: '<span class="badge badge--warning">' + awaiting.length + '</span>',
      flush: true,
      body: body,
      foot: '<a class="btn btn--primary btn--sm btn--block" href="#/approvals"><span class="material-symbols-outlined">assignment_turned_in</span>Buka approval inbox</a>'
    });
  }

  function governanceCard() {
    var active = store.policies.filter(function (p) { return p.active; }).length;
    var mandatesActive = store.mandates.filter(function (m) { return m.status === 'active'; }).length;
    var c = store.counts();
    return ui.card({
      title: 'Status tata kelola',
      desc: 'Batas wewenang yang sedang berlaku',
      body:
        '<div class="stack" style="gap:14px">' +
          '<div class="row"><span class="material-symbols-outlined" style="font-size:18px;color:var(--success-600)">verified_user</span>' +
            '<div style="flex:1"><div class="small strong">Mandat aktif</div><div class="tiny muted">Terikat plan_hash, satu kali pakai</div></div>' +
            '<span class="strong">' + mandatesActive + '</span></div>' +
          '<div class="row"><span class="material-symbols-outlined" style="font-size:18px;color:var(--brand-600)">policy</span>' +
            '<div style="flex:1"><div class="small strong">Kebijakan aktif</div><div class="tiny muted">' + (store.policies.length - active) + ' nonaktif dalam uji coba</div></div>' +
            '<span class="strong">' + active + '/' + store.policies.length + '</span></div>' +
          '<div class="row"><span class="material-symbols-outlined" style="font-size:18px;color:var(--warning-600)">schedule</span>' +
            '<div style="flex:1"><div class="small strong">Jendela terlindungi</div><div class="tiny muted">Salat Jumat 11:30–13:00 WIB</div></div>' +
            '<span class="badge badge--success">Aktif</span></div>' +
          '<div class="divider" style="margin:2px 0"></div>' +
          '<div class="row"><span class="material-symbols-outlined" style="font-size:18px;color:var(--danger-600)">report</span>' +
            '<div style="flex:1"><div class="small strong">Diblokir</div><div class="tiny muted">Tidak ada eksekusi tanpa mandat</div></div>' +
            '<span class="strong">' + c.blocked + '</span></div>' +
        '</div>' +
        '<div class="banner banner--info" style="margin-top:14px"><span class="material-symbols-outlined">shield_lock</span>' +
        '<div>Local-only service exposure · scoped execution authorization</div></div>'
    });
  }

  function workforceCard() {
    var rows = store.specialists.map(function (s) {
      var load = store.plans.filter(function (p) { return p.specialist === s.id && p.status !== 'EXECUTED' && p.status !== 'REJECTED'; }).length;
      return '<a href="#/specialists" class="row" style="padding:9px 0;border-bottom:1px solid var(--border)">' +
        '<span class="spec-avatar' + (s.engine ? ' spec-avatar--engine' : '') + '" style="width:30px;height:30px;border-radius:8px"><span class="material-symbols-outlined" style="font-size:16px">' + s.icon + '</span></span>' +
        '<div style="flex:1;min-width:0"><div class="small strong truncate">' + esc(s.name) + '</div>' +
        '<div class="tiny muted truncate">' + esc(s.engine ? 'Mesin kebijakan deterministik' : s.role) + '</div></div>' +
        '<span class="badge badge--outline">' + load + ' aktif</span></a>';
    }).join('');
    return ui.card({
      title: 'Workforce', desc: 'Empat spesialis AI, satu mesin kebijakan',
      actions: '<a class="icon-btn" href="#/workforce" title="Buka workforce"><span class="material-symbols-outlined">arrow_outward</span></a>',
      body: '<div style="margin-top:-9px">' + rows + '</div>'
    });
  }

  function attentionCard() {
    var items = [];
    store.plans.forEach(function (p) {
      if (p.status === 'BLOCKED') {
        var f = (p.findings || []).filter(function (x) { return x.severity === 'blocking'; })[0];
        items.push({ icon: 'block', tone: 'danger', title: p.plan_id + ' diblokir', body: f ? f.message : 'Diblokir kebijakan.', href: '#/work-packages/' + p.plan_id });
      } else if (p.status === 'NEEDS_REVIEW') {
        var f2 = (p.findings || []).filter(function (x) { return x.severity === 'blocking'; })[0];
        items.push({ icon: 'help', tone: 'warning', title: p.plan_id + ' butuh klarifikasi', body: f2 ? f2.message : 'Perlu keputusan manusia.', href: '#/review/' + p.plan_id });
      }
    });
    var revoked = store.mandates.filter(function (m) { return m.status === 'revoked'; })[0];
    if (revoked) items.push({ icon: 'undo', tone: 'warning', title: revoked.mandate_id + ' dicabut', body: revoked.revoke_reason, href: '#/mandates' });
    items = items.slice(0, 3);

    var body = items.map(function (it) {
      var color = it.tone === 'danger' ? 'var(--danger-600)' : 'var(--warning-600)';
      var bg = it.tone === 'danger' ? 'var(--danger-100)' : 'var(--warning-100)';
      return '<a href="' + it.href + '" class="row" style="align-items:flex-start;gap:10px;padding:10px;border-radius:9px;border:1px solid var(--border);margin-bottom:8px">' +
        '<span style="width:26px;height:26px;border-radius:7px;background:' + bg + ';color:' + color + ';display:grid;place-items:center;flex:0 0 auto">' +
        '<span class="material-symbols-outlined" style="font-size:15px">' + it.icon + '</span></span>' +
        '<div style="min-width:0"><div class="small strong">' + esc(it.title) + '</div>' +
        '<div class="tiny muted" style="line-height:1.45">' + esc(it.body) + '</div></div></a>';
    }).join('');
    return ui.card({
      title: 'Perlu perhatian', desc: 'Hal yang tidak dapat diselesaikan sistem sendiri',
      body: body || ui.empty({ icon: 'check_circle', title: 'Tidak ada yang mendesak', body: 'Semua item berada dalam alur normal.' })
    });
  }

  function auditCard() {
    var rows = store.audit.slice(0, 5).map(function (e) {
      return '<div class="row" style="align-items:flex-start;gap:9px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<span class="tl-dot" style="width:18px;height:18px;flex:0 0 auto"><span class="material-symbols-outlined" style="font-size:11px">' +
        (e.type === 'action_executed' ? 'check' : e.type === 'policy_blocked' ? 'block' : e.type === 'approval_granted' ? 'verified' : 'history') + '</span></span>' +
        '<div style="flex:1;min-width:0"><div class="tiny strong">' + esc(e.type.replace(/_/g, ' ')) + '</div>' +
        '<div class="tiny muted truncate">' + esc(U.actorName(e.actor)) + ' · ' + esc(e.plan_id || '—') + (e.reason_code ? ' · ' + esc(e.reason_code) : '') + '</div></div>' +
        '<span class="tiny faint nowrap">' + U.rel(e.at) + '</span></div>';
    }).join('');
    return ui.card({
      title: 'Audit terakhir', desc: 'Append-only, tidak dapat diubah',
      actions: '<a class="btn btn--ghost btn--sm" href="#/audit">Semua</a>',
      body: rows
    });
  }

  D.views.overview = function (root) {
    var c = store.counts();
    var greeting = (function () {
      var h = new Date().getHours();
      if (h < 11) return 'Selamat pagi';
      if (h < 15) return 'Selamat siang';
      if (h < 19) return 'Selamat sore';
      return 'Selamat malam';
    })();

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workspace · Overview',
        title: 'Overview',
        desc: greeting + ', ' + esc(D.session.user.name.split(' ')[0]) + '. ' +
          (c.awaiting ? '<b>' + c.awaiting + ' work package menunggu keputusan Anda</b> dan ' + c.blocked + ' diblokir kebijakan.' : 'Tidak ada keputusan yang menunggu.'),
        actions:
          '<a class="btn btn--secondary" href="#/board"><span class="material-symbols-outlined">view_kanban</span>Task board</a>' +
          '<a class="btn btn--primary" href="#/assistant"><span class="material-symbols-outlined">add</span>Buat permintaan</a>'
      }) +
      ui.demoBanner() +
      kpis() +
      '<div class="grid grid--sidebar" style="margin-top:16px">' +
        '<div class="stack">' + activityCard() + packagesCard() +
          '<div class="grid grid--2">' + auditCard() + attentionCard() + '</div>' +
        '</div>' +
        '<div class="stack">' + queueCard() + governanceCard() + workforceCard() + '</div>' +
      '</div>';

    ui.mount(root, '#wp-table-host', packagesTable());
  };
})();
