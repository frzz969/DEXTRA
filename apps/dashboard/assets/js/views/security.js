/* View — Security Center.
 *
 * Every number here is derived from records the server already wrote: audit
 * events, execution results, and mandate expiry. Nothing is scored, predicted,
 * or rated. There is no "threat level" dial, because DEXTRA has no sensor that
 * would justify one.
 *
 * It is also not real-time, and the page says so. The dashboard refreshes on
 * load and after each mutation; calling that "real-time monitoring" would be a
 * claim about a subsystem that does not exist.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  /* Event types that represent a refusal or a caught attack. Taken from the
   * audit contract; anything not listed is not counted as a security event. */
  var DENIAL_TYPES = ['mandate_rejected', 'action_blocked', 'plan_blocked', 'approval_rejected'];
  var QUARANTINE_TYPES = ['injection_quarantined'];
  var WINDOWS = [
    { value: '24h', label: '24 jam terakhir' },
    { value: '7d', label: '7 hari terakhir' },
    { value: 'all', label: 'Semua' }
  ];

  function isDenial(type) { return DENIAL_TYPES.indexOf(type) >= 0; }
  function isQuarantine(type) { return QUARANTINE_TYPES.indexOf(type) >= 0; }
  function isSecurityEvent(type) { return isDenial(type) || isQuarantine(type); }

  function cutoffFor(windowKey) {
    if (windowKey === 'all') return null;
    var hours = windowKey === '24h' ? 24 : 24 * 7;
    return Date.now() - hours * 3600 * 1000;
  }

  D.views.security = function (root) {
    var filter = { window: '7d', type: 'all', q: '' };

    function eventsInWindow() {
      var cutoff = cutoffFor(filter.window);
      return store.audit.filter(function (e) {
        if (cutoff !== null && Date.parse(e.at) < cutoff) return false;
        return true;
      });
    }

    function denials() { return eventsInWindow().filter(function (e) { return isDenial(e.type); }); }
    function quarantined() { return eventsInWindow().filter(function (e) { return isQuarantine(e.type); }); }

    /* A mandate is expired when the clock says so. The stored `status` lags
     * behind the clock, so it cannot be trusted alone — an "active" mandate
     * past its expiry is exactly the case an operator needs to see. */
    function expiredMandates() {
      var now = Date.now();
      return store.mandates.filter(function (m) {
        if (!m.expires_at) return false;
        if (m.status === 'revoked' || m.status === 'consumed') return false;
        return Date.parse(m.expires_at) < now;
      });
    }
    function expiringSoon() {
      var now = Date.now();
      return store.mandates.filter(function (m) {
        if (!m.expires_at || m.status !== 'active') return false;
        var t = Date.parse(m.expires_at);
        return t >= now && t - now < 24 * 3600 * 1000;
      });
    }

    function failedExecutions() {
      return store.executions.filter(function (e) { return e.result === 'failed'; });
    }

    var integrity = store.auditIntegrity;

    function integrityCard() {
      if (!integrity) {
        return ui.card({
          title: 'Integritas audit',
          desc: 'Server belum mengirim hasil pemeriksaan rantai hash.',
          body: '<div class="banner banner--info"><span class="material-symbols-outlined">help</span><div>Tidak ada verdict, jadi tidak ada klaim. Halaman ini tidak memverifikasi sendiri dari sebagian data.</div></div>'
        });
      }
      var tone = integrity.ok ? 'success' : 'danger';
      var icon = integrity.ok ? 'verified_user' : 'gpp_bad';
      var headline = integrity.ok
        ? 'Rantai utuh pada ' + integrity.verified + ' event'
        : 'Rantai terputus pada ' + esc(integrity.broken_at || '?');

      return ui.card({
        title: 'Integritas audit',
        desc: 'Setiap event menandatangani event sebelumnya. Menyunting satu baris memutus rantai setelahnya.',
        body: '<div class="banner banner--' + tone + '"><span class="material-symbols-outlined">' + icon + '</span><div>' +
            '<b>' + headline + '</b><br>' +
            (integrity.ok
              ? 'Tidak ada baris yang berubah sejak ditulis.'
              : 'Event pada indeks ' + integrity.broken_index + ' tidak cocok dengan hash pendahulunya. Isi berkas audit kemungkinan disunting atau dihapus.') +
          '</div></div>' +
          '<dl class="def-list" style="margin-top:12px">' +
            '<dt>Event terverifikasi</dt><dd>' + integrity.verified + '</dd>' +
            '<dt>Event lama tanpa hash</dt><dd>' + integrity.unchained + (integrity.unchained ? ' <span class="tiny muted">(ditulis sebelum rantai ada — tidak terverifikasi, bukan berarti rusak)</span>' : '') + '</dd>' +
            '<dt>Status</dt><dd>' + (integrity.ok ? '<span class="badge badge--success">utuh</span>' : '<span class="badge badge--danger">terputus</span>') + '</dd>' +
          '</dl>',
        foot: '<span class="tiny muted">Diperiksa server atas seluruh isi log, bukan hanya halaman ini.</span>'
      });
    }

    function rows() {
      var cutoff = cutoffFor(filter.window);
      return store.audit.filter(function (e) {
        if (cutoff !== null && Date.parse(e.at) < cutoff) return false;
        if (filter.type === 'denial' && !isDenial(e.type)) return false;
        if (filter.type === 'quarantine' && !isQuarantine(e.type)) return false;
        if (filter.type === 'integrity' && e.type !== 'audit_integrity_checked') return false;
        if (filter.q) {
          var hay = [e.type, e.actor, e.plan_id, e.mandate_id, e.action_id, e.reason_code, U.detailText(e.detail)].join(' ').toLowerCase();
          if (hay.indexOf(filter.q.toLowerCase()) < 0) return false;
        }
        return true;
      }).slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    }

    var d = denials();
    var q = quarantined();
    var expired = expiredMandates();
    var soon = expiringSoon();
    var failed = failedExecutions();

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Governance · Security',
        title: 'Security Center',
        desc: 'Penolakan, karantina, mandat kedaluwarsa, dan integritas rekaman. Semua angka berasal dari event yang sudah tercatat — tidak ada skor risiko yang dihitung di sini.',
        actions: '<a class="btn btn--secondary" href="#/audit"><span class="material-symbols-outlined">receipt_long</span>Audit trail</a>'
      }) +
      '<div class="banner banner--info" style="margin-bottom:16px"><span class="material-symbols-outlined">info</span><div>' +
        '<b>Bukan pemantauan real-time.</b> Halaman ini membaca ulang data saat dimuat dan setelah setiap tindakan yang mengubah data. ' +
        'Tidak ada sensor yang menunggu kejadian di latar belakang, jadi jangan menganggapnya sebagai peringatan langsung.' +
      '</div></div>' +

      '<div class="grid grid--4" style="margin-bottom:16px">' +
        ui.kpi({
          label: 'Penolakan', value: String(d.length), icon: 'block',
          tone: d.length ? 'warning' : '',
          foot: '<span class="tiny muted">' + esc(WINDOWS.filter(function (w) { return w.value === filter.window; })[0].label.toLowerCase()) + '</span>'
        }) +
        ui.kpi({
          label: 'Mandat kedaluwarsa', value: String(expired.length), icon: 'timer_off',
          tone: expired.length ? 'danger' : 'success',
          foot: '<span class="tiny muted">' + soon.length + ' lagi kedaluwarsa < 24 jam</span>'
        }) +
        ui.kpi({
          label: 'Eksekusi gagal', value: String(failed.length), icon: 'error',
          tone: failed.length ? 'warning' : '',
          foot: '<span class="tiny muted">dari ' + store.executions.length + ' rekaman</span>'
        }) +
        ui.kpi({
          label: 'Karantina', value: String(q.length), icon: 'shield',
          tone: q.length ? 'warning' : '',
          foot: '<span class="tiny muted">input yang ditahan policy</span>'
        }) +
      '</div>' +

      '<div class="grid grid--2" style="gap:16px;margin-bottom:16px">' +
        integrityCard() +
        ui.card({
          title: 'Mandat yang perlu perhatian',
          desc: 'Kedaluwarsa dihitung dari jam sekarang, bukan dari kolom status yang tertinggal.',
          body: (expired.length || soon.length)
            ? '<dl class="def-list">' +
                expired.slice(0, 5).map(function (m) {
                  return '<dt class="mono tiny">' + esc(m.mandate_id) + '</dt><dd><span class="badge badge--danger">kedaluwarsa</span> ' +
                    '<span class="tiny muted">' + esc(m.plan_id || '—') + ' · ' + esc(U.fmtDate(m.expires_at)) + '</span></dd>';
                }).join('') +
                soon.slice(0, 5).map(function (m) {
                  return '<dt class="mono tiny">' + esc(m.mandate_id) + '</dt><dd><span class="badge badge--warning">segera</span> ' +
                    '<span class="tiny muted">' + esc(m.plan_id || '—') + ' · ' + esc(U.fmtDate(m.expires_at)) + '</span></dd>';
                }).join('') +
              '</dl>'
            : ui.empty({ icon: 'task_alt', title: 'Tidak ada mandat kedaluwarsa', body: 'Semua mandat aktif masih dalam masa berlaku.' })
        }) +
      '</div>' +

      '<div class="card"><div class="card__head" style="flex-wrap:wrap;gap:8px">' +
        '<div class="input-wrap" style="flex:1 1 220px;max-width:300px"><span class="material-symbols-outlined">search</span>' +
          '<input class="input input--icon" id="q" placeholder="Cari aktor, plan, reason code…" style="height:32px"></div>' +
        ui.select('window', WINDOWS, filter.window, 'style="width:auto;height:32px;font-size:12px"') +
        ui.select('type', [
          { value: 'all', label: 'Semua event' },
          { value: 'denial', label: 'Penolakan saja' },
          { value: 'quarantine', label: 'Karantina saja' },
          { value: 'integrity', label: 'Pemeriksaan integritas' }
        ], 'all', 'style="width:auto;height:32px;font-size:12px"') +
        '<div class="spacer"></div>' +
        '<span class="badge badge--outline"><span class="material-symbols-outlined" style="font-size:13px">lock</span>Dari audit log</span>' +
      '</div><div id="host"></div></div>';

    var host = root.querySelector('#host');

    function paint() {
      host.innerHTML = '';
      host.appendChild(ui.table({
        columns: [
          { key: 'at', label: 'Waktu', width: '150px', render: function (e) { return '<span class="tiny muted">' + U.fmtDate(e.at) + '</span>'; } },
          { key: 'type', label: 'Event', width: '190px', render: function (e) {
            var tone = isQuarantine(e.type) ? 'warning' : (isDenial(e.type) ? 'danger' : '');
            return '<span class="badge badge--' + tone + '">' + esc(e.type.replace(/_/g, ' ')) + '</span>';
          }},
          { key: 'actor', label: 'Aktor', width: '140px', render: function (e) { return '<span class="small">' + esc(U.actorName(e.actor)) + '</span>'; } },
          { key: 'subject', label: 'Subjek', width: '170px', render: function (e) {
            var s = e.plan_id || e.mandate_id || '—';
            return '<span class="mono tiny">' + esc(s) + '</span>';
          }},
          { key: 'reason_code', label: 'Reason code', width: '160px', render: function (e) {
            return e.reason_code ? '<span class="badge badge--danger">' + esc(e.reason_code) + '</span>' : '<span class="faint tiny">—</span>';
          }},
          { key: 'detail', label: 'Detail', render: function (e) {
            return '<span class="tiny muted truncate" style="display:block;max-width:240px">' + esc(U.detailText(e.detail) || '—') + '</span>';
          }}
        ],
        rows: rows(), pageSize: 12,
        onRowClick: function (e) {
          ui.drawer({
            eyebrow: 'Security event', title: e.type.replace(/_/g, ' '), subtitle: U.fmtDate(e.at),
            body: '<dl class="def-list">' +
              '<dt>Aktor</dt><dd>' + esc(U.actorName(e.actor)) + '</dd>' +
              '<dt>Work package</dt><dd class="mono">' + esc(e.plan_id || '—') + '</dd>' +
              '<dt>Mandat</dt><dd class="mono">' + esc(e.mandate_id || '—') + '</dd>' +
              '<dt>Tindakan</dt><dd class="mono">' + esc(e.action_id || '—') + '</dd>' +
              '<dt>Reason code</dt><dd>' + (e.reason_code ? '<span class="badge badge--danger">' + esc(e.reason_code) + '</span>' : '—') + '</dd>' +
              '<dt>Detail</dt><dd>' + esc(U.detailText(e.detail) || '—') + '</dd>' +
              '<dt>Event ID</dt><dd class="mono tiny">' + esc(e.event_id || '—') + '</dd>' +
              '<dt>Hash</dt><dd class="mono tiny">' + esc(e.hash ? e.hash.slice(0, 16) + '…' : 'tanpa hash (event lama)') + '</dd>' +
            '</dl>' +
            (e.plan_id ? '<div style="margin-top:14px"><a class="btn btn--secondary btn--sm" href="#/work-packages/' + esc(e.plan_id) + '">Buka work package</a></div>' : ''),
            footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button>'
          });
        },
        empty: ui.empty({ icon: 'verified_user', title: 'Tidak ada event keamanan', body: 'Tidak ada penolakan atau karantina pada rentang ini.' })
      }));
    }

    root.querySelector('#q').addEventListener('input', U.debounce(function (e) { filter.q = e.target.value; paint(); }, 180));
    root.querySelector('#type').addEventListener('change', function (e) { filter.type = e.target.value; paint(); });
    root.querySelector('#window').addEventListener('change', function (e) {
      filter.window = e.target.value;
      D.router.render();
    });
    paint();
  };
})();
