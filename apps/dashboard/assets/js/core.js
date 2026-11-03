/* DEXTRA Dashboard — core runtime: utils, session, permissions, API bridge, router. */
(function () {
  'use strict';
  var D = (window.DEXTRA = window.DEXTRA || {});

  var API = 'http://127.0.0.1:8765';
  var TOKEN_KEY = 'dextra_ops_token';

  /* ---------------- utils ---------------- */
  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(s) { return esc(s).replace(/`/g, '&#96;'); }
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return String(iso); }
  }
  function fmtDay(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }); }
    catch (e) { return String(iso); }
  }
  function fmtTime(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB'; }
    catch (e) { return String(iso); }
  }
  function rel(iso) {
    if (!iso) return '—';
    var t = new Date(iso).getTime();
    if (isNaN(t)) return '—';
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' mnt lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    var d = Math.floor(h / 24);
    if (d === 1) return 'kemarin';
    if (d < 7) return d + ' hari lalu';
    return fmtDay(iso);
  }
  function initials(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms || 200); };
  }
  function qs(name, fallback) {
    var v = new URLSearchParams(location.search).get(name);
    return v === null ? fallback : v;
  }
  function csv(rows) {
    return rows.map(function (r) {
      return r.map(function (c) { var s = String(c === undefined || c === null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
    }).join('\n');
  }
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== false) el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }

  /* ---------------- status vocabulary ---------------- */
  var STATUS = {
    DRAFT: { label: 'Draf', tone: 'outline', icon: 'edit_note', desc: 'Belum diajukan untuk validasi.' },
    READY: { label: 'Siap Ditinjau', tone: 'warning', icon: 'pending_actions', desc: 'Lolos validasi, menunggu keputusan manusia.' },
    NEEDS_REVIEW: { label: 'Perlu Tinjauan', tone: 'warning', icon: 'rate_review', desc: 'Ada temuan yang butuh perhatian manusia.' },
    BLOCKED: { label: 'Diblokir', tone: 'danger', icon: 'block', desc: 'Kebijakan memblokir eksekusi.' },
    APPROVED: { label: 'Disetujui', tone: 'success', icon: 'verified', desc: 'Mandat terbit, eksekusi belum berjalan.' },
    REJECTED: { label: 'Ditolak', tone: 'danger', icon: 'cancel', desc: 'Ditolak oleh manusia.' },
    EXECUTED: { label: 'Terlaksana', tone: 'success', icon: 'check_circle', desc: 'Dieksekusi dengan mandat.' }
  };
  var RISK = {
    low: { label: 'Risiko rendah', tone: 'success' },
    medium: { label: 'Risiko sedang', tone: 'warning' },
    high: { label: 'Risiko tinggi', tone: 'danger' },
    critical: { label: 'Risiko kritis', tone: 'danger' }
  };
  var MANDATE_STATUS = {
    active: { label: 'Aktif', tone: 'success' },
    expired: { label: 'Kedaluwarsa', tone: 'outline' },
    revoked: { label: 'Dicabut', tone: 'danger' }
  };

  var ACTORS = {
    workforce_dispatcher: 'Workforce Dispatcher', ea: 'Executive Assistant', ao: 'Administrative Officer',
    adversarial_reviewer: 'Adversarial Reviewer', policy_validator: 'Policy Validator',
    executor: 'Executor', mandate_engine: 'Mandate Engine', audit_log: 'Audit Log', system: 'Sistem'
  };
  function actorName(id) { return ACTORS[id] || id || 'sistem'; }

  /* readable labels for audit event types, shared by audit trail / activity rails */
  var EVENTS = {
    request_received: 'Permintaan diterima',
    intent_interpreted: 'Niat dipecah',
    specialist_assigned: 'Spesialis ditugaskan',
    plan_drafted: 'Rencana disusun',
    policy_validated: 'Validasi kebijakan',
    policy_blocked: 'Diblokir kebijakan',
    adversarial_review: 'Sidik adversarial',
    approval_granted: 'Disetujui manusia',
    approval_rejected: 'Ditolak manusia',
    revision_requested: 'Revisi diminta',
    mandate_issued: 'Mandat terbit',
    mandate_revoked: 'Mandat dicabut',
    action_executed: 'Tindakan dieksekusi',
    audit_recorded: 'Dicatat di audit'
  };
  function eventLabel(type) {
    return EVENTS[type] || String(type || '').replace(/_/g, ' ');
  }
  function eventTone(type) {
    if (/block|reject|revoke/.test(type)) return 'danger';
    if (/granted|issued|executed|validated/.test(type)) return 'success';
    if (/revis|clarif/.test(type)) return 'warning';
    return '';
  }

  function badge(label, tone, dot) {
    return '<span class="badge badge--' + (tone || '') + '">' + (dot ? '<i class="dot"></i>' : '') + esc(label) + '</span>';
  }
  function statusBadge(s) {
    var m = STATUS[s] || { label: s || '—', tone: '' };
    return '<span class="badge badge--' + m.tone + '">' + esc(m.label) + '</span>';
  }
  function riskBadge(r) {
    var m = RISK[r] || RISK.low;
    return '<span class="badge badge--' + m.tone + '">' + esc(m.label) + '</span>';
  }
  function mandateBadge(s) {
    var m = MANDATE_STATUS[s] || { label: s, tone: '' };
    return '<span class="badge badge--' + m.tone + '">' + esc(m.label) + '</span>';
  }

  /* ---------------- session & permissions ---------------- */
  var ROLE_LABEL = {
    operations_manager: 'Operations Manager', governance_lead: 'Governance Lead',
    legal_reviewer: 'Legal Reviewer', finance_approver: 'Finance Approver',
    requester: 'Requester', auditor: 'Auditor', org_admin: 'Organization Admin'
  };

  /*
   * Session.
   *
   * `user` is a DISPLAY persona. It is not an identity and carries no authority:
   * the server never receives it, so it cannot be the basis of any decision.
   * What actually decides is `serverCapabilities`, reported by the MCP server
   * for the token this browser authenticated with (get_caller_context).
   *
   * In demo mode there is no server, so the simulated permission matrix is used.
   * Demo mode says so on every screen that uses it.
   */
  var session = {
    user: {
      id: 'user_001', name: 'Farhan Pratama', role: 'operations_manager',
      title: 'Operations Manager', dept: 'Operasi', org: 'Kenari Group'
    },
    scope: null,
    serverCapabilities: null,
    serverUnbacked: null,

    applyServerContext: function (ctx) {
      if (!ctx) {
        this.scope = null;
        this.serverCapabilities = null;
        this.serverUnbacked = null;
        return;
      }
      this.scope = typeof ctx.scope === 'string' ? ctx.scope : null;
      this.serverCapabilities = Array.isArray(ctx.capabilities) ? ctx.capabilities.slice() : [];
      this.serverUnbacked = Array.isArray(ctx.unbacked_capabilities) ? ctx.unbacked_capabilities.slice() : [];
    },

    /* True when the browser is relying on the simulated matrix instead of the server. */
    simulated: function () { return this.serverCapabilities === null; },

    /*
     * Three outcomes, and the distinction is the whole point:
     *   granted     — the server says this scope holds it
     *   denied      — the capability exists, this scope does not hold it
     *   unavailable — the server implements no authorization for it at all
     * "unavailable" is not a refusal. Rendering it as one would claim a decision
     * that was never made.
     */
    capState: function (cap) {
      if (!cap) return 'granted';
      if (this.serverCapabilities) {
        if (this.serverCapabilities.indexOf(cap) >= 0) return 'granted';
        if (this.serverUnbacked && this.serverUnbacked.indexOf(cap) >= 0) return 'unavailable';
        return 'denied';
      }
      var row = (D.demo.permMatrix || {})[this.user.role] || {};
      var v = row[cap];
      return (v === 'yes' || v === 'lim') ? 'granted' : 'denied';
    },

    can: function (cap) { return this.capState(cap) === 'granted'; },

    limited: function (cap) {
      if (this.serverCapabilities) return false; /* the server does not model partial grants */
      var row = (D.demo.permMatrix || {})[this.user.role] || {};
      return row[cap] === 'lim';
    },

    /* Identity as the server understands it, or the demo persona. Never mixed. */
    roleLabel: function () {
      if (this.serverCapabilities) return 'Token ' + this.scope + ' · server';
      return ROLE_LABEL[this.user.role] || this.user.role;
    },

    identityLine: function () {
      if (this.serverCapabilities) {
        return 'Terautentikasi sebagai scope ' + this.scope +
          '. Tidak ada identitas per orang: token membawa wewenang, bukan nama.';
      }
      return 'Mode demo: persona contoh, bukan identitas terautentikasi.';
    }
  };

  /*
   * Audit `detail` is a Record<string,string> per AuditEventSchema, but several
   * views rendered it with esc() as if it were a string, which prints
   * "[object Object]". Flatten it once, here, and let every caller share it.
   */
  function detailText(d) {
    if (d === null || d === undefined) return '';
    if (typeof d === 'string') return d;
    if (typeof d === 'number' || typeof d === 'boolean') return String(d);
    if (Array.isArray(d)) return d.map(detailText).filter(Boolean).join(' · ');
    if (typeof d === 'object') {
      return Object.keys(d).map(function (k) {
        var v = d[k];
        var s = (v === null || v === undefined) ? '—'
          : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        return k + '=' + s;
      }).join(' · ');
    }
    return String(d);
  }

  /* ---------------- API bridge ----------------
     Transport tinggal di packages/api-client/src/api-client.js. Berkas ini hanya
     merakitnya; kalau bridge tidak dimuat, gagal keras alih-alih diam-diam
     mengarang perilaku lain. */
  if (!window.DEXTRA_API || typeof window.DEXTRA_API.create !== 'function') {
    throw new Error('packages/api-client tidak dimuat sebelum core.js');
  }
  var api = window.DEXTRA_API.create({ baseUrl: API, tokenKey: TOKEN_KEY });

  /* ---------------- store (demo + live overlay) ---------------- */
  var store = {
    mode: 'demo',
    plans: [], mandates: [], audit: [], executions: [], policies: [], org: null,
    users: [], roles: [], specialists: [], integrations: [], notifications: [], board: [],
    contacts: [], capabilities: [], permMatrix: {}, assistantThread: [],
    overlay: {}, // local prototype mutations (demo only), keyed by plan id

    hydrateDemo: function () {
      var s = D.demo;
      this.plans = s.plans.map(function (p) { return Object.assign({}, p); });
      this.mandates = s.mandates.slice();
      this.audit = s.audit.slice();
      this.executions = s.executions.slice();
      this.policies = s.policies.map(function (p) { return Object.assign({}, p); });
      this.org = s.org;
      this.users = s.users.slice();
      this.roles = s.roles.slice();
      this.specialists = s.specialists.slice();
      this.integrations = s.integrations.slice();
      this.notifications = s.notifications.slice();
      this.board = s.board.map(function (b) { return Object.assign({}, b); });
      this.contacts = s.contacts.slice();
      this.capabilities = s.capabilities;
      this.permMatrix = s.permMatrix;
      this.assistantThread = s.assistantThread.slice();
    },

    /* live: list_plans / list_mandates are the primary source; the audit-derived
       path stays as a fallback for an older server that only has get-by-id. */
    hydrateLive: function () {
      var self = this;

      var auditP = api.call('get_audit_log', { limit: 500 }).then(function (d) {
        self.audit = (d.events || []).slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
      }).catch(function () { self.audit = []; });

      var plansP = auditP.then(function () {
        return api.call('list_plans', { limit: 200 }).then(function (d) {
          return (d.plans || []).slice();
        }).catch(function () {
          var ids = [];
          self.audit.forEach(function (e) { if (e.plan_id && ids.indexOf(e.plan_id) < 0) ids.push(e.plan_id); });
          return Promise.all(ids.map(function (id) {
            return api.call('get_plan', { plan_id: id }).then(function (r) { return r.plan; }).catch(function () { return null; });
          })).then(function (rows) { return rows.filter(Boolean); });
        });
      });

      var mandatesP = api.call('list_mandates', { limit: 200 }).then(function (d) {
        return (d.mandates || []).map(function (m) {
          return {
            mandate_id: m.mandate_id,
            plan_id: m.plan_id,
            plan_hash: m.plan_hash,
            scope: (m.allowed_action_types || []).join(' · ') + ' · maks risiko ' + m.max_risk,
            issued_by: m.issued_by,
            issued_at: m.issued_at,
            expires_at: m.expires_at,
            status: m.status,
            max_uses: (m.allowed_action_ids || []).length,
            uses: null /* the server does not report consumption; do not invent it */
          };
        });
      }).catch(function () { return null; });

      var executionsP = api.call('list_executions', { limit: 200 }).then(function (d) {
        return (d.executions || []).map(function (e) {
          var ev = e.evidence || {};
          return {
            execution_id: e.execution_id,
            plan_id: null, /* filled from the mandate below — the store does not denormalise it */
            action_id: e.action_id,
            mandate_id: e.mandate_id,
            at: e.executed_at,
            result: e.result,
            adapter: 'mcp',
            detail: ev.mock_message_id || ev.mock_event_id || ev.mock_task_id || e.reason_code || '—',
            duration_ms: 0
          };
        });
      }).catch(function () { return null; });

      return Promise.all([plansP, mandatesP, executionsP]).then(function (res) {
        self.plans = res[0].map(function (p) {
          p.specialist = p.specialist || 'dispatcher';
          p.risk = (p.actions || []).reduce(function (m, a) {
            var order = { low: 0, medium: 1, high: 2, critical: 3 };
            return (order[a.risk] || 0) > (order[m] || 0) ? a.risk : m;
          }, 'low');
          /* The MCP server authenticates a scope (agent/ops), not a person, and the
           * Plan contract carries no requester field. Stamping the signed-in user
           * here would invent ownership and make /requests lie. Leave it null and
           * let the view say ownership is not recorded. */
          p.requester = p.requester || null;
          return p;
        }).sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });

        if (res[1]) {
          self.mandates = res[1];
        } else {
          var seen = {};
          self.mandates = self.audit.filter(function (e) { return e.type === 'approval_granted' && e.mandate_id; })
            .filter(function (e) { if (seen[e.mandate_id]) return false; seen[e.mandate_id] = true; return true; })
            .map(function (e) { return { mandate_id: e.mandate_id, plan_id: e.plan_id, scope: 'lihat detail work package', issued_at: e.at, expires_at: null, issued_by: e.actor || '—', status: 'active', plan_hash: e.plan_hash || '', uses: null, max_uses: null }; });
        }

        if (res[2]) {
          var planByMandate = {};
          self.mandates.forEach(function (m) { planByMandate[m.mandate_id] = m.plan_id; });
          self.executions = res[2].map(function (e) {
            e.plan_id = planByMandate[e.mandate_id] || null;
            e.source = 'execution';
            return e;
          });
        } else {
          /*
           * list_executions failed. Fall back to audit events, but do NOT dress
           * them up as execution records:
           *   - no invented execution_id (the old code minted 'EX-5500')
           *   - result is null, because an audit event records that something
           *     was executed, not that the send succeeded
           * `source` lets the view say where the row came from. An audit event
           * and an execution record are different evidence; showing one as the
           * other would make the page claim more than the server said.
           */
          self.executions = self.audit.filter(function (e) { return e.type === 'action_executed'; }).map(function (e) {
            return {
              execution_id: null,
              source: 'audit',
              plan_id: e.plan_id,
              action_id: e.action_id,
              mandate_id: e.mandate_id,
              at: e.at,
              result: null,
              adapter: 'mcp',
              detail: (e.detail && e.detail.mock_message_id) || '—',
              duration_ms: null
            };
          });
        }

        return api.call('get_org_rules', { org_id: 'org_kenari' }).catch(function () { return null; });
      }).then(function (o) {
        if (o) self.org = o;
      });
    },

    plan: function (id) {
      for (var i = 0; i < this.plans.length; i++) if (this.plans[i].plan_id === id) return this.plans[i];
      return null;
    },
    plansBy: function (fn) { return this.plans.filter(fn); },
    counts: function () {
      var c = { total: this.plans.length, awaiting: 0, blocked: 0, executed: 0, draft: 0, rejected: 0, needs: 0 };
      this.plans.forEach(function (p) {
        if (p.status === 'READY') c.awaiting++;
        else if (p.status === 'NEEDS_REVIEW') { c.awaiting++; c.needs++; }
        else if (p.status === 'BLOCKED') c.blocked++;
        else if (p.status === 'EXECUTED') c.executed++;
        else if (p.status === 'DRAFT') c.draft++;
        else if (p.status === 'REJECTED') c.rejected++;
      });
      return c;
    },
    auditFor: function (planId) { return this.audit.filter(function (e) { return e.plan_id === planId; }); },
    mandateFor: function (planId) {
      for (var i = 0; i < this.mandates.length; i++) if (this.mandates[i].plan_id === planId) return this.mandates[i];
      return null;
    },
    specialist: function (id) {
      for (var i = 0; i < this.specialists.length; i++) if (this.specialists[i].id === id) return this.specialists[i];
      return null;
    },
    role: function (id) {
      for (var i = 0; i < this.roles.length; i++) if (this.roles[i].id === id) return this.roles[i];
      return null;
    },
    unreadCount: function () { return this.notifications.filter(function (n) { return !n.read; }).length; }
  };

  /* ---------------- router ---------------- */
  var routes = [];
  var router = {
    register: function (list) { routes = routes.concat(list); },
    routes: function () { return routes; },
    resolve: function (path) {
      var clean = (path || '').replace(/^#/, '').split('?')[0] || '/overview';
      var segs = clean.split('/').filter(Boolean);
      for (var i = 0; i < routes.length; i++) {
        var r = routes[i];
        var rs = r.path.split('/').filter(Boolean);
        if (rs.length !== segs.length) continue;
        var params = {}, ok = true;
        for (var j = 0; j < rs.length; j++) {
          if (rs[j].charAt(0) === ':') params[rs[j].slice(1)] = decodeURIComponent(segs[j]);
          else if (rs[j] !== segs[j]) { ok = false; break; }
        }
        if (ok) return { route: r, params: params, path: clean };
      }
      return { route: null, params: {}, path: clean };
    },
    go: function (path, opts) {
      var target = '#' + (path.charAt(0) === '/' ? path : '/' + path);
      if (location.hash === target) { router.render(); return; }
      location.hash = target;
      if (opts && opts.replace) history.replaceState(null, '', target);
    },
    render: function () {
      var hit = router.resolve(location.hash);
      var view = hit.route ? hit.route : null;
      if (!view) { view = routes.filter(function (r) { return r.path === '/not-found'; })[0]; }
      if (!view) return;
      /*
       * Route guard is UX, not a security boundary. It decides what to draw; it
       * does not decide what is permitted. Every operation behind these screens
       * is still refused by the server on its own (see handleTool), so bypassing
       * this guard by editing the URL yields no extra authority — only a screen
       * the server would refuse to feed.
       */
      var blockedCap = null;
      if (view.cap) {
        var capState = session.capState(view.cap);
        if (capState === 'unavailable') {
          blockedCap = view.cap;
          view = routes.filter(function (r) { return r.path === '/unavailable'; })[0] || view;
        } else if (capState !== 'granted') {
          view = routes.filter(function (r) { return r.path === '/forbidden'; })[0];
        }
      }
      var root = document.getElementById('view-root');
      if (!root) return;
      // tear down previous page
      if (D._cleanup) { try { D._cleanup(); } catch (e) {} D._cleanup = null; }
      root.innerHTML = '';
      var page = h('div', { class: 'page' });
      root.appendChild(page);
      document.title = (view.title || 'DEXTRA') + ' · DEXTRA Dashboard';
      try {
        hit.blockedCap = blockedCap;
        (D.views[view.view] || D.views['notFound'])(page, hit.params, hit);
      } catch (err) {
        page.innerHTML = '<div class="banner banner--danger"><span class="material-symbols-outlined">error</span><div><b>Tampilan gagal dimuat.</b> ' + esc(err.message) + '</div></div>';
      }
      if (D.shell) D.shell.afterRender(view, hit.params);
      window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
    },
    start: function () {
      window.addEventListener('hashchange', router.render);
      if (!location.hash) location.replace('#/overview');
      router.render();
    }
  };

  /* ---------------- theme ---------------- */
  var theme = {
    get: function () {
      var q = qs('theme', null);
      if (q === 'dark' || q === 'light') return q;
      try { return localStorage.getItem('dextra_theme') || 'light'; } catch (e) { return 'light'; }
    },
    apply: function (t) {
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('dextra_theme', t); } catch (e) {}
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0e0e16' : '#ffffff');
    },
    toggle: function () { var next = theme.get() === 'dark' ? 'light' : 'dark'; theme.apply(next); return next; }
  };

  /* ---------------- boot ---------------- */
  D.util = { esc: esc, attr: attr, detailText: detailText, actorName: actorName, eventLabel: eventLabel, eventTone: eventTone, fmtDate: fmtDate, fmtDay: fmtDay, fmtTime: fmtTime, rel: rel, initials: initials, debounce: debounce, qs: qs, csv: csv, download: download, h: h };
  D.badge = badge; D.statusBadge = statusBadge; D.riskBadge = riskBadge; D.mandateBadge = mandateBadge;
  D.STATUS = STATUS; D.RISK = RISK;
  D.session = session; D.api = api; D.store = store; D.router = router; D.theme = theme;
  D.views = D.views || {};
  D.boot = function () {
    theme.apply(theme.get());
    store.hydrateDemo();
    return api.health().then(function (ok) {
      if (!ok) { store.mode = 'demo'; return; }
      if (!api.token()) { store.mode = 'demo'; return; }
      /*
       * Ask the server who we are before drawing anything. The scope it reports
       * is the only thing that decides which capabilities the UI may show; the
       * hardcoded persona never does.
       */
      return api.call('get_caller_context', {}).then(function (ctx) {
        session.applyServerContext(ctx);
        return store.hydrateLive().then(function () { store.mode = 'live'; });
      }).catch(function (err) {
        session.applyServerContext(null);
        store.mode = 'demo';
        store.hydrateDemo();
        /*
         * A rejected credential must not quietly become a demo session that
         * looks normal. Drop the token and send the operator back to sign in.
         * Anything else (server vanished mid-boot) keeps the demo fallback.
         */
        if (String((err && err.message) || '').toLowerCase().indexOf('unauthorized') >= 0) {
          api.clearToken();
          D.authRejected = true;
          if (location.hash !== '#/login') location.hash = '#/login';
        }
      });
    });
  };
})();
