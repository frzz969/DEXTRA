/* View — Data Explorer.
 *
 * Halaman ini tidak memuat seluruh basis data ke peramban. Setiap perubahan
 * kata kunci atau halaman adalah satu permintaan ke server, dan server yang
 * memutuskan apa yang cocok — bukan klien yang menyaring 200 baris yang
 * kebetulan sudah diunduh.
 *
 * Konsekuensi yang harus dinyatakan, bukan disembunyikan: ini bukan satu
 * pencarian gabungan. Empat entitas punya empat tool baca, jadi hasilnya
 * ditampilkan per entitas, dengan `total` dari server masing-masing. Tidak ada
 * peringkat relevansi lintas entitas, karena tidak ada yang menghitungnya.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var PAGE_SIZE = 25;

  /*
   * Hanya entitas yang punya tool baca berpaginasi di server.
   *
   * Approval dan Worker sengaja tidak ada di sini. Tidak ada `list_approvals`,
   * dan `list_specialists` membaca berkas roster tanpa pencarian. Menampilkan
   * keduanya berarti menyaring snapshot dashboard lalu menyebutnya "pencarian" —
   * hasilnya akan bergantung pada berapa baris yang kebetulan sudah dimuat,
   * bukan pada isi basis data. Alasan itu ditulis di halaman, bukan disembunyikan.
   */
  var ENTITIES = [
    { id: 'plans', label: 'Plan', tool: 'list_plans', key: 'plans', cap: 'view_all' },
    { id: 'mandates', label: 'Mandate', tool: 'list_mandates', key: 'mandates', cap: 'view_all' },
    { id: 'executions', label: 'Execution', tool: 'list_executions', key: 'executions', cap: 'view_all' },
    { id: 'audit', label: 'Audit', tool: 'get_audit_log', key: 'events', cap: 'view_audit' }
  ];

  function entityById(id) {
    for (var i = 0; i < ENTITIES.length; i++) if (ENTITIES[i].id === id) return ENTITIES[i];
    return ENTITIES[0];
  }

  /*
   * Dashboard ini memakai hash routing (`#/explorer?entity=audit`), sedangkan
   * `U.qs` membaca `location.search`. Untuk halaman ini parameternya ada di
   * belakang tanda tanya di dalam hash, jadi dibaca dari situ — kalau tidak,
   * tautan langsung ke entitas tertentu akan selalu jatuh ke Plan.
   */
  function hashParams() {
    var hash = location.hash || '';
    var i = hash.indexOf('?');
    return new URLSearchParams(i < 0 ? '' : hash.slice(i + 1));
  }

  /* Nilai yang tidak ada ditulis sebagai tanda pisah, bukan nol dan bukan
     teks karangan. */
  function val(x) {
    if (x === null || x === undefined || x === '') return '<span class="faint">—</span>';
    if (Array.isArray(x)) return x.length ? esc(x.join(', ')) : '<span class="faint">—</span>';
    if (typeof x === 'object') return '<span class="mono tiny">' + esc(JSON.stringify(x)) + '</span>';
    return esc(String(x));
  }

  function when(iso) {
    if (!iso) return '<span class="faint">—</span>';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return esc(String(iso));
    return '<span title="' + esc(String(iso)) + '">' + esc(d.toLocaleString('id-ID')) + '</span>';
  }

  function badge(text, tone) {
    return '<span class="badge badge--' + (tone || 'neutral') + '">' + esc(String(text)) + '</span>';
  }

  function statusTone(status) {
    var s = String(status || '').toUpperCase();
    if (s === 'ACTIVE' || s === 'SENT' || s === 'GRANTED' || s === 'READY') return 'success';
    if (s === 'FAILED' || s === 'BLOCKED' || s === 'REVOKED' || s === 'REJECTED' || s === 'EXPIRED') return 'danger';
    if (s === 'PENDING' || s === 'NEEDS_REVIEW' || s === 'DRAFT') return 'warning';
    return 'neutral';
  }

  var COLUMNS = {
    plans: [
      { key: 'plan_id', label: 'Plan', render: function (r) { return '<span class="mono tiny">' + esc(r.plan_id) + '</span>'; } },
      { key: 'intent', label: 'Maksud' },
      { key: 'status', label: 'Status', render: function (r) { return badge(r.status, statusTone(r.status)); } },
      { key: 'created_at', label: 'Dibuat', render: function (r) { return when(r.created_at); } }
    ],
    mandates: [
      { key: 'mandate_id', label: 'Mandat', render: function (r) { return '<span class="mono tiny">' + esc(r.mandate_id) + '</span>'; } },
      { key: 'plan_id', label: 'Plan', render: function (r) { return '<span class="mono tiny">' + esc(r.plan_id) + '</span>'; } },
      { key: 'status', label: 'Status', render: function (r) { return badge(r.status, statusTone(r.status)); } },
      { key: 'expires_at', label: 'Kedaluwarsa', render: function (r) { return when(r.expires_at); } }
    ],
    executions: [
      { key: 'execution_id', label: 'Eksekusi', render: function (r) { return '<span class="mono tiny">' + esc(r.execution_id) + '</span>'; } },
      { key: 'action_id', label: 'Aksi', render: function (r) { return '<span class="mono tiny">' + esc(r.action_id) + '</span>'; } },
      { key: 'result', label: 'Hasil', render: function (r) { return badge(r.result, statusTone(String(r.result || '').toUpperCase())); } },
      { key: 'executed_at', label: 'Waktu', render: function (r) { return when(r.executed_at); } }
    ],
    audit: [
      { key: 'type', label: 'Tipe', render: function (r) { return '<span class="mono tiny">' + esc(r.type) + '</span>'; } },
      { key: 'actor', label: 'Aktor' },
      { key: 'at', label: 'Waktu', render: function (r) { return when(r.at); } },
      {
        key: 'subject',
        label: 'Subjek',
        render: function (r) {
          var parts = [];
          if (r.plan_id) parts.push('plan ' + r.plan_id);
          if (r.mandate_id) parts.push('mandate ' + r.mandate_id);
          if (r.action_id) parts.push('action ' + r.action_id);
          return parts.length ? '<span class="mono tiny">' + esc(parts.join(' · ')) + '</span>' : '<span class="faint">—</span>';
        }
      }
    ]
  };

  function rowId(entity, row) {
    if (entity.id === 'plans') return row.plan_id;
    if (entity.id === 'mandates') return row.mandate_id;
    if (entity.id === 'executions') return row.execution_id;
    return row.event_id;
  }

  /* ---------------- detail drawer ---------------- */

  function fieldList(pairs) {
    return '<dl class="def-list">' + pairs.map(function (p) {
      return '<dt>' + esc(p[0]) + '</dt><dd>' + (p[2] || val(p[1])) + '</dd>';
    }).join('') + '</dl>';
  }

  function relationBlock(title, body) {
    return '<div style="margin-top:16px"><div class="tiny muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">' + esc(title) + '</div>' + body + '</div>';
  }

  function notFound(text) {
    return '<div class="banner banner--warn"><span class="material-symbols-outlined">info</span><div>' + esc(text) + '</div></div>';
  }

  /*
   * Relasi dibaca dari server saat drawer dibuka, memakai pencarian yang sama
   * yang dipakai tabel. Ini bukan join di klien atas snapshot: kalau mandat
   * untuk sebuah plan ada di luar 200 baris yang dimuat dashboard, jawabannya
   * tetap benar.
   */
  function openPlan(plan) {
    ui.drawer({
      eyebrow: 'Plan',
      title: plan.plan_id,
      subtitle: plan.intent,
      wide: true,
      body: fieldList([
        ['Status', plan.status],
        ['Org', plan.org_id],
        ['Request', plan.request_id],
        ['Pemohon', plan.requester_id],
        ['Penanggung jawab', plan.assignee_id],
        ['Dibuat', plan.created_at],
        ['Plan hash', plan.plan_hash],
        ['Jumlah aksi', Array.isArray(plan.actions) ? plan.actions.length : null],
        ['Temuan validasi', Array.isArray(plan.findings) ? plan.findings.length : null]
      ]) + '<div id="rel-plan"><div class="tiny muted">Memuat relasi…</div></div>',
      onMount: function (node) {
        var box = node.querySelector('#rel-plan');
        D.api.call('list_mandates', { q: plan.plan_id, limit: 50 }).then(function (d) {
          var mandates = d.mandates || [];
          var html = '';
          html += relationBlock(
            'Mandat',
            mandates.length
              ? mandates.map(function (m) {
                  return '<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
                    '<span class="mono tiny">' + esc(m.mandate_id) + '</span>' +
                    badge(m.status, statusTone(m.status)) +
                    '<span class="tiny muted">berakhir ' + esc(new Date(m.expires_at).toLocaleString('id-ID')) + '</span>' +
                  '</div>';
                }).join('')
              : notFound('Tidak ada mandat untuk plan ini. Tanpa approval, mandat memang tidak pernah terbit.')
          );
          /*
           * Approval tidak punya tool baca. Jejaknya ada di audit, dan itu yang
           * ditampilkan — bukan kesimpulan "belum di-approve" yang tidak bisa
           * dibuktikan dari data yang ada.
           */
          return D.api.call('get_audit_log', { q: plan.plan_id, limit: 100 }).then(function (a) {
            var related = (a.events || []).filter(function (e) {
              return e.type.indexOf('approval') === 0 || e.type.indexOf('mandate') === 0;
            });
            html += relationBlock(
              'Jejak approval di audit',
              related.length
                ? related.map(function (e) {
                    return '<div class="tiny" style="padding:3px 0"><span class="mono">' + esc(e.type) + '</span> · ' + when(e.at) + '</div>';
                  }).join('')
                : notFound('Belum ada event approval atau mandate untuk plan ini di audit log.')
            );
            box.innerHTML = html;
          });
        }).catch(function (e) {
          box.innerHTML = notFound('Relasi tidak dapat dimuat: ' + e.message);
        });
      }
    });
  }

  function openMandate(mandate) {
    ui.drawer({
      eyebrow: 'Mandate',
      title: mandate.mandate_id,
      subtitle: 'Mandat untuk ' + mandate.plan_id,
      wide: true,
      body: fieldList([
        ['Status', mandate.status, badge(mandate.status, statusTone(mandate.status))],
        ['Plan', mandate.plan_id],
        ['Diterbitkan oleh', mandate.issued_by],
        ['Pemilik', mandate.owner_principal_id],
        ['Diterbitkan', mandate.issued_at],
        ['Kedaluwarsa', mandate.expires_at],
        ['Risiko maksimum', mandate.max_risk],
        ['Aksi diizinkan', mandate.allowed_action_ids],
        ['Tipe diizinkan', mandate.allowed_action_types]
      ]) + '<div id="rel-mandate"><div class="tiny muted">Memuat eksekusi…</div></div>',
      onMount: function (node) {
        var box = node.querySelector('#rel-mandate');
        D.api.call('list_executions', { mandate_id: mandate.mandate_id, limit: 50 }).then(function (d) {
          var rows = d.executions || [];
          box.innerHTML = relationBlock(
            'Eksekusi di bawah mandat ini',
            rows.length
              ? rows.map(function (e) {
                  return '<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">' +
                    '<span class="mono tiny">' + esc(e.action_id) + '</span>' +
                    badge(e.result, statusTone(String(e.result).toUpperCase())) +
                    '<span class="tiny muted">' + esc(e.executed_at) + '</span>' +
                  '</div>';
                }).join('')
              : notFound('Belum ada eksekusi untuk mandat ini. Mandat yang terbit tidak otomatis dieksekusi.')
          );
        }).catch(function (e) {
          box.innerHTML = notFound('Relasi tidak dapat dimuat: ' + e.message);
        });
      }
    });
  }

  function openExecution(execution) {
    var usage = execution.usage || null;
    var evidence = execution.evidence || {};
    ui.drawer({
      eyebrow: 'Execution',
      title: execution.execution_id,
      subtitle: execution.action_id,
      wide: true,
      body: fieldList([
        ['Hasil', execution.result, badge(execution.result, statusTone(String(execution.result).toUpperCase()))],
        ['Mandat', execution.mandate_id],
        ['Kunci eksekusi', execution.execution_key],
        ['Alasan', execution.reason_code],
        ['Waktu', execution.executed_at],
        ['Provider usage', usage ? usage.provider : null],
        ['Model', usage ? usage.model : null],
        ['Token masuk', usage ? usage.tokens_in : null],
        ['Token keluar', usage ? usage.tokens_out : null],
        ['Biaya (USD)', usage ? usage.cost_usd : null],
        ['Sumber biaya', usage ? usage.cost_source : null],
        ['Latensi', usage ? usage.latency_ms + ' ms' : null],
        ['Bukti', Object.keys(evidence).length ? evidence : null]
      ]) +
        (usage && usage.tokens_in === null
          ? '<div style="margin-top:10px">' + notFound('Token dan biaya tidak diukur oleh adapter ini. Nilainya null di data, bukan nol.') + '</div>'
          : '') +
        '<div style="margin-top:10px">' + notFound('Adapter saat ini tiruan: bukti di atas tidak berarti ada surel, pesan, atau jadwal yang benar-benar terkirim.') + '</div>' +
        '<div id="rel-exec"><div class="tiny muted" style="margin-top:12px">Memuat mandat…</div></div>',
      onMount: function (node) {
        var box = node.querySelector('#rel-exec');
        D.api.call('list_mandates', { q: execution.mandate_id, limit: 5 }).then(function (d) {
          var mandate = (d.mandates || [])[0];
          box.innerHTML = mandate
            ? relationBlock(
                'Mandat',
                '<div class="tiny">' + esc(mandate.mandate_id) + ' · ' + badge(mandate.status, statusTone(mandate.status)) +
                  ' · plan <span class="mono">' + esc(mandate.plan_id) + '</span></div>'
              )
            : notFound('Mandat ' + execution.mandate_id + ' tidak ditemukan di penyimpanan.');
        }).catch(function (e) {
          box.innerHTML = notFound('Relasi tidak dapat dimuat: ' + e.message);
        });
      }
    });
  }

  function openAuditEvent(event) {
    ui.drawer({
      eyebrow: 'Audit event',
      title: event.type,
      subtitle: event.event_id,
      wide: true,
      body: fieldList([
        ['Waktu', event.at],
        ['Aktor', event.actor],
        ['Plan', event.plan_id],
        ['Mandat', event.mandate_id],
        ['Aksi', event.action_id],
        ['Plan hash', event.plan_hash],
        ['Kode alasan', event.reason_code],
        ['Detail', Object.keys(event.detail || {}).length ? event.detail : null],
        ['prev_hash', event.prev_hash],
        ['hash', event.hash]
      ]) +
        (event.hash
          ? ''
          : '<div style="margin-top:10px">' + notFound('Event ini tidak punya hash: ditulis sebelum rantai hash ada. Tidak terverifikasi — bukan berarti rusak.') + '</div>')
    });
  }

  function openDetail(entity, row) {
    if (entity.id === 'plans') return openPlan(row);
    if (entity.id === 'mandates') return openMandate(row);
    if (entity.id === 'executions') return openExecution(row);
    return openAuditEvent(row);
  }

  /* ---------------- page ---------------- */

  D.views.explorer = function (root) {
    var live = store.mode === 'live';
    var params = hashParams();
    var state = {
      entity: entityById(params.get('entity')),
      q: (params.get('q') || '').trim(),
      offset: 0,
      data: null,
      loading: false,
      error: null
    };

    if (!state.entity) state.entity = ENTITIES[0];

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Data · Explorer',
        title: 'Data Explorer',
        desc: 'Membaca rekaman yang benar-benar tersimpan, satu entitas per permintaan. Pencarian dan paginasi dijalankan server — halaman ini tidak pernah memuat seluruh berkas.'
      }) +
      '<div id="ex-shell"></div>';

    var shell = root.querySelector('#ex-shell');

    if (!live) {
      shell.innerHTML = ui.demoBanner('Explorer membutuhkan server: tanpa server tidak ada yang bisa dicari, dan halaman ini tidak akan mengarang baris contoh.');
      return;
    }

    shell.innerHTML =
      '<div class="card" style="padding:12px;margin-bottom:14px">' +
        '<div class="row" style="gap:8px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:220px;position:relative">' +
            '<span class="material-symbols-outlined" style="position:absolute;left:10px;top:9px;font-size:18px;color:var(--text-3)">search</span>' +
            '<input id="ex-q" class="input" placeholder="Cari di ' + esc(state.entity.label) + '…" style="padding-left:34px" autocomplete="off">' +
          '</div>' +
          '<div class="row" style="gap:4px" id="ex-tabs"></div>' +
        '</div>' +
        '<div class="tiny muted" style="margin-top:8px">Hasil diambil per entitas, bukan satu pencarian gabungan. Setiap entitas punya tool baca sendiri, dan angkanya datang dari server.</div>' +
      '</div>' +
      '<div id="ex-body"></div>';

    var tabs = shell.querySelector('#ex-tabs');
    tabs.innerHTML = ENTITIES.map(function (e) {
      var active = e.id === state.entity.id;
      /* Entitas audit butuh `view_audit`. Token yang tidak memegangnya melihat
         tombolnya nonaktif, bukan tombol yang menghasilkan galat server. */
      var capState = (D.session && D.session.capState) ? D.session.capState(e.cap) : 'granted';
      var disabled = capState !== 'granted';
      return '<button class="btn ' + (active ? 'btn--primary' : 'btn--ghost') + ' btn--sm" data-entity="' + e.id + '"' +
        (disabled ? ' disabled title="Tidak tersedia untuk token ini"' : '') + '>' + esc(e.label) + '</button>';
    }).join('');

    var body = shell.querySelector('#ex-body');
    var input = shell.querySelector('#ex-q');
    if (state.q) input.value = state.q;

    function renderPager(total) {
      var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      var page = Math.floor(state.offset / PAGE_SIZE) + 1;
      return '<div class="row" style="gap:8px;margin-top:12px;align-items:center">' +
        '<button class="btn btn--ghost btn--sm" data-page="prev"' + (state.offset <= 0 ? ' disabled' : '') + '>Sebelumnya</button>' +
        '<span class="tiny muted">Halaman ' + page + ' dari ' + pages + ' · ' + total.toLocaleString('id-ID') + ' baris</span>' +
        '<button class="btn btn--ghost btn--sm" data-page="next"' + (state.offset + PAGE_SIZE >= total ? ' disabled' : '') + '>Berikutnya</button>' +
      '</div>';
    }

    function paint() {
      if (state.loading) {
        body.innerHTML = ui.skeletonTable(6, 4);
        return;
      }
      if (state.error) {
        body.innerHTML = ui.errorState(state.error, 'Coba lagi');
        var retry = body.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }
      var d = state.data;
      if (!d) return;

      var rows = d.rows || [];
      var cols = COLUMNS[state.entity.id];

      if (!rows.length) {
        body.innerHTML = ui.empty({
          icon: 'search_off',
          title: state.q ? 'Tidak ada yang cocok' : 'Belum ada data',
          body: state.q
            ? 'Kata kunci "' + state.q + '" tidak cocok dengan apa pun di ' + state.entity.label + '. Server mencari di seluruh isi, bukan hanya halaman ini.'
            : 'Penyimpanan untuk ' + state.entity.label + ' masih kosong.'
        });
        return;
      }

      var head = '<tr>' + cols.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') + '<th style="width:60px"></th></tr>';
      var html = rows.map(function (r) {
        var cells = cols.map(function (c) {
          var out = c.render ? c.render(r) : val(r[c.key]);
          return '<td>' + out + '</td>';
        }).join('');
        return '<tr data-id="' + esc(rowId(state.entity, r)) + '" style="cursor:pointer">' + cells +
          '<td><button class="icon-btn" data-open aria-label="Detail"><span class="material-symbols-outlined">open_in_new</span></button></td></tr>';
      }).join('');

      body.innerHTML =
        '<div class="card" style="padding:0;overflow:auto"><table class="table"><thead>' + head + '</thead><tbody>' + html + '</tbody></table></div>' +
        renderPager(d.total || 0) +
        '<div class="tiny muted" style="margin-top:8px">' +
          'total=' + (d.total || 0) + ' dari server' +
          (state.entity.id === 'audit' && typeof d.scanned === 'number' ? ' · ' + d.scanned + ' event dibaca untuk verdict integritas' : '') +
        '</div>';

      Array.prototype.forEach.call(body.querySelectorAll('tbody tr'), function (tr) {
        var id = tr.getAttribute('data-id');
        var row = rows.filter(function (r) { return String(rowId(state.entity, r)) === id; })[0];
        if (!row) return;
        tr.addEventListener('click', function () { openDetail(state.entity, row); });
      });
    }

    function load() {
      state.loading = true;
      state.error = null;
      paint();

      var args = { limit: PAGE_SIZE, offset: state.offset };
      if (state.q) args.q = state.q;

      D.api.call(state.entity.tool, args).then(function (d) {
        state.data = {
          rows: d[state.entity.key] || [],
          total: typeof d.total === 'number' ? d.total : (d[state.entity.key] || []).length,
          scanned: d.scanned
        };
        state.loading = false;
        paint();
      }).catch(function (e) {
        state.loading = false;
        state.error = 'Gagal memuat ' + state.entity.label + ': ' + e.message;
        paint();
      });
    }

    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = input.value.trim();
        state.offset = 0;
        load();
      }, 300);
    });

    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-entity]');
      if (!btn) return;
      state.entity = entityById(btn.getAttribute('data-entity'));
      state.offset = 0;
      input.setAttribute('placeholder', 'Cari di ' + state.entity.label + '…');
      Array.prototype.forEach.call(tabs.querySelectorAll('[data-entity]'), function (b) {
        var active = b.getAttribute('data-entity') === state.entity.id;
        b.className = 'btn ' + (active ? 'btn--primary' : 'btn--ghost') + ' btn--sm';
      });
      load();
    });

    body.addEventListener('click', function (e) {
      var pager = e.target.closest('[data-page]');
      if (!pager || pager.disabled) return;
      if (pager.getAttribute('data-page') === 'prev') {
        state.offset = Math.max(0, state.offset - PAGE_SIZE);
      } else {
        state.offset = state.offset + PAGE_SIZE;
      }
      load();
    });

    load();

    /* Alasan entitas lain tidak ada di sini, ditulis di halaman. */
    var note = document.createElement('div');
    note.className = 'tiny muted';
    note.style.marginTop = '14px';
    note.textContent = 'Approval dan Worker tidak dapat dicari di sini: server tidak punya tool baca berpaginasi untuk keduanya, dan menyaring snapshot dashboard lalu menyebutnya pencarian akan menyesatkan.';
    shell.appendChild(note);
  };
})();
