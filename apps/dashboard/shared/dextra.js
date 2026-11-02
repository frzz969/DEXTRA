/* DEXTRA dashboard runtime — shared by every Stitch screen.
   Offline-first: all assets are local, only the MCP server on 127.0.0.1 is contacted. */
(function () {
  'use strict';

  var API = 'http://127.0.0.1:8765';
  var TOKEN_KEY = 'dextra_ops_token';
  var PLANS_KEY = 'dextra_plans';

  var ROUTES = {
    overview: 'overview.html',
    'create-request': 'buat-permintaan.html',
    'buat-permintaan': 'buat-permintaan.html',
    'my-requests': 'permintaan-saya.html',
    'approval-inbox': 'kotak-persetujuan.html',
    'kotak-persetujuan': 'kotak-persetujuan.html',
    'approval-history': 'permintaan-saya.html',
    'work-packages': 'permintaan-saya.html',
    'work-package': 'work-package.html',
    audit: 'audit.html',
    'aktivitas-dan-audit': 'audit.html',
    mandates: 'mandat.html',
    workforce: 'workforce.html',
    policies: 'kebijakan.html',
    'kebijakan-mandat': 'kebijakan.html',
    settings: 'pengaturan.html',
    pengaturan: 'pengaturan.html',
    login: 'masuk.html'
  };

  /* Pages that exist in the Stitch export but are not wired to a real feature yet.
     They stay visible but inert, instead of pretending to work. */
  var NOT_YET = { 'knowledge-base': 'Knowledge base belum tersedia di MVP', notifications: 'Pusat notifikasi belum tersedia di MVP' };

  function token() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; }
    catch (_) { return ''; }
  }
  function setToken(t, remember) {
    try { sessionStorage.setItem(TOKEN_KEY, t); if (remember) localStorage.setItem(TOKEN_KEY, t); } catch (_) {}
  }

  function call(tool, args) {
    return fetch(API + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: tool, arguments: args || {} } })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      if (json.error) throw new Error(json.error.message || 'Panggilan tool gagal');
      var text = json.result && json.result.content && json.result.content[0] && json.result.content[0].text;
      var parsed = text ? JSON.parse(text) : {};
      if (parsed && parsed.ok === false) throw new Error((parsed.error && parsed.error.message) || 'Tool menolak permintaan');
      return parsed ? parsed.data : {};
    });
  }

  function health() {
    return fetch(API + '/health').then(function (r) { return r.ok; }).catch(function () { return false; });
  }

  function readPlans() { try { return JSON.parse(localStorage.getItem(PLANS_KEY) || '[]'); } catch (_) { return []; } }
  function writePlans(ids) { try { localStorage.setItem(PLANS_KEY, JSON.stringify(ids)); } catch (_) {} }

  /* The MCP server has no "list plans" tool, so the id set is the union of
     locally-created plans and plan ids that appear in the audit log. */
  function listPlanIds() {
    var ids = readPlans().slice();
    return call('get_audit_log', { limit: 200 }).catch(function () { return { events: [] }; }).then(function (data) {
      (data.events || []).forEach(function (e) { if (e.plan_id && ids.indexOf(e.plan_id) < 0) ids.push(e.plan_id); });
      writePlans(ids);
      return ids;
    });
  }

  function getPlans() {
    return listPlanIds().then(function (ids) {
      return Promise.all(ids.map(function (id) { return call('get_plan', { plan_id: id }).then(function (d) { return d.plan; }).catch(function () { return null; }); }));
    }).then(function (rows) { return rows.filter(Boolean); });
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }); }
    catch (_) { return String(iso); }
  }

  function relTime(iso) {
    if (!iso) return '—';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' menit lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    var d = Math.floor(h / 24);
    if (d === 1) return 'kemarin';
    if (d < 7) return d + ' hari lalu';
    return fmtDate(iso);
  }

  function clockLabel(d) {
    var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    var wib = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000);
    var hh = String(wib.getHours()).padStart(2, '0');
    var mm = String(wib.getMinutes()).padStart(2, '0');
    return days[wib.getDay()] + ', ' + wib.getDate() + ' ' + months[wib.getMonth()] + ' ' + wib.getFullYear() + ' · ' + hh + ':' + mm + ' WIB';
  }

  var STATUS = {
    READY: { label: 'Siap Ditinjau', cls: 'bg-[#FEF7ED] text-[#B4761F]' },
    NEEDS_REVIEW: { label: 'Perlu Tinjauan', cls: 'bg-[#FEF7ED] text-[#B4761F]' },
    BLOCKED: { label: 'Diblokir', cls: 'bg-[#FDF2F3] text-[#D95362]' },
    DRAFT: { label: 'Draf', cls: 'bg-[#F3F2F9] text-[#77778C]' },
    EXECUTED: { label: 'Terlaksana', cls: 'bg-[#E8F7F1] text-[#269B72]' },
    REJECTED: { label: 'Ditolak', cls: 'bg-[#FDF2F3] text-[#D95362]' }
  };
  var RISK = {
    low: { label: 'Rendah', cls: 'bg-[#E8F7F1] text-[#269B72]' },
    medium: { label: 'Sedang', cls: 'bg-[#FEF7ED] text-[#B4761F]' },
    high: { label: 'Tinggi', cls: 'bg-[#FDF2F3] text-[#D95362]' },
    critical: { label: 'Kritis', cls: 'bg-[#D95362] text-white' }
  };

  function badge(kind, key, extraCls) {
    var src = kind === 'risk' ? RISK : STATUS;
    var hit = src[key] || { label: key || '—', cls: 'bg-[#F3F2F9] text-[#77778C]' };
    return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ' + hit.cls + (extraCls ? ' ' + extraCls : '') + '">' + esc(hit.label) + '</span>';
  }

  function toast(message, type) {
    var host = document.getElementById('dextra-toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'dextra-toast-host';
      host.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:flex-end;';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    var bg = type === 'error' ? '#D95362' : type === 'success' ? '#269B72' : '#202033';
    el.style.cssText = 'background:' + bg + ';color:#fff;padding:11px 16px;border-radius:10px;font-size:13px;font-weight:500;box-shadow:0 8px 24px -4px rgba(32,32,51,.24);opacity:0;transform:translateY(8px);transition:opacity .18s,transform .18s;max-width:380px;';
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'none'; });
    setTimeout(function () {
      el.style.opacity = '0'; el.style.transform = 'translateY(8px)';
      setTimeout(function () { el.remove(); }, 220);
    }, 3400);
  }

  function offlineNotice() {
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:9999;background:#FEF7ED;color:#8A5B12;border:1px solid #F3DDBB;padding:8px 14px;border-radius:9999px;font-size:12px;font-weight:600;box-shadow:0 6px 16px -6px rgba(32,32,51,.2);';
    bar.textContent = 'Server MCP tidak terhubung — data yang tampil mungkin kosong.';
    document.body.appendChild(bar);
    setTimeout(function () { bar.remove(); }, 6000);
  }

  function wireNav() {
    document.querySelectorAll('[data-path]').forEach(function (el) {
      var path = el.getAttribute('data-path');
      var target = ROUTES[path];
      if (target) {
        el.setAttribute('href', target);
        el.removeAttribute('aria-disabled');
        return;
      }
      if (NOT_YET[path]) {
        el.removeAttribute('href');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('title', NOT_YET[path]);
        el.style.opacity = '0.45';
        el.style.cursor = 'not-allowed';
        el.addEventListener('click', function (ev) { ev.preventDefault(); toast(NOT_YET[path], 'info'); });
        return;
      }
      el.removeAttribute('href');
      el.style.cursor = 'default';
    });

    // Logout entries point at the login screen.
    document.querySelectorAll('[title="Keluar"]').forEach(function (el) { el.setAttribute('href', 'masuk.html'); });
  }

  function paintClock() {
    var rx = /^(Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu),\s\d{1,2}\s\w+\s\d{4}\s·\s\d{1,2}:\d{2}\sWIB$/;
    document.querySelectorAll('span,div,p').forEach(function (el) {
      if (el.children.length === 0 && rx.test((el.textContent || '').trim())) el.textContent = clockLabel(new Date());
    });
  }

  function refreshSidebarCounts() {
    getPlans().then(function (plans) {
      var waiting = plans.filter(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; }).length;
      document.querySelectorAll('a[data-path="kotak-persetujuan"], a[data-path="approval-inbox"]').forEach(function (a) {
        var chip = a.querySelector('span.rounded-full, span[class*="rounded-full"]');
        if (!chip) return;
        if (waiting > 0) { chip.textContent = String(waiting); chip.style.display = ''; }
        else { chip.style.display = 'none'; }
      });
    }).catch(function () {});
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireNav();
    paintClock();
    setInterval(paintClock, 30000);
    health().then(function (ok) { if (!ok) offlineNotice(); });
    refreshSidebarCounts();
  });

  window.DEXTRA = {
    API: API, call: call, health: health, token: token, setToken: setToken,
    getPlans: getPlans, listPlanIds: listPlanIds,
    esc: esc, fmtDate: fmtDate, relTime: relTime, clockLabel: clockLabel,
    statusBadge: function (s) { return badge('status', s); },
    riskBadge: function (r) { return badge('risk', r); },
    toast: toast,
    routes: ROUTES,
    // Mark a plan as executed by joining audit events, since plan status never changes after creation.
    annotate: function (plans, events) {
      var done = {};
      (events || []).forEach(function (e) { if (e.type === 'action_executed' && e.plan_id && e.action_id) done[e.plan_id + '::' + e.action_id] = true; });
      return plans.map(function (p) {
        var acts = p.actions || [];
        var allDone = p.status !== 'BLOCKED' && acts.length > 0 && acts.every(function (a) { return done[p.plan_id + '::' + a.action_id]; });
        p._state = allDone ? 'EXECUTED' : (p.status || 'DRAFT');
        return p;
      }).sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
    }
  };
})();
