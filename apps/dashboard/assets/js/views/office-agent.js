/* View — Office Agent: Meeting to Action.
 *
 * Lima tahap yang tidak boleh saling mengklaim: permintaan, ringkasan, tindakan
 * dan klarifikasi, rencana, lalu persetujuan dan eksekusi. Status draf, status
 * persetujuan, dan status eksekusi ditampilkan terpisah; satu badge tidak
 * pernah mewakili dua fakta.
 *
 * Dalam mode demo seluruh data berasal dari fixtures.js lewat mesin demo lokal.
 * Tidak ada email, jadwal, atau tugas yang dikirim, dan layar mengatakan itu
 * pada setiap hasil.
 */
(function () {
  'use strict';

  var D = window.DEXTRA;
  var U = D.util, ui = D.ui, esc = U.esc;
  var C = window.DEXTRA_OFFICE_CONTRACTS;
  var FX = window.DEXTRA_OFFICE_FIXTURES;

  var STEPS = [
    { n: 1, label: 'Permintaan' },
    { n: 2, label: 'Ringkasan' },
    { n: 3, label: 'Tindakan & Klarifikasi' },
    { n: 4, label: 'Tinjauan Rencana' },
    { n: 5, label: 'Persetujuan & Eksekusi' }
  ];

  var TYPE = {
    send_email: { label: 'Email', icon: 'mail', tone: 'info' },
    create_calendar_event: { label: 'Kalender', icon: 'event', tone: 'brand' },
    create_task: { label: 'Tugas', icon: 'task_alt', tone: 'outline' }
  };

  var SEV = {
    blocking: { label: 'Memblokir', tone: 'danger', icon: 'block' },
    warning: { label: 'Peringatan', tone: 'warning', icon: 'warning' },
    info: { label: 'Info', tone: 'info', icon: 'info' }
  };

  var TZ = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'UTC'];

  var EXAMPLES = [
    'Buatkan ringkasan notulen rapat koordinasi 30 Oktober 2026 dan siapkan tindak lanjutnya.',
    'Ubah catatan rapat Operasi 30 Oktober menjadi daftar tindakan yang bisa ditinjau.',
    'Siapkan notulen rapat untuk dipublikasikan ke tim, termasuk jadwal rapat berikutnya.'
  ];

  function clone(v) { return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  function statusBadge(s) {
    var m = C.STATUS[s] || { label: s || '—', tone: 'outline' };
    return '<span class="badge badge--' + m.tone + '">' + esc(m.label) + '</span>';
  }
  function typeBadge(t) {
    var m = TYPE[t] || { label: String(t || '—').replace(/_/g, ' '), tone: 'outline' };
    return '<span class="badge badge--' + m.tone + '">' + esc(m.label) + '</span>';
  }
  function demoChip() { return '<span class="badge badge--outline oa-demo-chip">DEMO</span>'; }
  function dl(rows) {
    return '<dl class="def-list">' + rows.map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }
  function bytes(n) {
    if (!n && n !== 0) return '—';
    if (n < 1024) return n + ' B';
    return (n / 1024).toFixed(1) + ' KB';
  }
  function localParts(iso) {
    if (!iso) return { date: '', time: '' };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    var shifted = new Date(d.getTime() + 7 * 3600000);
    return { date: shifted.toISOString().slice(0, 10), time: shifted.toISOString().slice(11, 16) };
  }
  function actionTitle(plan, id) {
    var list = (plan && plan.actions) || [];
    for (var i = 0; i < list.length; i++) if (list[i].action_id === id) return list[i].title || id;
    return id;
  }
  function severityIcon(sev) { return (SEV[sev] || SEV.info).icon; }

  function findingRow(f) {
    var m = SEV[f.severity] || SEV.info;
    return '<div class="oa-finding oa-finding--' + esc(f.severity || 'info') + '">' +
      '<span class="material-symbols-outlined">' + severityIcon(f.severity) + '</span>' +
      '<div><span class="oa-finding__code">' + esc(f.code || 'TEMUAN') + '</span>' +
      '<span class="small">' + esc(f.message || '') + '</span></div>' +
      '<span class="badge badge--' + m.tone + '">' + esc(m.label) + '</span></div>';
  }

  D.views.officeAgent = function (root) {
    var store = window.DEXTRA_OFFICE_STATE.create();
    var api = window.DEXTRA_OFFICE_API.create({
      api: D.api,
      fixtures: FX,
      demo: window.DEXTRA_OFFICE_ENGINE
    });

    var local = {
      tab: 'text',
      text: '',
      file: null,
      fileError: null,
      intakeError: null,
      answers: {},
      editDraft: null,
      retry: null
    };
    var unmounted = false;

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workspace · Office Agent',
        title: 'Office Agent — Meeting to Action',
        desc: 'Ubah notulen rapat menjadi ringkasan, daftar tindakan, dan rencana yang harus disetujui manusia sebelum apa pun dijalankan.',
        actions:
          '<button class="btn btn--secondary" data-oa="load-demo" id="oa-load-demo">' +
            '<span class="material-symbols-outlined">auto_awesome</span>Muat contoh</button>' +
          '<button class="btn btn--secondary" data-oa="new">' +
            '<span class="material-symbols-outlined">add</span>Mulai baru</button>'
      }) +
      '<div id="oa-mode" aria-live="polite"></div>' +
      '<div id="oa-stepper"></div>' +
      '<div class="oa-layout">' +
        '<div class="oa-main" id="oa-main" aria-live="polite"></div>' +
        '<aside class="oa-rail" id="oa-rail"></aside>' +
      '</div>';

    /* ---------------- helpers that read the view ---------------- */
    function q(sel) { return root.querySelector(sel); }
    function qa(sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
    function state() { return store.get(); }
    function reqId() {
      var s = state();
      if (s.request && s.request.request_id) return s.request.request_id;
      /* Fallback bernama fixture hanya boleh dipakai mode demo: di live, memakai
         id dari data contoh akan mengirim permintaan ke server dengan identitas
         yang bukan milik sesi ini. */
      if (isDemo() && FX && FX.request_id) return FX.request_id;
      return null;
    }
    function isDemo() { return state().mode === 'demo'; }
    function modeIsLive() { return state().mode === 'live' || state().mode === 'partial'; }

    function fail(err) {
      if (unmounted) return;
      store.set({ loading: false, error: (err && err.message) || 'Permintaan tidak dapat diproses.' });
    }

    function apply(res) {
      if (!res) return;
      if (res.state) {
        store.replace(res.state);
        return;
      }
      if (!res.patch) return;
      var patch = clone(res.patch);
      if (patch.planStatus) {
        var current = state().plan;
        patch.plan = current ? Object.assign({}, current, { status: patch.planStatus, can_approve: false }) : current;
        delete patch.planStatus;
      }
      if (patch.approvals && patch.approval) {
        patch.approvals = (state().approvals || []).concat(patch.approvals);
      }
      store.set(patch);
    }

    function refreshAudit() {
      if (isDemo() || !reqId()) return;
      api.getAudit(reqId()).then(function (res) {
        if (!unmounted) apply(res);
      }).catch(function () {
        /* Timeline bersifat pendamping; kegagalannya tidak boleh menutupi
           hasil operasi utama atau diganti data contoh. */
      });
    }

    function goStage(n) {
      var max = state().maxStage || 1;
      if (n < 1 || n > max) return;
      store.set({ stage: n });
    }

    /* ---------------- mode banner ---------------- */
    function modeHtml(s) {
      if (s.mode === 'probing') {
        return '<div class="banner banner--info oa-modebar"><span class="material-symbols-outlined">sync</span>' +
          '<div><b>Memeriksa pipeline Office Agent…</b> Menanyakan tool yang tersedia di server sebelum menampilkan data apa pun.</div></div>';
      }
      if (s.mode === 'demo') {
        return '<div class="banner banner--demo oa-modebar"><span class="material-symbols-outlined">science</span>' +
          '<div><b>Mode DEMO</b> — pipeline Office Agent belum tersedia di server. Data contoh; tidak ada email, jadwal, atau tugas yang dikirim.' +
          (s.reason ? ' ' + esc(s.reason) : '') + '</div></div>';
      }
      if (s.mode === 'partial') {
        var missing = (s.probe && s.probe.missing) || [];
        return '<div class="banner banner--warning oa-modebar"><span class="material-symbols-outlined">rule</span>' +
          '<div><b>Pipeline Office Agent sebagian.</b> Tool yang belum tersedia: ' +
          esc(missing.join(', ')) + '. Tindakan yang bergantung pada tool itu akan gagal dengan alasan dari server, bukan diganti data contoh.</div></div>';
      }
      return '<div class="oa-conn" role="status">' +
        '<span class="dot dot--success"></span>Terhubung ke server — pipeline Office Agent tersedia.' +
        (s.probe && s.probe.available ? ' <span class="tiny muted">' + s.probe.available.length + ' tool</span>' : '') +
        '</div>';
    }

    /* ---------------- stepper ---------------- */
    function stepperHtml(s) {
      var max = s.maxStage || 1;
      return '<nav class="oa-stepper" aria-label="Tahap Office Agent">' +
        STEPS.map(function (st) {
          var done = st.n < s.stage;
          var current = st.n === s.stage;
          var locked = st.n > max;
          var cls = 'oa-step' + (done ? ' is-done' : '') + (current ? ' is-current' : '') + (locked ? ' is-locked' : '');
          return '<button class="' + cls + '" data-oa="stage" data-n="' + st.n + '"' +
            (locked ? ' disabled aria-disabled="true"' : '') +
            (current ? ' aria-current="step"' : '') +
            ' title="' + (locked ? 'Selesaikan tahap sebelumnya dulu' : 'Buka tahap ' + st.n) + '">' +
            '<span class="oa-step__num">' + (done ? '<span class="material-symbols-outlined">check</span>' : st.n) + '</span>' +
            '<span class="oa-step__label">' + esc(st.label) + '</span></button>';
        }).join('') +
        '</nav>';
    }

    /* ---------------- stage 1: intake ---------------- */
    function intakeHtml(s) {
      if (s.loading) {
        return '<section class="card"><div class="card__body oa-processing">' +
          '<span class="oa-spinner" aria-hidden="true"></span>' +
          '<div><b>Memproses permintaan…</b><p class="small muted">' + (isDemo() ? 'Mengekstrak ringkasan, keputusan, dan tindak lanjut. Tidak ada data yang dikirim ke sistem eksternal.' : 'Mengekstrak ringkasan, keputusan, dan tindak lanjut; permintaan dikirim ke server untuk diproses.') + '</p></div>' +
          '<div class="oa-skel-lines"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line"></span></div>' +
          '</div></section>';
      }
      if (s.error) {
        return '<section class="card"><div class="card__body">' + ui.errorState(s.error, 'Coba lagi') + '</div></section>';
      }

      var tab = local.tab;
      var tabs =
        '<div class="segmented oa-tabs" role="tablist" aria-label="Sumber permintaan">' +
          ['text|Teks|notes', 'document|Dokumen|description', 'voice|Voice|mic'].map(function (t) {
            var parts = t.split('|');
            return '<button role="tab" data-oa="tab" data-tab="' + parts[0] + '" aria-selected="' + (tab === parts[0]) + '"' +
              ' class="' + (tab === parts[0] ? 'is-active' : '') + '">' +
              '<span class="material-symbols-outlined">' + parts[2] + '</span>' + parts[1] + '</button>';
          }).join('') +
        '</div>';

      var body = '';
      if (tab === 'text') {
        body =
          '<div class="field" id="oa-text-field">' +
            '<label class="field__label" for="oa-text">Teks permintaan<span class="req">*</span></label>' +
            '<textarea class="textarea" id="oa-text" rows="7" maxlength="2000" placeholder="Contoh: Buatkan ringkasan notulen rapat koordinasi 30 Oktober 2026, lalu siapkan tindak lanjut untuk dipublikasikan.">' + esc(local.text) + '</textarea>' +
            '<div class="row oa-counter"><span class="tiny faint" id="oa-count">' + local.text.length + ' / 2000</span>' +
              '<span class="spacer"></span><span class="tiny faint">Minimal 20 karakter</span></div>' +
            (local.intakeError ? '<div class="field__error"><span class="material-symbols-outlined">error</span>' + esc(local.intakeError) + '</div>' : '') +
          '</div>' +
          '<div class="oa-examples"><span class="tiny faint">Contoh cepat</span>' +
            EXAMPLES.map(function (x) {
              return '<button class="chip chip--sm" data-oa="example" data-text="' + esc(x) + '">' + esc(x.length > 58 ? x.slice(0, 58) + '…' : x) + '</button>';
            }).join('') +
          '</div>';
      } else if (tab === 'document') {
        body =
          '<div class="oa-drop" data-oa="dropzone" role="button" tabindex="0" aria-label="Pilih berkas .md atau .txt, maksimum 1 MB">' +
            '<span class="material-symbols-outlined">upload_file</span>' +
            '<div><b>Letakkan berkas di sini atau pilih berkas</b>' +
              '<p class="tiny muted">.md atau .txt, maksimum 1 MB. Berkas dibaca di peramban dan tidak diunggah ke mana pun pada mode demo.</p></div>' +
            '<input type="file" id="oa-file" accept=".md,.txt,text/markdown,text/plain" hidden>' +
          '</div>' +
          (local.fileError ? '<div class="field__error" style="margin-top:8px"><span class="material-symbols-outlined">error</span>' + esc(local.fileError) + '</div>' : '') +
          (local.file ? fileCardHtml() : '');
      } else {
        body =
          '<div class="oa-voice">' +
            '<div class="row" style="margin-bottom:8px"><span class="material-symbols-outlined" style="color:var(--faint)">mic_off</span>' +
              '<b>Input suara belum tersedia</b><span class="badge badge--outline">Belum tersedia</span></div>' +
            '<p class="small muted">Layanan pengenalan suara (ASR) belum terhubung ke backend, jadi rekaman tidak dapat diproses. Tidak ada tombol rekam di layar ini karena tidak ada yang bisa dilakukan tombol itu.</p>' +
            '<p class="tiny faint" style="margin-top:8px">Gunakan tab Teks atau Dokumen untuk melanjutkan.</p>' +
          '</div>';
      }

      return '<section class="card">' +
        '<div class="card__head"><div><h2>Permintaan</h2><p>Pilih sumber, lalu proses menjadi ringkasan rapat.</p></div>' +
          '<div class="spacer"></div><span class="badge badge--outline">' + esc(isDemo() ? 'Diproses lokal' : 'Diproses di server') + '</span></div>' +
        '<div class="card__body">' +
          '<div class="oa-intro"><span class="material-symbols-outlined">note_add</span>' +
            '<span class="small muted">Belum ada permintaan pada sesi ini. Mulai dari teks, dokumen, atau contoh cepat di bawah.</span></div>' +
          tabs +
          '<div class="oa-tabpanel">' + body + '</div>' +
        '</div>' +
        '<div class="card__foot">' +
          '<span class="tiny faint">Demikian pula di mode live: permintaan hanya dikirim ke server setelah Anda menekan Proses.</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn btn--primary" data-oa="process"' + (tab === 'voice' ? ' disabled title="Input suara belum tersedia"' : '') + '>' +
            '<span class="material-symbols-outlined">play_arrow</span>Proses permintaan</button>' +
        '</div>' +
      '</section>';
    }

    function fileCardHtml() {
      var f = local.file;
      return '<div class="oa-filecard">' +
        '<span class="material-symbols-outlined">description</span>' +
        '<div class="oa-filecard__meta"><b>' + esc(f.name) + '</b>' +
          '<span class="tiny muted">' + bytes(f.size) + ' · ' + esc((f.text || '').length) + ' karakter</span></div>' +
        '<button class="icon-btn" data-oa="remove-file" aria-label="Hapus berkas"><span class="material-symbols-outlined">close</span></button>' +
        '<pre class="oa-pre">' + esc(String(f.text || '').slice(0, 2200)) + (f.text && f.text.length > 2200 ? '\n…' : '') + '</pre>' +
      '</div>';
    }

    /* ---------------- stage 2: summary ---------------- */
    function summaryHtml(s) {
      if (s.loading) return loadingCard('Menyiapkan ringkasan…');
      if (!s.summary) {
        return '<section class="card"><div class="card__body">' +
          ui.empty({ icon: 'summarize', title: 'Belum ada ringkasan', body: 'Proses permintaan terlebih dahulu pada tahap 1.', action: '<button class="btn btn--secondary" data-oa="stage" data-n="1">Kembali ke permintaan</button>' }) +
          '</div></section>';
      }
      var m = s.summary;
      var src = m.sumber || {};
      return '<div class="stack">' +
        '<section class="card">' +
          '<div class="card__head"><div style="min-width:0"><h2>' + esc(m.title || 'Ringkasan rapat') + '</h2>' +
            '<p>' + esc(U.fmtDay(m.tanggal)) + (m.waktu ? ' · ' + esc(m.waktu.start) + '–' + esc(m.waktu.end) + ' ' + esc(m.waktu.timezone) : '') + '</p></div>' +
            '<div class="spacer"></div><span class="badge badge--info">Hasil ekstraksi</span></div>' +
          '<div class="card__body">' +
            '<p class="oa-summary-text">' + esc(m.ringkasan || '') + '</p>' +
            '<div class="oa-summary-grid">' +
              '<div><h3 class="oa-subhead">Keputusan</h3>' +
                '<ul class="oa-list">' + (m.keputusan || []).map(function (k) {
                  return '<li><span class="material-symbols-outlined">check_circle</span><span>' + esc(k) + '</span></li>';
                }).join('') + '</ul></div>' +
              '<div><h3 class="oa-subhead">Pihak terkait</h3>' +
                '<div class="oa-people">' + (m.pihak || []).map(function (p) {
                  return '<span class="oa-person"><span class="avatar avatar--sm">' + esc(U.initials(p.name)) + '</span>' +
                    '<span><b>' + esc(p.name) + '</b><span class="tiny muted">' + esc(p.department || '') + '</span></span></span>';
                }).join('') + '</div></div>' +
            '</div>' +
            '<div class="divider"></div>' +
            dl([
              ['Sumber', esc(src.filename || '—') + (src.size_bytes ? ' <span class="tiny faint">· ' + bytes(src.size_bytes) + '</span>' : '')],
              ['Diproses', esc(U.fmtDate(src.processed_at))],
              ['Sitasi', (src.citations || []).map(function (c) {
                return '<div class="oa-citation"><span class="mono">' + esc(c.id) + '</span> <span class="small">' + esc(c.quote) + '</span></div>';
              }).join('') || '<span class="faint">—</span>']
            ]) +
          '</div>' +
          '<div class="card__foot">' +
            '<button class="btn btn--secondary" data-oa="stage" data-n="1"><span class="material-symbols-outlined">edit_note</span>Ubah sumber</button>' +
            '<div class="spacer"></div>' +
            '<button class="btn btn--primary" data-oa="stage" data-n="3">Lanjut ke tindakan<span class="material-symbols-outlined">arrow_forward</span></button>' +
          '</div>' +
        '</section>' +
        (m.warnings && m.warnings.length
          ? '<div class="banner banner--warning"><span class="material-symbols-outlined">report</span><div><b>Peringatan ekstraksi.</b> ' +
            m.warnings.map(function (w) { return esc(w.message); }).join(' ') + '</div></div>'
          : '') +
      '</div>';
    }

    function loadingCard(text) {
      return '<section class="card"><div class="card__body oa-processing">' +
        '<span class="oa-spinner" aria-hidden="true"></span><div><b>' + esc(text) + '</b>' +
        '<p class="small muted">Menunggu respons. Tidak ada tindakan yang dijalankan selama proses ini.</p></div></div></section>';
    }
    /* ---------------- stage 3: actions & clarifications ---------------- */
    function actionCardHtml(a, planChanged) {
      var recipient = a.recipient;
      var recipientHtml = recipient
        ? '<b>' + esc(recipient.display_name) + '</b>' +
          (recipient.department ? ' <span class="muted">· ' + esc(recipient.department) + '</span>' : '') +
          '<div class="tiny muted mono--wrap">' + esc(recipient.masked || recipient.email || '') + '</div>'
        : '<span class="badge badge--warning">Belum ditentukan — menunggu klarifikasi</span>';
      var schedule = a.schedule
        ? esc(U.fmtDate(a.schedule.start_at)) + ' · ' + (a.schedule.duration_minutes || 60) + ' menit · ' + esc(a.schedule.timezone || 'Asia/Jakarta')
        : '<span class="faint">—</span>';
      var attendees = (a.attendees || []).length
        ? a.attendees.map(function (x) { return esc(x.name); }).join(', ')
        : '<span class="faint">—</span>';
      return '<section class="card oa-action' + (planChanged ? ' is-changed' : '') + '">' +
        '<div class="card__head">' +
          '<span class="mono oa-action__id">' + esc(a.action_id) + '</span>' +
          typeBadge(a.action_type) +
          '<span class="oa-adapter">MOCK ADAPTER</span>' +
          '<div class="spacer"></div>' + statusBadge(a.status) +
        '</div>' +
        '<div class="card__body">' +
          '<p class="oa-action__what">' + esc(a.what || '') + '</p>' +
          dl([
            ['PIC', '<b>' + esc((a.pic && a.pic.name) || '—') + '</b>' + (a.pic && a.pic.department ? ' <span class="muted">· ' + esc(a.pic.department) + '</span>' : '')],
            (a.action_type === 'create_calendar_event'
              ? ['Kalender', '<b>Kalender Divisi Operasi</b> <span class="muted">· Operasi</span>']
              : ['Penerima', recipientHtml]),
            ['Tenggat', a.due_at ? esc(U.fmtDate(a.due_at)) : '<span class="faint">—</span>'],
            ['Jadwal', schedule],
            ['Lokasi', a.location ? esc(a.location) : '<span class="faint">—</span>'],
            ['Peserta', attendees],
            ['Sumber', esc((a.source && a.source.document) || '—') + ' ' +
              ((a.source && a.source.citations) || []).map(function (c) { return '<span class="mono">' + esc(c) + '</span>'; }).join(' ')],
            ['Temuan', (a.findings && a.findings.length)
              ? a.findings.map(findingRow).join('')
              : '<span class="tiny muted">Tidak ada temuan pada tindakan ini.</span>']
          ]) +
        '</div>' +
      '</section>';
    }

    function clarificationPanelHtml(s) {
      if (!s.clarifications || !s.clarifications.length) {
        return '<section class="card"><div class="card__body oa-clarify-done">' +
          '<span class="material-symbols-outlined" style="color:var(--success-600)">check_circle</span>' +
          '<div><b>Tidak ada klarifikasi diperlukan.</b>' +
          '<p class="small muted">Semua tindakan sudah memiliki penerima dan jadwal yang jelas.</p></div></div></section>';
      }
      var answered = s.answers && Object.keys(s.answers).length > 0;
      if (answered) {
        return '<section class="card oa-clarify"><div class="card__body oa-clarify-done">' +
          '<span class="material-symbols-outlined" style="color:var(--success-600)">task_alt</span>' +
          '<div style="flex:1;min-width:0"><b>Klarifikasi dijawab</b>' +
          '<p class="small muted">Penerima dan jadwal pada tindakan di atas sudah diperbarui dari jawaban Anda.</p></div>' +
          '<button class="btn btn--primary btn--sm" data-oa="stage" data-n="4">Tinjau rencana<span class="material-symbols-outlined">arrow_forward</span></button>' +
          '</div></section>';
      }

      var blocks = s.clarifications.map(function (q) { return questionHtml(q); }).join('');
      return '<section class="card oa-clarify" id="oa-clarify">' +
        '<div class="card__head"><div><h2>Klarifikasi diperlukan</h2>' +
          '<p>' + s.clarifications.length + ' pertanyaan sebelum rencana bisa disusun. Tidak ada pilihan yang dipilih otomatis.</p></div>' +
          '<div class="spacer"></div><span class="badge badge--warning">' + s.clarifications.length + ' terbuka</span></div>' +
        '<div class="card__body">' + blocks +
          '<div class="field__error oa-clarify__error" id="oa-clar-error" style="display:none"><span class="material-symbols-outlined">error</span><span></span></div>' +
        '</div>' +
        '<div class="card__foot">' +
          '<span class="tiny faint">Jawaban dikirim ke tahap validasi rencana, bukan langsung ke eksekusi.</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn btn--primary" id="oa-clar-submit" data-oa="submit-clarify" disabled>Kirim klarifikasi</button>' +
        '</div>' +
      '</section>';
    }

    function questionHtml(q) {
      var a = local.answers || {};
      if (q.kind === 'recipient') {
        var selected = a.clar_recipient || {};
        var options = (q.options || []).map(function (o) {
          var checked = selected.contact_id === o.contact_id;
          return '<label class="oa-option' + (checked ? ' is-selected' : '') + '">' +
            '<input type="radio" name="oa-recipient" value="' + esc(o.contact_id) + '"' + (checked ? ' checked' : '') + '>' +
            '<span class="oa-option__body"><b>' + esc(o.display_name) + '</b>' +
              '<span class="tiny muted">' + esc(o.department || '') + ' · ' + esc(o.masked || '') + '</span>' +
              (o.evidence ? '<span class="tiny faint">' + esc(o.evidence) + '</span>' : '') +
            '</span></label>';
        }).join('');
        return '<div class="oa-q" data-q="recipient">' +
          '<div class="oa-q__title"><span class="oa-q__badge">1</span><div><b>' + esc(q.question) + '</b>' +
            '<div class="tiny faint">Tindakan ' + esc(q.action_id) + ' · pilih satu kontak atau isi email lain.</div></div></div>' +
          '<div class="oa-options">' + options + '</div>' +
          '<div class="field" style="margin-top:10px">' +
            '<label class="field__label" for="oa-recipient-email">Atau email lain</label>' +
            '<input class="input" id="oa-recipient-email" type="email" autocomplete="off" placeholder="nama@kenari.co.id" value="' + esc((selected && selected.email) || '') + '">' +
            '<div class="field__hint">Dipakai hanya bila kontak yang benar tidak ada pada daftar di atas.</div>' +
          '</div>' +
        '</div>';
      }
      if (q.kind === 'schedule') {
        var sc = a.clar_schedule || {};
        var sug = q.suggested || {};
        return '<div class="oa-q" data-q="schedule">' +
          '<div class="oa-q__title"><span class="oa-q__badge">2</span><div><b>' + esc(q.question) + '</b>' +
            '<div class="tiny faint">Tindakan ' + esc(q.action_id) + (sug.date ? ' · saran notulen: ' + esc(sug.date) + ' ' + esc(sug.time) + ' ' + esc(sug.timezone) : '') + '. Saran tidak dipilih otomatis.</div></div></div>' +
          '<div class="oa-grid-3">' +
            '<div class="field"><label class="field__label" for="oa-date">Tanggal<span class="req">*</span></label>' +
              '<input class="input" id="oa-date" type="date" value="' + esc(sc.date || '') + '"></div>' +
            '<div class="field"><label class="field__label" for="oa-time">Waktu<span class="req">*</span></label>' +
              '<input class="input" id="oa-time" type="time" value="' + esc(sc.time || '') + '"></div>' +
            '<div class="field"><label class="field__label" for="oa-tz">Zona waktu</label>' +
              '<select class="select" id="oa-tz">' + TZ.map(function (z) {
                return '<option value="' + esc(z) + '"' + ((sc.timezone || 'Asia/Jakarta') === z ? ' selected' : '') + '>' + esc(z) + '</option>';
              }).join('') + '</select></div>' +
            '<div class="field"><label class="field__label" for="oa-dur">Durasi (menit)<span class="req">*</span></label>' +
              '<input class="input" id="oa-dur" type="number" min="15" max="480" step="15" placeholder="60" value="' + esc(sc.duration_minutes || '') + '"></div>' +
          '</div>' +
        '</div>';
      }
      var lc = a.clar_location || {};
      var chosen = lc.attendees || [];
      return '<div class="oa-q" data-q="location">' +
        '<div class="oa-q__title"><span class="oa-q__badge">3</span><div><b>' + esc(q.question) + '</b>' +
          '<div class="tiny faint">Tindakan ' + esc(q.action_id) + ' · nama peserta dipakai pada undangan rapat.</div></div></div>' +
        '<div class="field"><label class="field__label" for="oa-loc">Lokasi<span class="req">*</span></label>' +
          '<input class="input" id="oa-loc" type="text" placeholder="Ruang Rapat Melati, Lantai 3" value="' + esc(lc.location || '') + '"></div>' +
        '<div class="field" style="margin-top:10px"><span class="field__label">Peserta<span class="req">*</span></span>' +
          '<div class="oa-checks">' + (q.attendees || []).map(function (p) {
            var on = chosen.indexOf(p.name) >= 0;
            return '<label class="oa-check"><input type="checkbox" name="oa-attendee" value="' + esc(p.name) + '"' + (on ? ' checked' : '') + '>' +
              '<span>' + esc(p.name) + (p.department ? ' <span class="tiny muted">· ' + esc(p.department) + '</span>' : '') + '</span></label>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>';
    }

    function actionsHtml(s) {
      if (s.loading) return loadingCard('Menyimpan klarifikasi dan menyusun rencana…');
      if (s.error) return '<section class="card"><div class="card__body">' + ui.errorState(s.error, 'Coba lagi') + '</div></section>';
      if (!s.actions || !s.actions.length) {
        return '<section class="card"><div class="card__body">' +
          ui.empty({ icon: 'checklist', title: 'Belum ada tindakan', body: 'Tindakan diekstrak dari ringkasan. Proses sumber terlebih dahulu.', action: '<button class="btn btn--secondary" data-oa="stage" data-n="1">Kembali ke permintaan</button>' }) +
          '</div></section>';
      }
      return '<div class="stack">' +
        '<div class="oa-section-head"><div><h2>Tindakan</h2>' +
          '<p class="small muted">' + s.actions.length + ' tindakan terpisah. Setiap tindakan memiliki penerima dan adaptor sendiri; tidak ada yang digabung.</p></div></div>' +
        s.actions.map(function (a) { return actionCardHtml(a, s.planChanged); }).join('') +
        clarificationPanelHtml(s) +
      '</div>';
    }

    /* ---------------- stage 4: plan preview ---------------- */
    function approvalGate(s) {
      var p = s.plan;
      if (!p) return { ok: false, why: 'Rencana belum tersedia.' };
      if (p.status === 'APPROVED') return { ok: false, why: 'Rencana sudah disetujui.' };
      if (p.status === 'REJECTED') return { ok: false, why: 'Rencana sudah ditolak.' };
      if (p.status === 'BLOCKED') return { ok: false, why: 'Rencana diblokir kebijakan.' };
      if (s.planChanged) return { ok: false, why: 'Rencana berubah; validasi ulang diperlukan sebelum persetujuan.' };
      if (!p.plan_hash) return { ok: false, why: 'Hash rencana belum tersedia.' };
      if ((p.findings || []).some(function (f) { return f.severity === 'blocking'; })) {
        return { ok: false, why: 'Masih ada temuan yang memblokir.' };
      }
      if (p.can_approve === false) return { ok: false, why: 'Server tidak menyatakan rencana ini dapat disetujui.' };
      if (p.status !== 'PENDING_APPROVAL') return { ok: false, why: 'Status rencana bukan menunggu persetujuan.' };
      return { ok: true, why: '' };
    }

    function planActionHtml(a, index) {
      var target = a.target || {};
      var emailLine = target.email
        ? esc(target.email)
        : (target.masked
          ? esc(target.masked) + ' <span class="badge badge--outline">hanya versi tersamarkan</span>'
          : '<span class="faint">—</span>');
      var rows = [
        ['Penerima', '<b>' + esc(target.display_name || '—') + '</b>' +
          (target.department ? ' <span class="muted">· ' + esc(target.department) + '</span>' : '') +
          '<div class="tiny muted mono--wrap">' + emailLine + '</div>'],
        ['Subjek', a.subject ? esc(a.subject) : '<span class="faint">—</span>']
      ];
      if (a.attachment) rows.push(['Lampiran', esc(a.attachment.name) + ' <span class="tiny faint">· ' + bytes(a.attachment.size_bytes) + '</span>']);
      if (a.schedule) {
        rows.push(['Jadwal', esc(U.fmtDate(a.schedule.start_at)) + ' · ' + (a.schedule.duration_minutes || 60) + ' menit · ' + esc(a.schedule.timezone || 'Asia/Jakarta')]);
      }
      if (a.location) rows.push(['Lokasi', esc(a.location)]);
      if (a.attendees && a.attendees.length) {
        rows.push(['Peserta', a.attendees.map(function (x) { return esc(x.name); }).join(', ')]);
      }
      if (a.due_at) rows.push(['Tenggat', esc(U.fmtDate(a.due_at))]);
      rows.push(['Action ID', '<span class="mono">' + esc(a.action_id) + '</span>']);
      rows.push(['Sumber', esc((a.source && a.source.document) || '—') + ' ' +
        ((a.source && a.source.citations) || []).map(function (c) { return '<span class="mono">' + esc(c) + '</span>'; }).join(' ')]);
      rows.push(['Temuan', (a.findings && a.findings.length)
        ? a.findings.map(findingRow).join('')
        : '<span class="tiny muted">Tidak ada temuan.</span>']);

      return '<section class="oa-plan-action">' +
        '<div class="oa-plan-action__head">' +
          '<span class="oa-plan-action__num">' + String(index + 1).padStart(2, '0') + '</span>' +
          '<div style="min-width:0;flex:1"><h3>Action ' + String(index + 1).padStart(2, '0') + ' — ' + esc(a.title || a.action_id) + '</h3>' +
            '<p class="tiny muted">' + esc(a.action_type || '') + ' · ' + esc(a.channel || '') + ' · adapter ' + esc(a.adapter || 'mock') + '</p></div>' +
          '<span class="oa-adapter">MOCK ADAPTER</span>' +
        '</div>' +
        '<div class="card__body">' +
          dl(rows) +
          (a.body
            ? '<div class="oa-email-block"><div class="oa-email-block__label">Isi pesan lengkap</div>' +
              '<pre class="oa-email">' + esc(a.body) + '</pre></div>'
            : '') +
        '</div>' +
      '</section>';
    }

    function planHtml(s) {
      if (s.loading) return loadingCard('Memproses…');
      if (s.error) return '<section class="card"><div class="card__body">' + ui.errorState(s.error, 'Coba lagi') + '</div></section>';
      if (!s.plan) {
        return '<section class="card"><div class="card__body">' +
          ui.empty({
            icon: 'fact_check',
            title: 'Rencana belum tersedia',
            body: 'Rencana disusun setelah klarifikasi dijawab. Belum ada yang bisa disetujui pada tahap ini.',
            action: '<button class="btn btn--secondary" data-oa="stage" data-n="3">Buka tindakan & klarifikasi</button>'
          }) + '</div></section>';
      }
      var p = s.plan;
      var gate = approvalGate(s);
      var blocking = (p.findings || []).filter(function (f) { return f.severity === 'blocking'; });
      var approvable = gate.ok;

      return '<div class="stack">' +
        (blocking.length
          ? '<div class="banner banner--danger"><span class="material-symbols-outlined">block</span><div><b>Rencana diblokir kebijakan.</b> ' +
            blocking.map(function (f) { return esc(f.code) + ' — ' + esc(f.message); }).join(' ') +
            ' Persetujuan dinonaktifkan sampai temuan ini hilang.</div></div>'
          : '') +
        (s.planChanged
          ? '<div class="banner banner--warning"><span class="material-symbols-outlined">history</span>' +
            '<div style="flex:1;min-width:0"><b>Rencana berubah — hash dan persetujuan sebelumnya tidak berlaku.</b>' +
            ' Lakukan validasi ulang sebelum meminta persetujuan.' +
            (isDemo()
              ? ' <span class="tiny">Di demo, hash dihitung ulang di peramban dan bukan sha256 server.</span>'
              : '') + '</div>' +
            '<button class="btn btn--secondary btn--sm" data-oa="revalidate"' + (isDemo() ? '' : ' disabled title="Server belum menyediakan operasi validasi ulang"') + '>Validasi ulang</button>' +
            '</div>'
          : '') +
        '<section class="card">' +
          '<div class="card__head"><div style="min-width:0"><h2>Pratinjau rencana</h2>' +
            '<p>Isi persis yang akan dijalankan bila disetujui.</p></div><div class="spacer"></div>' + statusBadge(p.status) + '</div>' +
          '<div class="card__body">' +
            dl([
              ['Plan ID', '<span class="mono mono--wrap">' + esc(p.plan_id) + '</span>'],
              ['Plan hash', '<span class="row" style="gap:8px;align-items:flex-start">' +
                '<span class="mono mono--wrap" style="flex:1;min-width:0">' + esc(p.plan_hash || '—') + '</span>' +
                '<button class="btn btn--ghost btn--sm" data-oa="copy-hash" data-hash="' + esc(p.plan_hash || '') + '" aria-label="Salin plan hash">' +
                '<span class="material-symbols-outlined">content_copy</span>Salin</button></span>'],
              ['Status', statusBadge(p.status) + (p.status === 'PENDING_APPROVAL' && p.plan_hash && p.plan_hash.indexOf('demo_') === 0
                ? ' <span class="badge badge--outline">hash demo</span>' : '')],
              ['Risiko', D.riskBadge(p.risk || 'low')],
              ['Peminta', esc((p.requester && p.requester.name) || '—') +
                (p.requester && p.requester.department ? ' <span class="muted">· ' + esc(p.requester.department) + '</span>' : '')],
              ['Dibuat', esc(U.fmtDate(p.created_at))]
            ]) +
          '</div>' +
          '<div class="card__foot">' +
            '<span class="tiny faint">' +
              (approvable ? 'Persetujuan hanya dicatat dari respons server.' : 'Persetujuan belum dapat diminta: ' + esc(gate.why)) +
            '</span>' +
            '<div class="spacer"></div>' +
            '<button class="btn btn--secondary" data-oa="edit-plan"' +
              ((p.status === 'APPROVED' || p.status === 'REJECTED' || p.status === 'BLOCKED') ? ' disabled title="Rencana yang sudah diputuskan tidak dapat diubah"' : '') + '>Edit & Review</button>' +
            '<button class="btn btn--danger-soft" data-oa="reject"' +
              ((p.status === 'APPROVED' || p.status === 'REJECTED') ? ' disabled' : '') + '>Tolak</button>' +
            '<button class="btn btn--primary" data-oa="approve"' + (approvable ? '' : ' disabled') +
              ' title="' + (approvable ? 'Setujui rencana' : esc(gate.why)) + '">Setujui rencana</button>' +
          '</div>' +
        '</section>' +
        '<div class="oa-plan-actions">' + (p.actions || []).map(function (a, i) { return planActionHtml(a, i); }).join('') + '</div>' +
      '</div>';
    }
    /* ---------------- stage 5: approval & execution ---------------- */
    function approverIdentity() {
      if (D.session.hasPrincipal()) {
        return {
          name: D.session.principal.display_name,
          id: D.session.principal.principal_id,
          demo: false,
          note: 'principal yang diikat server ke token ini'
        };
      }
      if (D.session.serverCapabilities) {
        return {
          name: 'Token ' + D.session.scope,
          id: 'scope:' + D.session.scope,
          demo: false,
          note: 'token tanpa identitas per orang'
        };
      }
      return {
        name: D.session.displayName(),
        id: D.session.user.id,
        demo: true,
        note: 'demo — bukan identitas terautentikasi'
      };
    }

    function approvalCardHtml(s) {
      var p = s.plan;
      var who = approverIdentity();
      var history = s.approvals && s.approvals.length
        ? s.approvals
        : (s.approval ? [s.approval] : []);
      var canDecide = p.status === 'PENDING_APPROVAL' && approvalGate(s).ok;
      var rows = [
        ['Status rencana', statusBadge(p.status)],
        ['Approver', '<b>' + esc(who.name) + '</b>' + (who.demo ? ' ' + demoChip() : '') +
          '<div class="tiny muted">' + esc(who.id) + ' · ' + esc(who.note) + '</div>'],
        ['Plan hash', '<span class="mono mono--wrap">' + esc(p.plan_hash || '—') + '</span>'],
        ['Plan ID', '<span class="mono mono--wrap">' + esc(p.plan_id) + '</span>']
      ];
      return '<section class="card">' +
        '<div class="card__head"><div><h2>Persetujuan</h2><p>Keputusan manusia dicatat terpisah dari eksekusi.</p></div>' +
          '<div class="spacer"></div>' + statusBadge(p.status) + '</div>' +
        '<div class="card__body">' +
          dl(rows) +
          '<div class="divider"></div>' +
          '<h3 class="oa-subhead">Riwayat keputusan</h3>' +
          (history.length
            ? '<div class="oa-history">' + history.map(function (h) {
              var decision = h.decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
              return '<div class="oa-history__row">' +
                statusBadge(decision) +
                '<div style="flex:1;min-width:0"><b>' + esc(h.approver_name || (h.demo ? 'Demo lokal' : 'Tidak dilaporkan server')) + '</b>' +
                  (h.demo ? ' ' + demoChip() : '') +
                  '<div class="tiny muted">' + esc(U.fmtDate(h.at)) + '</div>' +
                  (h.reason ? '<div class="small" style="margin-top:4px">' + esc(h.reason) + '</div>' : '') +
                  (h.note ? '<div class="tiny faint" style="margin-top:2px">' + esc(h.note) + '</div>' : '') +
                '</div></div>';
            }).join('') + '</div>'
            : '<p class="small muted">Belum ada keputusan pada permintaan ini.</p>') +
        '</div>' +
        '<div class="card__foot">' +
          '<span class="tiny faint">' +
            (canDecide ? 'Keputusan dikirim ke server dan dicatat sebagai respons.' : 'Tidak ada keputusan yang dapat diambil pada status ini.') +
          '</span>' +
          '<div class="spacer"></div>' +
          '<button class="btn btn--danger-soft" data-oa="reject"' + (canDecide ? '' : ' disabled') + '>Tolak</button>' +
          '<button class="btn btn--primary" data-oa="approve"' + (canDecide ? '' : ' disabled title="' + esc(approvalGate(s).why) + '"') + '>Setujui rencana</button>' +
        '</div>' +
      '</section>';
    }

    function executionCardHtml(s) {
      var p = s.plan;
      var ex = s.executions || [];
      var body;

      if (p.status === 'BLOCKED') {
        var blocks = (p.findings || []).filter(function (f) { return f.severity === 'blocking'; });
        body = '<div class="banner banner--danger"><span class="material-symbols-outlined">block</span>' +
          '<div><b>Eksekusi diblokir.</b> ' +
          (blocks.length
            ? blocks.map(function (f) { return '<span class="mono">' + esc(f.code) + '</span> — ' + esc(f.message); }).join('<br>')
            : 'Kebijakan memblokir rencana ini.') +
          '<div style="margin-top:6px"><b>Langkah berikutnya:</b> perbaiki penerima pada permintaan atau susun rencana baru dari tahap 1. Persetujuan tidak dapat diberikan selama temuan memblokir masih ada.</div>' +
          '</div></div>';
      } else if (ex.length) {
        var dispatched = ex.filter(function (e) { return e.status === 'DISPATCHED_MOCK'; }).length;
        var failed = ex.filter(function (e) { return e.status === 'FAILED' || e.status === 'BLOCKED'; }).length;
        body = (failed
          ? '<div class="banner banner--warning"><span class="material-symbols-outlined">report</span><div><b>Eksekusi sebagian.</b> ' +
            dispatched + ' tindakan didispatch ke adapter mock, ' + failed + ' gagal. Tindakan yang gagal tidak otomatis dicoba ulang.</div></div>'
          : '') +
          '<div class="oa-exec-list">' + ex.map(function (e) {
            return '<div class="oa-exec">' +
              '<div class="oa-exec__head">' +
                '<span class="mono">' + esc(e.action_id) + '</span>' +
                '<span class="small strong" style="flex:1;min-width:0">' + esc(actionTitle(p, e.action_id)) + '</span>' +
                statusBadge(e.status) +
              '</div>' +
              dl([
                ['Adapter', esc(e.adapter || 'mock')],
                ['Waktu', esc(U.fmtDate(e.at))],
                ['Detail', e.detail ? '<span class="mono mono--wrap">' + esc(e.detail) + '</span>' : '<span class="faint">—</span>'],
                ['Alasan', e.reason_code ? '<span class="mono">' + esc(e.reason_code) + '</span>' : '<span class="faint">—</span>'],
                ['Catatan', e.note ? esc(e.note) : '<span class="faint">—</span>']
              ]) +
            '</div>';
          }).join('') + '</div>' +
          (isDemo()
            ? '<div class="banner banner--info" style="margin-top:12px"><span class="material-symbols-outlined">science</span>' +
              '<div><b>Adapter mock tidak membuat apa pun di sistem eksternal.</b> Tidak ada email terkirim, tidak ada jadwal di kalender, dan tidak ada tugas di papan tugas. "Didispatch (mock)" bukan "terkirim".</div></div>'
            : '<div class="banner banner--info" style="margin-top:12px"><span class="material-symbols-outlined">science</span>' +
              '<div><b>Execution Gateway server.</b> Hasil per tindakan akan dicatat lewat rantai audit setelah eksekusi diproses.</div></div>');
      } else if (p.status === 'APPROVED') {
        body = '<p class="small muted" style="margin-bottom:12px">Rencana sudah disetujui. Eksekusi harus diminta terpisah; persetujuan tidak menjalankan tindakan.</p>' +
          '<div class="banner ' + (isDemo() ? 'banner--demo' : 'banner--info') + '" style="margin-bottom:12px"><span class="material-symbols-outlined">science</span>' +
            '<div><b>' + (isDemo() ? 'Mode demo.' : 'Mode live — eksekusi lewat server.') + '</b> Eksekusi hanya menghasilkan catatan hasil per tindakan di layar. Tidak ada email, jadwal, atau tugas yang dibuat.</div></div>' +
          '<button class="btn btn--primary" data-oa="execute"><span class="material-symbols-outlined">play_arrow</span>Minta eksekusi</button>';
      } else if (p.status === 'REJECTED') {
        body = '<p class="small muted">Rencana ditolak, jadi tidak ada eksekusi yang dapat diminta. Mulai permintaan baru bila perlu.</p>';
      } else {
        body = '<p class="small muted">Eksekusi hanya dapat diminta setelah rencana disetujui manusia.</p>';
      }

      return '<section class="card">' +
        '<div class="card__head"><div><h2>Eksekusi</h2><p>Hasil per tindakan, bukan satu status "terkirim".</p></div>' +
          '<div class="spacer"></div><span class="badge badge--outline">' + esc(isDemo() ? 'Adapter mock' : 'Execution Gateway') + '</span></div>' +
        '<div class="card__body">' + body + '</div>' +
      '</section>';
    }

    function stageHtml(s) {
      if (s.stage !== 1 && s.loading) return loadingCard('Memproses…');
      if (s.stage === 2) return summaryHtml(s);
      if (s.stage === 3) return actionsHtml(s);
      if (s.stage === 4) return planHtml(s);
      if (s.stage === 5) {
        if (!s.plan) {
          return '<section class="card"><div class="card__body">' +
            ui.empty({
              icon: 'verified_user',
              title: 'Belum ada rencana untuk diputuskan',
              body: 'Persetujuan hanya tersedia setelah rencana lengkap disusun pada tahap 4.',
              action: '<button class="btn btn--secondary" data-oa="stage" data-n="3">Buka tindakan & klarifikasi</button>'
            }) + '</div></section>';
        }
        return '<div class="stack">' +
          (s.error
            ? '<section class="card"><div class="card__body">' + ui.errorState(s.error, 'Coba lagi') + '</div></section>'
            : '') +
          approvalCardHtml(s) + executionCardHtml(s) + '</div>';
      }
      return intakeHtml(s);
    }

    /* ---------------- right rail ---------------- */
    function contextCardHtml(s) {
      var req = s.request;
      var p = s.plan;
      var modeBadge = s.mode === 'demo'
        ? '<span class="badge badge--warning">DEMO</span>'
        : s.mode === 'live'
          ? '<span class="badge badge--success">Live</span>'
          : s.mode === 'partial'
            ? '<span class="badge badge--info">Sebagian</span>'
            : '<span class="badge badge--outline">Memeriksa</span>';
      var body = dl([
        ['Mode', modeBadge],
        ['Permintaan', req ? '<span class="mono mono--wrap">' + esc(req.request_id) + '</span>' : '<span class="faint">—</span>'],
        ['Status permintaan', statusBadge(s.status)],
        ['Rencana', p ? '<span class="mono mono--wrap">' + esc(p.plan_id) + '</span>' : '<span class="faint">—</span>'],
        ['Status rencana', p ? statusBadge(p.status) : '<span class="faint">—</span>'],
        ['Tahap', '<span class="small">' + s.stage + ' dari 5</span>']
      ]);
      var variants = '';
      if (s.mode === 'demo' && req) {
        variants = '<div class="divider"></div><div class="oa-variants">' +
          '<span class="tiny faint">Varian skenario demo</span>' +
          '<div class="row row--wrap" style="gap:6px;margin-top:6px">' +
          [['normal', 'Normal'], ['blocked', 'Diblokir'], ['rejected', 'Ditolak'], ['changed', 'Rencana berubah']].map(function (v) {
            return '<button class="chip chip--sm" data-oa="variant" data-variant="' + v[0] + '">' + esc(v[1]) + '</button>';
          }).join('') +
          '</div></div>';
      }
      return ui.card({
        title: 'Konteks & status',
        desc: 'Status permintaan, rencana, dan eksekusi tidak digabung.',
        body: body + variants
      });
    }

    function authorityCardHtml() {
      return ui.card({
        title: 'Batas kewenangan',
        body: '<div class="stack" style="gap:8px">' +
          [
            'Office Agent tidak pernah mengirim email atau membuat jadwal atas namanya sendiri.',
            'Persetujuan hanya sah bila datang dari respons server, bukan dari peramban.',
            (isDemo()
              ? 'Adapter mock mencatat niat, bukan efek: tidak ada pesan, jadwal, atau tugas yang dibuat.'
              : 'Execution Gateway menjalankan tindakan lewat mandate server; hasilnya tercatat audit.'),
            (isDemo()
              ? 'Mode demo tidak mengirim data apa pun; semua proses berjalan di peramban.'
              : 'Mode live: permintaan, persetujuan, dan eksekusi berjalan lewat tool server.')
          ].map(function (x) {
            return '<div class="row" style="gap:8px;align-items:flex-start"><span class="material-symbols-outlined" style="font-size:15px;color:var(--faint);margin-top:1px">remove</span>' +
              '<span class="small muted" style="line-height:1.5">' + esc(x) + '</span></div>';
          }).join('') +
        '</div>'
      });
    }

    function eventIcon(type) {
      if (/block|reject/.test(type)) return 'block';
      if (/approval|mandate/.test(type)) return 'verified';
      if (/executed/.test(type)) return 'outbound';
      if (/clarif/.test(type)) return 'help';
      if (/plan/.test(type)) return 'description';
      if (/request/.test(type)) return 'inbox';
      if (/document/.test(type)) return 'article';
      return 'radio_button_unchecked';
    }

    function auditCardHtml(s) {
      var events = s.audit || [];
      var body;
      if (!events.length) {
        body = '<div class="oa-audit-empty"><span class="material-symbols-outlined">history</span>' +
          '<p class="small muted">Belum ada peristiwa. Timeline hanya menampilkan catatan dari server atau berkas contoh, tidak pernah dibuat di peramban.</p></div>';
      } else {
        body = '<div class="timeline oa-timeline">' + events.map(function (e) {
          var tone = U.eventTone(e.type);
          var cls = tone === 'danger' ? ' is-blocked' : tone === 'success' ? ' is-done' : tone === 'warning' ? ' is-current' : '';
          var label = C.EVENTS[e.type] || U.eventLabel(e.type);
          return '<div class="tl-item' + cls + '">' +
            '<span class="tl-dot"><span class="material-symbols-outlined">' + eventIcon(e.type) + '</span></span>' +
            '<div class="tl-body">' +
              '<div class="tl-title">' + esc(label) + (e.demo ? ' ' + demoChip() : '') + '</div>' +
              '<div class="tl-meta">' + esc(U.fmtTime(e.at)) + ' · ' + esc(U.actorName(e.actor)) + '</div>' +
              (e.detail ? '<div class="oa-tl-detail">' + esc(U.detailText(e.detail)) + '</div>' : '') +
              (e.request_id || e.plan_id
                ? '<div class="oa-tl-corr">' + (e.request_id ? '<span class="mono">' + esc(e.request_id) + '</span>' : '') +
                  (e.plan_id ? ' <span class="mono faint">' + esc(e.plan_id) + '</span>' : '') + '</div>'
                : '') +
            '</div></div>';
        }).join('') + '</div>';
      }
      return ui.card({ title: 'Audit timeline', desc: 'Hanya peristiwa dari server atau berkas contoh.', className: 'oa-audit-card', body: body });
    }

    function railHtml(s) {
      return '<div class="stack">' + contextCardHtml(s) + authorityCardHtml() + auditCardHtml(s) + '</div>';
    }

    /* ---------------- paint ---------------- */
    function paint() {
      if (unmounted) return;
      var s = store.get();
      var modeEl = root.querySelector('#oa-mode');
      if (modeEl) modeEl.innerHTML = modeHtml(s);
      var stepEl = root.querySelector('#oa-stepper');
      if (stepEl) stepEl.innerHTML = stepperHtml(s);
      var mainEl = root.querySelector('#oa-main');
      if (mainEl) mainEl.innerHTML = stageHtml(s);
      var railEl = root.querySelector('#oa-rail');
      if (railEl) railEl.innerHTML = railHtml(s);

      var loadBtn = root.querySelector('#oa-load-demo');
      if (loadBtn) {
        var demo = s.mode === 'demo';
        loadBtn.disabled = !demo;
        loadBtn.title = demo ? 'Muat skenario contoh lengkap (demo)' : 'Contoh hanya tersedia dalam mode demo';
      }
      var counter = root.querySelector('#oa-count');
      if (counter) counter.textContent = local.text.length + ' / 2000';
      if (s.stage === 3) validateClarify(false);
    }

    /* ---------------- intake helpers ---------------- */
    function readFile(file) {
      local.fileError = null;
      if (!file) return;
      if (!/\.(md|txt)$/i.test(file.name)) {
        local.file = null;
        local.fileError = 'Format berkas harus .md atau .txt.';
        paint();
        return;
      }
      if (file.size > 1048576) {
        local.file = null;
        local.fileError = 'Ukuran berkas melebihi 1 MB.';
        paint();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        if (!text.trim()) {
          local.file = null;
          local.fileError = 'Isi berkas kosong.';
        } else {
          local.file = { name: file.name, size: file.size, text: text };
          local.fileError = null;
          local.intakeError = null;
        }
        paint();
      };
      reader.onerror = function () {
        local.file = null;
        local.fileError = 'Berkas tidak dapat dibaca.';
        paint();
      };
      reader.readAsText(file);
    }

    function processIntake() {
      var s = state();
      if (s.mode === 'probing') {
        ui.toast('Masih memeriksa ketersediaan pipeline Office Agent.', 'info');
        return;
      }
      var input;
      if (local.tab === 'text') {
        var ta = q('#oa-text');
        if (ta) local.text = ta.value;
        if (local.text.trim().length < 20) {
          local.intakeError = 'Teks permintaan minimal 20 karakter.';
          paint();
          return;
        }
        input = { type: 'text', text: local.text };
      } else if (local.tab === 'document') {
        if (!local.file || !local.file.text.trim()) {
          local.intakeError = 'Pilih berkas .md atau .txt yang berisi teks.';
          paint();
          return;
        }
        input = { type: 'document', text: local.file.text, filename: local.file.name, size_bytes: local.file.size };
      } else {
        return;
      }
      local.intakeError = null;
      local.retry = processIntake;
      store.set({ loading: true, error: null });
      api.createRequest(input).then(function (res) {
        apply(res);
        if (!res.demo && state().request && state().request.request_id) {
          return api.getRequest(state().request.request_id).then(apply);
        }
        return null;
      }).then(function () {
        if (unmounted) return;
        refreshAudit();
        store.set({ loading: false, stage: 2, maxStage: Math.max(3, state().maxStage) });
      }).catch(fail);
    }

    /* ---------------- clarification helpers ---------------- */
    function collectAnswers() {
      var a = {};
      var radio = q('input[name="oa-recipient"]:checked');
      if (radio) {
        a.clar_recipient = { contact_id: radio.value };
      } else {
        var em = q('#oa-recipient-email');
        if (em && em.value.trim()) a.clar_recipient = { email: em.value.trim() };
      }
      var date = q('#oa-date'), time = q('#oa-time'), tz = q('#oa-tz'), dur = q('#oa-dur');
      if (date || time || dur) {
        a.clar_schedule = {
          date: date ? date.value : '',
          time: time ? time.value : '',
          timezone: tz ? tz.value : 'Asia/Jakarta',
          duration_minutes: dur ? dur.value : ''
        };
      }
      var loc = q('#oa-loc');
      if (loc) {
        a.clar_location = {
          location: loc.value,
          attendees: qa('input[name="oa-attendee"]:checked').map(function (c) { return c.value; })
        };
      }
      return a;
    }

    function clarifyProblems(a) {
      var out = [];
      var r = a.clar_recipient || {};
      var hasRecipientQuestion = !!q('#oa-recipient-email') || qa('input[name="oa-recipient"]').length > 0;
      if (hasRecipientQuestion && !r.contact_id && !(r.email && r.email.indexOf('@') > 0)) {
        out.push('Pilih penerima atau isi email yang valid.');
      }
      var sc = a.clar_schedule;
      if (sc) {
        if (!sc.date || !sc.time) out.push('Isi tanggal dan waktu rapat.');
        var dur = parseInt(sc.duration_minutes, 10);
        if (!dur || dur < 15 || dur > 480) out.push('Durasi rapat harus 15–480 menit.');
      }
      var lc = a.clar_location;
      if (lc) {
        if (!String(lc.location || '').trim()) out.push('Isi lokasi rapat.');
        if (!lc.attendees || !lc.attendees.length) out.push('Pilih minimal satu peserta.');
      }
      return out;
    }

    function validateClarify(showErrors) {
      var s = state();
      if (s.stage !== 3) return;
      if (!s.clarifications || !s.clarifications.length) return;
      if (s.answers && Object.keys(s.answers).length) return;
      if (!q('#oa-clarify')) return;
      local.answers = collectAnswers();
      var problems = clarifyProblems(local.answers);
      var btn = q('#oa-clar-submit');
      if (btn) btn.disabled = problems.length > 0;
      var err = q('#oa-clar-error');
      if (err) {
        if (showErrors && problems.length) {
          err.style.display = 'flex';
          var msg = err.querySelector('span:last-child');
          if (msg) msg.textContent = problems.join(' ');
        } else {
          err.style.display = 'none';
        }
      }
      qa('input[name="oa-recipient"]').forEach(function (radio) {
        var label = radio.closest('.oa-option');
        if (label) label.classList.toggle('is-selected', radio.checked);
      });
    }

    function submitClarify() {
      var a = collectAnswers();
      local.answers = a;
      if (clarifyProblems(a).length) {
        validateClarify(true);
        return;
      }
      local.retry = submitClarify;
      store.set({ loading: true, error: null });
      api.clarify(reqId(), a).then(function (res) {
        apply(res);
        if (!res.demo && state().planId && !state().plan) {
          return api.getPlan(reqId()).then(apply);
        }
        return null;
      }).then(function () {
        if (unmounted) return;
        refreshAudit();
        store.set({ loading: false, stage: 4, maxStage: 5 });
      }).catch(fail);
    }

    /* ---------------- approval & execution ---------------- */
    function doApprove(decision, reason) {
      var s = state();
      var p = s.plan;
      if (!p) return;
      var wasDemo = isDemo();
      local.retry = function () { doApprove(decision, reason); };
      store.set({ loading: true, error: null });
      api.approve(reqId(), decision, reason, p.plan_hash).then(function (res) {
        apply(res);
        if (!res.demo && state().planId) return api.getPlan(reqId()).then(apply);
        return null;
      }).then(function () {
        if (unmounted) return;
        refreshAudit();
        store.set({ loading: false, stage: 5, maxStage: 5 });
        var msg = decision === 'APPROVED'
          ? (wasDemo ? 'Disetujui (demo lokal — tidak ada approval yang tercatat di backend).' : 'Rencana disetujui server.')
          : (wasDemo ? 'Ditolak (demo lokal — tidak ada keputusan yang tercatat di backend).' : 'Rencana ditolak server.');
        ui.toast(msg, decision === 'APPROVED' ? 'success' : 'warning');
      }).catch(fail);
    }

    function doExecute() {
      var p = state().plan;
      if (!p) return;
      local.retry = doExecute;
      store.set({ loading: true, error: null });
      api.execute(reqId(), p.plan_hash).then(function (res) {
        apply(res);
        if (!res.demo && state().planId) return api.getPlan(reqId()).then(apply);
        return null;
      }).then(function () {
        if (unmounted) return;
        refreshAudit();
        store.set({ loading: false, stage: 5, maxStage: 5 });
      }).catch(fail);
    }

    function openApprove() {
      var s = state();
      var gate = approvalGate(s);
      if (!gate.ok) { ui.toast(gate.why, 'warning'); return; }
      var p = s.plan;
      ui.confirm({
        title: 'Setujui rencana ini?',
        subtitle: p.plan_id,
        confirmLabel: 'Setujui',
        body: 'Anda menyetujui rencana <b>' + esc(p.plan_id) + '</b> dengan hash ' +
          '<span class="mono mono--wrap">' + esc(p.plan_hash) + '</span>.' +
          '<p class="small muted" style="margin-top:8px">Persetujuan tidak menjalankan tindakan. Eksekusi diminta terpisah pada tahap 5.</p>' +
          (isDemo() ? '<div class="banner banner--demo" style="margin-top:10px"><span class="material-symbols-outlined">science</span><div>Demo lokal: keputusan tidak dikirim ke backend dan tidak tercatat di mana pun.</div></div>' : '')
      }).then(function (r) {
        if (!r.ok) return;
        doApprove('APPROVED', null);
      });
    }

    function openReject() {
      var s = state();
      if (!s.plan) return;
      ui.confirm({
        title: 'Tolak rencana',
        subtitle: s.plan.plan_id,
        tone: 'danger',
        confirmLabel: 'Tolak',
        required: ['oa-reason'],
        body: '<div class="small" style="color:var(--text-2);margin-bottom:10px">Alasan dicatat bersama keputusan dan tidak dapat dikosongkan.</div>' +
          ui.field({
            id: 'oa-reason',
            label: 'Alasan penolakan',
            required: true,
            control: '<textarea class="textarea" id="oa-reason" rows="3" placeholder="Jelaskan alasan penolakan"></textarea>'
          }) +
          (isDemo() ? '<div class="banner banner--demo" style="margin-top:10px"><span class="material-symbols-outlined">science</span><div>Demo lokal: penolakan tidak dikirim ke backend.</div></div>' : '')
      }).then(function (r) {
        if (!r.ok) return;
        doApprove('REJECTED', r.values['oa-reason'] || '');
      });
    }

    function openExecute() {
      var s = state();
      if (!s.plan || s.plan.status !== 'APPROVED') {
        ui.toast('Eksekusi hanya dapat diminta setelah rencana disetujui.', 'warning');
        return;
      }
      ui.confirm({
        title: 'Minta eksekusi?',
        subtitle: s.plan.plan_id,
        confirmLabel: 'Minta eksekusi',
        body: (isDemo()
          ? 'Eksekusi dijalankan per tindakan dengan adapter mock. Hasilnya adalah catatan di layar, bukan pengiriman nyata.'
          : 'Eksekusi dijalankan per tindakan melalui Execution Gateway dengan mandate server. Hasilnya adalah catatan di layar, bukan pengiriman nyata.') +
          '<p class="small muted" style="margin-top:8px">Tidak ada email, jadwal, atau tugas yang dibuat di sistem eksternal.</p>' +
          (isDemo() ? '<div class="banner banner--demo" style="margin-top:10px"><span class="material-symbols-outlined">science</span><div>Demo lokal: tidak ada permintaan eksekusi yang dikirim ke backend.</div></div>' : '')
      }).then(function (r) {
        if (!r.ok) return;
        doExecute();
      });
    }

    function isoFromLocal(date, time, tz) {
      var offsets = { 'Asia/Jakarta': 7, 'Asia/Makassar': 8, 'Asia/Jayapura': 9, 'Asia/Singapore': 8, 'UTC': 0 };
      var d = String(date || '').split('-');
      var t = String(time || '').split(':');
      if (d.length !== 3 || t.length < 2) return null;
      var offset = offsets[tz];
      if (offset === undefined) offset = 7;
      var ms = Date.UTC(
        parseInt(d[0], 10), parseInt(d[1], 10) - 1, parseInt(d[2], 10),
        parseInt(t[0], 10) - offset, parseInt(t[1], 10), 0, 0
      );
      if (isNaN(ms)) return null;
      return new Date(ms).toISOString();
    }

    function openEdit() {
      var s = state();
      var p = s.plan;
      if (!p) return;
      var a1 = null, a2 = null;
      (p.actions || []).forEach(function (a) {
        if (a.action_id === 'act_01') a1 = a;
        if (a.action_id === 'act_02') a2 = a;
      });
      var sch = a2 && a2.schedule ? localParts(a2.schedule.start_at) : { date: '', time: '' };
      var live = !isDemo();
      var body =
        (live
          ? '<div class="banner banner--warning" style="margin-bottom:14px"><span class="material-symbols-outlined">rule</span>' +
            '<div><b>Ubah rencana belum didukung server.</b> Kontrak Office Agent belum memiliki tool untuk menyimpan perubahan rencana, jadi tombol simpan dinonaktifkan. Perubahan tidak dikirim dan tidak disimpan.</div></div>'
          : '') +
        ui.field({
          id: 'oa-edit-subject',
          label: 'Subjek email',
          required: true,
          control: '<input class="input" id="oa-edit-subject" type="text" value="' + esc((a1 && a1.subject) || '') + '"' + (live ? ' disabled' : '') + '>'
        }) +
        '<div class="field" style="margin-top:12px"><label class="field__label" for="oa-edit-body">Isi email</label>' +
          '<textarea class="textarea" id="oa-edit-body" rows="12"' + (live ? ' disabled' : '') + '>' + esc((a1 && a1.body) || '') + '</textarea></div>' +
        '<div class="oa-grid-2" style="margin-top:12px">' +
          '<div class="field"><label class="field__label" for="oa-edit-date">Tanggal rapat</label>' +
            '<input class="input" id="oa-edit-date" type="date" value="' + esc(sch.date) + '"' + (live ? ' disabled' : '') + '></div>' +
          '<div class="field"><label class="field__label" for="oa-edit-time">Waktu rapat</label>' +
            '<input class="input" id="oa-edit-time" type="time" value="' + esc(sch.time) + '"' + (live ? ' disabled' : '') + '></div>' +
        '</div>' +
        '<div class="tiny faint" style="margin-top:10px">Menyimpan tidak langsung memvalidasi. Setelah disimpan, rencana ditandai berubah dan harus divalidasi ulang sebelum dapat disetujui.</div>';

      ui.drawer({
        eyebrow: 'Tinjauan rencana',
        title: 'Edit & Review',
        subtitle: p.plan_id,
        wide: true,
        body: body,
        footer: '<button class="btn btn--secondary" data-dismiss>Batal</button>' +
          '<button class="btn btn--primary" id="oa-edit-save"' + (live ? ' disabled title="Server belum mendukung ubah rencana"' : '') + '>Simpan perubahan</button>',
        onMount: function (node, ov) {
          var save = node.querySelector('#oa-edit-save');
          if (!save) return;
          save.addEventListener('click', function () {
            var subject = node.querySelector('#oa-edit-subject').value.trim();
            var bodyText = node.querySelector('#oa-edit-body').value;
            var date = node.querySelector('#oa-edit-date').value;
            var time = node.querySelector('#oa-edit-time').value;
            if (!subject) { ui.toast('Subjek email tidak boleh kosong.', 'warning'); return; }
            if (!bodyText.trim()) { ui.toast('Isi email tidak boleh kosong.', 'warning'); return; }
            var next = clone(p);
            (next.actions || []).forEach(function (a) {
              if (a.action_id === 'act_01') { a.subject = subject; a.body = bodyText; }
              if (a.action_id === 'act_02' && a.schedule && date && time) {
                var start = isoFromLocal(date, time, a.schedule.timezone);
                if (start) a.schedule = Object.assign({}, a.schedule, { start_at: start });
              }
            });
            local.editDraft = { subject: subject, body: bodyText, date: date, time: time };
            store.set({ plan: next, planChanged: true });
            ov.close();
            ui.toast('Perubahan disimpan lokal. Validasi ulang diperlukan sebelum persetujuan.', 'warning');
          });
        }
      });
    }

    function revalidatePlan() {
      var s = state();
      if (!s.plan) return;
      if (!isDemo()) {
        store.set({ loading: true, error: null });
        api.getPlan(reqId()).then(function (res) {
          apply(res);
          refreshAudit();
          store.set({ loading: false });
          ui.toast('Rencana disegarkan dari server. Server belum menyediakan operasi validasi ulang, jadi persetujuan tetap terkunci.', 'warning', 5200);
        }).catch(fail);
        return;
      }
      local.retry = revalidatePlan;
      store.set({ loading: true, error: null });
      api.demoRevalidate(local.editDraft || {}).then(function (res) {
        apply(res);
        if (unmounted) return;
        store.set({ loading: false });
        ui.toast('Rencana divalidasi ulang (demo). Hash dihitung di peramban, bukan sha256 server.', 'info');
      }).catch(fail);
    }

    function loadDemo() {
      if (!isDemo()) {
        ui.toast('Contoh hanya tersedia dalam mode demo.', 'warning');
        return;
      }
      local.retry = loadDemo;
      store.set({ loading: true, error: null });
      api.demoVariant('normal').then(function (res) {
        apply(res);
        if (unmounted) return;
        local.answers = {};
        store.set({ loading: false, stage: 4, maxStage: 5 });
        ui.toast('Skenario contoh dimuat. Data contoh; tidak ada tindakan nyata.', 'info');
      }).catch(fail);
    }

    function loadVariant(name) {
      if (!isDemo()) return;
      local.retry = function () { loadVariant(name); };
      store.set({ loading: true, error: null });
      api.demoVariant(name).then(function (res) {
        apply(res);
        if (unmounted) return;
        local.answers = {};
        store.set({ loading: false, stage: (res.state && res.state.stage) || 4, maxStage: 5 });
      }).catch(fail);
    }

    function newSession() {
      var mode = state().mode;
      var probe = state().probe;
      var reason = probe && probe.reason ? probe.reason : null;
      if (isDemo()) api.demoReset();
      local.text = '';
      local.file = null;
      local.fileError = null;
      local.intakeError = null;
      local.answers = {};
      local.editDraft = null;
      local.retry = null;
      local.tab = 'text';
      store.reset();
      store.set({ mode: mode, probe: probe, reason: reason });
      ui.toast('Sesi baru. Belum ada permintaan.', 'info', 2400);
    }

    function copyHash(btn) {
      var hash = btn.getAttribute('data-hash') || '';
      if (!hash) return;
      function done() {
        ui.toast('Plan hash disalin.', 'success', 1800);
        var original = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined">check</span>Tersalin';
        setTimeout(function () { btn.innerHTML = original; }, 1600);
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = hash;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); }
        catch (e) { ui.toast('Salin manual: ' + hash, 'warning', 6000); }
        ta.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(hash).then(done).catch(fallback);
      } else {
        fallback();
      }
    }

    /* ---------------- events ---------------- */
    function onClick(e) {
      var retryBtn = e.target.closest('[data-retry]');
      if (retryBtn) {
        if (typeof local.retry === 'function') local.retry();
        return;
      }
      var el = e.target.closest('[data-oa]');
      if (!el) return;
      var act = el.getAttribute('data-oa');
      if (act === 'pick-file' && e.target.id === 'oa-file') return;

      switch (act) {
        case 'stage': goStage(parseInt(el.getAttribute('data-n'), 10)); break;
        case 'tab': local.tab = el.getAttribute('data-tab'); local.intakeError = null; paint(); break;
        case 'example':
          local.text = el.getAttribute('data-text') || '';
          local.intakeError = null;
          paint();
          break;
        case 'process': processIntake(); break;
        case 'dropzone':
        case 'pick-file': {
          var fi = q('#oa-file');
          if (fi) fi.click();
          break;
        }
        case 'remove-file': local.file = null; local.fileError = null; paint(); break;
        case 'submit-clarify': submitClarify(); break;
        case 'approve': openApprove(); break;
        case 'reject': openReject(); break;
        case 'edit-plan': openEdit(); break;
        case 'revalidate': revalidatePlan(); break;
        case 'execute': openExecute(); break;
        case 'copy-hash': copyHash(el); break;
        case 'load-demo': loadDemo(); break;
        case 'new': newSession(); break;
        case 'variant': loadVariant(el.getAttribute('data-variant')); break;
        case 'retry':
          if (typeof local.retry === 'function') local.retry();
          break;
        default: break;
      }
    }

    function onInput(e) {
      if (e.target.id === 'oa-text') {
        local.text = e.target.value;
        local.intakeError = null;
        var counter = q('#oa-count');
        if (counter) counter.textContent = local.text.length + ' / 2000';
        return;
      }
      if (e.target.id === 'oa-recipient-email' && e.target.value.trim()) {
        qa('input[name="oa-recipient"]').forEach(function (radio) { radio.checked = false; });
      }
      if (e.target.closest && e.target.closest('#oa-clarify')) validateClarify(true);
    }

    function onChange(e) {
      if (e.target.id === 'oa-file') {
        var f = e.target.files && e.target.files[0];
        e.target.value = '';
        readFile(f);
        return;
      }
      if (e.target.name === 'oa-recipient' && e.target.checked) {
        var email = q('#oa-recipient-email');
        if (email) email.value = '';
      }
      if (e.target.closest && e.target.closest('#oa-clarify')) validateClarify(true);
    }

    function onKeydown(e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-oa="dropzone"]')) {
        e.preventDefault();
        var fi = q('#oa-file');
        if (fi) fi.click();
      }
    }

    function onDragOver(e) {
      var d = e.target.closest && e.target.closest('[data-oa="dropzone"]');
      if (!d) return;
      e.preventDefault();
      d.classList.add('is-over');
    }

    function onDragLeave(e) {
      var d = e.target.closest && e.target.closest('[data-oa="dropzone"]');
      if (!d) return;
      d.classList.remove('is-over');
    }

    function onDrop(e) {
      var d = e.target.closest && e.target.closest('[data-oa="dropzone"]');
      if (!d) return;
      e.preventDefault();
      d.classList.remove('is-over');
      local.tab = 'document';
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    }

    var unsub = store.subscribe(paint);
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    root.addEventListener('keydown', onKeydown);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('dragleave', onDragLeave);
    root.addEventListener('drop', onDrop);

    D._cleanup = function () {
      unmounted = true;
      if (unsub) unsub();
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.removeEventListener('change', onChange);
      root.removeEventListener('keydown', onKeydown);
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('dragleave', onDragLeave);
      root.removeEventListener('drop', onDrop);
      D._cleanup = null;
    };

    paint();
    api.probe().then(function (res) {
      if (unmounted) return;
      store.set({ mode: res.mode, probe: res, reason: res.reason });
      if (res.mode === 'demo' && res.reason) {
        ui.toast('Office Agent: mode demo. ' + res.reason, 'info', 4600);
      }
    }).catch(function () {
      if (unmounted) return;
      store.set({
        mode: 'demo',
        probe: { mode: 'demo', available: [], missing: [], reason: null },
        reason: 'Pemeriksaan pipeline gagal; layar berjalan dalam mode demo.'
      });
    });
  };
})();
