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
 *
 * `intents` is the contract between a route and the Copilot: what the assistant
 * is allowed to offer while the operator is standing on that screen. The same
 * rule applies here — an intent may only reference a tool that exists, a route
 * that is registered, and a compute function that is implemented. A test reads
 * this file and fails if any of that stops being true, so no chip is ever dead.
 *
 *   kind: 'answer'  — computed locally from the store, no write
 *         'tool'    — calls one MCP tool; refuses when the server is not live
 *         'go'      — navigates
 *         'handoff' — deliberately does NOT act; explains why a human must
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
      note: 'KPI diturunkan dari plan + audit nyata. Tidak ada endpoint agregat.',
      intents: [
        { id: 'ov.summary', label: 'Ringkas kondisi hari ini', kind: 'answer', compute: 'summary' },
        { id: 'ov.awaiting', label: 'Apa yang menunggu keputusan?', kind: 'answer', compute: 'awaiting' },
        { id: 'ov.blocked', label: 'Apa yang diblokir kebijakan?', kind: 'answer', compute: 'blocked' },
        { id: 'ov.audit', label: 'Aktivitas terakhir', kind: 'tool', tool: 'get_audit_log', args: { limit: 8 } }
      ] },

    { route: '/assistant', label: 'AI Assistant', domain: 'Operasional', state: 'partial',
      tools: ['find_precedent', 'create_plan', 'validate_plan'], modules: ['plan', 'policy-engine', 'store', 'contracts'],
      note: 'Penerima dicari lewat find_precedent; penyusunan rencana masih aturan lokal, bukan model.',
      intents: [
        { id: 'as.awaiting', label: 'Tunjukkan yang menunggu tinjauan', kind: 'answer', compute: 'awaiting' },
        { id: 'as.rules', label: 'Aturan apa yang membatasi saya?', kind: 'answer', compute: 'policies' },
        { id: 'as.compose', label: 'Susun rencana dari kalimat saya', kind: 'answer', compute: 'composeHint' }
      ] },

    { route: '/requests', label: 'My Requests', domain: 'Operasional', state: 'partial',
      tools: ['list_plans'], modules: ['store', 'plan'],
      note: 'Daftar dari list_plans. Kepemilikan tercatat bila server mengikat principal ke token (requester_id diisi server, bukan klien); layar menyaring dengan field itu. Tanpa ikatan, layar menampilkan seluruh permintaan workspace dan menyatakannya.',
      intents: [
        { id: 'rq.recent', label: 'Permintaan terbaru di workspace', kind: 'answer', compute: 'recentPlans' },
        { id: 'rq.owner', label: 'Siapa pemilik permintaan ini?', kind: 'answer', compute: 'ownershipGap' }
      ] },

    { route: '/my-work', label: 'My Work', domain: 'Operasional', state: 'partial',
      tools: ['list_plans', 'get_audit_log'], modules: ['store', 'plan'],
      note: 'Antrean diturunkan dari status plan dan assignee_id bila server mencatatnya. Tanpa principal atau tanpa assignee, isinya item terbuka seluruh workspace dan halaman menyatakannya.',
      intents: [
        { id: 'mw.queue', label: 'Apa yang menunggu saya?', kind: 'answer', compute: 'awaiting' },
        { id: 'mw.assign', label: 'Apakah penugasan tercatat server?', kind: 'answer', compute: 'assignmentGap' }
      ] },

    { route: '/work-packages', label: 'Work Packages', domain: 'Manajemen kerja', state: 'live',
      tools: ['list_plans', 'get_plan'], modules: ['plan', 'store'],
      note: 'Daftar dari list_plans, detail dari get_plan.',
      intents: [
        { id: 'wp.list', label: 'Daftar work package terbaru', kind: 'answer', compute: 'recentPlans' },
        { id: 'wp.review', label: 'Mana yang perlu ditinjau?', kind: 'answer', compute: 'needsReview' }
      ] },

    { route: '/work-packages/:id', label: 'Work Package detail', domain: 'Manajemen kerja', state: 'live',
      tools: ['get_plan'], modules: ['plan', 'policy-engine', 'contracts'],
      note: 'Satu plan lengkap dengan hasil validasi kebijakan.',
      intents: [
        { id: 'wpd.explain', label: 'Jelaskan work package ini', kind: 'answer', compute: 'planDetail' },
        { id: 'wpd.validate', label: 'Validasi ulang rencana ini', kind: 'tool', tool: 'validate_plan', argsFrom: 'plan' },
        { id: 'wpd.audit', label: 'Jejak audit untuk ini', kind: 'answer', compute: 'planAudit' },
        { id: 'wpd.mandate', label: 'Mandat yang terkait', kind: 'answer', compute: 'planMandate' }
      ] },

    { route: '/board', label: 'Task Board', domain: 'Manajemen kerja', state: 'partial',
      tools: ['list_plans'], modules: ['plan', 'store'],
      note: 'Kartu diturunkan dari plan saat live; kolom mengikuti status. Urutan kartu tidak disimpan server.',
      intents: [
        { id: 'bd.columns', label: 'Apa isi tiap kolom?', kind: 'answer', compute: 'board' },
        { id: 'bd.order', label: 'Apakah urutan kartu disimpan?', kind: 'answer', compute: 'boardGap' }
      ] },

    { route: '/execution', label: 'Execution History', domain: 'Manajemen kerja', state: 'live',
      tools: ['list_executions'], modules: ['executor', 'store', 'replay'],
      note: 'Dibaca dari list_executions. Work package diturunkan dari mandat, bukan disimpan di hasil.',
      intents: [
        { id: 'ex.recent', label: 'Eksekusi terakhir', kind: 'answer', compute: 'executions' },
        { id: 'ex.count', label: 'Berapa yang berhasil dan gagal?', kind: 'answer', compute: 'executionStats' }
      ] },

    { route: '/workforce', label: 'Workforce', domain: 'Workforce', state: 'live',
      tools: ['list_specialists'], modules: ['workbuddy', 'store'],
      note: 'Roster dibaca dari workbuddy/agents/*.md lewat list_specialists. Hanya field yang benar-benar ada di berkas yang ditampilkan: nama, peran, batas, tool. Beban kerja tidak ditampilkan karena plan tidak menyimpan spesialis.',
      intents: [
        { id: 'wf.list', label: 'Siapa saja spesialisnya?', kind: 'answer', compute: 'specialists' },
        { id: 'wf.limits', label: 'Apa yang tidak boleh mereka lakukan?', kind: 'answer', compute: 'specialistLimits' },
        { id: 'wf.source', label: 'Dari mana daftar ini dibaca?', kind: 'answer', compute: 'specialistSource' }
      ] },

    { route: '/approvals', label: 'Approval Inbox', domain: 'Tata kelola', state: 'live',
      tools: ['list_plans', 'get_plan', 'submit_approval'], modules: ['store', 'policy-engine', 'mandate-engine'],
      note: 'Antrean dari list_plans berstatus READY/NEEDS_REVIEW; keputusan memakai submit_approval.',
      intents: [
        { id: 'ap.pending', label: 'Apa yang menunggu keputusan?', kind: 'answer', compute: 'awaiting' },
        { id: 'ap.how', label: 'Bagaimana menyetujui dengan aman?', kind: 'answer', compute: 'approvalHowto' },
        { id: 'ap.handoff', label: 'Setujui work package', kind: 'handoff', path: '/approvals',
          why: 'Keputusan persetujuan harus dibuat manusia. Asisten tidak memegang approval token dan tidak memanggil submit_approval.' }
      ] },

    { route: '/review', label: 'Review & Validation', domain: 'Tata kelola', state: 'live',
      tools: ['validate_plan', 'get_plan'], modules: ['policy-engine', 'plan'],
      note: 'Validasi deterministik; Policy Validator bukan agen AI.',
      intents: [
        { id: 'rv.queue', label: 'Mana yang perlu ditinjau?', kind: 'answer', compute: 'needsReview' },
        { id: 'rv.deterministic', label: 'Apakah ini dinilai model AI?', kind: 'answer', compute: 'reviewGap' }
      ] },

    { route: '/review/:id', label: 'Review detail', domain: 'Tata kelola', state: 'live',
      tools: ['validate_plan', 'get_plan'], modules: ['policy-engine', 'plan', 'contracts'],
      note: 'Satu plan dengan temuan dan reason code.',
      intents: [
        { id: 'rvd.findings', label: 'Temuan dan reason code', kind: 'answer', compute: 'planDetail' },
        { id: 'rvd.revalidate', label: 'Validasi ulang', kind: 'tool', tool: 'validate_plan', argsFrom: 'plan' }
      ] },

    { route: '/mandates', label: 'Mandates', domain: 'Tata kelola', state: 'live',
      tools: ['list_mandates', 'get_mandate', 'execute_action', 'revoke_mandate'], modules: ['mandate-engine', 'executor', 'store'],
      note: 'Daftar dari list_mandates; eksekusi dan pencabutan dipicu dari drawer mandat.',
      intents: [
        { id: 'mn.active', label: 'Mandat aktif', kind: 'answer', compute: 'mandates' },
        { id: 'mn.expiring', label: 'Mandat yang hampir kedaluwarsa', kind: 'answer', compute: 'mandatesExpiring' },
        { id: 'mn.handoff', label: 'Jalankan tindakan', kind: 'handoff', path: '/mandates',
          why: 'Eksekusi butuh mandat aktif dan dipicu dari drawer mandat, bukan dari percakapan. Asisten tidak memanggil execute_action.' }
      ] },

    { route: '/audit', label: 'Audit Trail', domain: 'Tata kelola', state: 'live',
      tools: ['get_audit_log'], modules: ['store', 'replay'],
      note: 'Append-only di sisi server; dashboard hanya membaca.',
      intents: [
        { id: 'au.recent', label: 'Peristiwa terakhir', kind: 'tool', tool: 'get_audit_log', args: { limit: 10 } },
        { id: 'au.proof', label: 'Bagaimana membuktikan jejak tidak diubah?', kind: 'answer', compute: 'auditProof' }
      ] },

    { route: '/policies', label: 'Policies', domain: 'Tata kelola', state: 'live',
      tools: ['get_org_rules'], modules: ['policy-engine', 'contracts'],
      note: 'Katalog aturan dibaca dari server. Perubahan kebijakan belum punya tool.',
      intents: [
        { id: 'po.list', label: 'Aturan aktif', kind: 'answer', compute: 'policies' },
        { id: 'po.blocking', label: 'Aturan mana yang memblokir?', kind: 'answer', compute: 'policiesBlocking' }
      ] },

    { route: '/permissions', label: 'Permissions', domain: 'Administrasi', state: 'live',
      tools: ['get_caller_context'], modules: ['contracts'],
      note: 'Kapabilitas dan tool dinyatakan server untuk token ini. Matriks per peran sudah dihapus: model identitas tidak punya peran per pengguna, dan matriksnya berasal dari data contoh.',
      intents: [
        { id: 'pm.scope', label: 'Kapabilitas apa yang saya punya?', kind: 'tool', tool: 'get_caller_context', args: {} },
        { id: 'pm.matrix', label: 'Mengapa tidak ada matriks per peran?', kind: 'answer', compute: 'permissionGap' }
      ] },

    { route: '/integrations', label: 'Integrations', domain: 'Administrasi', state: 'partial',
      tools: ['get_status', 'get_caller_context'], modules: ['mcp-server', 'telegram-adapter'],
      note: 'Status runtime nyata dari get_status; scope pemanggil dari get_caller_context. Adapter lain masih mock/planned. Halaman dijaga kapabilitas manage_integrations yang belum didukung server.',
      intents: [
        { id: 'ig.scope', label: 'Scope apa yang dipakai sekarang?', kind: 'tool', tool: 'get_caller_context', args: {} },
        { id: 'ig.mock', label: 'Integrasi mana yang masih mock?', kind: 'answer', compute: 'integrations' }
      ] },

    { route: '/settings', label: 'Settings', domain: 'Administrasi', state: 'partial',
      tools: ['get_org_rules'], modules: ['store', 'policy-engine'],
      note: 'Profil organisasi dari aturan server; penyimpanan preferensi masih lokal.',
      intents: [
        { id: 'st.org', label: 'Profil organisasi', kind: 'tool', tool: 'get_org_rules', args: {} },
        { id: 'st.local', label: 'Apa yang disimpan di peramban?', kind: 'answer', compute: 'browserStorage' }
      ] },

    { route: '/login', label: 'Login', domain: 'Akses', state: 'none',
      tools: ['get_caller_context'], modules: ['mcp-server'],
      note: 'Menukar token lalu memverifikasi lewat tools/list; boot memanggil get_caller_context untuk menentukan scope.',
      intents: [] },

    { route: '/forbidden', label: 'Forbidden', domain: 'Akses', state: 'none',
      tools: [], modules: [], note: 'Halaman statis.', intents: [] },

    { route: '/not-found', label: 'Not found', domain: 'Akses', state: 'none',
      tools: [], modules: [], note: 'Halaman statis.', intents: [] }
  ];

  /* Offered on every screen, because they are questions about the workspace,
     not about the page you happen to be standing on. */
  var GLOBAL_INTENTS = [
    { id: 'g.awaiting', label: 'Apa yang menunggu keputusan?', kind: 'answer', compute: 'awaiting' },
    { id: 'g.mandates', label: 'Mandat aktif', kind: 'answer', compute: 'mandates' },
    { id: 'g.audit', label: 'Aktivitas terakhir', kind: 'tool', tool: 'get_audit_log', args: { limit: 6 } },
    { id: 'g.help', label: 'Apa yang bisa kamu lakukan di sini?', kind: 'answer', compute: 'capabilitiesHere' }
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
    globalIntents: GLOBAL_INTENTS,
    stateLabel: function (s) { return STATE_LABEL[s] || s; },

    /* Intents offered on a given path: the ones the route declares, then the
       workspace-wide ones. De-duplicated by id AND by label, because a route
       intent and a global intent often answer the same question — showing
       "Mandat aktif" twice on the same screen is just noise. The route's own
       wording wins, since it is the more specific one. */
    intentsFor: function (path) {
      var r = D.sources.byRoute(path);
      var out = [], seenId = {}, seenLabel = {};
      (r && r.intents ? r.intents : []).concat(GLOBAL_INTENTS).forEach(function (it) {
        if (seenId[it.id]) return;
        var key = String(it.label).toLowerCase();
        if (seenLabel[key]) return;
        seenId[it.id] = true;
        seenLabel[key] = true;
        out.push(it);
      });
      return out;
    },

    /* Every intent in the file, for the contract test. */
    allIntents: function () {
      var out = [];
      ROUTES.forEach(function (r) {
        (r.intents || []).forEach(function (it) { out.push({ route: r.route, intent: it }); });
      });
      GLOBAL_INTENTS.forEach(function (it) { out.push({ route: '*', intent: it }); });
      return out;
    },

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
