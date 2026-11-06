/* View — Akun & Keamanan (P8 Human Authentication).
 *
 * Endpoint P8 ada di backend v2: router auth (backend/dextra/modules/auth/router.py,
 * didaftarkan di backend/dextra/main.py:67) — POST /api/v1/auth/login, /logout,
 * /mfa/*, /password, /sessions/*. Jembatan enterprise/api.js probe-aware: live
 * bila GET /api/v1/auth/session berhasil, demo (fixture in-memory berlabel DEMO)
 * bila backend tak tercapai. Mutasi demo hanya berlaku pada tab ini dan tidak
 * pernah diklaim tercatat di server.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  var api = window.DEXTRA_ENTERPRISE_API.create({});

  function demoChip() { return '<span class="badge badge--outline ent-demo-chip">DEMO</span>'; }
  function liveChip() { return '<span class="badge badge--success ent-live-chip">LIVE</span>'; }
  function modeChip() { return (api.isLive ? api.isLive() : false) ? liveChip() : demoChip(); }

  function sessionRows(sessions) {
    return sessions.map(function (s) {
      return '<tr>' +
        '<td><div class="small strong">' + esc(s.device) + '</div>' +
          '<div class="tiny muted">' + esc(s.browser) + ' · ' + esc(s.os) + '</div></td>' +
        '<td class="mono tiny">' + esc(s.ip) + '</td>' +
        '<td class="small">' + esc(U.fmtDate(s.lastSeenAt)) + '</td>' +
        '<td>' + (s.current ? '<span class="badge badge--success"><span class="dot"></span>Sesi ini</span>' : demoChip()) + '</td>' +
        '<td class="num">' + (s.current
          ? '<span class="tiny faint">tidak bisa dicabut</span>'
          : '<button class="btn btn--danger-soft btn--sm" data-revoke-session="' + esc(s.id) + '"><span class="material-symbols-outlined">logout</span>Cabut</button>') + '</td>' +
      '</tr>';
    }).join('');
  }

  D.views.account = function (root) {
    var state = {
      tab: 'sesi',
      snapshot: null,
      loading: true,
      error: null,
      pending: false
    };

    function load() {
      state.loading = true; state.error = null; paint();
      api.getAuthSnapshot().then(function (snap) {
        state.snapshot = snap; state.loading = false; paint();
      }).catch(function (err) {
        state.error = (err && err.message) || 'Gagal memuat data akun (demo).';
        state.loading = false; paint();
      });
    }

    function setTab(tab) { state.tab = tab; paint(); }

    /* JANGAN klaim endpoint mati untuk demo: di live, konfirmasi ini memanggil
   * backend nyata (POST /auth/sessions/{id}/revoke). Mode tampil memakai
   * api.isLive(). "Demo lokal" di body hanya benar di mode demo. */
    function confirmRevoke(id, label) {
      var live = api.isLive && api.isLive();
      ui.confirm({
        title: 'Cabut sesi?',
        subtitle: live ? 'Tercatat di backend' : 'Demo lokal — tidak tercatat di backend',
        body: live
          ? 'Sesi <b>' + esc(label) + '</b> akan dicabut di server (' + esc('/api/v1/auth/sessions/' + id + '/revoke') + ').'
          : 'Sesi <b>' + esc(label) + '</b> akan dihapus dari daftar demo di tab ini.',
        confirmLabel: live ? 'Cabut sesi' : 'Cabut sesi (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.revokeSession(id).then(function (r) {
          state.pending = false;
          ui.toast(r.message + (r.revoked ? (live ? ' — sesi dicabut di server.' : ' — sesi dihapus dari daftar demo.') : ' — sesi tidak ditemukan.'), live ? 'success' : 'warning');
          load();
        }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal mencabut sesi.', 'error'); paint(); });
      });
    }

    function confirmRevokeOthers() {
      var live = api.isLive && api.isLive();
      ui.confirm({
        title: 'Cabut semua sesi lain?',
        subtitle: live ? 'Tercatat di backend' : 'Demo lokal — tidak tercatat di backend',
        body: live
          ? 'Semua sesi selain sesi ini akan dicabut di server (satu per satu via POST /auth/sessions/{id}/revoke).'
          : 'Semua sesi selain sesi ini akan dihapus dari daftar demo.',
        confirmLabel: live ? 'Cabut lainnya' : 'Cabut lainnya (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        state.pending = true; paint();
        api.revokeOtherSessions().then(function (r) {
          state.pending = false;
          ui.toast(r.message + ' — ' + r.revokedCount + ' sesi lain dihapus dari daftar demo.', 'warning');
          load();
        }).catch(function (err) { state.pending = false; ui.toast(err.message || 'Gagal mencabut sesi.', 'error'); paint(); });
      });
    }

    function openMfaEnroll() {
      ui.modal({
        title: 'Daftarkan ulang MFA',
        subtitle: 'Demo lokal — bukan pendaftaran sungguhan',
        body:
          '<div class="ent-warning-card" style="margin-bottom:12px"><span class="material-symbols-outlined">science</span>' +
            '<div>Ini contoh tampilan. Kode QR / otpauth URL di bawah <b>tidak valid</b> dan tidak bisa dipakai dengan aplikasi authenticator mana pun.</div></div>' +
          '<div class="field"><label class="field__label" for="ent-otpauth">otpauth URL (DEMO)</label>' +
            '<input class="input mono" id="ent-otpauth" readonly value="otpauth://totp/DEXTRA-DEMO:maya.lestari%40kenari.co.id?secret=DEMO-BUKAN-SECRET-ASLI&issuer=DEXTRA-DEMO"></div>' +
          '<div class="row" style="margin-top:10px;gap:8px"><button class="btn btn--secondary btn--sm" id="ent-copy-otpauth"><span class="material-symbols-outlined">content_copy</span>Salin string DEMO</button></div>',
        footer: '<button class="btn btn--secondary" data-dismiss>Tutup</button><button class="btn btn--primary" id="ent-mfa-confirm">Tandai terdaftar (demo)</button>',
        onMount: function (node, ov) {
          node.querySelector('#ent-copy-otpauth').addEventListener('click', function () {
            var v = node.querySelector('#ent-otpauth').value;
            copyText(v, 'String DEMO tersalin (mengandung “DEMO”, bukan rahasia asli).');
          });
          node.querySelector('#ent-mfa-confirm').addEventListener('click', function () {
            api.enrollMfa().then(function () {
              ui.toast('Demo lokal — tidak tercatat di backend. Status MFA pada tab ini diubah.', 'warning');
              ov.close(); load();
            });
          });
        }
      });
    }

    function confirmDisableMfa() {
      ui.confirm({
        title: 'Nonaktifkan MFA?',
        subtitle: 'Demo lokal — tidak tercatat di backend',
        body: 'MFA pada akun demo ini akan ditandai nonaktif di tab ini. Di produksi, penonaktifan menunggu endpoint <span class="mono">POST /api/v1/auth/mfa/disable</span> yang belum tersedia.',
        confirmLabel: 'Nonaktifkan (demo)',
        tone: 'danger'
      }).then(function (res) {
        if (!res.ok) return;
        api.disableMfa().then(function (r) {
          ui.toast(r.message + ' — MFA ditandai nonaktif (demo).', 'warning');
          load();
        });
      });
    }

    function copyText(text, okMsg) {
      var done = function () { ui.toast(okMsg, 'success'); };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { ui.toast('Gagal menyalin ke papan klip.', 'error'); }
        ta.remove();
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    }

    function paintPasswordForm(container) {
      container.innerHTML =
        '<form id="ent-pass-form" class="stack" style="gap:12px;max-width:520px" novalidate>' +
          '<div class="field"><label class="field__label" for="ent-cur">Kata sandi saat ini<span class="req">*</span></label>' +
            '<input class="input" id="ent-cur" type="password" autocomplete="current-password" required></div>' +
          '<div class="field"><label class="field__label" for="ent-new">Kata sandi baru<span class="req">*</span></label>' +
            '<input class="input" id="ent-new" type="password" autocomplete="new-password" required>' +
            '<div class="field__hint">Minimal 12 karakter, kombinasi huruf besar, huruf kecil, dan angka.</div></div>' +
          '<div class="field"><label class="field__label" for="ent-confirm">Ulangi kata sandi baru<span class="req">*</span></label>' +
            '<input class="input" id="ent-confirm" type="password" autocomplete="new-password" required></div>' +
          '<div id="ent-pass-result" aria-live="polite"></div>' +
          '<div class="row" style="gap:8px"><button type="submit" class="btn btn--primary" id="ent-pass-submit"><span class="material-symbols-outlined">lock_reset</span>Validasi lokal</button></div>' +
          '<p class="tiny faint" style="line-height:1.5">Tombol ini memanggil backend nyata (POST /api/v1/auth/password) saat mode live. Di mode demo, hanya validasi lokal.</p>' +
        '</form>';
      var form = container.querySelector('#ent-pass-form');
      var result = container.querySelector('#ent-pass-result');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var cur = container.querySelector('#ent-cur').value;
        var next = container.querySelector('#ent-new').value;
        var conf = container.querySelector('#ent-confirm').value;
        result.innerHTML = '';
        if (next !== conf) {
          result.innerHTML = '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div>Konfirmasi kata sandi tidak cocok.</div></div>';
          return;
        }
        var btn = container.querySelector('#ent-pass-submit');
        btn.disabled = true; btn.classList.add('is-loading');
        api.changePassword({ current: cur, next: next }).then(function () {
          btn.disabled = false; btn.classList.remove('is-loading');
          result.innerHTML = '<div class="banner banner--success"><span class="material-symbols-outlined">check_circle</span><div><b>Validasi lokal lulus.</b> Tidak mengubah backend — kata sandi server tidak tersentuh.</div></div>';
          form.querySelectorAll('input[type=password]').forEach(function (i) { i.value = ''; });
        }).catch(function (err) {
          btn.disabled = false; btn.classList.remove('is-loading');
          var msg = (err && err.problems && err.problems.length) ? err.problems.join(' ') : (err.message || 'Validasi gagal.');
          result.innerHTML = '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div>' + esc(msg) + '</div></div>';
        });
      });
    }

    function paint() {
      if (state.loading) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Akun · P8', title: 'Akun & Keamanan', desc: 'Memuat data demo…' }) + ui.skeletonTable(4, 5);
        return;
      }
      if (state.error) {
        root.innerHTML = ui.pageHead({ eyebrow: 'Akun · P8', title: 'Akun & Keamanan' }) + ui.errorState(state.error, 'Muat ulang');
        var retry = root.querySelector('[data-retry]');
        if (retry) retry.addEventListener('click', load);
        return;
      }
      var snap = state.snapshot;
      var u = snap.user, mfa = snap.mfa;

      var tabs = [
        ['sesi', 'Sesi aktif'],
        ['mfa', 'MFA'],
        ['password', 'Password'],
        ['aktivitas', 'Aktivitas login']
      ];

      var head = ui.pageHead({
        eyebrow: 'Akun · P8 Human Authentication',
        title: 'Akun & Keamanan',
        desc: 'Identitas, sesi, dan kredensial. Mode ditentukan probe: ' + (api.isLive && api.isLive() ? 'LIVE dari backend (/api/v1/auth).' : 'DEMO — backend tak tercapai.'),
        actions: modeChip()
      });

      var live = !!api.isLive && api.isLive();
      var banner = live ? '<div class="banner banner--success ent-banner"><span class="material-symbols-outlined">cloud_done</span>' +
        '<div><b>Data live.</b> Identitas, sesi, dan MFA dari backend (<span class="mono">/api/v1/auth</span>). ' +
        'Mutasi tercatat di server.</div></div>'
      : '<div class="banner banner--demo ent-banner"><span class="material-symbols-outlined">science</span>' +
        '<div><b>Data demo.</b> Backend tak tercapai saat probe. Nama, email, sesi, dan aktivitas di bawah adalah fixture. ' +
        'Mutasi hanya berlaku pada tab ini dan tidak tercatat di mana pun.</div></div>';

      var summary = ui.card({
        title: 'Maya Lestari ' + demoChip(),
        desc: 'Kenari Group (org_kenari) · Governance Lead — identitas contoh, bukan akun terautentikasi',
        body:
          '<dl class="ent-kv">' +
            '<dt>Email (DEMO)</dt><dd class="mono">' + esc(u.email) + '</dd>' +
            '<dt>Peran</dt><dd>' + esc(u.roleLabel) + '</dd>' +
            '<dt>MFA</dt><dd>' + (mfa.verified ? '<span class="badge badge--success">Terverifikasi (DEMO)</span>' : '<span class="badge badge--warning">Belum terverifikasi</span>') + '</dd>' +
            '<dt>Password diganti</dt><dd>' + esc(U.fmtDate(u.passwordChangedAt)) + '</dd>' +
          '</dl>'
      });

      var tabBar = '<div class="segmented ent-tabs" role="tablist" aria-label="Bagian akun">' +
        tabs.map(function (t) {
          return '<button role="tab" aria-selected="' + (state.tab === t[0] ? 'true' : 'false') + '" class="' + (state.tab === t[0] ? 'is-active' : '') + '" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>';
        }).join('') + '</div>';

      var panel = '';
      if (state.tab === 'sesi') {
        panel = ui.card({
          title: 'Sesi aktif ' + demoChip(),
          desc: 'Perangkat yang terdaftar pada akun demo ini.',
          flush: true,
          body:
            '<div class="table-wrap"><table class="table"><thead><tr><th>Perangkat</th><th>IP</th><th>Terakhir aktif</th><th>Status</th><th class="num">Aksi</th></tr></thead><tbody>' +
              sessionRows(snap.sessions) +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">Pencabutan hanya mengubah daftar di tab ini. Tidak ada sesi nyata yang dicabut.</div>',
          foot: '<button class="btn btn--danger-soft" id="ent-revoke-others" ' + (state.pending ? 'disabled' : '') + '><span class="material-symbols-outlined">no_accounts</span>Cabut semua sesi lain (demo)</button>'
        });
      } else if (state.tab === 'mfa') {
        panel = ui.card({
          title: 'Multi-factor authentication ' + demoChip(),
          body:
            '<div class="stack" style="gap:12px">' +
              '<div class="ent-status-line"><span class="material-symbols-outlined" style="color:var(--success-600)">verified_user</span><span><b>Terverifikasi (DEMO)</b> — metode TOTP, didaftarkan ' + esc(U.fmtDay(mfa.enrolledAt)) + '.</span></div>' +
              '<div class="ent-warning-card"><span class="material-symbols-outlined">info</span><div>Secret asli tidak pernah ditampilkan di sini. Contoh otpauth hanya berisi penanda <span class="mono">DEMO</span> dan tidak valid.</div></div>' +
              '<div class="btn-group"><button class="btn btn--secondary" id="ent-mfa-reenroll"><span class="material-symbols-outlined">qr_code_2</span>Daftarkan ulang</button>' +
              '<button class="btn btn--danger-soft" id="ent-mfa-disable"><span class="material-symbols-outlined">gpp_bad</span>Nonaktifkan</button></div>' +
            '</div>'
        });
      } else if (state.tab === 'password') {
        panel = ui.card({ title: 'Ganti kata sandi ' + demoChip(), body: '<div id="ent-pass-host"></div>' });
      } else if (state.tab === 'aktivitas') {
        panel = ui.card({
          title: 'Aktivitas login ' + demoChip(),
          flush: true,
          body:
            '<div class="table-wrap"><table class="table"><thead><tr><th>Waktu</th><th>Kejadian</th><th>Perangkat</th><th>IP</th><th>Hasil</th></tr></thead><tbody>' +
              snap.loginActivity.map(function (a) {
                return '<tr><td class="small">' + esc(U.fmtDate(a.at)) + '</td><td class="small">' + esc(a.event) + '</td><td class="small">' + esc(a.device) + '</td><td class="mono tiny">' + esc(a.ip) + '</td>' +
                  '<td>' + (a.result === 'success' ? '<span class="badge badge--success">Berhasil</span>' : '<span class="badge badge--danger">Gagal</span>') + '</td></tr>';
              }).join('') +
            '</tbody></table></div>' +
            '<div class="ent-empty-hint">Daftar contoh — backend P8 belum mencatat aktivitas login.</div>'
        });
      }

      root.innerHTML = head + banner + '<div class="ent-panel">' + summary + tabBar + '<div id="ent-tab-panel">' + panel + '</div></div>';

      root.querySelectorAll('[data-tab]').forEach(function (b) {
        b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
      });
      root.querySelectorAll('[data-revoke-session]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-revoke-session');
          var s = (state.snapshot.sessions || []).filter(function (x) { return x.id === id; })[0];
          confirmRevoke(id, s ? s.device : id);
        });
      });
      var others = root.querySelector('#ent-revoke-others');
      if (others) others.addEventListener('click', confirmRevokeOthers);
      var reenroll = root.querySelector('#ent-mfa-reenroll');
      if (reenroll) reenroll.addEventListener('click', openMfaEnroll);
      var disable = root.querySelector('#ent-mfa-disable');
      if (disable) disable.addEventListener('click', confirmDisableMfa);
      var passHost = root.querySelector('#ent-pass-host');
      if (passHost) paintPasswordForm(passHost);
    }

    load();
  };
})();
