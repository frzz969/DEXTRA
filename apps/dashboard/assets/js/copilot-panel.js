/* DEXTRA Dashboard — Copilot panel.
 *
 * The panel is mounted once and survives navigation, so a question asked on
 * /mandates is still there when you land on /audit. That is the difference
 * between "a chat page" and an assistant that can actually be used while
 * working: you should not have to leave the screen you are looking at.
 *
 * It renders results generically — title, rows, bullets, actions, note — so the
 * engine can grow new answers without this file knowing about them.
 */
(function (window) {
  'use strict';
  var D = window.DEXTRA;
  var U = D.util, esc = U.esc;

  var log = [];       /* conversation, kept across route changes */
  var root = null;
  var busy = false;

  function isBare() {
    return document.body.classList.contains('is-bare');
  }

  /* ---------------- rendering ---------------- */

  function renderResult(r) {
    var out = '<div class="cp__msg cp__msg--bot">';
    out += '<div class="cp__bubble">';
    if (r.title) out += '<div class="cp__title' + (r.tone ? ' cp__title--' + r.tone : '') + '">' + esc(r.title) + '</div>';
    (r.body || []).forEach(function (p) { out += '<p class="cp__p">' + esc(p) + '</p>'; });
    if (r.rows && r.rows.length) {
      out += '<dl class="cp__rows">' + r.rows.map(function (row) {
        return '<dt>' + esc(row.label) + '</dt><dd>' + esc(row.value) + '</dd>';
      }).join('') + '</dl>';
    }
    if (r.bullets && r.bullets.length) {
      out += '<ul class="cp__list">' + r.bullets.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
    }
    if (r.actions && r.actions.length) {
      out += '<div class="cp__actions">' + r.actions.map(function (a) {
        return '<a class="btn btn--sm ' + (a.primary ? 'btn--primary' : 'btn--secondary') + '" href="#' + esc(a.path) + '">' +
          esc(a.label) + '<span class="material-symbols-outlined">arrow_forward</span></a>';
      }).join('') + '</div>';
    }
    if (r.note) out += '<div class="cp__note">' + esc(r.note) + '</div>';
    out += '</div></div>';
    return out;
  }

  function renderUser(text) {
    return '<div class="cp__msg cp__msg--user"><div class="cp__bubble">' + esc(text).replace(/\n/g, '<br>') + '</div></div>';
  }

  function paintLog() {
    if (!root) return;
    var host = root.querySelector('#cp-log');
    if (!host) return;
    if (!log.length) {
      host.innerHTML = '<div class="cp__empty">' +
        '<span class="material-symbols-outlined">auto_awesome</span>' +
        '<p class="small strong">Tanya apa saja tentang layar ini</p>' +
        '<p class="tiny muted">Saya membaca dari server yang sama dengan halaman ini. Saya tidak menyetujui, menerbitkan mandat, atau mengeksekusi tindakan.</p>' +
        '</div>';
      return;
    }
    host.innerHTML = log.map(function (m) {
      return m.role === 'user' ? renderUser(m.text) : renderResult(m.result);
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  function paintChips() {
    if (!root) return;
    var host = root.querySelector('#cp-chips');
    if (!host) return;
    var list = D.copilot.intents();
    host.innerHTML = list.map(function (it) {
      var mark = it.kind === 'handoff' ? '<span class="material-symbols-outlined">pan_tool</span>'
        : it.kind === 'tool' ? '<span class="material-symbols-outlined">cloud_sync</span>'
        : '';
      return '<button class="chip chip--sm" data-intent="' + esc(it.id) + '" data-label="' + esc(it.label) + '" title="' +
        esc(it.kind === 'handoff' ? 'Butuh keputusan manusia' : it.kind === 'tool' ? 'Menanyakan server' : 'Dihitung dari data yang dimuat') + '">' +
        mark + esc(it.label) + '</button>';
    }).join('');
    host.querySelectorAll('[data-intent]').forEach(function (b) {
      b.addEventListener('click', function () {
        /* Read the label from the attribute, not textContent: textContent also
           contains the icon ligature ("pan_toolJalankan tindakan"). */
        exec(b.getAttribute('data-intent'), b.getAttribute('data-label'));
      });
    });
  }

  /* The route state is a property of the route; the mode is a property of the
     session. Showing "Terhubung" next to "DEMO" told the operator two different
     things at once, so the route pill says what the backend situation is, in
     words that cannot be mistaken for a connection status. */
  var ROUTE_STATE = {
    live: 'Backend ada',
    partial: 'Backend sebagian',
    demo: 'Tanpa backend',
    none: 'Bukan data'
  };

  function paintContext() {
    if (!root) return;
    var ctx = D.copilot.context();
    var label = root.querySelector('#cp-ctx-label');
    var state = root.querySelector('#cp-ctx-state');
    var mode = root.querySelector('#cp-mode');
    if (label) label.textContent = ctx.label + (ctx.entity ? ' · ' + ctx.entity : '');
    if (state) {
      var src = D.sources.byRoute(ctx.path);
      var st = src ? src.state : 'none';
      state.textContent = ROUTE_STATE[st] || st;
      state.className = 'cp__pill cp__pill--' + st;
      state.title = src ? src.note || '' : '';
    }
    if (mode) {
      mode.textContent = ctx.mode === 'live' ? 'Live · MCP' : 'Demo';
      mode.className = 'cp__pill ' + (ctx.mode === 'live' ? 'cp__pill--live' : 'cp__pill--demo');
      mode.title = ctx.mode === 'live'
        ? 'Jawaban datang dari server MCP di 127.0.0.1:8765'
        : 'Server MCP tidak menjawab. Halaman menampilkan data contoh; asisten tidak akan mengarang jawaban.';
    }
    paintChips();
  }

  /* ---------------- behaviour ---------------- */

  function push(m) { log.push(m); paintLog(); }

  function exec(intentId, label) {
    if (busy) return;
    busy = true;
    push({ role: 'user', text: label });
    var pending = D.copilot.run(intentId);
    pending.then(function (r) {
      busy = false;
      if (r && r.kind === 'go') {
        D.router.go(r.path);
        push({ role: 'assistant', result: {
          title: 'Membuka ' + r.path, body: [], rows: [], bullets: [], actions: [], note: 'Perpindahan halaman, bukan tindakan.'
        } });
        return;
      }
      push({ role: 'assistant', result: r });
    }).catch(function (e) {
      busy = false;
      push({ role: 'assistant', result: {
        tone: 'danger', title: 'Gagal menjalankan', body: [e.message || String(e)],
        rows: [], bullets: [], actions: [], note: 'Tidak ada jawaban pengganti.'
      } });
    });
  }

  function submit(text) {
    var t = String(text || '').trim();
    if (!t || busy) return;
    busy = true;
    push({ role: 'user', text: t });
    var input = root.querySelector('#cp-input');
    if (input) input.value = '';

    /* "susun rencana …" goes to the planner, everything else to Q&A. The
       planner is the only path that can produce a draft plan. */
    var wantsPlan = /^(susun|buat|siapkan|draft|rencana)\b/i.test(t) || /susun(kan)?\s+rencana/i.test(t);
    var p = wantsPlan ? D.copilot.compose(t).then(function (draft) {
      return {
        kind: 'answer',
        tone: draft.blocked ? 'warn' : 'ok',
        title: draft.blocked ? 'Berhenti: ' + draft.blocked.code : 'Draf rencana siap ditinjau',
        body: [draft.text],
        rows: draft.plan ? [
          { label: 'Plan', value: draft.plan.plan_id },
          { label: 'Aksi', value: String(draft.plan.actions.length) }
        ] : [],
        bullets: draft.steps || [],
        actions: draft.plan ? [{ label: 'Tinjau rencana', path: '/review/' + encodeURIComponent(draft.plan.plan_id), primary: true }] : [],
        note: 'Draf lokal — belum ada pesan terkirim, belum ada data berubah.'
      };
    }) : D.copilot.ask(t);

    p.then(function (r) { busy = false; push({ role: 'assistant', result: r }); })
      .catch(function (e) {
        busy = false;
        push({ role: 'assistant', result: { tone: 'danger', title: 'Gagal', body: [e.message || String(e)], rows: [], bullets: [], actions: [], note: '' } });
      });
  }

  function open() {
    if (!root || isBare()) return;
    root.setAttribute('data-open', 'true');
    document.body.classList.add('is-copilot');
    paintContext();
    var input = root.querySelector('#cp-input');
    if (input) setTimeout(function () { input.focus(); }, 60);
  }

  function close() {
    if (!root) return;
    root.setAttribute('data-open', 'false');
    document.body.classList.remove('is-copilot');
  }

  function toggle() {
    if (!root) return;
    if (root.getAttribute('data-open') === 'true') close(); else open();
  }

  function mount() {
    if (root) return root;
    root = U.h('aside', { class: 'copilot', id: 'copilot', 'aria-label': 'DEXTRA Copilot' });
    root.setAttribute('data-open', 'false');
    root.innerHTML =
      '<div class="cp__head">' +
        '<div class="cp__brand"><span class="material-symbols-outlined">auto_awesome</span>' +
          '<div style="min-width:0"><div class="cp__name">Copilot</div>' +
          '<div class="cp__ctx"><span id="cp-ctx-label">—</span></div></div></div>' +
        '<div class="spacer"></div>' +
        '<span class="cp__pill cp__pill--demo" id="cp-mode">Demo</span>' +
        '<span class="cp__pill cp__pill--none" id="cp-ctx-state">—</span>' +
        '<button class="icon-btn" id="cp-clear" title="Bersihkan percakapan"><span class="material-symbols-outlined">delete_sweep</span></button>' +
        '<button class="icon-btn" id="cp-close" aria-label="Tutup"><span class="material-symbols-outlined">close</span></button>' +
      '</div>' +
      '<div class="cp__log" id="cp-log"></div>' +
      '<div class="cp__chips" id="cp-chips"></div>' +
      '<div class="cp__composer">' +
        '<textarea class="textarea" id="cp-input" rows="2" placeholder="Tanya tentang layar ini, atau tulis “susun rencana …”"></textarea>' +
        '<button class="btn btn--primary btn--sm" id="cp-send"><span class="material-symbols-outlined">send</span></button>' +
      '</div>' +
      '<div class="cp__foot">' +
        '<span class="material-symbols-outlined">pan_tool</span>' +
        '<span>Asisten tidak menyetujui, tidak menerbitkan mandat, tidak mengeksekusi. Itu selalu manusia.</span>' +
      '</div>';

    document.body.appendChild(root);

    root.querySelector('#cp-close').addEventListener('click', close);
    root.querySelector('#cp-clear').addEventListener('click', function () {
      log = [];
      paintLog();
    });
    root.querySelector('#cp-send').addEventListener('click', function () {
      submit(root.querySelector('#cp-input').value);
    });
    root.querySelector('#cp-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e.target.value); }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && root.getAttribute('data-open') === 'true') close();
    });

    /* Re-scope on navigation, but keep the conversation. */
    window.addEventListener('hashchange', function () {
      paintContext();
      if (root.getAttribute('data-open') === 'true') paintLog();
    });

    paintLog();
    paintContext();
    return root;
  }

  D.copilotPanel = {
    mount: mount,
    open: open,
    close: close,
    toggle: toggle,
    /* shell calls this after every render so bare pages stay bare */
    sync: function () {
      if (isBare()) close();
      paintContext();
    }
  };
})(window);
