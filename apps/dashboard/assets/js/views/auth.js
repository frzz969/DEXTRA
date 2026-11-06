/* Views — Login, forbidden, not found.
 *
 * Login memakai backend LIVE POST /api/v1/auth/login via D.api.rest
 * (cookie + CSRF, api-client.js auth.login). Label "DEMO"/fallback hanya
 * bila backend tak tercapai. Google: GET /api/v1/auth/google — bila 503
 * (belum dikonfigurasi) ditampilkan sebagai unavailable jujur, bukan tombol
 * palsu. Facebook tidak ada endpoint-nya dan tidak ditampilkan.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  D.views.login = function (root) {
    root.innerHTML =
      '<div class="auth auth--login">' +
        '<div class="auth__card">' +
          '<section class="auth__brand">' +
            '<div class="auth__brandtop"><div class="brand-mark" style="width:38px;height:38px;font-size:19px">D</div>' +
              '<div class="brand-text"><b style="color:#fff">DEXTRA</b><span style="color:rgba(255,255,255,.62)">Governed AI Workforce</span></div></div>' +
            '<div class="auth__pitch">' +
              '<h1>Simplify management with our dashboard</h1>' +
              '<p>Specialized AI workers, human-defined authority, accountable execution — setiap tindakan tulis melewati mandat dan tercatat.</p>' +
            '</div>' +
            '<div class="auth__hero">' +
              '<svg viewBox="0 0 340 180" role="img" aria-label="Ilustrasi agen AI di meja kerja" xmlns="http://www.w3.org/2000/svg">' +
                '<defs><linearGradient id="desk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#ffffff" stop-opacity=".04"/></linearGradient></defs>' +
                '<rect x="52" y="96" width="236" height="10" rx="5" fill="url(#desk)"/>' +
                '<rect x="66" y="106" width="10" height="54" rx="4" fill="rgba(255,255,255,.22)"/>' +
                '<rect x="264" y="106" width="10" height="54" rx="4" fill="rgba(255,255,255,.22)"/>' +
                '<rect x="80" y="58" width="76" height="52" rx="8" fill="rgba(21,21,42,.55)"/>' +
                '<rect x="88" y="66" width="60" height="34" rx="4" fill="rgba(255,255,255,.28)"/>' +
                '<rect x="112" y="110" width="12" height="10" fill="rgba(255,255,255,.3)"/>' +
                '<rect x="168" y="66" width="66" height="44" rx="6" fill="rgba(255,255,255,.14)" stroke="rgba(255,255,255,.35)"/>' +
                '<circle cx="201" cy="88" r="10" fill="rgba(255,255,255,.4)"/>' +
                '<circle cx="238" cy="60" r="16" fill="#ffd9a8"/>' +
                '<path d="M222 44 a16 16 0 0 1 32 0 l-4 6 h-24 z" fill="#8a5a2b"/>' +
                '<rect x="218" y="80" width="40" height="16" rx="6" fill="#ffffff"/>' +
                '<rect x="228" y="96" width="20" height="26" rx="4" fill="#5b3fd6"/>' +
                '<circle cx="170" cy="130" r="10" fill="none" stroke="rgba(255,255,255,.5)" stroke-width="3"/>' +
                '<text x="36" y="40" fill="rgba(255,255,255,.85)" font-family="system-ui" font-size="16" font-weight="700">AI</text>' +
                '<text x="36" y="60" fill="rgba(255,255,255,.6)" font-family="system-ui" font-size="11">mandate</text>' +
                '<text x="36" y="76" fill="rgba(255,255,255,.6)" font-family="system-ui" font-size="11">approval</text>' +
              '</svg>' +
              '<div class="auth__principles auth__principles--card">' +
                [['verified_user', 'Mandat eksplisit'], ['receipt_long', 'Audit append-only'], ['lock', 'Tanpa jalur agen ke executor']].map(function (p) {
                  return '<span class="chip"><span class="material-symbols-outlined">' + p[0] + '</span>' + esc(p[1]) + '</span>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div class="auth__foot">Instans lokal · 127.0.0.1 · Asia/Jakarta</div>' +
          '</section>' +
          '<section class="auth__form">' +
            '<div class="auth__forminner">' +
              '<div class="auth__logo"><span class="brand-mark">D</span><b>DEXTRA</b></div>' +
              '<h1 class="auth__title">Selamat datang kembali</h1>' +
              '<p class="auth__sub">Masuk untuk melanjutkan ke workspace</p>' +
              '<div id="login-error" aria-live="polite"></div>' +
              '<div class="field" style="margin-bottom:12px">' +
                '<label class="field__label" for="human-email">Email</label>' +
                '<input class="input" id="human-email" type="email" placeholder="nama@perusahaan.co.id" autocomplete="username"></div>' +
              '<div class="field" style="margin-bottom:4px">' +
                '<label class="field__label" for="human-password">Password</label>' +
                '<div class="input-wrap"><span class="material-symbols-outlined">lock</span>' +
                  '<input class="input input--icon" id="human-password" type="password" placeholder="••••••••" autocomplete="current-password">' +
                  '<button type="button" class="icon-btn" id="toggle-pass" aria-label="Tampilkan password" style="position:absolute;right:8px;top:50%;transform:translateY(-50%)"><span class="material-symbols-outlined" style="font-size:18px">visibility_off</span></button></div></div>' +
              '<div class="auth__forgot"><a href="#/login" id="forgot">Lupa password?</a></div>' +
              '<div id="human-error" aria-live="polite"></div>' +
              '<button class="btn btn--primary btn--lg btn--block" id="signin" style="height:46px;border-radius:10px">Masuk</button>' +
              '<div class="auth__divider"><span>atau masuk dengan</span></div>' +
              '<div class="auth__social">' +
                '<button class="btn btn--secondary" id="google" disabled title="Belum dikonfigurasi di backend (503)"><span class="material-symbols-outlined" style="font-size:18px;color:#ea4335">login</span>Google</button>' +
                '<button class="btn btn--secondary" id="demo"><span class="material-symbols-outlined" style="font-size:18px">science</span>Demo</button>' +
              '</div>' +
              '<details class="auth__ops" id="ops-panel" style="margin-top:16px;border:1px solid var(--border);border-radius:10px;padding:10px 12px">' +
                '<summary style="cursor:pointer;font-size:12.5px;font-weight:600;color:var(--muted)">Token ops (gateway v1 · MCP 127.0.0.1:8765)</summary>' +
                '<p class="tiny faint" style="margin:8px 0 10px;line-height:1.5">Data v1 (work package, mandat, eksekusi, audit) dibaca lewat gateway MCP dan butuh bearer token ops. Token disimpan hanya di sessionStorage tab ini.</p>' +
                '<div class="field" style="margin-bottom:8px"><label class="field__label" for="ops-token">Token ops</label>' +
                  '<input class="input" id="ops-token" type="password" placeholder="ops-…" autocomplete="off"></div>' +
                '<div id="ops-error" aria-live="polite"></div>' +
                '<button class="btn btn--secondary btn--block" id="ops-connect">Hubungkan token</button>' +
                '<div class="row" style="margin-top:8px;gap:8px"><button class="btn btn--ghost tiny" id="ops-clear" type="button">Lepas token</button>' +
                  '<span class="tiny faint" id="ops-state">—</span></div>' +
              '</details>' +
              '<p class="tiny faint" style="margin-top:12px;text-align:center;line-height:1.5">Mode demo memakai dataset contoh di peramban. Bila backend tak tercapai, halaman ini tetap jujur berlabel DEMO — tidak pernah disamarkan jadi LIVE.</p>' +
              '<div class="row" style="margin-top:14px;justify-content:center;gap:14px">' +
                '<a class="tiny muted" href="#/overview" style="text-decoration:underline">Lewati untuk sekarang</a>' +
                '<span class="tiny faint">·</span>' +
                '<a class="tiny muted" href="../../docs/PRD.md">Dokumentasi produk</a>' +
              '</div>' +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';

    var err = root.querySelector('#login-error');
    var humanErr = root.querySelector('#human-error');
    var emailInput = root.querySelector('#human-email');
    var passInput = root.querySelector('#human-password');
    var btn = root.querySelector('#signin');
    var googleBtn = root.querySelector('#google');
    var toggleBtn = root.querySelector('#toggle-pass');

    function showError(el, msg) {
      el.innerHTML = '<div class="banner banner--danger" style="margin-bottom:12px"><span class="material-symbols-outlined">error</span><div>' + esc(msg) + '</div></div>';
    }
    function clearError(el) { try { el.innerHTML = ''; } catch (e) { void e; } }

    /* Toggle lihat password */
    toggleBtn.addEventListener('click', function () {
      var show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      toggleBtn.querySelector('.material-symbols-outlined').textContent = show ? 'visibility' : 'visibility_off';
      toggleBtn.setAttribute('aria-label', show ? 'Sembunyikan password' : 'Tampilkan password');
    });

    /* Forgot password: backend belum menyediakan endpoint reset — unavailable jujur */
    root.querySelector('#forgot').addEventListener('click', function () {
      clearError(err); clearError(humanErr);
      showError(humanErr, 'Reset password belum tersedia di backend (tidak ada endpoint forgot/reset). Silakan hubungi administrator tenant.');
    });

    /* Google: cek backend; 503 = unavailable jujur */
    (function probeGoogle() {
      var api = D.api;
      var baseUrl = (api && api.restBase) || (api && api.API ? String(api.API).replace(/:8765$/, ':8000') : 'http://127.0.0.1:8000');
      fetch(baseUrl + '/api/v1/auth/google', { method: 'GET', credentials: 'include' })
        .then(function (r) {
          if (r.ok) {
            googleBtn.disabled = false;
            googleBtn.removeAttribute('title');
            googleBtn.addEventListener('click', function () {
              fetch(baseUrl + '/api/v1/auth/google', { method: 'GET', credentials: 'include' })
                .then(function (r2) { if (!r2.ok) throw new Error('HTTP ' + r2.status); return r2.json(); })
                .then(function (j) {
                  if (j.authorization_url) window.location.href = j.authorization_url;
                  else showError(err, j.detail || 'Google OAuth belum dikonfigurasi di backend.');
                })
                .catch(function (e) { showError(err, 'Backend tidak merespons: ' + (e.message || e)); });
            });
            return null;
          }
          if (r.status === 503) {
            googleBtn.disabled = true;
            googleBtn.title = 'Google OAuth belum dikonfigurasi di backend (503)';
            return null;
          }
          googleBtn.disabled = true;
          return null;
        })
        .catch(function () {
          /* backend tak tercapai: tetap unavailable jujur */
          googleBtn.disabled = true;
          googleBtn.title = 'Backend tak tercapai';
        });
    })();

    /* Login manusia LIVE via D.api.rest (api-client.js auth.login) */
    function doLogin() {
      clearError(err); clearError(humanErr);
      var email = (emailInput.value || '').trim();
      var pass = passInput.value || '';
      if (!email || !pass) {
        showError(humanErr, 'Isi email dan password terlebih dahulu.');
        return;
      }
      btn.classList.add('is-loading');
      btn.textContent = 'Memverifikasi…';
      var api = D.api;
      var promise;
      try {
        if (api && api.auth && typeof api.auth.login === 'function') {
          promise = api.auth.login(email, pass);
        } else if (api && typeof api.rest === 'function') {
          promise = api.rest('POST', '/api/v1/auth/login', { email: email, password: pass });
        } else {
          promise = fetch(((api && api.restBase) || 'http://127.0.0.1:8000') + '/api/v1/auth/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ email: email, password: pass })
          }).then(function (r) { if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); });
        }
      } catch (e) {
        promise = Promise.reject(e);
      }
      promise.then(function (res) {
        btn.classList.remove('is-loading');
        btn.textContent = 'Masuk';
        /* Sukses: backend menerbitkan cookie sesi; muat ulang agar shell memakai sesi baru. */
        if (ui && ui.toast) ui.toast('Masuk berhasil. Memuat workspace…', 'success');
        void res;
        /* Tanpa ini layar tetap di /login setelah muat ulang: formulir kosong
         * terlihat seperti login yang gagal. Arahkan ke halaman tujuan dulu. */
        var next = U.qs('next', null);
        var target = next && next.charAt(0) === '/' ? next : '/overview';
        try { history.replaceState(null, '', '#' + target); } catch (e) { void e; }
        setTimeout(function () { location.reload(); }, 400);
      }).catch(function (e) {
        btn.classList.remove('is-loading');
        btn.textContent = 'Masuk';
        var msg = (e && e.message) || 'Login gagal.';
        if (e && (e.status === 401 || String(msg).indexOf('unauthorized') > -1)) {
          showError(humanErr, 'Email atau password salah. (Backend: 401)');
        } else if (String(msg).indexOf('Failed to fetch') > -1 || (e && e.name === 'TypeError')) {
          showError(humanErr, 'Backend DEXTRA tidak merespons di 127.0.0.1:8000. Jalankan backend, atau gunakan mode demo.');
        } else if (e && e.status === 422) {
          showError(humanErr, 'Data yang dikirim tidak valid (422). Periksa format email/password.');
        } else {
          showError(humanErr, msg);
        }
      });
    }

    btn.addEventListener('click', doLogin);
    emailInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    passInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });

    root.querySelector('#demo').addEventListener('click', function () {
      D.api.clearToken();
      ui.toast('Masuk dalam mode demo. Data contoh, bukan operasi nyata.', 'info', 4200);
      D.router.go('/overview');
    });

    /* ---------------- token ops (jalur data v1 / MCP) ----------------
     * Tanpa bearer ini, halaman work package, mandat, eksekusi, dan audit
     * tidak punya sumber: gateway menolak panggilan anonim. Dulu layar hanya
     * menawarkan email+password (jalur v2), sehingga data v1 tidak pernah bisa
     * dijangkau dari UI sama sekali. Panel ini mengembalikan jalur itu, dan
     * memverifikasi token lewat get_caller_context sebelum menyimpannya. */
    var opsInput = root.querySelector('#ops-token');
    var opsBtn = root.querySelector('#ops-connect');
    var opsErr = root.querySelector('#ops-error');
    var opsState = root.querySelector('#ops-state');
    var opsClear = root.querySelector('#ops-clear');

    function describeOps() {
      var t = D.api.token();
      opsState.textContent = t ? ('token terpasang · ' + t.slice(0, 4) + '…') : 'belum ada token';
    }
    describeOps();

    function connectOps() {
      clearError(opsErr);
      var token = (opsInput.value || '').trim();
      if (!token) { showError(opsErr, 'Isi token ops terlebih dahulu.'); return; }
      opsBtn.disabled = true;
      opsBtn.textContent = 'Memverifikasi…';
      var previous = D.api.token();
      D.api.setToken(token);
      D.api.call('get_caller_context', {}).then(function (ctx) {
        opsBtn.disabled = false;
        opsBtn.textContent = 'Hubungkan token';
        D.session.applyServerContext(ctx || null);
        describeOps();
        ui.toast('Token ops diterima: scope ' + ((ctx && ctx.scope) || '?') + '. Memuat data v1…', 'success');
        history.replaceState(null, '', '#/overview');
        setTimeout(function () { location.reload(); }, 400);
      }).catch(function (e) {
        D.api.setToken(previous);
        opsBtn.disabled = false;
        opsBtn.textContent = 'Hubungkan token';
        showError(opsErr, 'Token ditolak gateway: ' + ((e && e.message) || 'tidak diketahui') + '. Token tidak disimpan.');
        describeOps();
      });
    }
    opsBtn.addEventListener('click', connectOps);
    opsInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') connectOps(); });
    opsClear.addEventListener('click', function () {
      D.api.clearToken();
      describeOps();
      ui.toast('Token ops dilepas dari tab ini. Data v1 tidak lagi terbaca.', 'info');
    });
  };

  D.views.forbidden = function (root) {
    root.innerHTML =
      '<div class="auth auth--single"><div class="auth__form" style="justify-content:center">' +
        '<div class="auth__forminner" style="text-align:center">' +
          '<div class="empty__icon" style="margin:0 auto 14px;width:52px;height:52px;background:var(--danger-100);color:var(--danger-600)">' +
            '<span class="material-symbols-outlined" style="font-size:26px">lock</span></div>' +
          '<h1 style="font-size:22px">Akses ditolak</h1>' +
          '<p class="small muted" style="margin:8px 0 20px">' + esc(D.session.roleLabel()) + ' tidak memiliki izin untuk halaman ini. ' +
            'Halaman tetap ada — hanya terkunci.</p>' +
          '<div class="row" style="justify-content:center;gap:8px">' +
            '<a class="btn btn--primary" href="#/overview">Kembali ke overview</a>' +
            '<a class="btn btn--secondary" href="#/permissions">Lihat matriks izin</a>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  };

  /*
   * Distinct from "forbidden" on purpose.
   *
   * "Denied" means a decision was made against this caller. "Unavailable" means
   * no authorization for this capability exists on the server at all, so no
   * decision was ever possible. Showing the second as the first would claim a
   * security judgement that never happened — and would imply that some other
   * caller *could* get in, which is also untrue today.
   */
  D.views.unavailable = function (root, params, hit) {
    var cap = (hit && hit.blockedCap) || 'kemampuan ini';
    var label = (hit && hit.route && hit.route.title) || 'Halaman ini';
    root.innerHTML =
      '<div class="auth auth--single"><div class="auth__form" style="justify-content:center">' +
        '<div class="auth__forminner" style="text-align:center">' +
          '<div class="empty__icon" style="margin:0 auto 14px;width:52px;height:52px;background:var(--warning-100);color:var(--warning-600)">' +
            '<span class="material-symbols-outlined" style="font-size:26px">construction</span></div>' +
          '<h1 style="font-size:22px">Belum tersedia</h1>' +
          '<p class="small muted" style="margin:8px 0 10px">' + esc(label) + ' membutuhkan kemampuan ' +
            '<span class="mono">' + esc(cap) + '</span>, dan server belum menyediakan otorisasi untuk kemampuan itu.</p>' +
          '<p class="small muted" style="margin:0 0 20px">Ini <b>bukan</b> penolakan akses: tidak ada keputusan yang dibuat, ' +
            'karena tidak ada yang bisa memutuskan. Tidak ada token, peran, maupun perubahan persona yang membuka halaman ini.</p>' +
          '<div class="banner banner--warning" style="text-align:left;margin-bottom:18px">' +
            '<span class="material-symbols-outlined">rule</span><div>Blocker: server belum memiliki identitas per pengguna, ' +
            'role, maupun tool administrasi. Selama itu belum ada, halaman ini tetap terkunci apa pun yang dipilih di klien.</div></div>' +
          '<div class="row" style="justify-content:center;gap:8px">' +
            '<a class="btn btn--primary" href="#/overview">Kembali ke overview</a>' +
            '<a class="btn btn--secondary" href="#/integrations">Lihat peta rute</a>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  };

  D.views.notFound = function (root) {
    root.innerHTML =
      '<div class="auth auth--single"><div class="auth__form" style="justify-content:center">' +
        '<div class="auth__forminner" style="text-align:center">' +
          '<div class="empty__icon" style="margin:0 auto 14px;width:52px;height:52px">' +
            '<span class="material-symbols-outlined" style="font-size:26px">explore_off</span></div>' +
          '<h1 style="font-size:22px">Halaman tidak ditemukan</h1>' +
          '<p class="small muted" style="margin:8px 0 20px">Alamat <span class="mono">' + esc(location.hash || '—') + '</span> tidak cocok dengan layar mana pun di dashboard ini.</p>' +
          '<div class="row" style="justify-content:center;gap:8px">' +
            '<a class="btn btn--primary" href="#/overview">Buka overview</a>' +
            '<button class="btn btn--secondary" onclick="history.back()">Kembali</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';
  };
})();
