/* DEXTRA Dashboard — Copilot: one assistant, available on every route.
 *
 * Two rules shape this file, and they are the product's rules, not decoration:
 *
 *   1. The assistant answers with what the server actually said. Every `tool`
 *      intent goes through the same MCP bridge the page uses, and when the
 *      server is not live it refuses instead of inventing an answer. A
 *      governance product cannot ship an assistant that guesses.
 *
 *   2. The assistant never decides. `submit_approval`, `issue_mandate`,
 *      `execute_action` and `revoke_mandate` are not reachable from here at
 *      all — those intents are `handoff`: they open the right screen and say
 *      why the human has to be the one pressing the button. That is the whole
 *      thesis of DEXTRA, so the assistant must not be the exception to it.
 *
 * Everything the assistant may offer is declared in sources.js, per route, so
 * the route↔capability contract stays in one place and a test can check that no
 * chip is dead.
 */
(function (window) {
  'use strict';
  var D = window.DEXTRA = window.DEXTRA || {};
  var U = D.util, esc = U.esc;

  /* ---------------- context ---------------- */

  function currentPath() {
    return '/' + (location.hash.replace(/^#/, '').split('?')[0] || '/overview').replace(/^\//, '');
  }

  function context() {
    var path = currentPath();
    var hit = D.router.resolve('#' + path);
    var src = D.sources.byRoute(path);
    return {
      path: path,
      route: hit.route,
      params: hit.params || {},
      label: hit.route ? hit.route.title : (src ? src.label : 'Halaman'),
      state: src ? src.state : 'none',
      entity: hit.params && hit.params.id ? hit.params.id : null,
      mode: D.store.mode
    };
  }

  /* ---------------- result helpers ---------------- */

  function res(o) {
    return {
      kind: o.kind || 'answer',
      tone: o.tone || 'info',
      title: o.title || '',
      body: o.body || [],
      rows: o.rows || [],
      bullets: o.bullets || [],
      actions: o.actions || [],
      note: o.note || ''
    };
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function offline() {
    return res({
      tone: 'warn',
      title: 'Server MCP tidak aktif',
      body: ['Saya hanya membaca dari server. Tanpa server, saya tidak punya data untuk dijawab — dan saya tidak akan mengarang angkanya.'],
      bullets: [
        'Jalankan `npm run demo:seed` lalu `npm run dev:mcp` (port 8765), kemudian masuk lewat halaman Login.',
        'Selama server mati, halaman-halaman bertanda "Data contoh" tetap bisa dijelajahi — isinya contoh, bukan keadaan nyata.'
      ],
      note: 'Tidak ada panggilan tool yang dicoba.'
    });
  }

  function needsServer(toolName) {
    return res({
      tone: 'warn',
      title: 'Tidak dijalankan: server tidak aktif',
      body: ['`' + toolName + '` hanya bisa dijawab server. Saya berhenti di sini alih-alih menampilkan hasil yang tidak ada.'],
      note: 'Mode: demo. Tidak ada data yang dibuat.'
    });
  }

  /* ---------------- compute registry ----------------
     Pure reads over the store the page already hydrated. Nothing here writes. */

  var computes = {};

  computes.summary = function () {
    var c = D.store.counts();
    var mand = D.store.mandates.filter(function (m) { return m.status === 'active'; });
    return res({
      tone: c.blocked ? 'warn' : 'ok',
      title: 'Ringkasan workspace',
      rows: [
        { label: 'Work package', value: String(c.total) },
        { label: 'Menunggu keputusan', value: String(c.awaiting) },
        { label: 'Diblokir kebijakan', value: String(c.blocked) },
        { label: 'Sudah dieksekusi', value: String(c.executed) },
        { label: 'Mandat aktif', value: String(mand.length) }
      ],
      body: c.awaiting
        ? ['Ada ' + plural(c.awaiting, 'item', 'item') + ' yang menunggu manusia. Saya bisa menunjukkan mana saja, tetapi tidak bisa memutuskan.']
        : ['Tidak ada yang menunggu keputusan saat ini.'],
      actions: c.awaiting ? [{ label: 'Buka Approval Inbox', path: '/approvals', primary: true }] : [],
      note: 'Dihitung dari ' + plural(D.store.plans.length, 'plan', 'plan') + ' dan ' + plural(D.store.audit.length, 'peristiwa audit', 'peristiwa audit') + ' yang dimuat halaman ini.'
    });
  };

  computes.awaiting = function () {
    var rows = D.store.plansBy(function (p) { return p.status === 'READY' || p.status === 'NEEDS_REVIEW'; });
    if (!rows.length) {
      return res({ tone: 'ok', title: 'Tidak ada yang menunggu', body: ['Tidak ada work package berstatus Siap Ditinjau atau Perlu Tinjauan.'] });
    }
    return res({
      tone: 'warn',
      title: plural(rows.length, 'item menunggu keputusan', 'item menunggu keputusan'),
      bullets: rows.slice(0, 6).map(function (p) {
        return p.plan_id + ' · ' + p.intent + ' (' + (D.STATUS[p.status] ? D.STATUS[p.status].label : p.status) + ')';
      }),
      body: rows.length > 6 ? ['…dan ' + (rows.length - 6) + ' lainnya.'] : [],
      actions: [
        { label: 'Buka Approval Inbox', path: '/approvals', primary: true },
        { label: 'Buka Review', path: '/review' }
      ],
      note: 'Keputusan tetap di tangan manusia. Saya tidak memegang approval token.'
    });
  };

  computes.blocked = function () {
    var rows = D.store.plansBy(function (p) { return p.status === 'BLOCKED'; });
    if (!rows.length) return res({ tone: 'ok', title: 'Tidak ada yang diblokir', body: ['Tidak ada work package berstatus Diblokir.'] });
    return res({
      tone: 'danger',
      title: plural(rows.length, 'work package diblokir', 'work package diblokir'),
      bullets: rows.slice(0, 6).map(function (p) { return p.plan_id + ' · ' + p.intent; }),
      actions: [{ label: 'Lihat di Review', path: '/review' }],
      note: 'Alasan blokir per plan ada di halaman Review detail (reason code dari policy engine).'
    });
  };

  computes.recentPlans = function () {
    var rows = D.store.plans.slice(0, 6);
    if (!rows.length) return res({ tone: 'warn', title: 'Belum ada work package', body: ['Store belum berisi plan.'] });
    return res({
      title: 'Work package terbaru',
      bullets: rows.map(function (p) { return p.plan_id + ' · ' + p.intent; }),
      actions: [{ label: 'Buka Work Packages', path: '/work-packages', primary: true }]
    });
  };

  computes.needsReview = function () {
    var rows = D.store.plansBy(function (p) { return p.status === 'NEEDS_REVIEW'; });
    if (!rows.length) return res({ tone: 'ok', title: 'Tidak ada yang perlu tinjauan', body: ['Semua plan sudah lolos atau sudah diputuskan.'] });
    return res({
      tone: 'warn',
      title: plural(rows.length, 'plan perlu tinjauan', 'plan perlu tinjauan'),
      bullets: rows.slice(0, 6).map(function (p) { return p.plan_id + ' · ' + p.intent; }),
      actions: [{ label: 'Buka Review', path: '/review', primary: true }]
    });
  };

  computes.ownershipGap = function () {
    return res({
      tone: 'warn',
      title: 'Kepemilikan tidak tercatat',
      body: [
        'Plan tidak punya field pemohon, dan token MCP membawa scope — bukan nama orang. Jadi daftar di halaman ini adalah seluruh permintaan workspace, bukan "milik saya".',
        'Saya tidak akan menempelkan nama Anda ke plan yang bukan milik Anda untuk membuat halaman ini terlihat benar.'
      ],
      note: 'Terlihat juga di catatan rute /requests pada sources.js.'
    });
  };

  computes.assignmentGap = function () {
    return res({
      tone: 'warn',
      title: 'Penugasan tidak ada di server',
      body: ['Tidak ada field assignee pada plan. Antrean di halaman ini diturunkan dari status plan, sehingga isinya item terbuka seluruh workspace — bukan tugas pribadi.'],
      note: 'Kesenjangan dicatat, bukan ditutupi dengan data contoh.'
    });
  };

  computes.planDetail = function (intent, ctx) {
    var id = ctx.entity;
    if (!id) return res({ tone: 'warn', title: 'Tidak ada work package di layar', body: ['Buka satu work package dulu, lalu tanya lagi.'] });
    var p = D.store.plan(id);
    if (!p) return res({ tone: 'warn', title: 'Plan tidak ditemukan', body: ['Server tidak mengembalikan plan ' + id + '. Saya tidak mengarang isinya.'] });
    var findings = (p.validation && p.validation.findings) || [];
    return res({
      title: 'Work package ' + p.plan_id,
      rows: [
        { label: 'Niat', value: p.intent },
        { label: 'Status', value: D.STATUS[p.status] ? D.STATUS[p.status].label : p.status },
        { label: 'Risiko', value: (D.RISK[p.risk] || {}).label || p.risk || '—' },
        { label: 'Aksi', value: plural((p.actions || []).length, 'tindakan', 'tindakan') },
        { label: 'plan_hash', value: p.plan_hash || '—' }
      ],
      bullets: findings.slice(0, 5).map(function (f) {
        return (f.code || f.reason_code || 'temuan') + ' — ' + (f.message || f.detail || '');
      }),
      body: findings.length ? [] : ['Tidak ada temuan kebijakan yang tersimpan pada plan ini.'],
      actions: [
        { label: 'Buka detail', path: '/work-packages/' + encodeURIComponent(p.plan_id) },
        { label: 'Lihat jejak audit', path: '/audit' }
      ]
    });
  };

  computes.planAudit = function (intent, ctx) {
    var id = ctx.entity;
    var rows = D.store.auditFor(id);
    if (!rows.length) return res({ tone: 'warn', title: 'Belum ada jejak audit', body: ['Tidak ada peristiwa audit untuk ' + (id || 'plan ini') + ' yang dimuat.'] });
    return res({
      title: plural(rows.length, 'peristiwa audit', 'peristiwa audit'),
      bullets: rows.slice(0, 8).map(function (e) {
        return U.eventLabel(e.type) + ' · ' + (e.actor || 'sistem') + ' · ' + U.fmtDate(e.at);
      }),
      actions: [{ label: 'Buka Audit Trail', path: '/audit' }]
    });
  };

  computes.planMandate = function (intent, ctx) {
    var m = D.store.mandateFor(ctx.entity);
    if (!m) return res({ tone: 'warn', title: 'Belum ada mandat', body: ['Plan ini belum punya mandat. Mandat hanya terbit setelah persetujuan manusia.'] });
    var MANDATE = { active: 'Aktif', expired: 'Kedaluwarsa', revoked: 'Dicabut' };
    return res({
      title: 'Mandat ' + m.mandate_id,
      rows: [
        { label: 'Status', value: MANDATE[m.status] || m.status },
        { label: 'Lingkup', value: m.scope || '—' },
        { label: 'Terbit', value: U.fmtDate(m.issued_at) },
        { label: 'Kedaluwarsa', value: U.fmtDate(m.expires_at) }
      ],
      note: 'Pemakaian tidak dilaporkan server, jadi kolom itu tidak diisi.'
    });
  };

  computes.board = function () {
    var order = ['DRAFT', 'READY', 'NEEDS_REVIEW', 'APPROVED', 'EXECUTED', 'BLOCKED', 'REJECTED'];
    var rows = order.map(function (s) {
      var n = D.store.plansBy(function (p) { return p.status === s; }).length;
      return { label: (D.STATUS[s] || {}).label || s, value: String(n) };
    }).filter(function (r) { return r.value !== '0'; });
    return res({ title: 'Sebaran kartu per status', rows: rows.length ? rows : [{ label: 'Kosong', value: '0' }], note: 'Kolom dihitung dari status plan; server tidak menyimpan status papan.' });
  };

  computes.boardGap = function () {
    return res({
      tone: 'warn',
      title: 'Urutan kartu tidak disimpan',
      body: ['Server tidak punya konsep papan atau urutan kartu. Yang ada hanya status plan, dan kolom di sini adalah turunan dari itu. Menyeret kartu tidak akan bertahan setelah muat ulang.'],
      note: 'Dicatat sebagai partial pada rute /board.'
    });
  };

  computes.executions = function () {
    var rows = D.store.executions.slice(0, 6);
    if (!rows.length) return res({ tone: 'warn', title: 'Belum ada eksekusi', body: ['Tidak ada eksekusi tercatat.'] });
    return res({
      title: 'Eksekusi terakhir',
      bullets: rows.map(function (e) {
        return (e.action_id || '—') + ' · ' + (e.result || (e.source === 'audit' ? 'hasil tidak dilaporkan' : '—')) + ' · ' + U.fmtDate(e.at);
      }),
      note: rows[0].source === 'audit' ? 'Baris berasal dari event audit, bukan record eksekusi — hasilnya tidak diklaim.' : ''
    });
  };

  computes.executionStats = function () {
    var rows = D.store.executions;
    var ok = rows.filter(function (e) { return e.result === 'success' || e.result === 'ok'; }).length;
    var unknown = rows.filter(function (e) { return !e.result; }).length;
    return res({
      title: 'Rekap eksekusi',
      rows: [
        { label: 'Total', value: String(rows.length) },
        { label: 'Berhasil', value: String(ok) },
        { label: 'Hasil tidak dilaporkan', value: String(unknown) }
      ],
      body: unknown ? ['Sebagian baris hanya punya event audit, tanpa record hasil. Saya tidak menghitungnya sebagai berhasil.'] : []
    });
  };

  computes.specialists = function () {
    var rows = D.store.specialists || [];
    if (!rows.length) return res({ tone: 'warn', title: 'Daftar spesialis kosong', body: ['Tidak ada data spesialis di peramban.'] });
    return res({
      title: plural(rows.length, 'spesialis', 'spesialis'),
      bullets: rows.map(function (s) { return s.name + ' — ' + (s.role || '') + (s.status ? ' · ' + s.status : ''); }),
      note: 'Daftar ini dari workbuddy/agents/*.md, bukan dari API — rutenya bertanda Data contoh.'
    });
  };

  computes.specialistLimits = function () {
    var rows = D.store.specialists || [];
    var out = [];
    rows.forEach(function (s) {
      (s.limits || []).forEach(function (l) { out.push(s.name + ': ' + l); });
    });
    return res({
      title: 'Batas yang dinyatakan tiap spesialis',
      bullets: out.slice(0, 10),
      note: out.length ? '' : 'Tidak ada batas tercatat pada data yang dimuat.'
    });
  };

  computes.gapWorkforce = function () {
    return res({
      tone: 'warn',
      title: 'Registry agen belum diekspos server',
      body: ['Tidak ada tool MCP yang mengembalikan daftar agen atau beban kerjanya. Isi halaman ini adalah data contoh, dan spanduk di halamannya menyatakan itu.'],
      note: 'Saya tidak bisa membuat endpoint yang tidak ada, dan tidak akan menyajikannya sebagai data nyata.'
    });
  };

  computes.policies = function () {
    var rows = (D.store.policies || []).filter(function (p) { return p.active !== false; });
    if (!rows.length) return res({ tone: 'warn', title: 'Katalog aturan kosong', body: ['Belum ada aturan dimuat.'] });
    return res({
      title: plural(rows.length, 'aturan aktif', 'aturan aktif'),
      bullets: rows.slice(0, 8).map(function (p) { return p.id + ' · ' + p.name + ' (' + (p.severity || 'info') + ')'; }),
      actions: [{ label: 'Buka Policies', path: '/policies' }]
    });
  };

  computes.policiesBlocking = function () {
    var rows = (D.store.policies || []).filter(function (p) { return p.active !== false && p.severity === 'blocking'; });
    return res({
      tone: rows.length ? 'warn' : 'ok',
      title: plural(rows.length, 'aturan memblokir', 'aturan memblokir'),
      bullets: rows.map(function (p) { return p.id + ' · ' + p.name; }),
      body: ['Aturan yang memblokir tidak bisa dinegosiasikan di percakapan. Yang bisa dilakukan adalah mengubah rencananya, atau meminta peninjauan manusia.']
    });
  };

  computes.approvalHowto = function () {
    return res({
      title: 'Cara menyetujui tanpa melewati batas',
      bullets: [
        'Buka Approval Inbox, pilih plan berstatus Siap Ditinjau.',
        'Periksa plan_hash: persetujuan mengikat hash itu, bukan judul plan.',
        'Keputusan dikirim lewat submit_approval dengan approval token milik Anda.',
        'Mandat terbit hanya setelah persetujuan tercatat — bukan sebelumnya.'
      ],
      body: ['Saya tidak memegang approval token. Kalau saya bisa menyetujui, maka persetujuan manusia tidak berarti apa-apa.'],
      actions: [{ label: 'Buka Approval Inbox', path: '/approvals', primary: true }]
    });
  };

  computes.reviewGap = function () {
    return res({
      title: 'Validasi ini deterministik, bukan model',
      body: ['Policy Validator menjalankan aturan atas plan dan mengembalikan reason code. Tidak ada model bahasa yang menilai di jalur ini — supaya hasilnya bisa diulang dan diperiksa.'],
      note: 'Yang memakai model hanyalah penyusunan draf di AI Assistant, dan itu pun masih aturan lokal.'
    });
  };

  computes.auditProof = function () {
    return res({
      title: 'Bagaimana jejak dibuktikan utuh',
      body: [
        'Tiap entri audit menyimpan hash entri sebelumnya: entry_hash = sha256(prev_hash + payload kanonik). Mengubah satu entri lama membuat seluruh rantai setelahnya tidak cocok.',
        'Dashboard hanya membaca. Verifikasi rantai dijalankan di sisi server, bukan di peramban — kalau peramban yang memutuskan, hasilnya tidak bisa dipercaya.'
      ],
      actions: [{ label: 'Buka Audit Trail', path: '/audit' }]
    });
  };

  computes.gapUsers = function () {
    return res({
      tone: 'warn',
      title: 'Belum tersedia, bukan ditolak',
      body: [
        'Tidak ada tool identitas di server dan tidak ada otorisasi admin. Karena itu halaman ini terkunci sebagai "belum tersedia" — bukan "akses ditolak".',
        'Bedanya penting: "ditolak" berarti server memutuskan Anda tidak berhak. "Belum tersedia" berarti server belum punya kemampuannya. Menampilkan yang pertama untuk keadaan kedua berarti mengarang keputusan.'
      ]
    });
  };

  computes.permissionGap = function () {
    var live = D.session.serverCapabilities !== null;
    return res({
      tone: 'warn',
      title: live ? 'Yang nyata hanya scope token' : 'Matriks ini model demo',
      body: live
        ? ['Kapabilitas efektif datang dari get_caller_context untuk token ini. Matriks peran per pengguna di halaman ini hanya model demo — manage_users dan manage_integrations tidak didukung scope mana pun.']
        : ['Server belum menjawab, jadi yang tampil adalah matriks simulasi. Jangan dibaca sebagai wewenang nyata.']
    });
  };

  computes.integrations = function () {
    var rows = (D.store.integrations || []).filter(function (i) { return i.status !== 'connected'; });
    return res({
      title: 'Integrasi yang belum nyata',
      bullets: rows.slice(0, 8).map(function (i) { return (i.name || i.id) + ' — ' + (i.status || 'planned'); }),
      body: rows.length ? ['Hanya MCP lokal yang benar-benar tersambung. Sisanya mock atau direncanakan.'] : ['Semua integrasi pada daftar berstatus tersambung.']
    });
  };

  computes.browserStorage = function () {
    return res({
      tone: 'warn',
      title: 'Yang disimpan di peramban',
      rows: [
        { label: 'dextra_ops_token', value: 'sessionStorage (opsional localStorage bila "ingat saya")' },
        { label: 'dextra_theme', value: 'localStorage' },
        { label: 'dextra_role', value: 'localStorage — hanya persona prototipe' },
        { label: 'dextra_tabs', value: 'sessionStorage' }
      ],
      body: ['Token ops memang tersimpan di peramban. Itu keterbatasan yang dicatat (D-03), bukan sesuatu yang disembunyikan.'],
      note: 'Persona tidak pernah dikirim ke server dan tidak dipakai untuk keputusan apa pun.'
    });
  };

  computes.mandates = function () {
    var rows = (D.store.mandates || []).filter(function (m) { return m.status === 'active'; });
    if (!rows.length) return res({ tone: 'warn', title: 'Tidak ada mandat aktif', body: ['Belum ada mandat aktif yang dimuat.'] });
    return res({
      title: plural(rows.length, 'mandat aktif', 'mandat aktif'),
      bullets: rows.slice(0, 6).map(function (m) {
        return m.mandate_id + ' · ' + (m.plan_id || '—') + ' · ' + (m.scope || '—');
      }),
      actions: [{ label: 'Buka Mandates', path: '/mandates' }],
      note: 'Pemakaian per mandat tidak dilaporkan server.'
    });
  };

  computes.mandatesExpiring = function () {
    var now = Date.now();
    var rows = (D.store.mandates || []).filter(function (m) {
      if (m.status !== 'active' || !m.expires_at) return false;
      var t = new Date(m.expires_at).getTime();
      return !isNaN(t) && t - now < 24 * 3600 * 1000;
    });
    if (!rows.length) return res({ tone: 'ok', title: 'Tidak ada yang kedaluwarsa dalam 24 jam', body: ['Semua mandat aktif masih punya waktu.'] });
    return res({
      tone: 'warn',
      title: plural(rows.length, 'mandat hampir kedaluwarsa', 'mandat hampir kedaluwarsa'),
      bullets: rows.map(function (m) { return m.mandate_id + ' · ' + U.rel(m.expires_at); }),
      actions: [{ label: 'Buka Mandates', path: '/mandates' }]
    });
  };

  computes.capabilitiesHere = function (intent, ctx) {
    var list = (D.sources.byRoute(ctx.path) || {}).intents || [];
    return res({
      title: 'Di halaman ini saya bisa',
      bullets: list.map(function (it) {
        var tag = it.kind === 'handoff' ? ' (butuh manusia)' : it.kind === 'tool' ? ' (tanya server)' : '';
        return it.label + tag;
      }).concat(['…dan pertanyaan bebas tentang isi halaman ini.']),
      note: 'Saya tidak menyetujui, menerbitkan mandat, atau mengeksekusi tindakan.'
    });
  };

  computes.composeHint = function () {
    return res({
      title: 'Susun rencana dari kalimat',
      body: ['Tulis permintaan di kotak bawah, misalnya "kirim ringkasan kontrak ke Legal". Saya akan mencari penerima lewat find_precedent, lalu menyusun draf plan.'],
      bullets: ['Hasilnya draf — belum ada pesan terkirim dan belum ada data berubah.', 'Kalau penerima seri, saya berhenti dan minta Anda menentukan.'],
      actions: [{ label: 'Buka ruang kerja Assistant', path: '/assistant' }]
    });
  };

  /* ---------------- run ---------------- */

  function findIntent(id) {
    var ctx = context();
    var list = D.sources.intentsFor(ctx.path);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function run(id) {
    var ctx = context();
    var intent = findIntent(id);
    if (!intent) {
      return Promise.resolve(res({
        tone: 'warn',
        title: 'Aksi itu tidak tersedia di halaman ini',
        body: ['Kemampuan asisten dinyatakan per rute. Kalau saya menjalankannya dari sini, saya akan mengklaim wewenang yang tidak dideklarasikan halaman ini.'],
        note: 'Lihat daftar yang tersedia dengan "Apa yang bisa kamu lakukan di sini?".'
      }));
    }

    if (intent.kind === 'go') {
      return Promise.resolve({ kind: 'go', path: intent.path, title: intent.label });
    }

    if (intent.kind === 'handoff') {
      return Promise.resolve(res({
        kind: 'handoff',
        tone: 'warn',
        title: 'Ini harus Anda yang lakukan',
        body: [intent.why],
        actions: [{ label: 'Buka ' + intent.path, path: intent.path, primary: true }],
        note: 'Asisten berhenti tepat di batas wewenangnya.'
      }));
    }

    if (intent.kind === 'tool') {
      if (D.store.mode !== 'live') return Promise.resolve(needsServer(intent.tool));
      var args = intent.args || {};
      if (intent.argsFrom === 'plan') {
        var p = D.store.plan(ctx.entity);
        if (!p) return Promise.resolve(res({ tone: 'warn', title: 'Plan tidak ada di layar', body: ['Buka satu work package dulu.'] }));
        args = { plan: p };
      }
      return D.api.call(intent.tool, args).then(function (data) {
        return res({
          title: intent.label,
          body: ['Dijawab server lewat `' + intent.tool + '`.'],
          rows: summarizeToolData(intent.tool, data),
          note: 'Sumber: MCP 127.0.0.1:8765'
        });
      }).catch(function (e) {
        return res({
          tone: 'danger',
          title: 'Server menolak atau gagal',
          body: [e.message || String(e)],
          note: 'Tidak ada hasil pengganti yang dikarang.'
        });
      });
    }

    var fn = computes[intent.compute];
    if (!fn) {
      return Promise.resolve(res({
        tone: 'danger',
        title: 'Perhitungan belum ada',
        body: ['Intent `' + intent.id + '` menunjuk compute `' + intent.compute + '` yang tidak diimplementasikan.'],
        note: 'Ini kesalahan kontrak, bukan kesalahan Anda.'
      }));
    }
    return Promise.resolve(fn(intent, ctx));
  }

  /* Tool answers arrive as arbitrary JSON. Show a small, honest shape instead of
     dumping a wall of keys — and never invent fields that are not there. */
  function summarizeToolData(tool, data) {
    if (!data || typeof data !== 'object') return [];
    if (tool === 'get_caller_context') {
      return [
        { label: 'Scope', value: data.scope || '—' },
        { label: 'Kapabilitas', value: (data.capabilities || []).join(', ') || '—' },
        { label: 'Tidak didukung server', value: (data.unbacked_capabilities || []).join(', ') || '—' }
      ];
    }
    if (tool === 'get_org_rules') {
      return [
        { label: 'Organisasi', value: data.org_id || data.name || '—' },
        { label: 'Zona waktu', value: data.timezone || '—' },
        { label: 'Jumlah aturan', value: String((data.rules || []).length) }
      ];
    }
    if (tool === 'get_audit_log') {
      var ev = data.events || [];
      return [
        { label: 'Peristiwa', value: String(ev.length) },
        { label: 'Terbaru', value: ev[0] ? U.eventLabel(ev[0].type) + ' · ' + U.fmtDate(ev[0].at) : '—' }
      ];
    }
    if (data.plan) return [{ label: 'Plan', value: data.plan.plan_id + ' · ' + data.plan.status }];
    return Object.keys(data).slice(0, 6).map(function (k) {
      var v = data[k];
      return { label: k, value: typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v) };
    });
  }

  /* ---------------- free text ---------------- */

  var STOP = { yang: 1, apa: 1, saya: 1, ini: 1, itu: 1, ada: 1, dan: 1, ke: 1, di: 1, untuk: 1, dengan: 1, bisa: 1, kah: 1, mana: 1, bagaimana: 1, apakah: 1, kamu: 1, anda: 1, dong: 1, tolong: 1, tampilkan: 1, tunjukkan: 1, berapa: 1 };

  function tokens(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length > 2 && !STOP[w];
    });
  }

  function ask(text) {
    var ctx = context();
    var q = tokens(text);
    if (!q.length) return Promise.resolve(computes.capabilitiesHere(null, ctx));

    /* An explicit plan id in the message wins over fuzzy matching. */
    var m = String(text).match(/\b(WP-\d+|pln_[a-z0-9]+|PLN-[A-Z0-9]+)\b/i);
    if (m) {
      var plan = D.store.plan(m[1]) || D.store.plans.filter(function (p) {
        return String(p.plan_id).toLowerCase() === m[1].toLowerCase();
      })[0];
      if (plan) {
        return Promise.resolve(res({
          title: 'Work package ' + plan.plan_id,
          rows: [
            { label: 'Niat', value: plan.intent },
            { label: 'Status', value: D.STATUS[plan.status] ? D.STATUS[plan.status].label : plan.status },
            { label: 'Risiko', value: (D.RISK[plan.risk] || {}).label || plan.risk || '—' }
          ],
          actions: [{ label: 'Buka detail', path: '/work-packages/' + encodeURIComponent(plan.plan_id), primary: true }]
        }));
      }
      return Promise.resolve(res({ tone: 'warn', title: 'Plan tidak ditemukan', body: ['Server tidak punya ' + m[1] + ' pada data yang dimuat.'] }));
    }

    var best = null, bestScore = 0;
    D.sources.intentsFor(ctx.path).forEach(function (it) {
      var hay = tokens(it.label + ' ' + (it.compute || '') + ' ' + (it.tool || '') + ' ' + it.id);
      var score = 0;
      q.forEach(function (w) {
        if (hay.indexOf(w) >= 0) score += 1;
        else if (hay.some(function (h) { return h.indexOf(w) === 0 && w.length > 3; })) score += 0.5;
      });
      if (score > bestScore) { bestScore = score; best = it; }
    });

    if (best && bestScore >= 1) return run(best.id);

    return Promise.resolve(res({
      tone: 'warn',
      title: 'Saya tidak yakin maksudnya',
      body: ['Saya tidak memilih tebakan. Pilih salah satu di bawah, atau sebutkan nomor work package (mis. WP-1042).'],
      bullets: D.sources.intentsFor(ctx.path).slice(0, 5).map(function (it) { return it.label; }),
      note: 'Pencocokan berbasis kata kunci, bukan model bahasa — supaya hasilnya bisa diulang.'
    }));
  }

  /* ---------------- compose (plan drafting) ----------------
     Moved here from views/assistant.js so the page and the panel share one
     brain. Still a deterministic local planner, and it says so. */

  function guessHint(text) {
    var t = text.toLowerCase(), best = null;
    D.store.contacts.forEach(function (c) {
      var full = (c.display_name || '').toLowerCase();
      if (full.length > 3 && t.indexOf(full) >= 0 && (!best || full.length > best.length)) best = full;
      (c.tags || []).forEach(function (tag) {
        if (tag.length < 3 || t.indexOf(tag) < 0) return;
        if (!best || tag.length > best.length) best = tag;
      });
    });
    return best;
  }

  function decorate(candidate) {
    var contact = D.store.contacts.filter(function (c) { return c.contact_id === candidate.contact_id; })[0];
    return {
      contact_id: candidate.contact_id,
      display_name: contact ? contact.display_name : candidate.contact_id,
      department: contact ? contact.department : '',
      masked: contact ? contact.masked_address : '—',
      score: candidate.score,
      evidence: candidate.evidence || [],
      disputed: !!candidate.disputed,
      known: !!contact
    };
  }

  function demoLookup(text) {
    var t = text.toLowerCase();
    var hits = [];
    D.store.contacts.forEach(function (c) {
      var matched = (c.tags || []).filter(function (tag) { return tag.length >= 3 && t.indexOf(tag) >= 0; });
      var full = (c.display_name || '').toLowerCase();
      var fullHit = full.length > 3 && t.indexOf(full) >= 0;
      if (!matched.length && !fullHit) return;
      var firstName = full.split(' ')[0];
      var score = fullHit ? 1 : 0.4 + (matched.indexOf(firstName) >= 0 ? 0.4 : 0.2);
      if (c.department && t.indexOf(c.department.toLowerCase()) >= 0) score += 0.2;
      hits.push(decorate({
        contact_id: c.contact_id,
        score: Math.min(1, score),
        evidence: [fullHit ? 'nama lengkap disebut' : 'cocok pada tag: ' + matched.join(', ')],
        disputed: false
      }));
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    var resolution = 'none';
    if (hits.length === 1) resolution = 'unique';
    else if (hits.length > 1) resolution = Math.abs(hits[0].score - hits[1].score) < 1e-9 ? 'ambiguous' : 'unique';
    return { candidates: hits, resolution: resolution };
  }

  function liveLookup(text) {
    var hint = guessHint(text);
    if (!hint) return Promise.resolve({ candidates: [], resolution: 'none' });
    return D.api.call('find_precedent', { subject: hint, context: text }).then(function (d) {
      return { candidates: (d.candidates || []).map(decorate), resolution: d.resolution || 'none' };
    }).catch(function (e) {
      return { candidates: [], resolution: 'error', error: e.message };
    });
  }

  function lookupRecipient(text) {
    if (D.store.mode === 'live') return liveLookup(text);
    return Promise.resolve(demoLookup(text));
  }

  function planDraft(text, lookup) {
    var t = text.toLowerCase();
    var isSchedule = /jadwal|jadwalkan|rapat|agenda|undang/.test(t);
    var isDelete = /hapus|delete|bersihkan/.test(t);
    var isFridayBlocked = /jumat|friday/.test(t) && /11[:.]?(3|4)\d/.test(t);

    lookup = lookup || { candidates: [], resolution: 'none' };
    var recipient = lookup.candidates[0] || null;

    if (lookup.resolution === 'ambiguous') {
      return {
        text: 'Ada ' + lookup.candidates.length + ' kandidat penerima dengan kecocokan setara. Saya tidak memilih salah satunya — penerima harus ditentukan manusia.',
        steps: ['Mencari preseden penerima', 'Membandingkan skor kecocokan'],
        recipient: lookup,
        blocked: {
          code: 'AMBIGUOUS_RECIPIENT',
          message: 'Kandidat: ' + lookup.candidates.map(function (c) { return c.display_name + ' (' + c.department + ')'; }).join(', ') + '. Sebutkan departemennya.'
        }
      };
    }
    if (lookup.resolution === 'error') {
      return {
        text: 'Pencarian penerima gagal di server, jadi saya tidak menyusun rencana.',
        steps: ['Memanggil find_precedent'],
        recipient: lookup,
        blocked: { code: 'LOOKUP_FAILED', message: lookup.error }
      };
    }
    if (!recipient) {
      return {
        text: 'Saya tidak menemukan penerima pada permintaan ini. Sebutkan nama atau departemennya, lalu saya susun rencananya.',
        steps: ['Mencari preseden penerima'],
        recipient: lookup
      };
    }

    var actions = [{
      action_type: isSchedule ? 'schedule_event' : 'send_email',
      target: { display_name: recipient.display_name, masked_address: recipient.masked, channel: isSchedule ? 'calendar' : 'email' },
      schedule: { start_at: new Date(Date.now() + 86400000).toISOString() },
      risk: isDelete ? 'critical' : /eksternal|vendor|kontrak/.test(t) ? 'high' : 'medium'
    }];

    if (isDelete) {
      return {
        text: 'Permintaan ini menyentuh operasi destruktif. Saya dapat menyusunnya, tetapi tidak dapat menjalankannya tanpa dua approver.',
        steps: ['Mengidentifikasi objek yang akan dihapus', 'Memeriksa kebijakan retensi SAFE-05'],
        recipient: lookup,
        blocked: { code: 'SAFE-05', message: 'Operasi destruktif memerlukan dual approval dan tidak tercakup dalam mandat aktif.' }
      };
    }
    if (isFridayBlocked) {
      return {
        text: 'Jadwal yang Anda minta berada di dalam jendela Salat Jumat. Kebijakan TIME-03 memblokir penjadwalan pada 11:30–13:00 WIB. Saya dapat mengusulkan 09:00 atau 13:15.',
        steps: ['Membaca aturan organisasi', 'Mengevaluasi slot yang diminta'],
        recipient: lookup,
        blocked: { code: 'TIME-03', message: 'Jendela 11:30–13:00 pada hari Jumat dilindungi dan tidak dapat dijadwalkan.' }
      };
    }
    return {
      text: 'Saya menyusun satu work package. Ini masih rencana — belum ada pesan terkirim dan belum ada data yang diubah.',
      steps: [
        'Workforce Dispatcher memecah permintaan menjadi 1 tindakan',
        'Executive Assistant menyusun draf',
        'Adversarial Reviewer menguji lingkup',
        'Policy Validator mengevaluasi aturan aktif'
      ],
      recipient: lookup,
      plan: {
        plan_id: 'DRAFT-' + String(Math.floor(Math.random() * 900 + 100)),
        status: 'READY',
        intent: text.length > 110 ? text.slice(0, 110) + '…' : text,
        actions: actions
      }
    };
  }

  function compose(text) {
    return lookupRecipient(text).then(function (lookup) { return planDraft(text, lookup); });
  }

  /* ---------------- public ---------------- */

  D.copilot = {
    context: context,
    intents: function () { return D.sources.intentsFor(context().path); },
    run: run,
    ask: ask,
    compose: compose,
    computes: computes,
    /* exposed for the panel so it can re-render on navigation */
    path: currentPath
  };
})(window);
