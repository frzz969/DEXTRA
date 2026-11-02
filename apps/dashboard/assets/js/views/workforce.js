/* Views — Workforce & Specialist Directory. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  function load(s) {
    return store.plans.filter(function (p) { return p.specialist === s.id && p.status !== 'EXECUTED' && p.status !== 'REJECTED'; }).length;
  }
  function totalFor(s) {
    if (s.id === 'dispatcher') return store.plans.length;
    if (s.engine) return store.plans.length;
    return store.plans.filter(function (p) { return p.specialist === s.id; }).length;
  }
  function wpLabel(s) {
    return (s.id === 'dispatcher' || s.engine) ? 'semua WP' : totalFor(s) + ' WP';
  }
  function lastActive(s) {
    var evs = store.audit.filter(function (e) { return e.actor === s.id; });
    return evs.length ? evs[0].at : null;
  }

  function openSpecialist(s) {
    var recent = store.plans.filter(function (p) { return p.specialist === s.id; }).slice(0, 4);
    ui.drawer({
      eyebrow: s.engine ? 'Mesin kebijakan' : 'Spesialis AI',
      title: s.name, subtitle: s.role,
      body:
        '<div class="row" style="gap:10px;margin-bottom:14px">' +
          '<span class="spec-avatar' + (s.engine ? ' spec-avatar--engine' : '') + '" style="width:44px;height:44px;border-radius:12px"><span class="material-symbols-outlined" style="font-size:22px">' + s.icon + '</span></span>' +
          '<div><div class="small strong">' + esc(s.version) + '</div><div class="tiny muted">Status aktif</div></div>' +
          '<div class="spacer"></div>' + (s.mandates === 'read-only' ? '<span class="badge badge--outline">read-only</span>' : s.mandates === 'evaluate only' ? '<span class="badge badge--outline">evaluate only</span>' : '<span class="badge badge--brand">via mandate</span>') +
        '</div>' +
        '<p class="small" style="color:var(--text-2);line-height:1.6">' + esc(s.desc) + '</p>' +
        '<div class="divider"></div>' +
        '<h3 style="margin-bottom:8px">Dapat melakukan</h3>' +
        '<div class="stack" style="gap:6px;margin-bottom:14px">' + s.capabilities.map(function (c) {
          return '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--success-600)">check_circle</span><span class="small">' + esc(c) + '</span></div>';
        }).join('') + '</div>' +
        '<h3 style="margin-bottom:8px">Tidak dapat melakukan</h3>' +
        '<div class="stack" style="gap:6px;margin-bottom:14px">' + s.limits.map(function (c) {
          return '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--danger-600)">cancel</span><span class="small">' + esc(c) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="divider"></div>' +
        '<h3 style="margin-bottom:8px">Work package terbaru</h3>' +
        (recent.length ? recent.map(function (p) {
          return '<a href="#/work-packages/' + encodeURIComponent(p.plan_id) + '" class="row" style="padding:8px 0;border-bottom:1px solid var(--border)">' +
            '<div style="flex:1;min-width:0"><div class="tiny mono faint">' + esc(p.plan_id) + '</div>' +
            '<div class="small truncate">' + esc(p.intent) + '</div></div>' + D.statusBadge(p.status) + '</a>';
        }).join('') : '<p class="small muted">Belum ada work package.</p>') +
        '<div class="tag-row" style="margin-top:14px">' + s.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>'
      ,
      footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
        '<a class="btn btn--primary" href="#/specialists">Buka direktori</a>'
    });
  }

  D.views.workforce = function (root) {
    var ai = store.specialists.filter(function (s) { return !s.engine; });
    var engine = store.specialists.filter(function (s) { return s.engine; });
    var activeWork = store.plans.filter(function (p) { return p.status !== 'EXECUTED' && p.status !== 'REJECTED'; }).length;

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workforce · Workforce',
        title: 'Workforce',
        desc: 'Empat spesialis AI dengan lingkup wewenang berbeda, ditambah satu mesin kebijakan deterministik yang tidak dapat bertindak sendiri.',
        actions: '<a class="btn btn--secondary" href="#/specialists"><span class="material-symbols-outlined">badge</span>Direktori</a>'
      }) +
      '<div class="banner banner--warning" style="margin-bottom:16px"><span class="material-symbols-outlined">science</span>' +
        '<div><b>Angka di halaman ini dihitung dari work package dan audit log.</b> Tidak ada metrik performa model (akurasi, latensi, utilisasi) karena backend tidak menyediakannya — kolom tersebut sengaja tidak dibuat.</div></div>' +
      ui.demoBanner() +
      '<div class="grid grid--4" style="margin-bottom:16px">' +
        ui.kpi({ label: 'Spesialis AI', value: ai.length, icon: 'groups', tone: 'accent', foot: '<span class="material-symbols-outlined">verified</span>Semua berstatus aktif' }) +
        ui.kpi({ label: 'Mesin kebijakan', value: engine.length, icon: 'rule', foot: '<span class="material-symbols-outlined">functions</span>Deterministik, dapat diuji' }) +
        ui.kpi({ label: 'Work package berjalan', value: activeWork, icon: 'layers', tone: 'warn', foot: '<span class="material-symbols-outlined">pending</span>Belum selesai' }) +
        ui.kpi({ label: 'Spesialis read-only', value: ai.filter(function (s) { return s.mandates === 'read-only'; }).length, icon: 'visibility', tone: 'success', foot: '<span class="material-symbols-outlined">lock</span>Tidak dapat menulis' }) +
      '</div>' +
      '<div class="grid" style="grid-template-columns:minmax(0,1fr) 340px;align-items:start">' +
        '<div class="card"><div class="card__head"><div><h2>Beban kerja per spesialis</h2><p>Work package aktif yang sedang ditangani</p></div></div>' +
          '<div class="card__body card__body--flush" id="wf-table"></div></div>' +
        '<div class="stack">' +
          ui.card({ title: 'Distribusi beban', body: ui.bars(store.specialists.map(function (s) { return { label: s.name.replace('Workforce ', ''), value: load(s), color: s.engine ? 'var(--faint)' : 'var(--brand-500)' }; })) }) +
          ui.card({ title: 'Batas kepercayaan', body:
            '<div class="stack" style="gap:10px">' +
              ['Spesialis hanya menyusun rencana.', 'Executor memvalidasi mandat secara independen.', 'Tidak ada jalur langsung dari agen ke executor.'].map(function (t) {
                return '<div class="row" style="align-items:flex-start;gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--brand-600);margin-top:2px">check</span><span class="small muted">' + esc(t) + '</span></div>';
              }).join('') +
            '</div>'
          }) +
          ui.card({ title: 'Policy Validator', body:
            '<p class="small muted" style="line-height:1.6">Mesin aturan deterministik, bukan spesialis AI. Keluarannya dapat diprediksi: untuk masukan yang sama, hasilnya selalu sama. Karena itu ia boleh memblokir, sementara AI tidak.</p>' +
            '<a class="btn btn--secondary btn--sm btn--block" style="margin-top:10px" href="#/policies">Lihat aturan aktif</a>'
          }) +
        '</div>' +
      '</div>';

    ui.mount(root, '#wf-table', ui.table({
      columns: [
        { key: 'name', label: 'Spesialis', render: function (sp) {
          return '<div class="row" style="gap:9px"><span class="spec-avatar' + (sp.engine ? ' spec-avatar--engine' : '') + '" style="width:30px;height:30px;border-radius:8px">' +
            '<span class="material-symbols-outlined" style="font-size:16px">' + sp.icon + '</span></span>' +
            '<div><div class="cell-title">' + esc(sp.name) + '</div><div class="cell-sub">' + esc(sp.role) + '</div></div></div>';
        }},
        { key: 'mandates', label: 'Wewenang tulis', width: '150px', render: function (sp) {
          return sp.mandates === 'read-only' ? '<span class="badge badge--outline">read-only</span>'
            : sp.mandates === 'evaluate only' ? '<span class="badge badge--outline">evaluate only</span>'
            : '<span class="badge badge--brand">via mandate</span>';
        }},
        { key: 'load', label: 'Aktif', width: '72px', align: 'right', raw: load, render: function (sp) { return '<span class="strong">' + load(sp) + '</span>'; } },
        { key: 'total', label: 'Total', width: '72px', align: 'right', raw: totalFor, render: function (sp) { return '<span class="muted">' + totalFor(sp) + '</span>'; } },
        { key: 'last', label: 'Aktivitas terakhir', width: '150px', align: 'right', raw: function (sp) { return lastActive(sp) || ''; }, render: function (sp) {
          var at = lastActive(sp);
          return '<span class="tiny muted">' + (at ? U.rel(at) : 'belum ada') + '</span>';
        }}
      ],
      rows: store.specialists.slice(),
      onRowClick: function (sp) { openSpecialist(sp); }
    }));

    void ai;
  };

  D.views.specialists = function (root) {
    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workforce · Specialist Directory',
        title: 'Specialist Directory',
        desc: 'Setiap kartu menyatakan apa yang boleh dan tidak boleh dilakukan. Wewenang tulis selalu berasal dari mandat, bukan dari peran spesialis.',
        actions: '<a class="btn btn--secondary" href="#/workforce"><span class="material-symbols-outlined">groups</span>Workforce</a>'
      }) +
      ui.demoBanner() +
      '<div style="margin-bottom:16px">' + ui.statstrip([
        { label: 'Spesialis AI', value: store.specialists.filter(function (s) { return !s.engine; }).length, hint: 'Semua berstatus aktif' },
        { label: 'Read-only', value: store.specialists.filter(function (s) { return s.mandates === 'read-only'; }).length, tone: 'info', hint: 'Tidak pernah menulis' },
        { label: 'Via mandate', value: store.specialists.filter(function (s) { return s.mandates === 'write via mandate'; }).length, tone: 'success', hint: 'Butuh mandat aktif' },
        { label: 'Mesin kebijakan', value: store.specialists.filter(function (s) { return s.engine; }).length, hint: 'Deterministik, bukan AI' }
      ]) + '</div>' +
      '<div class="grid grid--3">' + store.specialists.map(function (s) {
        return '<article class="card spec-card card--hover" data-spec="' + s.id + '" style="cursor:pointer">' +
          '<div class="spec-card__top">' +
            '<span class="spec-avatar' + (s.engine ? ' spec-avatar--engine' : '') + '"><span class="material-symbols-outlined">' + s.icon + '</span></span>' +
            '<div style="flex:1;min-width:0"><h3>' + esc(s.name) + '</h3><div class="role">' + esc(s.role) + '</div></div>' +
            (s.engine ? '<span class="badge badge--outline">engine</span>' : '<span class="badge badge--success">aktif</span>') +
          '</div>' +
          '<p class="spec-card__desc">' + esc(s.desc) + '</p>' +
          '<div class="row" style="gap:8px;font-size:11.5px">' +
            '<span class="badge badge--outline">' + esc(s.version) + '</span>' +
            '<span class="badge ' + (s.mandates === 'read-only' || s.mandates === 'evaluate only' ? 'badge--outline' : 'badge--brand') + '">' + esc(s.mandates) + '</span>' +
            '<span class="spacer"></span><span class="tiny muted">' + wpLabel(s) + '</span>' +
          '</div>' +
          '<div class="tag-row">' + s.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '</article>';
      }).join('') +
        /* fills the sixth cell and explains the authority vocabulary used on every card */
        '<article class="card spec-card spec-card--legend">' +
          '<div class="spec-card__top"><span class="spec-avatar spec-avatar--engine"><span class="material-symbols-outlined">menu_book</span></span>' +
            '<div style="flex:1;min-width:0"><h3>Cara membaca kartu</h3><div class="role">Tiga tingkat wewenang tulis</div></div></div>' +
          '<p class="spec-card__desc">Wewenang tulis selalu berasal dari mandat, bukan dari peran spesialis itu sendiri.</p>' +
          '<div class="stack" style="gap:8px">' +
            [['read-only', 'Membaca dan menyusun rencana saja.'],
             ['via mandate', 'Bertindak hanya dengan mandat aktif.'],
             ['evaluate only', 'Menilai dan memblokir, tidak mengeksekusi.']].map(function (r) {
              return '<div class="row" style="gap:8px;align-items:flex-start">' +
                '<span class="badge badge--outline" style="flex:0 0 auto">' + esc(r[0]) + '</span>' +
                '<span class="tiny muted" style="line-height:1.45">' + esc(r[1]) + '</span></div>';
            }).join('') +
          '</div>' +
        '</article>' +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__body">' +
        '<div class="row" style="align-items:flex-start;gap:10px"><span class="material-symbols-outlined" style="color:var(--brand-600)">info</span>' +
        '<div><div class="small strong">Policy Validator bukan spesialis AI</div>' +
        '<p class="small muted" style="margin-top:2px;line-height:1.6">Ia adalah mesin aturan deterministik. Perbedaan ini penting: mesin aturan boleh memblokir eksekusi tanpa persetujuan manusia, sedangkan agen AI tidak. Karena itu blokir kebijakan selalu dapat ditelusuri ke aturan tertentu dengan reason code.</p></div></div>' +
      '</div></div>';

    root.querySelectorAll('[data-spec]').forEach(function (card) {
      card.addEventListener('click', function () {
        openSpecialist(store.specialist(card.getAttribute('data-spec')));
      });
    });
  };
})();
