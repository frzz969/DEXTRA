/* Views — Governance: Approval Inbox, Review, Mandates, Audit Trail, Policies. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  function planCard(p, opts) {
    opts = opts || {};
    var acts = p.actions || [];
    var first = acts[0] || {};
    var blocking = (p.findings || []).filter(function (f) { return f.severity === 'blocking'; });
    var warn = (p.findings || []).filter(function (f) { return f.severity === 'warning'; });
    var blocked = p.status === 'BLOCKED';
    return '<article class="card" style="padding:0;overflow:hidden' + (blocked ? ';border-left:3px solid var(--danger-600)' : '') + '">' +
      '<div style="padding:14px 16px">' +
        '<div class="row" style="gap:8px;margin-bottom:6px">' +
          '<span class="mono tiny faint">' + esc(p.plan_id) + '</span>' + D.statusBadge(p.status) + D.riskBadge(p.risk) +
          '<span class="spacer"></span><span class="tiny faint">' + U.rel(p.created_at) + '</span>' +
        '</div>' +
        '<div class="small strong" style="font-size:13.5px;line-height:1.4;margin-bottom:6px">' + esc(p.intent) + '</div>' +
        '<div class="row row--wrap" style="gap:14px;font-size:11.5px;color:var(--muted)">' +
          '<span class="row" style="gap:4px"><span class="material-symbols-outlined" style="font-size:14px">person</span>' + esc(p.requester || '—') + '</span>' +
          '<span class="row" style="gap:4px"><span class="material-symbols-outlined" style="font-size:14px">smart_toy</span>' + esc((store.specialist(p.specialist) || {}).name || '—') + '</span>' +
          '<span class="row" style="gap:4px"><span class="material-symbols-outlined" style="font-size:14px">mail</span>' + esc(first.target ? first.target.masked_address : '—') + '</span>' +
          '<span class="row" style="gap:4px"><span class="material-symbols-outlined" style="font-size:14px">layers</span>' + acts.length + ' tindakan</span>' +
        '</div>' +
        (blocking.length ? '<div class="banner banner--danger" style="margin-top:10px;padding:8px 10px"><span class="material-symbols-outlined">block</span>' +
          '<div><b>' + esc(blocking[0].code) + '</b> — ' + esc(blocking[0].message) + '</div></div>'
          : warn.length ? '<div class="banner banner--warning" style="margin-top:10px;padding:8px 10px"><span class="material-symbols-outlined">warning</span>' +
          '<div><b>' + esc(warn[0].code) + '</b> — ' + esc(warn[0].message) + '</div></div>' : '') +
      '</div>' +
      '<div class="card__foot" style="background:var(--surface-2)">' +
        '<span class="tiny muted">' + (p.mandate_id ? 'Mandat ' + esc(p.mandate_id) : 'Belum ada mandat') + '</span>' +
        '<div class="spacer"></div>' +
        (opts.cta === false ? '' :
          (blocked || blocking.length
            ? '<a class="btn btn--secondary btn--sm" href="#/review/' + encodeURIComponent(p.plan_id) + '">Lihat temuan</a>' +
              '<a class="btn btn--danger-soft btn--sm" href="#/review/' + encodeURIComponent(p.plan_id) + '">Putuskan</a>'
            : '<a class="btn btn--secondary btn--sm" href="#/review/' + encodeURIComponent(p.plan_id) + '">Tinjau</a>' +
              '<a class="btn btn--primary btn--sm" href="#/review/' + encodeURIComponent(p.plan_id) + '"><span class="material-symbols-outlined">done</span>Setujui</a>')) +
      '</div></article>';
  }

  /* ---------------- Approval Inbox ---------------- */
  D.views.approvals = function (root) {
    var awaiting = store.plans.filter(function (p) { return (p.status === 'READY' || p.status === 'NEEDS_REVIEW') && !p.mandate_id; });
    var blocked = store.plans.filter(function (p) { return p.status === 'BLOCKED'; });
    var decided = store.plans.filter(function (p) { return p.status === 'APPROVED' || p.status === 'REJECTED' || p.status === 'EXECUTED'; });
    var tab = 'awaiting';

    function list() {
      if (tab === 'awaiting') return awaiting;
      if (tab === 'blocked') return blocked;
      return decided;
    }

    /* latest human decisions, read straight from the audit log */
    function recentDecisionsCard() {
      var DECISION = {
        approval_granted: { label: 'Disetujui', tone: 'success', icon: 'verified_user' },
        approval_rejected: { label: 'Ditolak', tone: 'danger', icon: 'cancel' },
        revision_requested: { label: 'Revisi', tone: 'warning', icon: 'edit' }
      };
      var rows = store.audit
        .filter(function (e) { return DECISION[e.type]; })
        .sort(function (a, b) { return new Date(b.at) - new Date(a.at); })
        .slice(0, 4);

      return ui.card({
        title: 'Keputusan terakhir',
        desc: 'Dari audit trail',
        flush: true,
        body: rows.length ? rows.map(function (e) {
          var d = DECISION[e.type];
          return '<a class="row" href="#/review/' + encodeURIComponent(e.plan_id) + '" style="padding:10px 16px;border-bottom:1px solid var(--border);gap:9px">' +
            '<span class="material-symbols-outlined" style="font-size:16px;color:var(--' + d.tone + '-600)">' + d.icon + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div class="row" style="gap:6px"><span class="mono tiny faint">' + esc(e.plan_id) + '</span>' +
              '<span class="badge badge--' + d.tone + '">' + d.label + '</span></div>' +
              '<div class="tiny muted truncate" style="margin-top:2px">' + esc(U.actorName(e.actor)) + ' · ' + esc(U.rel(e.at)) + '</div>' +
            '</div></a>';
        }).join('') : '<div style="padding:22px 16px" class="tiny muted">Belum ada keputusan tercatat.</div>',
        foot: '<a class="btn btn--ghost btn--sm" href="#/audit" style="padding-left:0">Buka audit trail<span class="material-symbols-outlined">arrow_forward</span></a>'
      });
    }

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Governance · Approval Inbox',
        title: 'Approval Inbox',
        desc: 'Item di sini menunggu keputusan manusia. Menyetujui berarti menerbitkan mandat untuk tindakan persis yang ditampilkan — bukan untuk niat secara umum.',
        actions: '<a class="btn btn--secondary" href="#/review"><span class="material-symbols-outlined">fact_check</span>Review &amp; validation</a>'
      }) +
      ui.demoBanner() +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">' +
        '<div class="card"><div class="card__head" style="flex-wrap:wrap;gap:8px">' +
          '<div class="segmented" id="tabs">' +
            '<button data-t="awaiting" class="is-active">Menunggu <span class="faint">' + awaiting.length + '</span></button>' +
            '<button data-t="blocked">Diblokir <span class="faint">' + blocked.length + '</span></button>' +
            '<button data-t="decided">Diputuskan <span class="faint">' + decided.length + '</span></button>' +
          '</div><div class="spacer"></div>' +
          '<span class="tiny muted" id="tab-desc"></span>' +
        '</div><div class="card__body" id="list" style="display:flex;flex-direction:column;gap:12px"></div></div>' +
        '<div class="stack rail">' +
          ui.card({ title: 'Ringkasan antrean', body:
            '<div class="stack" style="gap:12px">' +
              [['Menunggu keputusan', awaiting.length, 'warning'], ['Diblokir kebijakan', blocked.length, 'danger'], ['Sudah diputuskan', decided.length, 'success']].map(function (r) {
                return '<div class="row"><span class="small muted" style="flex:1">' + r[0] + '</span>' +
                  '<span class="badge badge--' + r[2] + '">' + r[1] + '</span></div>';
              }).join('') +
              '<div class="divider" style="margin:2px 0"></div>' +
              '<div class="tiny muted" style="line-height:1.5">Antrean hanya berisi work package yang lolos validasi. Item yang diblokir dipisahkan agar tidak tercampur dengan keputusan normal.</div>' +
            '</div>'
          }) +
          recentDecisionsCard() +
          ui.card({ title: 'Sebelum menyetujui', body:
            '<div class="stack" style="gap:9px">' +
              ['Periksa penerima — alamat selalu ter-mask.', 'Baca isi persis yang akan dikirim.', 'Cek jadwal dan zona waktu.', 'Pastikan lingkup sesuai mandat yang akan terbit.'].map(function (t, i) {
                return '<div class="row" style="align-items:flex-start;gap:8px"><span class="badge badge--outline" style="min-width:20px;justify-content:center">' + (i + 1) + '</span><span class="small muted">' + esc(t) + '</span></div>';
              }).join('') +
            '</div>'
          }) +
          ui.card({ title: 'Batas wewenang Anda', body:
            '<div class="row" style="gap:8px"><span class="avatar avatar--sm">' + esc(U.initials(D.session.user.name)) + '</span>' +
            '<div><div class="small strong">' + esc(D.session.roleLabel()) + '</div><div class="tiny muted">' +
            (D.session.can('issue_mandate') ? 'Dapat menerbitkan mandat' : 'Tidak dapat menerbitkan mandat') + '</div></div></div>'
          }) +
        '</div>' +
      '</div>';

    var host = root.querySelector('#list');
    var desc = root.querySelector('#tab-desc');
    function paint() {
      var items = list();
      desc.textContent = tab === 'awaiting' ? 'Menunggu keputusan manusia'
        : tab === 'blocked' ? 'Tidak dapat disetujui dalam bentuk sekarang'
        : 'Keputusan yang sudah tercatat';
      host.innerHTML = items.length ? items.map(function (p) { return planCard(p); }).join('')
        : ui.empty({
            icon: tab === 'awaiting' ? 'done_all' : 'inbox',
            title: tab === 'awaiting' ? 'Antrean bersih' : 'Tidak ada item',
            body: tab === 'awaiting' ? 'Tidak ada work package yang menunggu keputusan Anda saat ini.' : 'Belum ada item pada kategori ini.',
            action: tab === 'awaiting' ? '<a class="btn btn--secondary" href="#/work-packages">Lihat semua work package</a>' : ''
          });
    }
    root.querySelectorAll('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        root.querySelectorAll('#tabs button').forEach(function (x) { x.classList.remove('is-active'); });
        b.classList.add('is-active');
        tab = b.getAttribute('data-t');
        paint();
      });
    });
    paint();
  };

  /* ---------------- Review queue ---------------- */
  D.views.reviewQueue = function (root) {
    var rows = store.plans.filter(function (p) { return p.status !== 'EXECUTED' && p.status !== 'REJECTED'; });
    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Governance · Review & Validation',
        title: 'Review & Validation',
        desc: 'Tinjau rencana, lingkup tindakan, dan hasil validasi. Halaman ini menjawab satu pertanyaan: apakah rencana ini persis seperti yang dimaksudkan pemohon?',
        actions: '<a class="btn btn--primary" href="#/approvals"><span class="material-symbols-outlined">assignment_turned_in</span>Approval inbox</a>'
      }) +
      ui.demoBanner() +
      '<div class="card"><div class="card__head"><div><h2>Perlu tinjauan</h2><p>Termasuk item yang belum dapat diputuskan</p></div><div class="spacer"></div>' +
        '<span class="badge badge--warning">' + rows.length + ' item</span></div>' +
        '<div id="host"></div></div>';

    var host = root.querySelector('#host');
    host.appendChild(ui.table({
      columns: [
        { key: 'plan_id', label: 'ID', width: '106px', render: function (p) { return '<span class="mono faint">' + esc(p.plan_id) + '</span>'; } },
        { key: 'intent', label: 'Work package', render: function (p) {
          return '<div class="cell-title truncate" style="max-width:380px">' + esc(p.intent) + '</div>' +
            '<div class="cell-sub">' + esc(p.requester || '—') + '</div>';
        }},
        { key: 'why', label: 'Alasan perlu tinjauan', render: function (p) {
          var f = (p.findings || [])[0];
          if (!f) return '<span class="tiny muted">Menunggu keputusan rutin</span>';
          return '<span class="badge badge--' + (f.severity === 'blocking' ? 'danger' : 'warning') + '">' + esc(f.code) + '</span>';
        }},
        { key: 'risk', label: 'Risiko', width: '118px', render: function (p) { return D.riskBadge(p.risk); } },
        { key: 'status', label: 'Status', width: '132px', render: function (p) { return D.statusBadge(p.status); } },
        { key: 'age', label: 'Umur', width: '92px', align: 'right', raw: function (p) { return new Date(p.created_at).getTime(); }, render: function (p) { return '<span class="tiny muted">' + U.rel(p.created_at) + '</span>'; } },
        { key: 'act', label: '', width: '96px', align: 'right', render: function (p) {
          return '<a class="btn btn--secondary btn--sm" href="#/review/' + encodeURIComponent(p.plan_id) + '">Tinjau</a>';
        }}
      ],
      rows: rows, pageSize: 9,
      onRowClick: function (p) { D.router.go('/review/' + p.plan_id); },
      empty: ui.empty({ icon: 'fact_check', title: 'Tidak ada yang perlu ditinjau', body: 'Semua work package sudah diputuskan atau dieksekusi.' })
    }));
  };

  /* ---------------- Review workspace ---------------- */
  D.views.review = function (root, params) {
    var p = store.plan(params.id);
    if (!p) {
      root.innerHTML = ui.pageHead({ eyebrow: 'Governance', title: 'Work package tidak ditemukan' }) +
        '<div class="card">' + ui.empty({ icon: 'search_off', title: 'ID ' + esc(params.id) + ' tidak ada', body: 'Periksa kembali tautan atau kembali ke approval inbox.', action: '<a class="btn btn--primary" href="#/approvals">Approval inbox</a>' }) + '</div>';
      return;
    }
    var acts = p.actions || [];
    var blocking = (p.findings || []).filter(function (f) { return f.severity === 'blocking'; });
    var isBlocked = p.status === 'BLOCKED' || blocking.length > 0;
    var canApprove = D.session.can('approve') && D.session.can('issue_mandate');
    var decided = p.status === 'APPROVED' || p.status === 'REJECTED' || p.status === 'EXECUTED';

    root.innerHTML =
      '<div class="breadcrumbs" style="margin-bottom:10px"><a href="#/approvals">Approval Inbox</a><span class="sep">/</span>' +
        '<a href="#/work-packages/' + encodeURIComponent(p.plan_id) + '" class="mono">' + esc(p.plan_id) + '</a><span class="sep">/</span><span class="current">Review</span></div>' +
      '<div class="page-head"><div class="page-head__text">' +
        '<div class="row" style="gap:8px;margin-bottom:6px">' + D.statusBadge(p.status) + D.riskBadge(p.risk) +
          '<span class="badge badge--outline">' + acts.length + ' tindakan</span>' +
          (isBlocked ? '<span class="badge badge--danger">Tidak dapat disetujui</span>' : '') + '</div>' +
        '<h1 style="max-width:66ch">' + esc(p.intent) + '</h1>' +
        '<p style="margin-top:4px">Diajukan oleh <b>' + esc(p.requester || '—') + '</b> · ' + esc(U.fmtDate(p.created_at)) +
          ' · spesialis ' + esc((store.specialist(p.specialist) || {}).name || '—') + '</p>' +
      '</div><div class="page-head__actions">' +
        '<a class="btn btn--secondary" href="#/work-packages/' + encodeURIComponent(p.plan_id) + '"><span class="material-symbols-outlined">open_in_new</span>Detail</a>' +
      '</div></div>' +
      ui.demoBanner() +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 360px;align-items:start">' +

        '<div class="stack">' +
          '<div class="card"><div class="card__head"><div><h2>Yang akan dijalankan</h2><p>Persetujuan mengikat pada isi persis di bawah ini</p></div>' +
            '<div class="spacer"></div><span class="mono mono--wrap tiny faint">' + esc(p.plan_hash) + '</span></div>' +
            '<div class="card__body">' +
              acts.map(function (a, i) {
                return '<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:' + (i === acts.length - 1 ? 0 : '12px') + '">' +
                  '<div class="row" style="padding:10px 12px;background:var(--surface-2);border-bottom:1px solid var(--border);gap:8px">' +
                    '<span class="badge badge--brand">' + (i + 1) + '</span>' +
                    '<span class="small strong">' + esc(a.action_type.replace(/_/g, ' ')) + '</span>' +
                    '<div class="spacer"></div>' + D.riskBadge(a.risk) +
                  '</div>' +
                  '<div style="padding:12px">' +
                    '<div class="grid grid--2" style="gap:10px 18px;margin-bottom:10px">' +
                      '<div><div class="tiny muted">Penerima</div><div class="small strong">' + esc(a.target.display_name) + '</div>' +
                        '<div class="tiny mono muted">' + esc(a.target.masked_address) + '</div></div>' +
                      '<div><div class="tiny muted">Kanal</div><div class="small">' + esc(a.target.channel) + '</div></div>' +
                      '<div><div class="tiny muted">Jadwal</div><div class="small">' + esc(U.fmtDate(a.schedule.start_at)) + '</div>' +
                        '<div class="tiny muted">' + esc(a.schedule.timezone) + '</div></div>' +
                      '<div><div class="tiny muted">Subjek</div><div class="small">' + esc(a.content.subject) + '</div></div>' +
                    '</div>' +
                    '<div class="tiny muted" style="margin-bottom:4px">Isi persis</div>' +
                    '<pre style="margin:0;white-space:pre-wrap;font-family:var(--font-sans);font-size:12.5px;line-height:1.6;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;padding:11px;color:var(--text-2);max-height:220px;overflow:auto">' + esc(a.content.body) + '</pre>' +
                  '</div></div>';
              }).join('') +
            '</div></div>' +

          '<div class="card"><div class="card__head"><div><h2>Hasil validasi</h2><p>Adversarial Reviewer dan Policy Validator</p></div></div>' +
            '<div class="card__body">' +
              ((p.findings || []).length ? p.findings.map(function (f) {
                var tone = f.severity === 'blocking' ? 'danger' : f.severity === 'warning' ? 'warning' : 'info';
                var icon = f.severity === 'blocking' ? 'block' : f.severity === 'warning' ? 'warning' : 'info';
                return '<div class="banner banner--' + tone + '" style="margin-bottom:8px"><span class="material-symbols-outlined">' + icon + '</span>' +
                  '<div><b>' + esc(f.code) + '</b> <span class="badge badge--outline" style="margin-left:4px">' + esc(f.severity) + '</span><div style="margin-top:2px">' + esc(f.message) + '</div></div></div>';
              }).join('') : '<div class="banner banner--success"><span class="material-symbols-outlined">check_circle</span><div>Semua pemeriksaan lulus. Tidak ada temuan.</div></div>') +
              (p.review && p.review.notes ? '<div class="tiny muted" style="margin-top:10px;line-height:1.5"><b>Catatan reviewer:</b> ' + esc(p.review.notes) + '</div>' : '') +
            '</div></div>' +

          '<div class="card"><div class="card__head"><div><h2>Jejak audit work package ini</h2></div>' +
            '<div class="spacer"></div><a class="btn btn--ghost btn--sm" href="#/audit">Semua</a></div>' +
            '<div class="card__body"><div class="timeline">' +
              store.auditFor(p.plan_id).slice().sort(function (a, b) { return new Date(a.at) - new Date(b.at); }).map(function (e) {
                var tone = (e.type === 'policy_blocked' || e.type === 'action_blocked') ? 'is-blocked' : 'is-done';
                return '<div class="tl-item ' + tone + '"><div class="tl-dot"><span class="material-symbols-outlined">' +
                  (tone === 'is-blocked' ? 'block' : 'check') + '</span></div><div class="tl-body">' +
                  '<div class="tl-title">' + esc(e.type.replace(/_/g, ' ')) + '</div>' +
                  '<div class="tl-meta">' + esc(U.actorName(e.actor)) + ' · ' + U.fmtDate(e.at) + (e.reason_code ? ' · <b>' + esc(e.reason_code) + '</b>' : '') + '</div></div></div>';
              }).join('') +
            '</div></div></div>' +
        '</div>' +

        '<div class="stack" id="decision-col">' +
          '<div class="card" id="decision">' + decisionPanel(p, { isBlocked: isBlocked, canApprove: canApprove, decided: decided }) + '</div>' +
          ui.card({ title: 'Ringkasan', body:
            '<dl class="def-list">' +
              '<dt>Work package</dt><dd class="mono">' + esc(p.plan_id) + '</dd>' +
              '<dt>Pemohon</dt><dd>' + esc(p.requester || '—') + '</dd>' +
              '<dt>Spesialis</dt><dd>' + esc((store.specialist(p.specialist) || {}).name || '—') + '</dd>' +
              '<dt>Risiko</dt><dd>' + D.riskBadge(p.risk) + '</dd>' +
              '<dt>Sidik rencana</dt><dd class="mono tiny" style="word-break:break-all">' + esc(p.plan_hash) + '</dd>' +
              '<dt>Mandat</dt><dd>' + (p.mandate_id ? '<span class="mono">' + esc(p.mandate_id) + '</span>' : 'belum terbit') + '</dd>' +
            '</dl>'
          }) +
          ui.card({ title: 'Kebijakan yang dievaluasi', body:
            '<div class="stack" style="gap:7px">' + store.policies.filter(function (x) { return x.active; }).slice(0, 5).map(function (x) {
              var violated = (p.findings || []).some(function (f) { return f.code && f.code.indexOf(x.id.split('-')[0]) > -1; });
              return '<div class="row" style="gap:7px"><span class="material-symbols-outlined" style="font-size:14px;color:' +
                (violated ? 'var(--danger-600)' : 'var(--success-600)') + '">' + (violated ? 'error' : 'check_circle') + '</span>' +
                '<span class="tiny ' + (violated ? 'strong' : 'muted') + '">' + esc(x.id) + ' · ' + esc(x.name) + '</span></div>';
            }).join('') + '</div>'
          }) +
        '</div>' +
      '</div>';

    bindDecision(root, p);
  };

  function decisionPanel(p, o) {
    if (o.decided) {
      return '<div class="card__body"><div class="banner banner--' + (p.status === 'REJECTED' ? 'danger' : 'success') + '">' +
        '<span class="material-symbols-outlined">' + (p.status === 'REJECTED' ? 'cancel' : 'verified') + '</span>' +
        '<div><b>' + (p.status === 'REJECTED' ? 'Work package ditolak' : 'Mandat sudah terbit') + '</b>' +
        '<div style="margin-top:2px">' + (p.mandate_id ? 'Mandat ' + esc(p.mandate_id) : 'Keputusan tercatat di audit trail.') + '</div></div></div>' +
        '<a class="btn btn--secondary btn--block" style="margin-top:12px" href="#/work-packages/' + encodeURIComponent(p.plan_id) + '">Lihat detail</a></div>';
    }
    return '<div class="card__head"><div><h2>Keputusan Anda</h2><p>Setiap keputusan tercatat atas nama Anda</p></div></div>' +
      '<div class="card__body">' +
        (o.isBlocked
          ? '<div class="banner banner--danger" style="margin-bottom:12px"><span class="material-symbols-outlined">block</span>' +
            '<div><b>Persetujuan dinonaktifkan.</b> Kebijakan memblokir rencana ini. Perbaiki temuan lebih dulu, atau tolak dengan alasan.</div></div>'
          : '<p class="small muted" style="margin-bottom:12px;line-height:1.55">Dengan menyetujui, Anda menerbitkan mandat untuk tindakan persis di samping. Mandat terikat pada sidik rencana dan tidak dapat dipakai untuk versi lain.</p>') +
        '<div class="field" style="margin-bottom:12px"><label class="field__label" for="note">Catatan (opsional)</label>' +
          '<textarea class="textarea" id="note" placeholder="Alasan keputusan, konteks tambahan…" style="min-height:72px"></textarea>' +
          '<div class="field__hint">Catatan tersimpan di audit trail bersama keputusan.</div></div>' +
        '<div class="stack" style="gap:8px">' +
          (o.canApprove
            ? '<button class="btn btn--primary btn--block" id="approve" ' + (o.isBlocked ? 'disabled aria-disabled="true"' : '') + '>' +
              '<span class="material-symbols-outlined">verified_user</span>Setujui &amp; terbitkan mandat</button>'
            : '<button class="btn btn--primary btn--block" disabled><span class="material-symbols-outlined">lock</span>Peran Anda tidak dapat menerbitkan mandat</button>') +
          '<button class="btn btn--secondary btn--block" id="revise"><span class="material-symbols-outlined">edit</span>Minta revisi</button>' +
          '<button class="btn btn--danger-soft btn--block" id="reject"><span class="material-symbols-outlined">cancel</span>Tolak work package</button>' +
        '</div>' +
        '<div class="tiny muted" style="margin-top:10px;line-height:1.5">Persetujuan tidak menjalankan eksekusi. Executor memvalidasi mandat secara terpisah sebelum tindakan apa pun.</div>' +
      '</div>';
  }

  function bindDecision(root, p) {
    var note = root.querySelector('#note');
    function getNote() { return note ? note.value.trim() : ''; }

    var approve = root.querySelector('#approve');
    if (approve && !approve.disabled) approve.addEventListener('click', function () {
      ui.confirm({
        title: 'Terbitkan mandat untuk ' + p.plan_id + '?',
        subtitle: 'Tindakan ini mengubah wewenang',
        confirmLabel: 'Ya, setujui & terbitkan',
        body: '<div class="banner banner--warning" style="margin-bottom:12px"><span class="material-symbols-outlined">warning</span>' +
          '<div>Mandat memberi wewenang eksekusi untuk <b>tindakan persis</b> yang Anda tinjau. Setelah terbit, mandat tidak dapat diubah — hanya dicabut.</div></div>' +
          '<dl class="def-list"><dt>Work package</dt><dd class="mono">' + esc(p.plan_id) + '</dd>' +
          '<dt>Tindakan</dt><dd>' + (p.actions || []).length + ' tindakan · ' + esc(p.actions[0].action_type) + '</dd>' +
          '<dt>Penerima</dt><dd>' + esc(p.actions[0].target.display_name) + ' · ' + esc(p.actions[0].target.masked_address) + '</dd>' +
          '<dt>Sidik rencana</dt><dd class="mono tiny">' + esc(p.plan_hash.slice(0, 16)) + '…</dd></dl>'
      }).then(function (r) {
        if (!r || !r.ok) return;
        doApprove(p, getNote());
      });
    });

    var reject = root.querySelector('#reject');
    if (reject) reject.addEventListener('click', function () {
      ui.confirm({
        title: 'Tolak ' + p.plan_id + '?', tone: 'danger', confirmLabel: 'Tolak work package',
        subtitle: 'Keputusan permanen untuk versi rencana ini',
        body: 'Penolakan tercatat di audit trail. Pemohon harus mengajukan work package baru; versi ini tidak dapat disetujui lagi.',
        extra: '<div class="field" style="margin-top:12px"><label class="field__label">Alasan penolakan <span class="req">*</span></label>' +
          '<textarea class="textarea" id="reject-reason" placeholder="Jelaskan alasan agar pemohon dapat memperbaiki."></textarea>' +
          '<div class="tiny muted" style="margin-top:4px">Alasan ini masuk ke audit trail dan dikirim ke pemohon.</div></div>',
        required: ['reject-reason']
      }).then(function (r) {
        if (!r || !r.ok) return;
        doReject(p, r.values['reject-reason']);
      });
    });

    var revise = root.querySelector('#revise');
    if (revise) revise.addEventListener('click', function () {
      ui.confirm({
        title: 'Minta revisi ' + p.plan_id + '?', confirmLabel: 'Kirim permintaan revisi',
        body: 'Work package tetap terbuka tetapi tidak dapat dieksekusi. Pemohon dan spesialis menerima catatan revisi Anda.',
        extra: '<div class="field" style="margin-top:12px"><label class="field__label">Apa yang perlu diubah? <span class="req">*</span></label>' +
          '<textarea class="textarea" id="revise-note" placeholder="Contoh: pilih penerima yang benar, atau kurangi lingkup penerima."></textarea></div>',
        required: ['revise-note']
      }).then(function (r) {
        if (!r || !r.ok) return;
        doRevise(p, r.values['revise-note']);
      });
    });
  }

  function logEvent(p, type, reason, detail) {
    store.audit.unshift({
      at: new Date().toISOString(), type: type, actor: D.session.user.name,
      plan_id: p.plan_id, mandate_id: p.mandate_id || null, action_id: null,
      reason_code: reason || null, detail: detail || null
    });
  }

  function doApprove(p, note) {
    var mandateId = 'MND-' + (1190 + Math.floor(Math.random() * 60));
    var finish = function () {
      p.status = 'APPROVED';
      p.mandate_id = mandateId;
      store.mandates.unshift({
        mandate_id: mandateId, plan_id: p.plan_id, scope: (p.actions[0].action_type) + ' · 1 penerima',
        issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
        issued_by: D.session.user.name, status: 'active', plan_hash: p.plan_hash, uses: 0, max_uses: 1
      });
      logEvent(p, 'approval_granted', null, note || 'Disetujui manusia');
      logEvent(p, 'mandate_issued', null, 'Mandat ' + mandateId + ' terikat plan_hash');
      ui.toast('Mandat ' + mandateId + ' diterbitkan. Eksekusi belum dijalankan.', 'success', 5000);
      D.shell.refresh();
      D.router.render();
    };
    if (store.mode === 'live') {
      D.api.call('submit_approval', { plan_id: p.plan_id, plan_hash: p.plan_hash, decision: 'approve', approver_id: 'user_001', approval_token: 'apt_' + Date.now() })
        .then(function (r) {
          p.mandate_id = r.mandate_id || mandateId;
          ui.toast('Mandat diterbitkan oleh server: ' + p.mandate_id, 'success');
          return store.hydrateLive().then(function () { D.shell.refresh(); D.router.render(); });
        })
        .catch(function (e) { ui.toast('Gagal menerbitkan mandat: ' + e.message, 'error'); });
      return;
    }
    finish();
  }

  function doReject(p, reason) {
    if (store.mode === 'live') {
      D.api.call('submit_approval', { plan_id: p.plan_id, plan_hash: p.plan_hash, decision: 'reject', approver_id: 'user_001', approval_token: 'apt_' + Date.now() })
        .then(function () { ui.toast('Work package ditolak.', 'success'); D.router.go('/approvals'); })
        .catch(function (e) { ui.toast('Gagal: ' + e.message, 'error'); });
      return;
    }
    p.status = 'REJECTED';
    p.rejected_at = new Date().toISOString();
    p.rejected_by = D.session.user.name;
    logEvent(p, 'approval_rejected', 'HUMAN_REJECT', reason);
    ui.toast('Work package ditolak. Tercatat di audit trail (demo).', 'success');
    D.shell.refresh();
    D.router.go('/approvals');
  }

  function doRevise(p, reason) {
    if (store.mode === 'live') {
      D.api.call('submit_approval', { plan_id: p.plan_id, plan_hash: p.plan_hash, decision: 'revise', approver_id: 'user_001', approval_token: 'apt_' + Date.now() })
        .then(function () { ui.toast('Permintaan revisi dikirim.', 'success'); })
        .catch(function (e) { ui.toast('Gagal: ' + e.message, 'error'); });
      return;
    }
    logEvent(p, 'revision_requested', 'HUMAN_REVISE', reason);
    ui.toast('Permintaan revisi dicatat di audit trail (demo).', 'success');
    D.router.render();
  }

  /* ---------------- Mandates ---------------- */
  D.views.mandates = function (root) {
    var active = store.mandates.filter(function (m) { return m.status === 'active'; });
    var expired = store.mandates.filter(function (m) { return m.status === 'expired'; });
    var revoked = store.mandates.filter(function (m) { return m.status === 'revoked'; });

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Governance · Mandates',
        title: 'Mandates',
        desc: 'Mandat adalah batas wewenang yang terbit setelah persetujuan manusia. Ia menyebut tindakan, penerima, dan masa berlaku — bukan niat umum.',
        actions: '<button class="btn btn--secondary" id="export"><span class="material-symbols-outlined">download</span>Ekspor</button>'
      }) +
      ui.demoBanner() +
      '<div class="grid grid--3" style="margin-bottom:16px">' +
        ui.kpi({ label: 'Mandat aktif', value: active.length, icon: 'verified_user', tone: 'success', foot: '<span class="material-symbols-outlined">bolt</span>Siap dipakai sekali' }) +
        ui.kpi({ label: 'Kedaluwarsa', value: expired.length, icon: 'schedule', foot: '<span class="material-symbols-outlined">history</span>Tidak dapat dipakai ulang' }) +
        ui.kpi({ label: 'Dicabut', value: revoked.length, icon: 'undo', tone: 'danger', foot: '<span class="material-symbols-outlined">report</span>Dicabut manusia' }) +
      '</div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">' +
        '<div class="card"><div class="card__head"><div><h2>Direktori mandat</h2><p>Terikat pada sidik rencana (plan_hash)</p></div><div class="spacer"></div>' +
          '<span class="badge badge--outline">' + store.mandates.length + ' total</span></div><div id="host"></div></div>' +
        '<div class="stack rail">' +
          mandatesAttentionCard(active) +
          ui.card({ title: 'Cara mandat bekerja', body:
            '<div class="stack" style="gap:9px">' +
              ['Mandat menyebut tindakan persis, penerima, dan masa berlaku.',
               'Terikat pada plan_hash — rencana yang berubah butuh mandat baru.',
               'Sekali pakai: pemakaian tercatat dan tidak dapat diulang.',
               'Tidak dapat diubah setelah terbit, hanya dicabut.',
               'Pencabutan dan alasan wajib tercatat di audit trail.'].map(function (t) {
                return '<div class="row" style="align-items:flex-start;gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--brand-600);margin-top:1px">check</span><span class="small muted">' + esc(t) + '</span></div>';
              }).join('') +
            '</div>'
          }) +
        '</div>' +
      '</div>';

    /* active mandates that are close to their use limit or expiry */
    function mandatesAttentionCard(activeList) {
      var soon = activeList.filter(function (m) { return m.uses >= m.max_uses; });
      var rows = activeList.slice(0, 4);
      return ui.card({
        title: 'Mandat aktif',
        desc: 'Perlu dipantau sebelum kedaluwarsa',
        flush: true,
        body: rows.length ? rows.map(function (m) {
          var used = m.uses >= m.max_uses;
          return '<a class="row" href="#/work-packages/' + encodeURIComponent(m.plan_id) + '" style="padding:9px 16px;border-bottom:1px solid var(--border);gap:8px">' +
            '<div style="flex:1;min-width:0">' +
              '<div class="mono tiny">' + esc(m.mandate_id) + '</div>' +
              '<div class="tiny muted truncate">' + esc(m.plan_id) + ' · ' + esc(m.scope) + '</div>' +
            '</div>' +
            (used ? '<span class="badge badge--warning">habis</span>'
                  : '<span class="tiny faint">' + m.uses + '/' + m.max_uses + '</span>') +
            '</a>';
        }).join('') : '<div style="padding:22px 16px" class="tiny muted">Tidak ada mandat aktif.</div>',
        foot: soon.length
          ? '<span class="tiny muted">' + soon.length + ' mandat sudah mencapai batas pakai.</span>'
          : '<span class="tiny muted">Semua mandat aktif masih punya sisa pemakaian.</span>'
      });
    }

    var host = root.querySelector('#host');
    host.appendChild(ui.table({
      columns: [
        { key: 'mandate_id', label: 'Mandat', width: '104px', render: function (m) { return '<span class="mono">' + esc(m.mandate_id) + '</span>'; } },
        { key: 'plan_id', label: 'Work package', width: '104px', render: function (m) { return '<a href="#/work-packages/' + encodeURIComponent(m.plan_id) + '" style="color:var(--brand-600);font-weight:600">' + esc(m.plan_id) + '</a>'; } },
        { key: 'scope', label: 'Lingkup', render: function (m) { return '<span class="small">' + esc(m.scope) + '</span>'; } },
        { key: 'issued_at', label: 'Terbit', width: '148px', raw: function (m) { return m.issued_at; }, render: function (m) {
          return '<div class="tiny" style="white-space:nowrap">' + esc(U.fmtDate(m.issued_at)) + '</div>' +
            '<div class="tiny muted" style="white-space:nowrap">oleh ' + esc(m.issued_by) + '</div>';
        }},
        { key: 'uses', label: 'Pakai', width: '64px', align: 'right', raw: function (m) { return m.uses; }, render: function (m) {
          if (m.uses == null) return '<span class="tiny faint" title="Server tidak melaporkan pemakaian">—</span>';
          return '<span class="tiny">' + m.uses + '/' + m.max_uses + '</span>';
        } },
        { key: 'status', label: 'Status', width: '110px', render: function (m) { return D.mandateBadge(m.status); } }
      ],
      rows: store.mandates.slice(), pageSize: 8,
      onRowClick: function (m) { openMandate(m); },
      empty: ui.empty({ icon: 'verified_user', title: 'Belum ada mandat', body: 'Mandat terbit hanya setelah persetujuan manusia.' })
    }));

    function openMandate(m) {
      var p = store.plan(m.plan_id);
      var drawer = ui.drawer({
        eyebrow: 'Mandat', title: m.mandate_id, subtitle: 'Terikat pada ' + m.plan_id,
        body:
          '<div class="row" style="gap:8px;margin-bottom:14px">' + D.mandateBadge(m.status) +
            '<span class="badge badge--outline">' + esc(m.scope) + '</span></div>' +
          '<dl class="def-list">' +
            '<dt>Work package</dt><dd>' + esc(m.plan_id) + (p ? ' · ' + esc(p.intent) : '') + '</dd>' +
            '<dt>Diterbitkan</dt><dd>' + esc(U.fmtDate(m.issued_at)) + '</dd>' +
            '<dt>Oleh</dt><dd>' + esc(m.issued_by) + '</dd>' +
            '<dt>Berlaku s.d.</dt><dd>' + esc(m.expires_at ? U.fmtDate(m.expires_at) : '—') + '</dd>' +
            '<dt>Pemakaian</dt><dd>' + (m.uses == null ? '— <span class="tiny faint">(tidak dilaporkan server)</span>' : m.uses + ' dari ' + m.max_uses) + '</dd>' +
            '<dt>Sidik rencana</dt><dd class="mono tiny" style="word-break:break-all">' + esc(m.plan_hash) + '</dd>' +
          '</dl>' +
          '<div class="divider"></div>' +
          '<div class="row" style="justify-content:space-between;margin-bottom:6px">' +
            '<h3 class="small strong">Aksi dalam mandat</h3>' +
            '<span class="tiny faint">' + (m.status === 'active' ? 'mandat aktif' : 'mandat ' + m.status) + '</span></div>' +
          '<div id="drawer-exec">' + actionsSection(m, p) + '</div>' +
          (m.status === 'revoked' ? '<div class="banner banner--danger" style="margin-top:14px"><span class="material-symbols-outlined">undo</span><div><b>Dicabut</b> · ' + esc(U.fmtDate(m.revoked_at)) + '<div>' + esc(m.revoke_reason || '') + '</div></div></div>' : '') +
          '<div class="banner banner--info" style="margin-top:14px"><span class="material-symbols-outlined">info</span>' +
          '<div>Mandat tidak dapat diubah setelah terbit. Perubahan lingkup memerlukan work package dan persetujuan baru.</div></div>'
        ,
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
          (m.status === 'active' && D.session.can('revoke_mandate') ? '<button class="btn btn--danger" id="drawer-revoke">Cabut mandat</button>' : '')
      });
      var rev = document.getElementById('drawer-revoke');
      if (rev) rev.addEventListener('click', function () {
        ui.confirm({
          title: 'Cabut ' + m.mandate_id + '?', tone: 'danger', confirmLabel: 'Cabut mandat',
          subtitle: 'Tindakan ini mengubah wewenang',
          body: 'Mandat yang dicabut tidak dapat dipakai lagi. Eksekusi yang belum berjalan akan gagal validasi mandat.',
          extra: '<div class="field" style="margin-top:12px"><label class="field__label">Alasan <span class="req">*</span></label><textarea class="textarea" id="mr" placeholder="Alasan pencabutan…"></textarea></div>',
          required: ['mr']
        }).then(function (r) {
          if (!r || !r.ok) return;
          if (store.mode === 'live') {
            D.api.call('revoke_mandate', { mandate_id: m.mandate_id })
              .then(function (res) {
                m.status = (res.mandate && res.mandate.status) || 'revoked';
                m.revoked_at = new Date().toISOString();
                m.revoke_reason = r.values.mr;
                ui.toast('Mandat ' + m.mandate_id + ' dicabut di server.', 'success');
                drawer.close();
                D.router.render();
              })
              .catch(function (e) { ui.toast('Gagal mencabut mandat: ' + e.message, 'error'); });
            return;
          }
          m.status = 'revoked';
          m.revoked_at = new Date().toISOString();
          m.revoke_reason = r.values.mr;
          store.audit.unshift({ at: new Date().toISOString(), type: 'mandate_revoked', actor: D.session.user.name, plan_id: m.plan_id, mandate_id: m.mandate_id, reason_code: 'MANUAL_REVOKE', detail: m.revoke_reason });
          ui.toast('Mandat dicabut (demo). Tercatat di audit trail.', 'success');
          D.router.render();
        });
      });

      var execHost = document.getElementById('drawer-exec');
      if (execHost) execHost.addEventListener('click', function (ev) {
        var btn = ev.target.closest('[data-exec]');
        if (!btn) return;
        var actionId = btn.getAttribute('data-exec');
        var action = ((p && p.actions) || []).filter(function (a) { return a.action_id === actionId; })[0];
        if (action) confirmExecute(m, action);
      });

      function executedRow(mandate, action) {
        for (var i = 0; i < store.executions.length; i++) {
          var e = store.executions[i];
          if (e.mandate_id === mandate.mandate_id && e.action_id === action.action_id && e.result === 'sent') return e;
        }
        return null;
      }

      function actionsSection(mandate, plan) {
        if (!plan || !plan.actions || !plan.actions.length) {
          return '<p class="small muted">Rencana untuk mandat ini tidak dimuat, jadi daftar aksi tidak tersedia. ' +
            'Buka <a href="#/work-packages/' + encodeURIComponent(mandate.plan_id) + '">work package</a> untuk detailnya.</p>';
        }
        return plan.actions.map(function (a) {
          var done = executedRow(mandate, a);
          var canRun = mandate.status === 'active' && D.session.can('execute');
          var right = done
            ? '<span class="badge badge--success">Dijalankan</span>'
            : (canRun
              ? '<button class="btn btn--secondary btn--sm" data-exec="' + esc(a.action_id) + '">Jalankan</button>'
              : '<span class="badge badge--outline">' + (mandate.status === 'active' ? 'Tanpa izin' : 'Tidak aktif') + '</span>');
          return '<div class="row" style="justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">' +
            '<div style="min-width:0"><div class="small strong mono">' + esc(a.action_id) + ' · ' + esc(a.action_type) + '</div>' +
              '<div class="tiny muted">ke ' + esc(a.target.display_name) + ' · ' + esc(a.target.masked_address) + '</div></div>' +
            '<div style="flex:0 0 auto">' + right + '</div></div>';
        }).join('');
      }

      function confirmExecute(mandate, action) {
        var prior = executedRow(mandate, action);
        if (prior) {
          ui.toast('Aksi ini sudah dijalankan' +
            (prior.execution_id ? ' (' + prior.execution_id + ')' : '') + '.', 'info');
          return;
        }
        var demo = store.mode !== 'live';
        ui.confirm({
          title: 'Jalankan ' + action.action_id + '?',
          confirmLabel: 'Jalankan aksi',
          subtitle: 'Memakai mandat ' + mandate.mandate_id,
          body: 'Aksi <b>' + esc(action.action_type) + '</b> ke <b>' + esc(action.target.display_name) + '</b> ' +
            '(' + esc(action.target.masked_address) + ') akan dijalankan oleh executor setelah mandat divalidasi ulang.<br><br>' +
            (demo
              ? '<span class="badge badge--warning">Mode demo</span> Tidak ada panggilan server. Hasilnya hanya dicatat di sesi ini.'
              : '<span class="badge badge--outline">Adapter mock</span> Executor saat ini memakai adapter mock: pesan dicatat dengan ID bukti, tetapi tidak dikirim ke layanan eksternal.'),
          extra: '<div class="tiny muted" style="margin-top:10px">Eksekusi yang sama tidak dapat diulang — idempotensi dijaga oleh pasangan mandat + aksi.</div>'
        }).then(function (r) {
          if (!r || !r.ok) return;
          runExecute(mandate, action);
        });
      }

      function runExecute(mandate, action) {
        var key = mandate.mandate_id + ':' + action.action_id;
        if (store.mode === 'live') {
          D.api.call('execute_action', { mandate_id: mandate.mandate_id, action_id: action.action_id, execution_key: key })
            .then(function (res) { recordExecution(mandate, action, res, false); })
            .catch(function (e) { ui.toast('Eksekusi ditolak: ' + e.message, 'error', 6000); });
          return;
        }
        recordExecution(mandate, action, {
          execution_id: 'EX-' + (5700 + store.executions.length),
          result: 'sent',
          reason_code: null,
          executed_at: new Date().toISOString(),
          evidence: { mock_message_id: 'mock_' + Date.now().toString(36) }
        }, true);
      }

      function recordExecution(mandate, action, res, simulated) {
        var result = res.result || 'failed';
        var ev = res.evidence || {};
        var evidenceId = ev.mock_message_id || ev.mock_event_id || ev.mock_task_id || '';
        var at = res.executed_at || new Date().toISOString();

        store.executions.unshift({
          /* Never invent an identifier. If the executor did not return one, the
           * row has no execution_id and says so; a made-up id would be
           * indistinguishable from a real one later. */
          execution_id: res.execution_id || null,
          source: res.execution_id ? 'execution' : 'local',
          plan_id: mandate.plan_id, action_id: action.action_id,
          mandate_id: mandate.mandate_id, at: at, result: result,
          adapter: simulated ? 'demo' : 'mcp',
          detail: evidenceId || res.reason_code || '—', duration_ms: 0
        });
        store.audit.unshift({
          at: at, type: result === 'sent' ? 'action_executed' : 'action_blocked',
          actor: D.session.user.name, plan_id: mandate.plan_id, mandate_id: mandate.mandate_id,
          action_id: action.action_id, reason_code: res.reason_code || null,
          detail: evidenceId || res.reason_code || null
        });

        if (result === 'sent') {
          ui.toast('Aksi ' + action.action_id + ' dijalankan' +
            (simulated ? ' (demo — tidak ada pengiriman nyata)' : ' · bukti ' + evidenceId), 'success', 5200);
        } else {
          ui.toast('Aksi diblokir: ' + (res.reason_code || 'tanpa alasan dari server'), 'danger', 7000);
        }

        drawer.close();
        D.router.render();
        openMandate(mandate);
      }
    }

    root.querySelector('#export').addEventListener('click', function () {
      var rows = [['Mandat', 'Work package', 'Lingkup', 'Diterbitkan oleh', 'Terbit', 'Berlaku s.d.', 'Status']];
      store.mandates.forEach(function (m) { rows.push([m.mandate_id, m.plan_id, m.scope, m.issued_by, m.issued_at, m.expires_at || '', m.status]); });
      U.download('dextra-mandat.csv', U.csv(rows));
      ui.toast('Ekspor mandat dibuat.', 'success');
    });

    /* deep link: ?mandate=MND-1234#/mandates opens that mandate, then clears the param
       so a later visit to /mandates does not reopen it. */
    var deep = U.qs('mandate', null);
    if (deep) {
      try {
        var url = new URL(location.href);
        url.searchParams.delete('mandate');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (e) { /* older browser: the param simply stays */ }
      var target = store.mandates.filter(function (x) { return x.mandate_id === deep; })[0];
      if (target) openMandate(target);
      else ui.toast('Mandat ' + deep + ' tidak ditemukan pada data saat ini.', 'warning');
    }
  };

  /* ---------------- Audit Trail ---------------- */
  D.views.audit = function (root) {
    var filter = { q: '', type: 'all' };
    var types = [];
    store.audit.forEach(function (e) { if (types.indexOf(e.type) < 0) types.push(e.type); });

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Governance · Audit Trail',
        title: 'Audit Trail',
        desc: 'Rekaman append-only dari setiap permintaan, validasi, keputusan, dan eksekusi. Tidak ada tombol ubah atau hapus — itu disengaja.',
        actions: '<button class="btn btn--secondary" id="export"><span class="material-symbols-outlined">download</span>Ekspor JSONL</button>' +
          '<a class="btn btn--secondary" href="#/execution"><span class="material-symbols-outlined">play_circle</span>Eksekusi</a>'
      }) +
      ui.demoBanner() +
      '<div class="card"><div class="card__head" style="flex-wrap:wrap;gap:8px">' +
        '<div class="input-wrap" style="flex:1 1 240px;max-width:320px"><span class="material-symbols-outlined">search</span>' +
          '<input class="input input--icon" id="q" placeholder="Cari aktor, plan, reason code…" style="height:32px"></div>' +
        ui.select('type', [{ value: 'all', label: 'Semua tipe event' }].concat(types.sort().map(function (t) { return { value: t, label: t.replace(/_/g, ' ') }; })), 'all', 'style="width:auto;height:32px;font-size:12px"') +
        '<div class="spacer"></div>' +
        '<span class="badge badge--outline"><span class="material-symbols-outlined" style="font-size:13px">lock</span>Append-only</span>' +
      '</div><div id="host"></div></div>';

    var host = root.querySelector('#host');
    function rows() {
      return store.audit.filter(function (e) {
        if (filter.type !== 'all' && e.type !== filter.type) return false;
        if (filter.q) {
          var hay = [e.type, e.actor, e.plan_id, e.mandate_id, e.reason_code, U.detailText(e.detail)].join(' ').toLowerCase();
          if (hay.indexOf(filter.q.toLowerCase()) < 0) return false;
        }
        return true;
      }).slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    }
    function paint() {
      host.innerHTML = '';
      host.appendChild(ui.table({
        columns: [
          { key: 'at', label: 'Waktu', width: '160px', render: function (e) { return '<span class="tiny muted">' + U.fmtDate(e.at) + '</span>'; } },
          { key: 'type', label: 'Event', width: '190px', render: function (e) {
            var tone = e.type.indexOf('block') > -1 || e.type.indexOf('reject') > -1 || e.type.indexOf('revoke') > -1 ? 'danger'
              : e.type.indexOf('execut') > -1 || e.type.indexOf('granted') > -1 || e.type.indexOf('issued') > -1 ? 'success' : '';
            return '<span class="badge badge--' + tone + '">' + esc(e.type.replace(/_/g, ' ')) + '</span>';
          }},
          { key: 'actor', label: 'Aktor', width: '170px', render: function (e) { return '<span class="small">' + esc(U.actorName(e.actor)) + '</span>'; } },
          { key: 'plan_id', label: 'Subjek', width: '150px', render: function (e) {
            var s = e.plan_id || e.mandate_id || '—';
            return '<span class="mono tiny">' + esc(s) + '</span>';
          }},
          { key: 'reason_code', label: 'Reason code', width: '160px', render: function (e) {
            return e.reason_code ? '<span class="badge badge--danger">' + esc(e.reason_code) + '</span>' : '<span class="faint tiny">—</span>';
          }},
          { key: 'detail', label: 'Detail', render: function (e) { return '<span class="tiny muted truncate" style="display:block;max-width:280px">' + esc(U.detailText(e.detail) || '—') + '</span>'; } }
        ],
        rows: rows(), pageSize: 12,
        onRowClick: function (e) {
          ui.drawer({
            eyebrow: 'Audit event', title: e.type.replace(/_/g, ' '), subtitle: U.fmtDate(e.at),
            body: '<dl class="def-list">' +
              '<dt>Aktor</dt><dd>' + esc(U.actorName(e.actor)) + '</dd>' +
              '<dt>Work package</dt><dd class="mono">' + esc(e.plan_id || '—') + '</dd>' +
              '<dt>Mandat</dt><dd class="mono">' + esc(e.mandate_id || '—') + '</dd>' +
              '<dt>Tindakan</dt><dd class="mono">' + esc(e.action_id || '—') + '</dd>' +
              '<dt>Reason code</dt><dd>' + (e.reason_code ? '<span class="badge badge--danger">' + esc(e.reason_code) + '</span>' : '—') + '</dd>' +
              '<dt>Detail</dt><dd>' + esc(U.detailText(e.detail) || '—') + '</dd>' +
              '<dt>Waktu</dt><dd class="mono tiny">' + esc(e.at) + '</dd>' +
            '</dl><div class="banner banner--info" style="margin-top:14px"><span class="material-symbols-outlined">lock</span>' +
            '<div>Event audit tidak dapat diubah atau dihapus. Koreksi dilakukan dengan menambahkan event baru.</div></div>',
            footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>'
          });
        },
        empty: ui.empty({ icon: 'search_off', title: 'Tidak ada event', body: 'Tidak ada event yang cocok dengan filter.' })
      }));
    }
    root.querySelector('#q').addEventListener('input', U.debounce(function (e) { filter.q = e.target.value; paint(); }, 180));
    root.querySelector('#type').addEventListener('change', function (e) { filter.type = e.target.value; paint(); });
    root.querySelector('#export').addEventListener('click', function () {
      U.download('dextra-audit.jsonl', store.audit.map(function (e) { return JSON.stringify(e); }).join('\n'), 'application/x-ndjson');
      ui.toast('Audit trail diekspor sebagai JSONL.', 'success');
    });
    paint();
  };

  /* ---------------- Policies ---------------- */
  D.views.policies = function (root) {
    var canEdit = D.session.can('edit_policy');
    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Governance · Policies',
        title: 'Policies',
        desc: 'Aturan yang dievaluasi Policy Validator sebelum manusia melihat work package. Setiap blokir harus dapat ditelusuri ke satu aturan dan satu reason code.',
        actions: (canEdit ? '<button class="btn btn--primary" id="new-policy"><span class="material-symbols-outlined">add</span>Kebijakan baru</button>' : '') +
          '<a class="btn btn--secondary" href="#/audit"><span class="material-symbols-outlined">receipt_long</span>Audit</a>'
      }) +
      (canEdit ? '' : '<div class="banner banner--info" style="margin-bottom:16px"><span class="material-symbols-outlined">lock</span>' +
        '<div>Peran <b>' + esc(D.session.roleLabel()) + '</b> dapat melihat kebijakan tetapi tidak dapat mengubahnya. Perubahan memerlukan peran Governance Lead.</div></div>') +
      ui.demoBanner() +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start">' +
        '<div class="card"><div class="card__head"><div><h2>Aturan aktif</h2><p>' +
          store.policies.filter(function (p) { return p.active; }).length + ' aktif dari ' + store.policies.length + ' aturan</p></div>' +
          '<div class="spacer"></div><span class="badge badge--outline">Deterministik</span></div>' +
          '<div class="card__body card__body--flush">' +
            store.policies.map(function (p, i) {
              var tone = p.severity === 'blocking' ? 'danger' : 'warning';
              return '<div class="policy-row" data-policy="' + esc(p.id) + '" style="padding:14px 16px;border-bottom:1px solid var(--border);cursor:pointer">' +
                '<div class="row" style="gap:10px;align-items:flex-start">' +
                  '<span style="width:30px;height:30px;border-radius:8px;background:var(--' + tone + '-100);color:var(--' + tone + '-600);display:grid;place-items:center;flex:0 0 auto">' +
                    '<span class="material-symbols-outlined" style="font-size:16px">' + (p.severity === 'blocking' ? 'block' : 'warning') + '</span></span>' +
                  '<div style="flex:1;min-width:0">' +
                    '<div class="row" style="gap:8px;margin-bottom:2px"><span class="mono tiny faint">' + esc(p.id) + '</span>' +
                      '<span class="small strong">' + esc(p.name) + '</span>' +
                      (p.active ? '<span class="badge badge--success">aktif</span>' : '<span class="badge badge--outline">nonaktif</span>') + '</div>' +
                    '<div class="tiny muted" style="line-height:1.45">' + esc(p.desc) + '</div>' +
                    '<div class="row" style="gap:12px;margin-top:5px"><span class="tiny faint">' + esc(p.category) + '</span>' +
                      '<span class="tiny faint">' + esc(p.scope) + '</span>' +
                      '<span class="tiny faint">diperbarui ' + U.rel(p.updated) + '</span></div>' +
                  '</div>' +
                  '<label class="switch" onclick="event.stopPropagation()"><input type="checkbox" ' + (p.active ? 'checked' : '') +
                    (canEdit ? '' : ' disabled') + ' data-toggle="' + esc(p.id) + '"><span class="switch__track"></span></label>' +
                '</div></div>';
            }).join('') +
          '</div></div>' +
        '<div class="stack">' +
          ui.card({ title: 'Distribusi keparahan', body:
            '<div class="stack" style="gap:10px">' +
              '<div class="bar-row"><span class="bar-row__label">Blocking</span><span class="bar-row__track"><i class="bar-row__fill" style="width:' +
                Math.round(store.policies.filter(function (p) { return p.severity === 'blocking'; }).length / store.policies.length * 100) + '%;background:var(--danger-600)"></i></span>' +
                '<span class="bar-row__val">' + store.policies.filter(function (p) { return p.severity === 'blocking'; }).length + '</span></div>' +
              '<div class="bar-row"><span class="bar-row__label">Warning</span><span class="bar-row__track"><i class="bar-row__fill" style="width:' +
                Math.round(store.policies.filter(function (p) { return p.severity === 'warning'; }).length / store.policies.length * 100) + '%;background:var(--warning-600)"></i></span>' +
                '<span class="bar-row__val">' + store.policies.filter(function (p) { return p.severity === 'warning'; }).length + '</span></div>' +
            '</div>'
          }) +
          ui.card({ title: 'Blokir terbaru', desc: 'Reason code yang muncul di audit', body:
            (function () {
              var counts = {};
              store.audit.forEach(function (e) { if (e.reason_code && /policy|block/i.test(e.type)) counts[e.reason_code] = (counts[e.reason_code] || 0) + 1; });
              var keys = Object.keys(counts);
              return keys.length ? keys.map(function (k) {
                return '<div class="row" style="padding:6px 0"><span class="badge badge--danger">' + esc(k) + '</span><span class="spacer"></span><span class="tiny muted">' + counts[k] + '×</span></div>';
              }).join('') : '<p class="tiny muted">Belum ada blokir tercatat.</p>';
            })()
          }) +
          ui.card({ title: 'Catatan', body:
            '<p class="small muted" style="line-height:1.6">Policy Validator adalah mesin aturan deterministik, bukan agen AI. Untuk masukan yang sama ia selalu memberi hasil yang sama — sehingga boleh memblokir tanpa persetujuan manusia.</p>'
          }) +
        '</div>' +
      '</div>';

    root.querySelectorAll('[data-policy]').forEach(function (row) {
      row.addEventListener('click', function () {
        var p = store.policies.filter(function (x) { return x.id === row.getAttribute('data-policy'); })[0];
        var blocks = store.audit.filter(function (e) { return e.reason_code === p.id || U.detailText(e.detail).indexOf(p.id) > -1; });
        ui.drawer({
          eyebrow: 'Kebijakan', title: p.id + ' · ' + p.name, subtitle: p.category,
          body:
            '<div class="row" style="gap:8px;margin-bottom:12px">' +
              '<span class="badge badge--' + (p.severity === 'blocking' ? 'danger' : 'warning') + '">' + esc(p.severity) + '</span>' +
              (p.active ? '<span class="badge badge--success">aktif</span>' : '<span class="badge badge--outline">nonaktif</span>') +
            '</div>' +
            '<p class="small" style="line-height:1.6;color:var(--text-2)">' + esc(p.desc) + '</p>' +
            '<div class="divider"></div>' +
            '<dl class="def-list">' +
              '<dt>Cakupan</dt><dd>' + esc(p.scope) + '</dd>' +
              '<dt>Keparahan</dt><dd>' + esc(p.severity) + '</dd>' +
              '<dt>Diperbarui</dt><dd>' + esc(U.fmtDate(p.updated)) + '</dd>' +
              '<dt>Oleh</dt><dd>' + esc(p.by) + '</dd>' +
            '</dl>' +
            '<div class="divider"></div>' +
            '<h3 style="margin-bottom:8px">Blokir terkait</h3>' +
            (blocks.length ? blocks.slice(0, 4).map(function (e) {
              return '<div class="row" style="padding:7px 0;border-bottom:1px solid var(--border)"><div style="flex:1;min-width:0">' +
                '<div class="tiny mono faint">' + esc(e.plan_id || '—') + '</div><div class="tiny muted">' + esc(U.detailText(e.detail) || e.reason_code || '—') + '</div></div>' +
                '<span class="tiny faint">' + U.rel(e.at) + '</span></div>';
            }).join('') : '<p class="tiny muted">Belum ada blokir tercatat untuk aturan ini.</p>')
          ,
          footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
            (canEdit ? '<button class="btn btn--primary" id="edit-policy">Ubah kebijakan</button>' : '')
        });
        var edit = document.getElementById('edit-policy');
        if (edit) edit.addEventListener('click', function () {
          ui.toast('Editor kebijakan belum tersedia di prototipe ini. Perubahan aturan harus melalui backend tata kelola.', 'warning', 4600);
        });
      });
    });

    root.querySelectorAll('[data-toggle]').forEach(function (input) {
      input.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = input.getAttribute('data-toggle');
        var p = store.policies.filter(function (x) { return x.id === id; })[0];
        var next = input.checked;
        if (!canEdit) { input.checked = !next; ui.toast('Peran Anda tidak dapat mengubah kebijakan.', 'warning'); return; }
        ui.confirm({
          title: (next ? 'Aktifkan ' : 'Nonaktifkan ') + id + '?',
          subtitle: 'Perubahan berlaku untuk seluruh organisasi',
          tone: next ? 'primary' : 'danger',
          confirmLabel: next ? 'Aktifkan' : 'Nonaktifkan',
          body: 'Perubahan kebijakan memengaruhi validasi semua work package berikutnya. Setiap perubahan dicatat di audit trail.<br><br><b>' + esc(p.name) + '</b><br><span class="muted">' + esc(p.desc) + '</span>'
        }).then(function (r) {
          if (!r || !r.ok) { input.checked = !next; return; }
          if (store.mode === 'live') { input.checked = !next; ui.toast('Perubahan kebijakan belum tersedia di API lokal.', 'warning'); return; }
          p.active = next;
          p.updated = new Date().toISOString();
          p.by = D.session.user.name;
          store.audit.unshift({ at: new Date().toISOString(), type: 'policy_updated', actor: D.session.user.name, plan_id: null, mandate_id: null, reason_code: null, detail: id + (next ? ' diaktifkan' : ' dinonaktifkan') });
          ui.toast(id + (next ? ' diaktifkan' : ' dinonaktifkan') + ' (demo). Tercatat di audit.', 'success');
          D.router.render();
        });
      });
    });

    var np = root.querySelector('#new-policy');
    if (np) np.addEventListener('click', function () {
      ui.toast('Pembuatan kebijakan baru memerlukan backend tata kelola. Belum tersedia di prototipe.', 'warning', 4600);
    });
  };
})();
