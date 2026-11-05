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
    plan_created: 'Plan dibuat',
    /* "diakui adapter", bukan "diterima manusia": transport palsu juga menjawab
       ok, dan dashboard tidak boleh menyiratkan lebih dari itu. */
    alert_dispatched: 'Notifikasi diakui adapter',
    alert_failed: 'Notifikasi gagal',
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
    serverTools: null,
    /* The person the server binds to this token, or null. Server-stated only. */
    principal: null,

    applyServerContext: function (ctx) {
      if (!ctx) {
        this.scope = null;
        this.serverCapabilities = null;
        this.serverUnbacked = null;
        this.serverTools = null;
        this.principal = null;
        return;
      }
      this.scope = typeof ctx.scope === 'string' ? ctx.scope : null;
      this.serverCapabilities = Array.isArray(ctx.capabilities) ? ctx.capabilities.slice() : [];
      this.serverUnbacked = Array.isArray(ctx.unbacked_capabilities) ? ctx.unbacked_capabilities.slice() : [];
      this.serverTools = Array.isArray(ctx.tools) ? ctx.tools.slice() : [];
      this.principal = ctx.principal && typeof ctx.principal === 'object' ? ctx.principal : null;
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

    /*
     * Identity as the server understands it, or the demo persona. Never mixed.
     *
     * Three states, not two:
     *   principal present — the server binds a named person to this token, so
     *                       the name and role come from the roster, not from `user`
     *   live, no principal — the server authenticated a scope but binds nobody;
     *                       say so instead of inventing a name
     *   demo             — the display persona, which never reaches the server
     */
    hasPrincipal: function () {
      return this.principal !== null && this.principal !== undefined;
    },

    roleLabel: function () {
      if (this.hasPrincipal()) {
        return (ROLE_LABEL[this.principal.role] || this.principal.role) + ' · ' + this.scope;
      }
      if (this.serverCapabilities) return 'Token ' + this.scope + ' · server';
      return ROLE_LABEL[this.user.role] || this.user.role;
    },

    /*
     * What to put in the user chip. In live mode without a principal there is no
     * person behind the token — the server authenticates a scope, and the demo
     * persona's name is not an identity that exists anywhere. Printing "Farhan
     * Pratama" next to a live session would attribute real authority to a
     * fictional person, so the chip shows the scope instead.
     */
    displayName: function () {
      if (this.hasPrincipal()) return this.principal.display_name;
      if (this.serverCapabilities) return 'Token ' + this.scope;
      return this.user.name;
    },

    /* Second line of the user chip: who is bound, or what backs the session. */
    subtitle: function () {
      if (this.hasPrincipal()) return this.principal.role;
      if (this.serverCapabilities) {
        return 'server · ' + this.serverCapabilities.length + ' kapabilitas';
      }
      return ROLE_LABEL[this.user.role] || this.user.role;
    },

    /*
     * The resolvable id behind the session. The persona's e-mail is demo data
     * and must never be shown as a real account.
     */
    contactLine: function () {
      if (this.hasPrincipal()) return this.principal.principal_id;
      if (this.serverCapabilities) return 'tanpa identitas per orang';
      return this.user.email || '';
    },

    /*
     * The id to record as the approver. When the server binds a principal, that
     * is the only correct answer — it is what the server will record anyway.
     * Otherwise record the authority that actually decided, never 'user_001':
     * a name no system can resolve and nobody can be held to.
     */
    identityId: function () {
      if (this.hasPrincipal()) return this.principal.principal_id;
      if (this.serverCapabilities) return 'scope:' + this.scope;
      return this.user.id;
    },

    identityLine: function () {
      if (this.hasPrincipal()) {
        return 'Terautentikasi sebagai ' + this.principal.display_name + ' (' + this.principal.principal_id + ') ' +
          'pada scope ' + this.scope + '. Ikatan token-ke-orang ditentukan server lewat roster; ' +
          'token ini tidak punya masa berlaku atau pencabutan.';
      }
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
    executionSummary: null,
    auditIntegrity: null,
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
        /*
         * The server's verdict on the hash chain, computed over the whole log.
         * The dashboard must not recompute it from the page it fetched — that
         * would verify 500 events and call it "the audit log".
         */
        self.auditIntegrity = d.integrity || null;
      }).catch(function () { self.audit = []; self.auditIntegrity = null; });

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
        /*
         * The server computes the summary over the whole filtered set, not over
         * the page it returned. Recomputing it here from the 200 rows we asked
         * for would silently change every number the moment the dataset grows
         * past the limit.
         */
        self.executionSummary = d.summary || null;
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
            /* Was hardcoded 0 — a duration the server never measured. Now the
             * executor's real measurement, or null when the record predates it. */
            duration_ms: e.usage ? e.usage.latency_ms : null,
            usage: e.usage || null
          };
        });
      }).catch(function () { return null; });

      /* The roster is read from the agent definition files, not from demo data.
       * Only the four fields the files actually contain are kept. */
      var specialistsP = api.call('list_specialists', {}).then(function (d) {
  /* */
        return (d.specialists || []).map(function (s) {
          return { id: s.id, name: s.name, role: s.role, limits: s.limits || [], tools: s.tools || [] };
        });
      }).catch(function () { return null; });

      /* Principal is server-bound to the token; null when none — never invent one. */
      var principalP = api.call('get_caller_context', {}).then(function (d) {
        return (d && d.principal) ? d.principal : null;
      }).catch(function () { return null; });

      return Promise.all([plansP, mandatesP, executionsP, specialistsP, principalP]).then(function (res) {
        self.plans = res[0].map(function (p) {
          /* The Plan contract has no `specialist` field. Defaulting it to
           * 'dispatcher' (as this used to) attributed every plan to an agent the
           * server never mentioned — on the main list screens, which is exactly
           * the "no fabricated state" rule this product is built on. Left null;
           * views render '—'. */
          p.specialist = p.specialist || null;
          p.risk = (p.actions || []).reduce(function (m, a) {
            var order = { low: 0, medium: 1, high: 2, critical: 3 };
            return (order[a.risk] || 0) > (order[m] || 0) ? a.risk : m;
          }, 'low');
          /* The MCP server authenticates a scope (agent/ops), not a person, and the
           * Plan contract carries no requester field. Stamping the signed-in user
           * here would invent ownership and make /requests lie. Leave it null and
           * let the view say ownership is not recorded. */
          p.requester = p.requester || p.requester_id || null;
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

        /* Only replace the roster when the server actually answered; otherwise
           the page shows its "needs server" state rather than stale demo rows. */
        if (res[3]) self.specialists = res[3];
        self.principal = res[4] || null;

        /*
         * The Plan contract has four statuses — DRAFT, READY, NEEDS_REVIEW,
         * BLOCKED — and none of them is "approved" or "executed". Those two are
         * facts the server records elsewhere: a granted approval, and an
         * execution. Deriving them here from those records keeps the screens
         * from claiming a plan is still "awaiting a decision" after a human
         * approved it and it ran.
         */
        var approvedPlans = {};
        self.mandates.forEach(function (m) { if (m.plan_id) approvedPlans[m.plan_id] = true; });
        var executedPlans = {};
        self.executions.forEach(function (e) { if (e.plan_id) executedPlans[e.plan_id] = true; });

        self.plans.forEach(function (p) {
          p.approved = approvedPlans[p.plan_id] === true;
          p.executed = executedPlans[p.plan_id] === true;
        });

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
    /* True only when the server actually attributed at least one plan to a
     * specialist. Views use this to hide a filter that would always be empty,
     * rather than offering a control that cannot do anything. */
    hasAttribution: function () {
      return this.plans.some(function (p) { return !!p.specialist; });
    },
    counts: function () {
      var c = { total: this.plans.length, awaiting: 0, blocked: 0, executed: 0, draft: 0, rejected: 0, needs: 0, approved: 0 };
      this.plans.forEach(function (p) {
        /* Executed and approved are derived from executions and mandates, not
         * from `status`, which the contract never sets to either. Checking them
         * first keeps a finished plan out of "awaiting decision". */
        if (p.executed) { c.executed++; return; }
        if (p.approved) { c.approved++; return; }
        if (p.status === 'READY') c.awaiting++;
        else if (p.status === 'NEEDS_REVIEW') { c.awaiting++; c.needs++; }
        else if (p.status === 'BLOCKED') c.blocked++;
        else if (p.status === 'DRAFT') c.draft++;
      });
      return c;
    },

    /*
     * What to show as a plan's state. The contract's `status` describes the
     * approval lifecycle only, so a plan that was approved and executed still
     * reads READY. This resolves the same facts counts() uses into the label the
     * screens show, so the badge and the KPI never disagree.
     */
    displayStatus: function (p) {
      if (!p) return 'DRAFT';
      if (p.executed) return 'EXECUTED';
      if (p.approved) return 'APPROVED';
      return p.status;
    },

    /* A plan still waiting on a human: not approved, not executed, and open. */
    awaitingDecision: function () {
      return this.plans.filter(function (p) {
        return !p.approved && !p.executed && (p.status === 'READY' || p.status === 'NEEDS_REVIEW');
      });
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
    unreadCount: function () { return this.notifications.filter(function (n) { return !n.read; }).length; },

    /*
     * A mutation (approve, execute, revoke, create) makes every cached snapshot
     * wrong. A timer would be a guess; a flag is a fact. The mutation marks the
     * store dirty and the next navigation re-reads the server.
     *
     * This exists because the audit trail used to be fetched once at boot and
     * never again: execute an action, open /audit, and the event you just caused
     * was missing. For an app whose entire claim is "what you see is what the
     * server recorded", a stale audit page is a lie by omission.
     */
    stale: false,
    markStale: function () { this.stale = true; },
    refresh: function () {
      this.stale = false;
      if (this.mode !== 'live') return Promise.resolve();
      var self = this;
      return this.hydrateLive().catch(function () {
        /* Keep whatever we had; the next navigation tries again. */
        self.stale = true;
      });
    }
  };

  /*
   * Reads are get_/list_/find_; every other tool changes server state, so it
   * invalidates the cache. Wrapping the transport (instead of sprinkling
   * markStale() across six call sites) means a mutation added later cannot
   * forget to declare itself. A failed mutation still marks stale on purpose:
   * a refusal writes a mandate_rejected event the audit page must show.
   */
  (function () {
    var rawCall = api.call.bind(api);
    api.call = function (tool, args) {
      var p = rawCall(tool, args);
      if (/^(get_|list_|find_)/.test(String(tool))) return p;
      return p.then(function (r) { store.markStale(); return r; }, function (e) { store.markStale(); throw e; });
    };
  })();

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
      /*
       * If a mutation happened since the last paint, re-read the server before
       * drawing. Skipping the stale draw is deliberate: showing the old audit
       * trail for a frame, then replacing it, is a worse answer than a short
       * pause — and the E2E proves the page reflects the server, not a cache.
       */
      if (store.mode === 'live' && store.stale) {
        if (router._refreshing) return;
        router._refreshing = store.refresh().then(function () {
          router._refreshing = null;
          router.draw();
        });
        return;
      }
      router.draw();
    },
    draw: function () {
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
  /* Badge for a plan: uses the derived state so an approved or executed plan is
     never labelled as still awaiting a decision. */
  D.planStatusBadge = function (p) { return statusBadge(store.displayStatus(p)); };
  D.STATUS = STATUS; D.RISK = RISK;
  D.session = session; D.api = api; D.store = store; D.router = router; D.theme = theme;
  D.views = D.views || {};
  D.boot = function () {
    theme.apply(theme.get());
    store.hydrateDemo();
    return api.health().then(function (ok) {
      if (!ok) { store.mode = 'demo'; return; }
      /* Dua jalur masuk, JANGAN dicampur:
       * - REST (cookie httpOnly): ada sesi manusia bila GET /auth/session lolos.
       * - MCP (bearer :8765): ada token ops bila sessionStorage punya token.
       * Salah satu cukup untuk live; keduanya gagal -> demo. */
      var hasBearer = !!api.token();
      return api.auth.getSession().then(function (sess) {
        if (sess && sess.user) {
          session.applyServerContext({ capabilities: sess.capabilities || [] });
        }
        return api.call('get_caller_context', {}).then(function (ctx) {
          session.applyServerContext(ctx);
          return store.hydrateLive().then(function () { store.mode = 'live'; });
        }).catch(function (err) {
          if (hasBearer) throw err;
          return store.hydrateLive().then(function () { store.mode = 'live'; });
        });
      }).catch(function (err) {
        if (!hasBearer) { store.mode = 'demo'; return null; }
        return api.call('get_caller_context', {}).then(function (ctx) {
          session.applyServerContext(ctx);
          return store.hydrateLive().then(function () { store.mode = 'live'; });
        }).catch(function (err2) {
          session.applyServerContext(null);
          store.mode = 'demo';
          store.hydrateDemo();
          if (String((err2 && err2.message) || '').toLowerCase().indexOf('unauthorized') >= 0) {
            api.clearToken();
            D.authRejected = true;
            if (location.hash !== '#/login') location.hash = '#/login';
          }
          return null;
        });
      });
    });
  };
})();
