/* Views — Login, forbidden, not found. */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;

  D.views.login = function (root) {
    root.innerHTML =
      '<div class="auth">' +
        '<section class="auth__brand">' +
          '<div class="auth__brandtop"><div class="brand-mark" style="width:38px;height:38px;font-size:19px">D</div>' +
            '<div class="brand-text"><b style="color:#fff">DEXTRA</b><span style="color:rgba(255,255,255,.62)">Governed AI Workforce</span></div></div>' +
          '<div class="auth__pitch">' +
            '<h1>Specialized AI workers.<br>Human-defined authority.<br>Accountable execution.</h1>' +
            '<p>Setiap tindakan tulis melewati mandat. Setiap keputusan tercatat. Tidak ada jalur dari agen ke executor.</p>' +
          '</div>' +
          '<div class="auth__principles">' +
            [['Membaca otomatis, menulis lewat mandat', 'lock'],
             ['Persetujuan manusia eksplisit', 'verified_user'],
             ['Audit append-only', 'receipt_long'],
             ['Local-only service exposure', 'dns']].map(function (p) {
              return '<div class="row" style="gap:9px"><span class="material-symbols-outlined" style="font-size:17px;color:rgba(255,255,255,.7)">' + p[1] + '</span>' +
                '<span style="font-size:12px;color:rgba(255,255,255,.78)">' + esc(p[0]) + '</span></div>';
            }).join('') +
          '</div>' +
          '<div class="auth__foot">Kenari Group · org_kenari · Asia/Jakarta</div>' +
        '</section>' +
        '<section class="auth__form">' +
          '<div class="auth__forminner">' +
            '<div class="page-head__eyebrow">Masuk ke dashboard</div>' +
            '<h1 style="font-size:24px;margin-bottom:6px">Autentikasi operator</h1>' +
            '<p class="small muted" style="margin-bottom:22px">Dashboard ini memakai token ops lokal. Token hanya disimpan di sesi peramban dan tidak pernah ditulis ke halaman.</p>' +
            '<div id="login-error"></div>' +
            '<div class="field" style="margin-bottom:14px">' +
              '<label class="field__label" for="token">Token ops</label>' +
              '<div class="input-wrap"><span class="material-symbols-outlined">key</span>' +
                '<input class="input input--icon" id="token" type="password" placeholder="ops-dev-token" autocomplete="current-password"></div>' +
              '<div class="field__hint">Di lingkungan pengembangan, token default adalah <span class="mono">ops-dev-token</span>. Token ini tidak memberi akses ke data pelanggan nyata.</div>' +
            '</div>' +
            '<label class="switch" style="margin-bottom:18px"><input type="checkbox" id="remember"><span class="switch__track"></span>' +
              '<span class="small">Ingat di perangkat ini</span></label>' +
            '<button class="btn btn--primary btn--lg btn--block" id="signin">Masuk</button>' +
            '<div class="row" style="margin:18px 0;gap:10px"><span style="flex:1;height:1px;background:var(--border)"></span>' +
              '<span class="tiny faint">atau</span><span style="flex:1;height:1px;background:var(--border)"></span></div>' +
            '<button class="btn btn--secondary btn--lg btn--block" id="demo"><span class="material-symbols-outlined">science</span>Jelajahi mode demo</button>' +
            '<p class="tiny faint" style="margin-top:10px;text-align:center;line-height:1.5">Mode demo memakai dataset contoh di peramban. Tidak ada koneksi server, tidak ada tindakan nyata.</p>' +
            '<div class="banner banner--info" style="margin-top:20px"><span class="material-symbols-outlined">info</span>' +
              '<div>Server MCP lokal: <span class="mono">127.0.0.1:8765</span>. Jika tidak berjalan, dashboard tetap dapat dijelajahi dalam mode demo.</div></div>' +
            '<div class="row" style="margin-top:16px;justify-content:center;gap:14px">' +
              '<a class="tiny muted" href="#/overview" style="text-decoration:underline">Lewati untuk sekarang</a>' +
              '<span class="tiny faint">·</span>' +
              '<a class="tiny muted" href="../../docs/PRD.md">Dokumentasi produk</a>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>';

    var input = root.querySelector('#token');
    var err = root.querySelector('#login-error');
    var btn = root.querySelector('#signin');

    function showError(msg) {
      err.innerHTML = '<div class="banner banner--danger" style="margin-bottom:14px"><span class="material-symbols-outlined">error</span><div>' + esc(msg) + '</div></div>';
    }
    function clearError() { err.innerHTML = ''; }

    btn.addEventListener('click', function () {
      clearError();
      var t = input.value.trim();
      if (!t) { showError('Token tidak boleh kosong.'); input.focus(); return; }
      btn.classList.add('is-loading');
      btn.textContent = 'Memverifikasi…';
      fetch(D.api.API || 'http://127.0.0.1:8765', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).then(function (j) {
        var tools = (j.result && j.result.tools) || [];
        if (!tools.length) throw new Error('Token tidak dikenali server.');
        var names = tools.map(function (x) { return x.name; });
        if (names.indexOf('execute_action') < 0 && names.indexOf('submit_approval') < 0) {
          throw new Error('Token ini tidak memiliki wewenang ops.');
        }
        D.api.setToken(t, root.querySelector('#remember').checked);
        ui.toast('Token valid. Memuat data live…', 'success');
        setTimeout(function () { location.reload(); }, 400);
      }).catch(function (e) {
        btn.classList.remove('is-loading');
        btn.textContent = 'Masuk';
        if (String(e.message).indexOf('Failed to fetch') > -1 || String(e.name) === 'TypeError') {
          showError('Server MCP lokal tidak merespons di 127.0.0.1:8765. Jalankan server, atau gunakan mode demo.');
        } else {
          showError(e.message || 'Token tidak valid.');
        }
      });
    });

    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });

    root.querySelector('#demo').addEventListener('click', function () {
      D.api.clearToken();
      ui.toast('Masuk dalam mode demo. Data contoh, bukan operasi nyata.', 'info', 4200);
      D.router.go('/overview');
    });
  };

  D.views.forbidden = function (root) {
    root.innerHTML =
      '<div class="auth auth--single"><div class="auth__form" style="justify-content:center">' +
        '<div class="auth__forminner" style="text-align:center">' +
          '<div class="empty__icon" style="margin:0 auto 14px;width:52px;height:52px;background:var(--danger-100);color:var(--danger-600)">' +
            '<span class="material-symbols-outlined" style="font-size:26px">lock</span></div>' +
          '<h1 style="font-size:22px">Akses ditolak</h1>' +
          '<p class="small muted" style="margin:8px 0 20px">Peran <b>' + esc(D.session.roleLabel()) + '</b> tidak memiliki izin untuk halaman ini. ' +
            'Halaman tetap ada — hanya terkunci. Minta administrator organisasi jika Anda memerlukan akses.</p>' +
          '<div class="row" style="justify-content:center;gap:8px">' +
            '<a class="btn btn--primary" href="#/overview">Kembali ke overview</a>' +
            '<a class="btn btn--secondary" href="#/permissions">Lihat matriks izin</a>' +
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
