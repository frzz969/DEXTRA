/* View — Workforce: the specialist roster, read from workbuddy/agents/*.md.
 *
 * This page used to be two screens (Workforce + Specialist Directory) showing
 * demo data with fields the server never had: version numbers, "status aktif",
 * tag lists, workload counters. All of it was invented in data.js.
 *
 * Now there is one screen and it renders exactly four things per specialist —
 * name, role, limits, tools — because those are the four things the agent files
 * state. Workload is gone: the server records no specialist on a plan, so any
 * "beban kerja" number would have been fiction. If the server is not running,
 * the page says so instead of falling back to example rows.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  function openSpecialist(s) {
    ui.drawer({
      eyebrow: 'Spesialis AI',
      title: s.name,
      subtitle: 'workbuddy/agents/' + s.id + '.md',
      body:
        '<p class="small" style="color:var(--text-2);line-height:1.65">' + esc(s.role) + '</p>' +
        '<div class="divider"></div>' +
        '<h3 style="margin-bottom:8px">Batas yang dinyatakan</h3>' +
        (s.limits.length
          ? '<div class="stack" style="gap:6px;margin-bottom:14px">' + s.limits.map(function (c) {
              return '<div class="row" style="gap:8px;align-items:flex-start"><span class="material-symbols-outlined" style="font-size:15px;color:var(--danger-600);margin-top:1px">cancel</span><span class="small">' + esc(c) + '</span></div>';
            }).join('') + '</div>'
          : '<p class="small muted">Berkas ini tidak menyatakan batas eksplisit.</p>') +
        '<div class="divider"></div>' +
        '<h3 style="margin-bottom:8px">Tool yang boleh dipanggil</h3>' +
        (s.tools.length
          ? '<div class="tag-row">' + s.tools.map(function (t) { return '<span class="tag mono">' + esc(t) + '</span>'; }).join('') + '</div>'
          : '<p class="small muted">Berkas ini tidak mencantumkan daftar tool. Wewenang tetap ditentukan token, bukan peran.</p>'),
      footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>' +
        '<a class="btn btn--primary" href="#/policies">Lihat aturan aktif</a>'
    });
  }

  D.views.workforce = function (root) {
    var live = store.mode === 'live';
    var roster = live ? (store.specialists || []) : [];

    if (!live) {
      root.innerHTML =
        ui.pageHead({
          eyebrow: 'Workforce',
          title: 'Workforce',
          desc: 'Roster spesialis dibaca dari berkas definisi agen di server.'
        }) +
        '<div class="card card--pad" style="max-width:640px">' +
          '<div class="row" style="gap:10px;align-items:flex-start">' +
            '<span class="material-symbols-outlined" style="color:var(--warning-600)">cloud_off</span>' +
            '<div><div class="small strong">Butuh server MCP</div>' +
            '<p class="small muted" style="margin-top:4px;line-height:1.6">Halaman ini tidak punya data contoh. Roster hanya bisa dibaca lewat tool <span class="mono">list_specialists</span>, yang membaca <span class="mono">workbuddy/agents/*.md</span> di server.</p>' +
            '<p class="small muted" style="margin-top:8px">Jalankan <span class="mono">pnpm run demo:seed</span> lalu <span class="mono">pnpm run dev:mcp</span>, kemudian masuk lewat halaman Login.</p>' +
            '</div></div></div>';
      return;
    }

    if (!roster.length) {
      root.innerHTML =
        ui.pageHead({ eyebrow: 'Workforce', title: 'Workforce', desc: 'Roster spesialis dari berkas definisi agen.' }) +
        '<div class="card card--pad"><div class="row" style="gap:10px;align-items:flex-start">' +
          '<span class="material-symbols-outlined" style="color:var(--warning-600)">folder_off</span>' +
          '<div><div class="small strong">Roster kosong</div>' +
          '<p class="small muted" style="margin-top:4px">Server menjawab, tetapi tidak menemukan berkas di <span class="mono">workbuddy/agents/</span>. Saya tidak akan mengisi daftar ini dengan data contoh.</p></div>' +
        '</div></div>';
      return;
    }

    var withTools = roster.filter(function (s) { return s.tools.length; });
    var totalLimits = roster.reduce(function (n, s) { return n + s.limits.length; }, 0);

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workforce',
        title: 'Workforce',
        desc: 'Empat spesialis AI. Wewenang tulis selalu berasal dari mandat, bukan dari peran spesialis — dan batas di bawah ini dikutip dari berkas definisi agennya.',
        actions: '<a class="btn btn--secondary" href="#/policies"><span class="material-symbols-outlined">policy</span>Aturan aktif</a>'
      }) +
      '<div style="margin-bottom:16px">' + ui.statstrip([
        { label: 'Spesialis', value: roster.length, hint: 'Dibaca dari workbuddy/agents' },
        { label: 'Batas dinyatakan', value: totalLimits, hint: 'Kutipan langsung dari berkas', tone: 'info' },
        { label: 'Punya daftar tool', value: withTools.length, hint: 'Sisanya bergantung pada token', tone: 'success' }
      ]) + '</div>' +
      '<div class="grid grid--3">' +
        roster.map(function (s) {
          return '<article class="card spec-card card--hover" data-spec="' + esc(s.id) + '" style="cursor:pointer">' +
            '<div class="spec-card__top">' +
              '<span class="spec-avatar"><span class="material-symbols-outlined">smart_toy</span></span>' +
              '<div style="flex:1;min-width:0"><h3>' + esc(s.name) + '</h3>' +
              '<div class="role">' + esc(s.id) + '</div></div>' +
            '</div>' +
            '<p class="spec-card__desc">' + esc(s.role) + '</p>' +
            '<div class="stack" style="gap:5px;margin-top:2px">' +
              s.limits.slice(0, 3).map(function (l) {
                return '<div class="row" style="gap:7px;align-items:flex-start">' +
                  '<span class="material-symbols-outlined" style="font-size:13px;color:var(--danger-600);margin-top:2px">block</span>' +
                  '<span class="tiny muted" style="line-height:1.45">' + esc(l) + '</span></div>';
              }).join('') +
            '</div>' +
            (s.tools.length
              ? '<div class="tag-row" style="margin-top:10px">' + s.tools.slice(0, 3).map(function (t) { return '<span class="tag mono">' + esc(t) + '</span>'; }).join('') +
                (s.tools.length > 3 ? '<span class="tag">+' + (s.tools.length - 3) + '</span>' : '') + '</div>'
              : '') +
          '</article>';
        }).join('') +
        '<article class="card spec-card spec-card--legend">' +
          '<div class="spec-card__top"><span class="spec-avatar spec-avatar--engine"><span class="material-symbols-outlined">menu_book</span></span>' +
            '<div style="flex:1;min-width:0"><h3>Cara membaca halaman ini</h3><div class="role">Sumber, bukan ringkasan</div></div></div>' +
          '<p class="spec-card__desc">Setiap kartu adalah kutipan dari berkas agen. Tidak ada versi, status, atau beban kerja di sini — berkasnya tidak menyatakan itu, jadi halaman ini juga tidak.</p>' +
          '<div class="stack" style="gap:8px">' +
            [['Peran', 'Apa yang dikerjakan spesialis.'],
             ['Batas', 'Apa yang secara eksplisit tidak boleh dilakukan.'],
             ['Tool', 'Operasi yang boleh dipanggil, bila berkas mencantumkannya.']].map(function (r) {
              return '<div class="row" style="gap:8px;align-items:flex-start">' +
                '<span class="badge badge--outline" style="flex:0 0 auto">' + esc(r[0]) + '</span>' +
                '<span class="tiny muted" style="line-height:1.45">' + esc(r[1]) + '</span></div>';
            }).join('') +
          '</div>' +
        '</article>' +
      '</div>' +
      '<div class="card" style="margin-top:16px"><div class="card__body">' +
        '<div class="row" style="align-items:flex-start;gap:10px"><span class="material-symbols-outlined" style="color:var(--brand-600)">info</span>' +
        '<div><div class="small strong">Policy Validator bukan bagian dari roster ini</div>' +
        '<p class="small muted" style="margin-top:2px;line-height:1.6">Ia mesin aturan deterministik di <span class="mono">packages/policy-engine</span>, bukan agen. Perbedaannya penting: mesin aturan boleh memblokir eksekusi tanpa persetujuan manusia, sedangkan agen AI tidak. Karena itu setiap blokir dapat ditelusuri ke aturan tertentu lewat reason code.</p></div></div>' +
      '</div></div>';

    root.querySelectorAll('[data-spec]').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-spec');
        var s = roster.filter(function (x) { return x.id === id; })[0];
        if (s) openSpecialist(s);
      });
    });
  };
})();
