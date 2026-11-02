/* DEXTRA Dashboard — route ↔ backend contract.
 *
 * Single source of truth for what actually backs every route. Nothing here is
 * aspirational: `tool` names must exist in apps/mcp-server/src/handlers.ts, and
 * a route with no tool is demo-only by definition and must say so in the UI.
 *
 * state:
 *   live    — the route can render real server data when the MCP server is up
 *   partial — some data is real, the rest is demo (no list/aggregate endpoint)
 *   demo    — no backend surface exists yet; demo data only
 *   none    — not a data route (auth, error pages)
 */
(function (window) {
  var D = window.DEXTRA = window.DEXTRA || {};

  /* Packages and apps that exist in this repo, with the job each one does. */
  var MODULES = {
    contracts: { path: 'packages/contracts', role: 'Skema Plan, Mandate, ActionResult' },
    store: { path: 'packages/store', role: 'Persistensi + repository + audit log' },
    'policy-engine': { path: 'packages/policy-engine', role: 'Aturan deterministik + reason code' },
    plan: { path: 'packages/plan', role: 'Penyusunan rencana + hash parameter' },
    'mandate-engine': { path: 'packages/mandate-engine', role: 'Validasi siklus mandat' },
    executor: { path: 'packages/executor', role: 'Eksekusi terkontrol + idempotensi' },
    replay: { path: 'packages/replay', role: 'Rekonstruksi jejak eksekusi' },
    'mcp-server': { path: 'apps/mcp-server', role: 'Gateway JSON-RPC 127.0.0.1:8765' },
    workbuddy: { path: 'workbuddy', role: 'Orkestrasi, 4 agen, knowledge' },
    'telegram-adapter': { path: 'apps/telegram-adapter', role: 'Channel adapter (post-MVP)' }
  };

  var ROUTES = [
    { route: '/overview', label: 'Overview', domain: 'Operasional', state: 'live',
      tools: ['list_plans', 'get_audit_log'], modules: ['store', 'plan', 'policy-engine'],
      note: 'KPI diturunkan dari plan + audit nyata. Tidak ada endpoint agregat.' },

    { route: '/assistant', label: 'AI Assistant', domain: 'Operasional', state: 'partial',
      tools: ['find_precedent', 'create_plan', 'validate_plan'], modules: ['plan', 'policy-engine', 'store', 'contracts'],
      note: 'Penerima dicari lewat find_precedent; penyusunan rencana masih aturan lokal, bukan model.' },

    { route: '/requests', label: 'My Requests', domain: 'Operasional', state: 'live',
      tools: ['list_plans'], modules: ['store', 'plan'],
      note: 'Daftar dari list_plans. Kepemilikan per pengguna belum dicatat server.' },

    { route: '/my-work', label: 'My Work', domain: 'Operasional', state: 'partial',
      tools: ['get_audit_log'], modules: ['store'],
      note: 'Turunan dari audit event yang menyebut pengguna ini.' },

    { route: '/work-packages', label: 'Work Packages', domain: 'Manajemen kerja', state: 'live',
      tools: ['list_plans', 'get_plan'], modules: ['plan', 'store'],
      note: 'Daftar dari list_plans, detail dari get_plan.' },

    { route: '/work-packages/:id', label: 'Work Package detail', domain: 'Manajemen kerja', state: 'live',
      tools: ['get_plan'], modules: ['plan', 'policy-engine', 'contracts'],
      note: 'Satu plan lengkap dengan hasil validasi kebijakan.' },

    { route: '/board', label: 'Task Board', domain: 'Manajemen kerja', state: 'demo',
      tools: [], modules: ['plan'],
      note: 'Pengelompokan kolom dilakukan di klien. Tidak ada status papan di server.' },

    { route: '/execution', label: 'Execution History', domain: 'Manajemen kerja', state: 'live',
      tools: ['list_executions'], modules: ['executor', 'store', 'replay'],
      note: 'Dibaca dari list_executions. Work package diturunkan dari mandat, bukan disimpan di hasil.' },

    { route: '/workforce', label: 'Workforce', domain: 'Workforce', state: 'demo',
      tools: [], modules: ['workbuddy'],
      note: 'Registry agen belum diekspos server. Beban kerja bersifat contoh.' },

    { route: '/specialists', label: 'Specialist Directory', domain: 'Workforce', state: 'demo',
      tools: [], modules: ['workbuddy'],
      note: 'Empat spesialis dibaca dari workbuddy/agents/*.md, bukan dari API.' },

    { route: '/approvals', label: 'Approval Inbox', domain: 'Tata kelola', state: 'live',
      tools: ['list_plans', 'get_plan', 'submit_approval'], modules: ['store', 'policy-engine', 'mandate-engine'],
      note: 'Antrean dari list_plans berstatus READY/NEEDS_REVIEW; keputusan memakai submit_approval.' },

    { route: '/review', label: 'Review & Validation', domain: 'Tata kelola', state: 'live',
      tools: ['validate_plan', 'get_plan'], modules: ['policy-engine', 'plan'],
      note: 'Validasi deterministik; Policy Validator bukan agen AI.' },

    { route: '/review/:id', label: 'Review detail', domain: 'Tata kelola', state: 'live',
      tools: ['validate_plan', 'get_plan'], modules: ['policy-engine', 'plan', 'contracts'],
      note: 'Satu plan dengan temuan dan reason code.' },

    { route: '/mandates', label: 'Mandates', domain: 'Tata kelola', state: 'live',
      tools: ['list_mandates', 'get_mandate', 'execute_action', 'revoke_mandate'], modules: ['mandate-engine', 'executor', 'store'],
      note: 'Daftar dari list_mandates; eksekusi dan pencabutan dipicu dari drawer mandat.' },

    { route: '/audit', label: 'Audit Trail', domain: 'Tata kelola', state: 'live',
      tools: ['get_audit_log'], modules: ['store', 'replay'],
      note: 'Append-only di sisi server; dashboard hanya membaca.' },

    { route: '/policies', label: 'Policies', domain: 'Tata kelola', state: 'live',
      tools: ['get_org_rules'], modules: ['policy-engine', 'contracts'],
      note: 'Katalog aturan dibaca dari server. Perubahan kebijakan belum punya tool.' },

    { route: '/users', label: 'Users & Roles', domain: 'Administrasi', state: 'demo',
      tools: [], modules: ['store'],
      note: 'Belum ada tool identitas. Daftar pengguna masih contoh.' },

    { route: '/permissions', label: 'Permissions', domain: 'Administrasi', state: 'demo',
      tools: [], modules: ['contracts'],
      note: 'Matriks peran masih di klien; server belum mengekspos permission.' },

    { route: '/integrations', label: 'Integrations', domain: 'Administrasi', state: 'partial',
      tools: ['get_status'], modules: ['mcp-server', 'telegram-adapter'],
      note: 'Status runtime nyata dari get_status; adapter lain masih mock/planned.' },

    { route: '/settings', label: 'Settings', domain: 'Administrasi', state: 'partial',
      tools: ['get_org_rules'], modules: ['store', 'policy-engine'],
      note: 'Profil organisasi dari aturan server; penyimpanan preferensi masih lokal.' },

    { route: '/login', label: 'Login', domain: 'Akses', state: 'none',
      tools: [], modules: ['mcp-server'],
      note: 'Menukar token ops lalu memverifikasi lewat /health.' },

    { route: '/forbidden', label: 'Forbidden', domain: 'Akses', state: 'none',
      tools: [], modules: [], note: 'Halaman statis.' },

    { route: '/not-found', label: 'Not found', domain: 'Akses', state: 'none',
      tools: [], modules: [], note: 'Halaman statis.' }
  ];

  var STATE_LABEL = {
    live: 'Terhubung',
    partial: 'Sebagian',
    demo: 'Data contoh',
    none: 'Bukan data'
  };

  D.sources = {
    modules: MODULES,
    routes: ROUTES,
    stateLabel: function (s) { return STATE_LABEL[s] || s; },

    /* Every tool the dashboard is allowed to call, taken from the table above. */
    tools: function () {
      var out = [];
      ROUTES.forEach(function (r) {
        r.tools.forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
      });
      return out.sort();
    },

    /* Modules that no route touches — surfaced so gaps are visible, not hidden. */
    unusedModules: function () {
      var used = {};
      ROUTES.forEach(function (r) { r.modules.forEach(function (m) { used[m] = true; }); });
      return Object.keys(MODULES).filter(function (m) { return !used[m]; });
    },

    summary: function () {
      var s = { live: 0, partial: 0, demo: 0, none: 0 };
      ROUTES.forEach(function (r) { s[r.state] = (s[r.state] || 0) + 1; });
      return s;
    },

    byRoute: function (path) {
      for (var i = 0; i < ROUTES.length; i++) {
        var r = ROUTES[i];
        if (r.route === path) return r;
        if (r.route.indexOf('/:') > 0 && path.indexOf(r.route.split('/:')[0] + '/') === 0) return r;
      }
      return null;
    }
  };
})(window);
