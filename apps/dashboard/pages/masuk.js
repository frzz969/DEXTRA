(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function init() {
    var input = document.querySelector('input[type="password"], input[type="text"]');
    if (!input) input = document.querySelector('input');
    var btn = null;
    document.querySelectorAll('button').forEach(function (b) {
      var t = (b.textContent || '').toLowerCase();
      if (t.includes('masuk') || t.includes('login') || t.includes('lanjut')) btn = b;
    });

    // prefill dev token
    if (input && !input.value) input.value = 'ops-dev-token';

    // "continue" link if token already stored
    try {
      var stored = sessionStorage.getItem('dextra_ops_token') || localStorage.getItem('dextra_ops_token');
      if (stored) {
        var link = document.createElement('a');
        link.href = 'overview.html';
        link.className = 'block text-center text-sm text-[#7357E8] font-semibold mt-3';
        link.textContent = 'Token tersimpan — lanjutkan ke Overview →';
        if (input && input.parentNode) input.parentNode.appendChild(link);
      }
    } catch (_) {}

    function setError(msg) {
      var box = document.getElementById('masuk-error');
      if (!box) {
        box = document.createElement('div');
        box.id = 'masuk-error';
        box.className = 'mt-3 p-3 rounded-lg bg-[#FDF2F3] text-sm text-[#D95362]';
        if (input && input.parentNode) input.parentNode.appendChild(box);
      }
      box.textContent = msg;
      box.style.display = '';
    }
    function clearError() {
      var box = document.getElementById('masuk-error');
      if (box) box.style.display = 'none';
    }

    async function verify(token) {
      var r = await fetch(D.API + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json();
      var tools = (j.result && j.result.tools) ? j.result.tools : [];
      if (!tools.length) throw new Error('Token tidak dikenali server.');
      var names = tools.map(function (t) { return t.name; });
      if (names.indexOf('execute_action') < 0 && names.indexOf('submit_approval') < 0) {
        throw new Error('Token tidak memiliki wewenang ops.');
      }
      return true;
    }

    if (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        clearError();
        var t = (input ? input.value : '').trim();
        if (!t) { setError('Token tidak boleh kosong.'); return; }
        btn.disabled = true; btn.textContent = 'Memverifikasi…';
        verify(t).then(function () {
          D.setToken(t, true);
          D.toast('Token valid. Mengalihkan…', 'success');
          setTimeout(function () { location.href = 'overview.html'; }, 400);
        }).catch(function (err) {
          setError(err.message || 'Token tidak valid.');
          btn.disabled = false; btn.textContent = 'Masuk';
        });
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
