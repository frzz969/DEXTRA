/* DEXTRA Dashboard — UI primitives: overlays, toasts, menus, tables, charts, states. */
(function () {
  'use strict';
  var D = window.DEXTRA;
  var U = D.util;
  var esc = U.esc;

  var ui = {};

  /* ---------------- toast ---------------- */
  function toastHost() {
    var host = document.getElementById('toast-host');
    if (!host) { host = U.h('div', { class: 'toast-host', id: 'toast-host' }); document.body.appendChild(host); }
    return host;
  }
  var TOAST_ICON = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
  ui.toast = function (message, type, ms) {
    type = type || 'info';
    var el = U.h('div', { class: 'toast toast--' + type });
    el.innerHTML = '<span class="material-symbols-outlined">' + (TOAST_ICON[type] || 'info') + '</span><div>' + esc(message) + '</div>';
    toastHost().appendChild(el);
    setTimeout(function () {
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 220);
    }, ms || 3600);
  };

  /* ---------------- overlay base ---------------- */
  function overlay(kind, node, onClose) {
    var wrap = U.h('div', { class: 'overlay overlay--' + kind, role: 'dialog', 'aria-modal': 'true' });
    wrap.appendChild(node);
    var closed = false;
    function close() {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey);
      wrap.remove();
      if (onClose) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    return { close: close, el: wrap };
  }

  ui.modal = function (opts) {
    var node = U.h('div', { class: 'modal' + (opts.wide ? ' modal--wide' : '') });
    node.innerHTML =
      '<div class="modal__head"><div style="flex:1;min-width:0">' +
        '<h2>' + esc(opts.title || '') + '</h2>' +
        (opts.subtitle ? '<p>' + esc(opts.subtitle) + '</p>' : '') +
      '</div>' +
      '<button class="icon-btn" data-close aria-label="Tutup"><span class="material-symbols-outlined">close</span></button></div>' +
      '<div class="modal__body">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="modal__foot">' + opts.footer + '</div>' : '');
    var ov = overlay('center', node, opts.onClose);
    node.querySelector('[data-close]').addEventListener('click', ov.close);
    node.addEventListener('click', function (e) { if (e.target.closest('[data-dismiss]')) ov.close(); });
    if (opts.onMount) opts.onMount(node, ov);
    var focusable = node.querySelector('input,textarea,select,button:not([data-close])');
    if (focusable) setTimeout(function () { focusable.focus(); }, 30);
    return ov;
  };

  ui.drawer = function (opts) {
    var node = U.h('div', { class: 'drawer' + (opts.wide ? ' drawer--wide' : '') });
    node.innerHTML =
      '<div class="drawer__head"><div style="flex:1;min-width:0">' +
        (opts.eyebrow ? '<div class="page-head__eyebrow">' + esc(opts.eyebrow) + '</div>' : '') +
        '<h2>' + esc(opts.title || '') + '</h2>' +
        (opts.subtitle ? '<p class="small muted" style="margin-top:2px">' + esc(opts.subtitle) + '</p>' : '') +
      '</div><button class="icon-btn" data-close aria-label="Tutup"><span class="material-symbols-outlined">close</span></button></div>' +
      '<div class="drawer__body">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="drawer__foot">' + opts.footer + '</div>' : '');
    var ov = overlay('right', node, opts.onClose);
    node.querySelector('[data-close]').addEventListener('click', ov.close);
    node.addEventListener('click', function (e) { if (e.target.closest('[data-dismiss]')) ov.close(); });
    if (opts.onMount) opts.onMount(node, ov);
    return ov;
  };

  ui.confirm = function (opts) {
    return new Promise(function (resolve) {
      var tone = opts.tone || 'primary';
      var btnClass = tone === 'danger' ? 'btn--danger' : 'btn--primary';
      var settled = false;
      function done(result) { if (settled) return; settled = true; resolve(result); }
      var ov = ui.modal({
        title: opts.title || 'Konfirmasi',
        subtitle: opts.subtitle || '',
        body: '<div class="small" style="color:var(--text-2);line-height:1.6">' + (opts.body || '') + '</div>' +
          (opts.extra || ''),
        footer: '<button class="btn btn--secondary" data-dismiss>Batal</button>' +
                '<button class="btn ' + btnClass + '" data-confirm>' + esc(opts.confirmLabel || 'Lanjutkan') + '</button>',
        onClose: function () { done({ ok: false, values: {} }); },
        onMount: function (node) {
          var reqIds = opts.required || [];
          var confirmBtn = node.querySelector('[data-confirm]');
          var touched = {};

          function readValues() {
            var values = {};
            node.querySelectorAll('input, textarea, select').forEach(function (f) { if (f.id) values[f.id] = f.value; });
            return values;
          }

          /* A required field stays empty -> confirm is blocked. No silent fallback reason.
             Errors are only surfaced after the user has interacted with the field. */
          function validate(showErrors) {
            var values = readValues();
            var missing = reqIds.filter(function (id) { return !String(values[id] == null ? '' : values[id]).trim(); });
            if (confirmBtn) {
              confirmBtn.disabled = missing.length > 0;
              confirmBtn.title = missing.length ? 'Lengkapi kolom wajib terlebih dahulu' : '';
            }
            reqIds.forEach(function (id) {
              var input = node.querySelector('#' + id);
              if (!input) return;
              var field = input.closest('.field');
              if (!field) return;
              var bad = !String(input.value || '').trim();
              var reveal = !!showErrors && !!touched[id];
              field.classList.toggle('field--error', bad && reveal);
              var msg = field.querySelector('.field__error');
              if (bad && reveal && !msg) {
                var e = U.h('div', { class: 'field__error' });
                e.innerHTML = '<span class="material-symbols-outlined">error</span>Kolom ini wajib diisi.';
                field.appendChild(e);
              } else if ((!bad || !reveal) && msg) {
                msg.remove();
              }
            });
            return missing.length === 0;
          }

          reqIds.forEach(function (id) {
            var el = node.querySelector('#' + id);
            if (!el) return;
            el.addEventListener('input', function () { touched[id] = true; validate(true); });
            el.addEventListener('change', function () { touched[id] = true; validate(true); });
            el.addEventListener('blur', function () { touched[id] = true; validate(true); });
          });
          validate(false);

          if (confirmBtn) confirmBtn.addEventListener('click', function () {
            if (reqIds.length) { reqIds.forEach(function (id) { touched[id] = true; }); if (!validate(true)) return; }
            done({ ok: true, values: readValues() });
            ov.close();
          });
        }
      });
    });
  };

  /* ---------------- menu ---------------- */
  ui.menu = function (anchor, items, opts) {
    var existing = document.querySelector('.menu[data-floating]');
    if (existing) existing.remove();
    opts = opts || {};
    var menu = U.h('div', { class: 'menu' });
    menu.setAttribute('data-floating', '1');
    if (opts.head) menu.insertAdjacentHTML('beforeend', opts.head);
    items.forEach(function (it) {
      if (it.sep) { menu.insertAdjacentHTML('beforeend', '<div class="menu__sep"></div>'); return; }
      if (it.label) { menu.insertAdjacentHTML('beforeend', '<div class="menu__label">' + esc(it.label) + '</div>'); return; }
      var b = U.h('button', { class: 'menu__item' + (it.danger ? ' menu__item--danger' : '') });
      b.innerHTML = '<span class="material-symbols-outlined">' + (it.icon || 'chevron_right') + '</span><span style="flex:1">' + esc(it.text) + '</span>' +
        (it.hint ? '<span class="tiny faint">' + esc(it.hint) + '</span>' : '');
      b.addEventListener('click', function () {
        menu.remove(); document.removeEventListener('mousedown', outside);
        if (it.onClick) it.onClick();
      });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    var w = menu.offsetWidth;
    var left = Math.min(r.right - w, window.innerWidth - w - 12);
    menu.style.left = Math.max(12, left) + 'px';
    menu.style.top = (r.bottom + 6) + 'px';
    if (r.bottom + menu.offsetHeight > window.innerHeight - 12) {
      menu.style.top = Math.max(12, r.top - menu.offsetHeight - 6) + 'px';
    }
    function outside(e) { if (!menu.contains(e.target) && !anchor.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', outside); } }
    setTimeout(function () { document.addEventListener('mousedown', outside); }, 0);
    return menu;
  };

  /* ---------------- states ---------------- */
  ui.empty = function (opts) {
    return '<div class="empty"><div class="empty__icon"><span class="material-symbols-outlined">' + (opts.icon || 'inbox') + '</span></div>' +
      '<h3>' + esc(opts.title || 'Tidak ada data') + '</h3>' +
      '<p>' + (opts.body || '') + '</p>' +
      (opts.action || '') + '</div>';
  };
  ui.skeletonTable = function (rows, cols) {
    var out = '<div class="table-wrap"><table class="table"><tbody>';
    for (var r = 0; r < (rows || 5); r++) {
      out += '<tr>';
      for (var c = 0; c < (cols || 4); c++) {
        out += '<td><div class="skeleton skeleton-line" style="width:' + (c === 0 ? 60 : 30 + Math.random() * 40) + '%"></div></td>';
      }
      out += '</tr>';
    }
    return out + '</tbody></table></div>';
  };
  ui.errorState = function (message, retryLabel) {
    return '<div class="empty"><div class="empty__icon" style="background:var(--danger-100);color:var(--danger-600)"><span class="material-symbols-outlined">cloud_off</span></div>' +
      '<h3>Data tidak dapat dimuat</h3><p>' + esc(message || 'Server lokal tidak merespons. Tidak ada tindakan yang dijalankan.') + '</p>' +
      (retryLabel ? '<button class="btn btn--secondary" data-retry><span class="material-symbols-outlined">refresh</span>' + esc(retryLabel) + '</button>' : '') + '</div>';
  };

  /* ---------------- table ---------------- */
  /* opts: {columns:[{key,label,render,raw,sortable,align,width,class}], rows, pageSize, onRowClick, rowClass, empty, selectable, toolbar} */
  ui.table = function (opts) {
    var state = { sort: opts.sort || null, dir: opts.dir || 'asc', page: 1, pageSize: opts.pageSize || 0, selected: {} };
    var wrap = U.h('div');
    var columns = opts.columns;
    var rows = opts.rows.slice();

    function sortRows() {
      if (!state.sort) return rows;
      var col = columns.filter(function (c) { return c.key === state.sort; })[0];
      var get = col && col.raw ? col.raw : function (r) { return r[col.key]; };
      rows.sort(function (a, b) {
        var x = get(a), y = get(b);
        if (x === y) return 0;
        if (x === undefined || x === null) return 1;
        if (y === undefined || y === null) return -1;
        var n = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'id');
        return state.dir === 'asc' ? n : -n;
      });
      return rows;
    }

    function paint() {
      var data = sortRows();
      var total = data.length;
      var paged = data;
      if (state.pageSize) {
        var maxPage = Math.max(1, Math.ceil(total / state.pageSize));
        if (state.page > maxPage) state.page = maxPage;
        paged = data.slice((state.page - 1) * state.pageSize, state.page * state.pageSize);
      }
      var head = '<tr>' + (opts.selectable ? '<th style="width:36px"><input type="checkbox" class="checkbox" data-check-all></th>' : '') +
        columns.map(function (c) {
          var sortable = c.sortable !== false && c.key;
          var aria = state.sort === c.key ? ' aria-sort="' + (state.dir === 'asc' ? 'ascending' : 'descending') + '"' : '';
          var ind = sortable ? '<span class="sort-ind"><span class="material-symbols-outlined">' + (state.sort === c.key ? (state.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more') + '</span></span>' : '';
          return '<th class="' + (sortable ? 'is-sortable ' : '') + (c.align === 'right' ? 'num ' : '') + (c.class || '') + '"' +
            (sortable ? ' data-sort="' + c.key + '"' : '') + (c.width ? ' style="width:' + c.width + '"' : '') + aria + '>' + esc(c.label) + ind + '</th>';
        }).join('') + '</tr>';

      var body;
      if (!paged.length) {
        body = '<tr><td colspan="' + (columns.length + (opts.selectable ? 1 : 0)) + '" style="padding:0">' +
          (opts.empty || ui.empty({ title: 'Tidak ada hasil', body: 'Ubah filter atau kata kunci pencarian.', icon: 'search_off' })) + '</td></tr>';
      } else {
        body = paged.map(function (r, i) {
          var cls = [];
          if (opts.onRowClick) cls.push('is-clickable');
          if (opts.rowClass) cls.push(opts.rowClass(r));
          return '<tr data-row="' + i + '" class="' + cls.join(' ') + '">' +
            (opts.selectable ? '<td><input type="checkbox" class="checkbox" data-check></td>' : '') +
            columns.map(function (c) {
              var v = c.render ? c.render(r) : esc(r[c.key]);
              return '<td class="' + (c.align === 'right' ? 'num ' : '') + (c.class || '') + '">' + (v === undefined || v === null || v === '' ? '<span class="faint">—</span>' : v) + '</td>';
            }).join('') + '</tr>';
        }).join('');
      }

      var foot = '';
      if (state.pageSize && total > state.pageSize) {
        var maxPage = Math.ceil(total / state.pageSize);
        var from = (state.page - 1) * state.pageSize + 1;
        var to = Math.min(total, state.page * state.pageSize);
        var pages = [];
        for (var p = 1; p <= maxPage; p++) {
          if (p === 1 || p === maxPage || Math.abs(p - state.page) <= 1) pages.push(p);
          else if (pages[pages.length - 1] !== '…') pages.push('…');
        }
        foot = '<div class="card__foot"><span class="tiny muted">' + from + '–' + to + ' dari ' + total + '</span><div class="spacer"></div>' +
          '<div class="pagination">' +
          '<button data-page="prev" ' + (state.page === 1 ? 'disabled' : '') + ' aria-label="Sebelumnya"><span class="material-symbols-outlined">chevron_left</span></button>' +
          pages.map(function (p) {
            return p === '…' ? '<button disabled>…</button>' : '<button data-page="' + p + '" class="' + (p === state.page ? 'is-active' : '') + '">' + p + '</button>';
          }).join('') +
          '<button data-page="next" ' + (state.page === maxPage ? 'disabled' : '') + ' aria-label="Berikutnya"><span class="material-symbols-outlined">chevron_right</span></button>' +
          '</div></div>';
      } else if (total > 0) {
        foot = '<div class="card__foot"><span class="tiny muted">' + total + ' baris</span></div>';
      }

      wrap.innerHTML = '<div class="table-wrap"><table class="table' + (opts.compact ? ' table--compact' : '') + '"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' + foot;

      wrap.querySelectorAll('th[data-sort]').forEach(function (th) {
        th.addEventListener('click', function () {
          var k = th.getAttribute('data-sort');
          if (state.sort === k) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
          else { state.sort = k; state.dir = 'asc'; }
          paint();
        });
      });
      wrap.querySelectorAll('[data-page]').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-page');
          if (v === 'prev') state.page--; else if (v === 'next') state.page++; else state.page = parseInt(v, 10);
          paint();
        });
      });
      wrap.querySelectorAll('tbody tr[data-row]').forEach(function (tr) {
        tr.addEventListener('click', function (e) {
          if (e.target.closest('input,button,a')) return;
          if (opts.onRowClick) opts.onRowClick(paged[parseInt(tr.getAttribute('data-row'), 10)]);
        });
      });
      var all = wrap.querySelector('[data-check-all]');
      if (all) all.addEventListener('change', function () {
        wrap.querySelectorAll('[data-check]').forEach(function (c) { c.checked = all.checked; });
      });
      if (opts.onPaint) opts.onPaint(wrap, state);
    }

    paint();
    return wrap;
  };

  /* ---------------- charts ---------------- */
  ui.spark = function (values, color, opts) {
    opts = opts || {};
    var w = opts.width || 120, hgt = opts.height || 34, pad = 2;
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var span = max - min || 1;
    var step = (w - pad * 2) / Math.max(1, values.length - 1);
    var pts = values.map(function (v, i) {
      return [pad + i * step, hgt - pad - ((v - min) / span) * (hgt - pad * 2)];
    });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + (w - pad) + ' ' + hgt + ' L' + pad + ' ' + hgt + ' Z';
    var id = 'sg' + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 ' + w + ' ' + hgt + '" preserveAspectRatio="none" style="width:100%;height:' + hgt + 'px">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" style="stop-color:' + color + ';stop-opacity:.18"/><stop offset="100%" style="stop-color:' + color + ';stop-opacity:0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')"/>' +
      '<path d="' + line + '" fill="none" style="stroke:' + color + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  };

  ui.areaChart = function (opts) {
    var labels = opts.labels, series = opts.series; // series: [{name,color,values}]
    var w = 640, hgt = opts.height || 220, padL = 34, padR = 8, padT = 12, padB = 26;
    var all = series.reduce(function (a, s) { return a.concat(s.values); }, [0]);
    var max = Math.max.apply(null, all);
    var niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    var innerW = w - padL - padR, innerH = hgt - padT - padB;
    var stepX = innerW / Math.max(1, labels.length - 1);
    var out = '<div class="chart-box"><svg viewBox="0 0 ' + w + ' ' + hgt + '" style="height:' + hgt + 'px">';
    // grid
    for (var g = 0; g <= 4; g++) {
      var y = padT + (innerH / 4) * g;
      out += '<line x1="' + padL + '" y1="' + y + '" x2="' + (w - padR) + '" y2="' + y + '" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="' + (g === 4 ? '0' : '3 4') + '"/>';
      out += '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" style="fill:var(--faint);font-size:10px;font-family:var(--font-sans)">' + Math.round(niceMax - (niceMax / 4) * g) + '</text>';
    }
    series.forEach(function (s) {
      var pts = s.values.map(function (v, i) { return [padL + i * stepX, padT + innerH - (v / niceMax) * innerH]; });
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      var id = 'ac' + Math.random().toString(36).slice(2, 7);
      out += '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" style="stop-color:' + s.color + ';stop-opacity:.22"/><stop offset="100%" style="stop-color:' + s.color + ';stop-opacity:0"/></linearGradient></defs>';
      out += '<path d="' + line + ' L' + pts[pts.length - 1][0] + ' ' + (padT + innerH) + ' L' + padL + ' ' + (padT + innerH) + ' Z" fill="url(#' + id + ')"/>';
      out += '<path d="' + line + '" fill="none" style="stroke:' + s.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      pts.forEach(function (p, i) {
        out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" style="fill:var(--surface);stroke:' + s.color + '" stroke-width="2"><title>' + esc(labels[i]) + ': ' + s.values[i] + '</title></circle>';
      });
    });
    labels.forEach(function (l, i) {
      if (labels.length > 8 && i % 2) return;
      out += '<text x="' + (padL + i * stepX) + '" y="' + (hgt - 6) + '" text-anchor="middle" style="fill:var(--faint);font-size:10px;font-family:var(--font-sans)">' + esc(l) + '</text>';
    });
    out += '</svg></div>';
    return out;
  };

  ui.donut = function (opts) {
    var segs = opts.segments, size = opts.size || 148, stroke = opts.stroke || 16;
    var total = segs.reduce(function (a, s) { return a + s.value; }, 0) || 1;
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, off = 0;
    var out = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:' + size + 'px;height:' + size + 'px">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" style="stroke:var(--surface-3)" stroke-width="' + stroke + '"/>';
    segs.forEach(function (s) {
      var len = (s.value / total) * c;
      out += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" style="stroke:' + s.color + '" stroke-width="' + stroke + '"' +
        ' stroke-dasharray="' + (len - 2) + ' ' + (c - len + 2) + '" stroke-dashoffset="' + (-off) + '" stroke-linecap="round"' +
        ' transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"><title>' + esc(s.label) + ': ' + s.value + '</title></circle>';
      off += len;
    });
    out += '<text x="' + size / 2 + '" y="' + (size / 2 - 2) + '" text-anchor="middle" style="fill:var(--text);font-size:22px;font-weight:700;font-family:var(--font-display)">' + (opts.centerValue !== undefined ? opts.centerValue : total) + '</text>';
    out += '<text x="' + size / 2 + '" y="' + (size / 2 + 16) + '" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-family:var(--font-sans)">' + esc(opts.centerLabel || 'total') + '</text>';
    out += '</svg>';
    return out;
  };

  /* Compact status breakdown strip. One card, segmented — avoids a row of
     oversized KPI widgets where a simple count breakdown is what's needed. */
  ui.statstrip = function (items, opts) {
    opts = opts || {};
    return '<div class="statstrip' + (opts.className ? ' ' + opts.className : '') + '">' +
      items.map(function (it) {
        var inner = '<span class="statstrip__label">' + esc(it.label) + '</span>' +
          '<span class="statstrip__value' + (it.tone ? ' statstrip__value--' + it.tone : '') + '">' + (it.value === undefined ? '—' : it.value) + '</span>' +
          (it.hint ? '<span class="statstrip__hint">' + esc(it.hint) + '</span>' : '');
        return it.href
          ? '<a class="statstrip__item" href="' + it.href + '">' + inner + '</a>'
          : '<div class="statstrip__item">' + inner + '</div>';
      }).join('') +
      '</div>';
  };

  ui.bars = function (rows, opts) {    opts = opts || {};
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    return rows.map(function (r) {
      return '<div class="bar-row"><span class="bar-row__label">' + esc(r.label) + '</span>' +
        '<span class="bar-row__track"><i class="bar-row__fill" style="width:' + Math.round((r.value / max) * 100) + '%;' + (r.color ? 'background:' + r.color : '') + '"></i></span>' +
        '<span class="bar-row__val">' + r.value + '</span></div>';
    }).join('');
  };

  /* ---------------- forms ---------------- */
  ui.field = function (opts) {
    return '<div class="field' + (opts.error ? ' has-error' : '') + '">' +
      '<label class="field__label" for="' + attr(opts.id || '') + '">' + esc(opts.label) + (opts.required ? '<span class="req">*</span>' : '') + '</label>' +
      (opts.control || '') +
      (opts.error ? '<div class="field__error"><span class="material-symbols-outlined">error</span>' + esc(opts.error) + '</div>' : '') +
      (opts.hint ? '<div class="field__hint">' + opts.hint + '</div>' : '') +
      '</div>';
  };
  function attr(s) { return String(s).replace(/"/g, '&quot;'); }

  ui.select = function (id, options, value, attrs) {
    return '<select class="select" id="' + id + '" ' + (attrs || '') + '>' +
      options.map(function (o) { return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') +
      '</select>';
  };

  /* ---------------- misc ---------------- */
  ui.honest = function (text) { return '<span class="honest"><span class="material-symbols-outlined">science</span>' + esc(text) + '</span>'; };
  ui.demoBanner = function (extra) {
    if (D.store.mode !== 'demo') return '';
    return '<div class="banner banner--demo" style="margin-bottom:16px"><span class="material-symbols-outlined">science</span>' +
      '<div><b>Data demo.</b> Server MCP lokal tidak terdeteksi, jadi layar ini memakai dataset contoh. Tidak ada tindakan nyata yang dijalankan.' +
      (extra ? ' ' + extra : '') + '</div></div>';
  };
  /* Real server data, but the server cannot answer the question this screen asks.
   * Shown in live mode so the gap is visible instead of papered over. */
  ui.partialBanner = function (text) {
    if (D.store.mode === 'demo') return '';
    return '<div class="banner banner--warning" style="margin-bottom:16px"><span class="material-symbols-outlined">rule</span>' +
      '<div><b>Data sebagian.</b> ' + text + '</div></div>';
  };
  ui.prototypeBanner = function (text) {
    return '<div class="banner banner--warning" style="margin-bottom:16px"><span class="material-symbols-outlined">construction</span>' +
      '<div><b>Prototipe.</b> ' + text + '</div></div>';
  };
  ui.kpi = function (o) {
    return '<div class="card kpi kpi--' + (o.tone || '') + '">' +
      '<div class="kpi__top"><span class="kpi__label">' + esc(o.label) + '</span>' +
      '<span class="kpi__icon"><span class="material-symbols-outlined">' + (o.icon || 'analytics') + '</span></span></div>' +
      '<div class="kpi__value">' + (o.value === undefined ? '—' : o.value) + (o.unit ? '<small>' + esc(o.unit) + '</small>' : '') + '</div>' +
      '<div class="kpi__foot">' + (o.foot || '') + '</div>' +
      (o.spark ? '<div class="kpi__spark">' + o.spark + '</div>' : '') +
      '</div>';
  };
  ui.sectionHead = function (title, desc, actions) {    return '<div class="row" style="margin-bottom:12px"><div style="flex:1;min-width:0"><h2>' + esc(title) + '</h2>' +
      (desc ? '<p class="small muted" style="margin-top:2px">' + desc + '</p>' : '') + '</div>' + (actions || '') + '</div>';
  };

  ui.pageHead = function (o) {
    return '<div class="page-head"><div class="page-head__text">' +
      (o.eyebrow ? '<div class="page-head__eyebrow">' + o.eyebrow + '</div>' : '') +
      '<h1>' + (o.title || '') + '</h1>' +
      (o.desc ? '<p>' + o.desc + '</p>' : '') +
      '</div>' + (o.actions ? '<div class="page-head__actions">' + o.actions + '</div>' : '') + '</div>';
  };

  ui.card = function (o) {
    return '<section class="card' + (o.className ? ' ' + o.className : '') + '">' +
      (o.title ? '<div class="card__head"><div style="min-width:0"><h2>' + o.title + '</h2>' +
        (o.desc ? '<p>' + o.desc + '</p>' : '') + '</div><div class="spacer"></div>' + (o.actions || '') + '</div>' : '') +
      '<div class="' + (o.flush ? 'card__body card__body--flush' : 'card__body') + '"' + (o.bodyId ? ' id="' + o.bodyId + '"' : '') + '>' +
      (o.body && o.body.nodeType ? '<div data-mount="1"></div>' : (o.body || '')) + '</div>' +
      (o.foot ? '<div class="card__foot">' + o.foot + '</div>' : '') +
      '</section>';
  };

  /* mount a DOM node into a card body that was rendered as a string */
  ui.mount = function (root, selector, node) {
    var host = root.querySelector(selector);
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(node);
  };

  /* compact plan row used by inbox / my work / overview */
  ui.planRow = function (p, opts) {
    opts = opts || {};
    var risk = D.RISK[p.risk] ? p.risk : 'low';
    var href = '#/work-packages/' + encodeURIComponent(p.plan_id);
    if (p.status === 'READY' || p.status === 'NEEDS_REVIEW') href = '#/review/' + encodeURIComponent(p.plan_id);
    return '<a class="plan-row" href="' + href + '" style="display:block;padding:12px 16px;border-bottom:1px solid var(--border)">' +
      '<div class="row" style="align-items:flex-start;gap:10px">' +
        '<div style="flex:1;min-width:0">' +
          '<div class="row" style="gap:8px;margin-bottom:2px">' +
            '<span class="mono faint" style="font-size:10.5px">' + esc(p.plan_id) + '</span>' +
            D.planStatusBadge(p) +
            (risk === 'high' || risk === 'critical' ? D.riskBadge(risk) : '') +
          '</div>' +
          '<div class="small strong truncate" style="color:var(--text)">' + esc(p.intent) + '</div>' +
          '<div class="tiny muted" style="margin-top:2px">' + esc((D.store.specialist(p.specialist) || {}).name || '—') + ' · ' + U.rel(p.created_at) + '</div>' +
        '</div>' +
        (opts.action === false ? '' : '<span class="material-symbols-outlined" style="font-size:17px;color:var(--faint);margin-top:2px">chevron_right</span>') +
      '</div></a>';
  };

  ui.avatarStack = function (names) {
    return '<div style="display:flex">' + names.slice(0, 3).map(function (n, i) {
      return '<span class="avatar avatar--sm" style="margin-left:' + (i ? '-6px' : '0') + ';border:2px solid var(--surface)" title="' + esc(n) + '">' + esc(U.initials(n)) + '</span>';
    }).join('') + '</div>';
  };

  D.ui = ui;
})();
