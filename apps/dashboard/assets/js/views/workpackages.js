/* Views — Work Packages list & detail. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'READY', label: 'Siap ditinjau' },
    { key: 'NEEDS_REVIEW', label: 'Perlu tinjauan' },
    { key: 'BLOCKED', label: 'Diblokir' },
    { key: 'DRAFT', label: 'Draf' },
    { key: 'EXECUTED', label: 'Terlaksana' },
    { key: 'REJECTED', label: 'Ditolak' }
  ];

  D.views.workPackages = function (root) {
    var filter = { q: '', status: 'all', specialist: 'all' };
    var c = store.counts();

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Work Management · Work Packages',
        title: 'Work Packages',
        desc: 'Satu work package adalah satu rencana yang dapat ditinjau dan dieksekusi. Status di sini mencerminkan posisi rencana dalam rantai tata kelola.',
        actions: '<button class="btn btn--secondary" id="export"><span class="material-symbols-outlined">download</span>Ekspor</button>' +
          '<a class="btn btn--primary" href="#/assistant"><span class="material-symbols-outlined">add</span>Buat permintaan</a>'
      }) +
      ui.demoBanner() +
      '<div class="grid grid--4" style="margin-bottom:16px">' +
        ui.kpi({ label: 'Total', value: c.total, icon: 'layers', foot: '<span class="material-symbols-outlined">folder_open</span>Seluruh workspace' }) +
        ui.kpi({ label: 'Menunggu keputusan', value: c.awaiting, icon: 'pending_actions', tone: 'warn', foot: '<span class="material-symbols-outlined">person</span>Butuh manusia' }) +
        ui.kpi({ label: 'Diblokir', value: c.blocked, icon: 'block', tone: 'danger', foot: '<span class="material-symbols-outlined">policy</span>Kebijakan aktif' }) +
        ui.kpi({ label: 'Terlaksana', value: c.executed, icon: 'task_alt', tone: 'success', foot: '<span class="material-symbols-outlined">verified_user</span>Dengan mandat' }) +
      '</div>' +
      '<div class="card"><div class="card__head" style="flex-wrap:wrap;gap:10px">' +
        '<div class="segmented" id="chips">' + FILTERS.map(function (f) {
          var n = f.key === 'all' ? store.plans.length : store.plans.filter(function (p) { return p.status === f.key; }).length;
          return '<button data-f="' + f.key + '" class="' + (f.key === 'all' ? 'is-active' : '') + '">' + esc(f.label) + ' <span class="faint">' + n + '</span></button>';
        }).join('') + '</div>' +
        '<div class="spacer"></div>' +
        '<div class="input-wrap" style="width:240px"><span class="material-symbols-outlined">search</span>' +
          '<input class="input input--icon" id="q" placeholder="Cari work package…" style="height:32px"></div>' +
        ui.select('spec', [{ value: 'all', label: 'Semua spesialis' }].concat(store.specialists.map(function (s) { return { value: s.id, label: s.name }; })), 'all', 'style="width:auto;height:32px;font-size:12px"') +
      '</div><div id="host"></div></div>';

    var host = root.querySelector('#host');
    function paint() {
      var rows = store.plans.filter(function (p) {
        if (filter.status !== 'all' && p.status !== filter.status) return false;
        if (filter.specialist !== 'all' && p.specialist !== filter.specialist) return false;
        if (filter.q && (p.plan_id + ' ' + p.intent + ' ' + (p.requester || '')).toLowerCase().indexOf(filter.q.toLowerCase()) < 0) return false;
        return true;
      });
      host.innerHTML = '';
      host.appendChild(ui.table({
        columns: [
          { key: 'plan_id', label: 'ID', width: '106px', render: function (p) { return '<span class="mono faint">' + esc(p.plan_id) + '</span>'; } },
          { key: 'intent', label: 'Work package', render: function (p) {
            return '<div class="cell-title truncate" style="max-width:400px">' + esc(p.intent) + '</div>' +
              '<div class="cell-sub">' + esc(p.requester || '—') + ' · ' + (p.actions || []).length + ' tindakan</div>';
          }},
          { key: 'specialist', label: 'Spesialis', width: '170px', render: function (p) {
            var s = store.specialist(p.specialist) || {};
            return '<div class="row" style="gap:7px"><span class="spec-avatar' + (s.engine ? ' spec-avatar--engine' : '') + '" style="width:24px;height:24px;border-radius:6px">' +
              '<span class="material-symbols-outlined" style="font-size:13px">' + (s.icon || 'smart_toy') + '</span></span>' +
              '<span class="small truncate">' + esc(s.name || '—') + '</span></div>';
          }},
          { key: 'risk', label: 'Risiko', width: '118px', render: function (p) { return D.riskBadge(p.risk); } },
          { key: 'status', label: 'Status', width: '134px', render: function (p) { return D.statusBadge(p.status); } },
          { key: 'mandate_id', label: 'Mandat', width: '100px', render: function (p) {
            return p.mandate_id ? '<span class="mono tiny">' + esc(p.mandate_id) + '</span>' : '<span class="tiny faint">—</span>';
          }},
          { key: 'created_at', label: 'Diperbarui', width: '104px', align: 'right', render: function (p) { return '<span class="tiny muted">' + U.rel(p.created_at) + '</span>'; } }
        ],
        rows: rows, pageSize: 9,
        onRowClick: function (p) { D.router.go('/work-packages/' + p.plan_id); },
        empty: ui.empty({ icon: 'search_off', title: 'Tidak ada work package', body: 'Tidak ada item yang cocok dengan filter saat ini.' })
      }));
    }

    root.querySelectorAll('#chips button').forEach(function (b) {
      b.addEventListener('click', function () {
        root.querySelectorAll('#chips button').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        filter.status = b.getAttribute('data-f');
        paint();
      });
    });
    root.querySelector('#q').addEventListener('input', U.debounce(function (e) { filter.q = e.target.value; paint(); }, 180));
    root.querySelector('#spec').addEventListener('change', function (e) { filter.specialist = e.target.value; paint(); });
    root.querySelector('#export').addEventListener('click', function () {
      var rows = [['ID', 'Intent', 'Pemohon', 'Spesialis', 'Risiko', 'Status', 'Mandat', 'Dibuat']];
      store.plans.forEach(function (p) { rows.push([p.plan_id, p.intent, p.requester || '', (store.specialist(p.specialist) || {}).name || '', p.risk, p.status, p.mandate_id || '', p.created_at]); });
      U.download('dextra-work-packages.csv', U.csv(rows));
      ui.toast('Ekspor dibuat (' + store.plans.length + ' baris).', 'success');
    });

    paint();
  };

  /* ---------------- detail ---------------- */
  var LIFECYCLE = [
    { label: 'Permintaan diterima', types: ['request_received'] },
    { label: 'Niat diinterpretasi', types: ['intent_interpreted'] },
    { label: 'Spesialis ditugaskan', types: ['specialist_assigned'] },
    { label: 'Work package disusun', types: ['plan_drafted'] },
    { label: 'Tinjauan adversarial', types: ['adversarial_review'] },
    { label: 'Validasi kebijakan', types: ['policy_validated', 'policy_blocked'] },
    { label: 'Persetujuan manusia', types: ['approval_granted', 'approval_rejected', 'revision_requested'] },
    { label: 'Mandat diterbitkan', types: ['mandate_issued', 'mandate_revoked'] },
    { label: 'Eksekusi', types: ['action_executed', 'action_blocked'] },
    { label: 'Audit dicatat', types: ['audit_recorded'] }
  ];

  function lifecycle(p) {
    var events = store.auditFor(p.plan_id);
    var done = {};
    events.forEach(function (e) { done[e.type] = e; });
    var blockedAt = -1;
    LIFECYCLE.forEach(function (s, i) {
      if (s.types.indexOf('policy_blocked') > -1 && done.policy_blocked) blockedAt = i;
      if (s.types.indexOf('approval_rejected') > -1 && done.approval_rejected) blockedAt = i;
    });
    var currentIdx = -1;
    LIFECYCLE.forEach(function (s, i) { if (s.types.some(function (t) { return done[t]; })) currentIdx = i; });
    if (p.status === 'BLOCKED' && blockedAt > -1) currentIdx = blockedAt;
    return LIFECYCLE.map(function (s, i) {
      var hit = s.types.map(function (t) { return done[t]; }).filter(Boolean)[0];
      var cls = 'is-pending';
      if (hit && i < currentIdx) cls = 'is-done';
      else if (hit && i === currentIdx) cls = 'is-current';
      if (blockedAt === i) cls = 'is-blocked';
      var icon = cls === 'is-done' ? 'check' : cls === 'is-blocked' ? 'block' : cls === 'is-current' ? 'radio_button_checked' : 'circle';
      return '<div class="tl-item ' + cls + '"><div class="tl-dot"><span class="material-symbols-outlined">' + icon + '</span></div>' +
        '<div class="tl-body"><div class="tl-title">' + esc(s.label) + '</div>' +
        '<div class="tl-meta">' + (hit ? esc(U.actorName(hit.actor)) + ' · ' + U.fmtDate(hit.at) : 'belum terjadi') + '</div></div></div>';
    }).join('');
  }

  D.views.workPackageDetail = function (root, params) {
    var p = store.plan(params.id);
    if (!p) {
      root.innerHTML = ui.pageHead({ eyebrow: 'Work Management', title: 'Work package tidak ditemukan' }) +
        '<div class="card">' + ui.empty({
          icon: 'search_off', title: 'ID ' + esc(params.id) + ' tidak ada',
          body: 'Work package mungkin belum dibuat, atau ID tidak sesuai.',
          action: '<a class="btn btn--primary" href="#/work-packages">Kembali ke daftar</a>'
        }) + '</div>';
      return;
    }
    var mandate = store.mandateFor(p.plan_id);
    var events = store.auditFor(p.plan_id).slice().sort(function (a, b) { return new Date(a.at) - new Date(b.at); });
    var execs = store.executions.filter(function (e) { return e.plan_id === p.plan_id; });
    var spec = store.specialist(p.specialist) || {};
    var isActionable = p.status === 'READY' || p.status === 'NEEDS_REVIEW';

    root.innerHTML =
      '<div class="breadcrumbs" style="margin-bottom:10px"><a href="#/work-packages">Work Packages</a><span class="sep">/</span><span class="current mono">' + esc(p.plan_id) + '</span></div>' +
      '<div class="page-head"><div class="page-head__text">' +
        '<div class="row" style="gap:8px;margin-bottom:6px">' + D.statusBadge(p.status) + D.riskBadge(p.risk) +
          '<span class="badge badge--outline">' + esc((p.actions || []).length) + ' tindakan</span></div>' +
        '<h1 style="max-width:70ch">' + esc(p.intent) + '</h1>' +
        '<p class="mono tiny" style="margin-top:6px">plan_hash ' + esc(p.plan_hash) + '</p>' +
      '</div><div class="page-head__actions">' +
        '<button class="btn btn--secondary" id="copy-id"><span class="material-symbols-outlined">content_copy</span>Salin ID</button>' +
        '<button class="btn btn--secondary" id="export-json"><span class="material-symbols-outlined">download</span>Ekspor JSON</button>' +
        (isActionable ? '<a class="btn btn--primary" href="#/review/' + encodeURIComponent(p.plan_id) + '"><span class="material-symbols-outlined">fact_check</span>Tinjau rencana</a>' : '') +
      '</div></div>' +
      ui.demoBanner() +
      '<div class="grid grid--sidebar">' +
        '<div class="stack">' +

          ui.card({
            title: 'Lingkup tindakan',
            desc: 'Persetujuan berlaku persis untuk tindakan di bawah ini, bukan untuk intent secara umum.',
            body: (p.actions || []).map(function (a, i) {
              return '<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:' + (i === p.actions.length - 1 ? '0' : '10px') + '">' +
                '<div class="row" style="gap:8px;margin-bottom:8px"><span class="badge badge--brand">Tindakan ' + (i + 1) + '</span>' +
                '<span class="small strong">' + esc(a.action_type.replace(/_/g, ' ')) + '</span><div class="spacer"></div>' + D.riskBadge(a.risk) + '</div>' +
                '<dl class="def-list">' +
                  '<dt>Penerima</dt><dd>' + esc(a.target.display_name) + ' · <span class="mono">' + esc(a.target.masked_address) + '</span></dd>' +
                  '<dt>Kanal</dt><dd>' + esc(a.target.channel) + '</dd>' +
                  '<dt>Jadwal</dt><dd>' + esc(U.fmtDate(a.schedule.start_at)) + ' · ' + esc(a.schedule.timezone) + '</dd>' +
                  '<dt>Subjek</dt><dd>' + esc(a.content.subject) + '</dd>' +
                '</dl>' +
                '<div style="margin-top:10px"><div class="tiny muted" style="margin-bottom:4px">Isi persis</div>' +
                '<pre style="margin:0;white-space:pre-wrap;font-family:var(--font-sans);font-size:12px;line-height:1.55;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text-2);max-height:180px;overflow:auto">' + esc(a.content.body) + '</pre></div>' +
              '</div>';
            }).join('')
          }) +

          (p.findings && p.findings.length ? ui.card({
            title: 'Temuan validasi', desc: 'Dari Adversarial Reviewer dan Policy Validator',
            body: p.findings.map(function (f) {
              var tone = f.severity === 'blocking' ? 'danger' : f.severity === 'warning' ? 'warning' : 'info';
              var icon = f.severity === 'blocking' ? 'block' : f.severity === 'warning' ? 'warning' : 'info';
              return '<div class="banner banner--' + tone + '" style="margin-bottom:8px"><span class="material-symbols-outlined">' + icon + '</span>' +
                '<div><b>' + esc(f.code) + '</b> — ' + esc(f.message) + '</div></div>';
            }).join('')
          }) : '') +

          ui.card({
            title: 'Bukti eksekusi', desc: 'Hanya ada jika mandat digunakan',
            body: execs.length
              ? execs.map(function (e) {
                  var label = e.execution_id || (e.source === 'audit' ? 'dari audit' : 'tidak tercatat');
                  return '<div class="banner banner--success" style="margin-bottom:8px"><span class="material-symbols-outlined">check_circle</span>' +
                    '<div><b>' + esc(label) + '</b> · ' + esc(e.adapter) + ' · ' + U.fmtDate(e.at) +
                    '<div class="mono tiny" style="margin-top:2px">' + esc(U.detailText(e.detail)) + '</div></div></div>';
                }).join('')
              : '<div class="empty" style="padding:22px"><div class="empty__icon"><span class="material-symbols-outlined">inbox</span></div>' +
                '<h3>Belum ada eksekusi</h3><p>Tidak ada yang dijalankan sebelum mandat terbit dan dipakai.</p></div>'
          }) +

          ui.card({
            title: 'Jejak audit', desc: 'Append-only · ' + events.length + ' event',
            actions: '<a class="btn btn--ghost btn--sm" href="#/audit">Audit trail</a>',
            body: '<div class="timeline">' + events.map(function (e) {
              var tone = e.type === 'policy_blocked' || e.type === 'action_blocked' ? 'is-blocked'
                : (e.type === 'action_executed' || e.type === 'audit_recorded') ? 'is-done' : 'is-current';
              return '<div class="tl-item ' + tone + '"><div class="tl-dot"><span class="material-symbols-outlined">' +
                (tone === 'is-blocked' ? 'block' : tone === 'is-done' ? 'check' : 'chevron_right') + '</span></div>' +
                '<div class="tl-body"><div class="tl-title">' + esc(e.type.replace(/_/g, ' ')) + '</div>' +
                '<div class="tl-meta">' + esc(U.actorName(e.actor)) + ' · ' + U.fmtDate(e.at) + (e.reason_code ? ' · <b>' + esc(e.reason_code) + '</b>' : '') + '</div>' +
                (e.detail ? '<div class="tiny muted" style="margin-top:2px">' + esc(U.detailText(e.detail)) + '</div>' : '') + '</div></div>';
            }).join('') + '</div>'
          }) +

        '</div>' +
        '<div class="stack">' +

          ui.card({ title: 'Status', body: '<div class="timeline" style="margin-top:-4px">' + lifecycle(p) + '</div>' }) +

          ui.card({
            title: 'Mandat',
            body: mandate
              ? '<dl class="def-list"><dt>ID</dt><dd class="mono">' + esc(mandate.mandate_id) + '</dd>' +
                '<dt>Status</dt><dd>' + D.mandateBadge(mandate.status) + '</dd>' +
                '<dt>Lingkup</dt><dd>' + esc(mandate.scope) + '</dd>' +
                '<dt>Diterbitkan</dt><dd>' + esc(U.fmtDate(mandate.issued_at)) + '</dd>' +
                '<dt>Berlaku s.d.</dt><dd>' + esc(mandate.expires_at ? U.fmtDate(mandate.expires_at) : '—') + '</dd>' +
                '<dt>Pemakaian</dt><dd>' + mandate.uses + ' / ' + mandate.max_uses + '</dd></dl>' +
                (mandate.status === 'active' && D.session.can('revoke_mandate')
                  ? '<button class="btn btn--danger-soft btn--sm btn--block" id="revoke" style="margin-top:12px"><span class="material-symbols-outlined">undo</span>Cabut mandat</button>' : '')
              : '<div class="empty" style="padding:20px"><div class="empty__icon"><span class="material-symbols-outlined">verified_user</span></div>' +
                '<h3>Belum ada mandat</h3><p>Mandat hanya terbit setelah persetujuan manusia.</p></div>'
          }) +

          ui.card({
            title: 'Metadata',
            body: '<dl class="def-list">' +
              '<dt>Pemohon</dt><dd>' + esc(p.requester || '—') + '</dd>' +
              '<dt>Spesialis</dt><dd>' + esc(spec.name || '—') + '</dd>' +
              '<dt>Dibuat</dt><dd>' + esc(U.fmtDate(p.created_at)) + '</dd>' +
              '<dt>Diperbarui</dt><dd>' + esc(U.rel(p.created_at)) + '</dd>' +
              '<dt>Organisasi</dt><dd class="mono">' + esc((store.org && store.org.org_id) || 'org_kenari') + '</dd>' +
              '<dt>Sidik rencana</dt><dd class="mono tiny" style="word-break:break-all">' + esc(p.plan_hash) + '</dd>' +
            '</dl>'
          }) +

          ui.card({
            title: 'Tindakan',
            body: '<div class="stack" style="gap:8px">' +
              (isActionable ? '<a class="btn btn--primary btn--block" href="#/review/' + encodeURIComponent(p.plan_id) + '">Buka review</a>' : '') +
              '<button class="btn btn--secondary btn--block" id="copy2">Salin ID work package</button>' +
              '<a class="btn btn--ghost btn--block" href="#/board">Lihat di task board</a>' +
            '</div>'
          }) +

        '</div>' +
      '</div>';

    function copy() {
      var text = p.plan_id;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { ui.toast('ID disalin: ' + text, 'success'); });
      else ui.toast('ID: ' + text, 'info');
    }
    root.querySelector('#copy-id').addEventListener('click', copy);
    var c2 = root.querySelector('#copy2'); if (c2) c2.addEventListener('click', copy);
    root.querySelector('#export-json').addEventListener('click', function () {
      U.download(p.plan_id + '.json', JSON.stringify(p, null, 2), 'application/json');
      ui.toast('Work package diekspor sebagai JSON.', 'success');
    });
    var revoke = root.querySelector('#revoke');
    if (revoke) revoke.addEventListener('click', function () {
      ui.confirm({
        title: 'Cabut mandat ' + mandate.mandate_id + '?',
        subtitle: 'Tindakan ini mengubah wewenang',
        tone: 'danger', confirmLabel: 'Cabut mandat',
        body: 'Mandat yang dicabut tidak dapat dipakai lagi. Eksekusi yang belum berjalan akan gagal validasi. Pencabutan dicatat di audit trail dan tidak dapat dibatalkan.',
        extra: '<div class="field" style="margin-top:12px"><label class="field__label">Alasan pencabutan <span class="req">*</span></label>' +
          '<textarea class="textarea" id="revoke-reason" placeholder="Contoh: lingkup penerima berubah setelah mandat terbit."></textarea></div>'
      }).then(function (r) {
        if (!r || !r.ok) return;
        if (store.mode === 'live') {
          ui.toast('Pencabutan mandat tidak tersedia melalui API lokal saat ini.', 'warning');
          return;
        }
        mandate.status = 'revoked';
        mandate.revoked_at = new Date().toISOString();
        store.audit.unshift({ at: new Date().toISOString(), type: 'mandate_revoked', actor: D.session.user.name, plan_id: p.plan_id, mandate_id: mandate.mandate_id, reason_code: 'MANUAL_REVOKE', detail: 'Dicabut dari detail work package (demo)' });
        ui.toast('Mandat dicabut (demo). Tercatat di audit trail.', 'success');
        D.router.render();
      });
    });
  };
})();
