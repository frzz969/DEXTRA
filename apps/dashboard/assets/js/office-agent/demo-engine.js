/* Office Agent — mesin demo lokal.
 *
 * Mesin status deterministik yang memutar skenario di fixtures.js. Tidak ada
 * fetch, tidak ada penyimpanan, dan tidak ada efek eksternal. Setiap hasil
 * membawa demo:true dan alasan yang menyebut dirinya demo.
 *
 * Persetujuan di sini TIDAK pernah berarti persetujuan nyata: status berubah
 * menjadi APPROVED dengan catatan bahwa tidak ada approval yang tercatat di
 * backend, karena memang tidak ada backend yang menerimanya.
 */
(function () {
  'use strict';

  var TZ_OFFSET = {
    'Asia/Jakarta': 7,
    'Asia/Makassar': 8,
    'Asia/Jayapura': 9,
    'Asia/Singapore': 8,
    'UTC': 0
  };

  function clone(v) { return v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)); }

  function demoHash(value) {
    var str = JSON.stringify(value);
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    var hex = h.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    return 'demo_' + hex;
  }

  function startAt(dateStr, timeStr, tz) {
    var d = String(dateStr || '').split('-');
    var t = String(timeStr || '').split(':');
    if (d.length !== 3 || t.length < 2) return null;
    var offset = TZ_OFFSET[tz];
    if (offset === undefined) offset = 7;
    var ms = Date.UTC(
      parseInt(d[0], 10), parseInt(d[1], 10) - 1, parseInt(d[2], 10),
      parseInt(t[0], 10) - offset, parseInt(t[1], 10), 0, 0
    );
    if (isNaN(ms)) return null;
    return new Date(ms).toISOString();
  }

  function localParts(iso) {
    if (!iso) return null;
    var dt = new Date(iso);
    if (isNaN(dt.getTime())) return null;
    /* Zona tampilan Indonesia barat; fixture memakai +07:00. */
    var shifted = new Date(dt.getTime() + 7 * 3600000);
    return {
      date: shifted.toISOString().slice(0, 10),
      time: shifted.toISOString().slice(11, 16),
      weekday: shifted.getUTCDay()
    };
  }

  function fridayConflict(schedule) {
    if (!schedule || !schedule.start_at) return null;
    var parts = localParts(schedule.start_at);
    if (!parts || parts.weekday !== 5) return null;
    var start = parseInt(parts.time.slice(0, 2), 10) * 60 + parseInt(parts.time.slice(3, 5), 10);
    var end = start + (schedule.duration_minutes || 60);
    if (start < 13 * 60 && end > 11 * 60 + 30) {
      return {
        code: 'FRIDAY_PRAYER_CONFLICT',
        severity: 'warning',
        message: 'Jadwal ' + parts.time + ' selama ' + (schedule.duration_minutes || 60) +
          ' menit bertabrakan dengan jendela salat Jumat 11.30–13.00 WIB.'
      };
    }
    return null;
  }

  function collectFindings(plan) {
    var out = [];
    var seen = {};
    (plan.actions || []).forEach(function (a) {
      (a.findings || []).forEach(function (f) {
        if (seen[f.code + f.message]) return;
        seen[f.code + f.message] = true;
        out.push(f);
      });
    });
    return out;
  }

  window.DEXTRA_OFFICE_ENGINE = {
    create: function (fixtures) {
      var F = fixtures;
      var state = blank();

      function blank() {
        return {
          demo: true,
          stage: 1,
          maxStage: 1,
          status: 'DRAFT',
          request: null,
          summary: null,
          actions: [],
          clarifications: [],
          answers: {},
          plan: null,
          approval: null,
          approvals: [],
          executions: [],
          audit: [],
          planChanged: false,
          reason: 'Mode demo: skenario contoh dimuat lokal di peramban.'
        };
      }

      function snapshot() { return clone(state); }

      function pushAudit(key) {
        var ev = F.audit[key];
        if (!ev) return;
        for (var i = 0; i < state.audit.length; i++) {
          if (state.audit[i].event_id === ev.event_id) return;
        }
        state.audit.push(clone(ev));
      }

      function hasBlocking(plan) {
        if (!plan) return true;
        return (plan.findings || []).some(function (f) { return f.severity === 'blocking'; });
      }

      function requirePlan() {
        if (!state.plan) throw new Error('Rencana belum dibuat. Jawab klarifikasi terlebih dahulu.');
        return state.plan;
      }

      function ensureRecipient(answers) {
        var a = answers && answers.clar_recipient;
        var q = F.clarifications[0];
        if (!a) throw new Error('Penerima notulen belum dipilih.');
        if (a.contact_id) {
          for (var i = 0; i < q.options.length; i++) {
            if (q.options[i].contact_id === a.contact_id) {
              return {
                contact_id: q.options[i].contact_id,
                display_name: q.options[i].display_name,
                department: q.options[i].department,
                email: q.options[i].email,
                masked: q.options[i].masked
              };
            }
          }
          throw new Error('Kontak yang dipilih tidak ada pada daftar klarifikasi.');
        }
        var email = String(a.email || '').trim();
        if (!email || email.indexOf('@') < 1) throw new Error('Email penerima belum diisi dengan benar.');
        return { contact_id: null, display_name: email, department: '', email: email, masked: email };
      }

      function ensureSchedule(answers) {
        var s = answers && answers.clar_schedule;
        if (!s || !s.date || !s.time) throw new Error('Tanggal dan waktu rapat belum diisi.');
        var start = startAt(s.date, s.time, s.timezone);
        if (!start) throw new Error('Tanggal atau waktu rapat tidak valid.');
        var duration = parseInt(s.duration_minutes, 10);
        if (!duration || duration < 15 || duration > 480) throw new Error('Durasi rapat harus 15–480 menit.');
        return { start_at: start, duration_minutes: duration, timezone: s.timezone || 'Asia/Jakarta' };
      }

      function ensureLocation(answers) {
        var l = answers && answers.clar_location;
        if (!l || !String(l.location || '').trim()) throw new Error('Lokasi rapat belum diisi.');
        var attendees = l.attendees || [];
        if (!attendees.length) throw new Error('Pilih minimal satu peserta rapat.');
        return { location: String(l.location).trim(), attendees: attendees.slice() };
      }

      function applyPlan(answers) {
        var recipient = ensureRecipient(answers);
        var schedule = ensureSchedule(answers);
        var place = ensureLocation(answers);

        var plan = clone(F.plan);
        plan.actions = plan.actions.map(function (a) {
          if (a.action_id === 'act_01') {
            a.target = recipient;
            a.findings = [{
              code: 'RECIPIENT_INTERNAL',
              severity: 'info',
              message: 'Penerima berada di domain internal kenari.co.id.'
            }];
          }
          if (a.action_id === 'act_02') {
            a.schedule = schedule;
            a.location = place.location;
            a.attendees = place.attendees.map(function (name) {
              return { name: name, department: '' };
            });
            var conflict = fridayConflict(schedule);
            a.findings = conflict ? [conflict] : [];
          }
          return a;
        });
        plan.findings = collectFindings(plan);
        plan.status = 'PENDING_APPROVAL';
        plan.can_approve = !hasBlocking(plan);
        plan.plan_hash = F.demoHash;

        state.plan = plan;
        state.planChanged = false;
        state.status = 'PENDING_APPROVAL';

        state.actions = state.actions.map(function (a) {
          if (a.action_id === 'act_01') {
            a.recipient = recipient;
            a.status = 'READY';
          }
          if (a.action_id === 'act_02') {
            a.schedule = schedule;
            a.location = place.location;
            a.attendees = place.attendees.map(function (name) { return { name: name }; });
            a.status = 'READY';
            a.findings = state.plan.findings.filter(function (f) { return f.code === 'FRIDAY_PRAYER_CONFLICT'; });
          }
          return a;
        });
      }

      var engine = {
        create: function () {
          state = blank();
          return snapshot();
        },

        getState: function () { return snapshot(); },

        reset: function () {
          state = blank();
          return snapshot();
        },

        ingest: function (input) {
          input = input || {};
          var type = input.type === 'document' ? 'document' : 'text';
          var text = String(input.text || '');
          if (type === 'text' && text.trim().length < 20) {
            throw new Error('Teks permintaan minimal 20 karakter.');
          }
          if (type === 'document') {
            var name = String(input.filename || '');
            if (!/\.(md|txt)$/i.test(name)) throw new Error('Berkas harus berformat .md atau .txt.');
            if (input.size_bytes > 1048576) throw new Error('Ukuran berkas melebihi 1 MB.');
            if (!text.trim()) throw new Error('Isi berkas kosong.');
          }

          if (!state.request) state = blank();

          state.request = clone(F.request);
          state.request.source = type === 'document'
            ? { type: 'document', filename: input.filename || F.document.filename, size_bytes: input.size_bytes || F.document.size_bytes, submitted_by: 'Pengguna layar ini' }
            : { type: 'text', filename: null, size_bytes: null, submitted_by: 'Pengguna layar ini' };
          state.request.text = text;
          state.request.status = 'NEEDS_CLARIFICATION';
          state.status = 'NEEDS_CLARIFICATION';
          state.summary = clone(F.summary);
          if (type === 'document') {
            state.summary.sumber.filename = input.filename || F.document.filename;
            state.summary.sumber.size_bytes = input.size_bytes || F.document.size_bytes;
          } else {
            state.summary.sumber.filename = 'teks yang ditempel';
            state.summary.sumber.size_bytes = text.length;
          }
          state.actions = clone(F.actions);
          state.clarifications = clone(F.clarifications);
          state.stage = 2;
          state.maxStage = 3;
          state.reason = 'Demo lokal memutar skenario notulen 30 Oktober 2026. Teks yang Anda kirim tidak dikirim ke mana pun.';

          pushAudit('request_received');
          pushAudit('document_processed');
          pushAudit('clarification_requested');
          return snapshot();
        },

        clarify: function (answers) {
          if (!state.request) throw new Error('Belum ada permintaan yang diproses.');
          var a = answers || {};
          var missing = [];
          try { ensureRecipient(a); } catch (e) { missing.push('penerima'); }
          try { ensureSchedule(a); } catch (e) { missing.push('jadwal'); }
          try { ensureLocation(a); } catch (e) { missing.push('lokasi dan peserta'); }
          if (missing.length) throw new Error('Klarifikasi belum lengkap: ' + missing.join(', ') + '.');

          state.answers = clone(a);
          state.clarifications = state.clarifications.map(function (q) {
            q.answered = true;
            return q;
          });
          applyPlan(a);
          state.stage = 4;
          state.maxStage = 5;

          pushAudit('clarification_answered');
          pushAudit('plan_created');
          pushAudit('plan_validated');
          pushAudit('approval_requested');
          return snapshot();
        },

        approve: function (decision) {
          var plan = requirePlan();
          var next = decision === 'REJECTED' ? 'REJECTED' : 'APPROVED';
          if (next === 'APPROVED') {
            if (plan.status === 'APPROVED') throw new Error('Rencana ini sudah disetujui.');
            if (!plan.can_approve || hasBlocking(plan)) {
              throw new Error('Rencana tidak dapat disetujui: masih ada temuan yang memblokir.');
            }
            plan.status = 'APPROVED';
            plan.can_approve = false;
            state.status = 'APPROVED';
            var granted = {
              decision: 'APPROVED',
              at: '2026-10-30T03:02:11.000Z',
              approver_name: null,
              demo: true,
              note: 'demo lokal — tidak ada approval yang tercatat di backend'
            };
            state.approval = granted;
            state.approvals.push(granted);
            pushAudit('approval_granted');
            pushAudit('mandate_issued');
          } else {
            if (plan.status === 'REJECTED') throw new Error('Rencana ini sudah ditolak.');
            plan.status = 'REJECTED';
            plan.can_approve = false;
            state.status = 'REJECTED';
            var rejected = clone(F.rejection);
            rejected.note = 'demo lokal — tidak ada keputusan yang tercatat di backend';
            state.approval = rejected;
            state.approvals.push(rejected);
            pushAudit('approval_rejected');
          }
          state.stage = 5;
          state.maxStage = 5;
          return snapshot();
        },

        execute: function () {
          var plan = requirePlan();
          if (plan.status !== 'APPROVED') {
            throw new Error('Eksekusi hanya dapat diminta setelah rencana disetujui.');
          }
          if (state.executions.length) {
            throw new Error('Eksekusi demo sudah dijalankan pada sesi ini.');
          }
          state.status = 'EXECUTION_REQUESTED';
          state.executions = clone(F.executions);
          state.plan.execution = {
            requested_at: '2026-10-30T03:02:30.000Z',
            completed_at: '2026-10-30T03:02:32.000Z',
            partial: true
          };
          var failed = state.executions.some(function (e) { return e.status === 'FAILED'; });
          state.status = failed ? 'FAILED' : 'DISPATCHED_MOCK';
          state.reason = 'Adapter demo hanya mencatat hasil di layar. Tidak ada email, jadwal, atau tugas yang dibuat.';
          pushAudit('action_executed');
          pushAudit('action_executed_2');
          pushAudit('action_blocked');
          state.stage = 5;
          state.maxStage = 5;
          return snapshot();
        },

        /* Validasi ulang setelah rencana diubah. Di demo, hash dihitung ulang
           di peramban dan disebut sebagai hash demo. */
        revalidate: function (edits) {
          var plan = requirePlan();
          if (plan.status === 'APPROVED' || plan.status === 'REJECTED') {
            throw new Error('Rencana yang sudah diputuskan tidak dapat diubah.');
          }
          edits = edits || {};
          plan.actions = plan.actions.map(function (a) {
            if (a.action_id !== 'act_01') return a;
            if (edits.subject) a.subject = edits.subject;
            if (edits.body) a.body = edits.body;
            return a;
          });
          if (edits.date || edits.time) {
            plan.actions = plan.actions.map(function (a) {
              if (a.action_id !== 'act_02') return a;
              var s = a.schedule || { timezone: 'Asia/Jakarta', duration_minutes: 60 };
              var parts = localParts(s.start_at) || { date: '2026-11-06', time: '11:30' };
              var next = startAt(edits.date || parts.date, edits.time || parts.time, s.timezone);
              if (!next) throw new Error('Tanggal atau waktu tidak valid.');
              a.schedule = { start_at: next, duration_minutes: s.duration_minutes, timezone: s.timezone };
              var conflict = fridayConflict(a.schedule);
              a.findings = conflict ? [conflict] : [];
              return a;
            });
          }
          plan.findings = collectFindings(plan);
          plan.can_approve = !hasBlocking(plan);
          plan.status = 'PENDING_APPROVAL';
          plan.plan_hash = demoHash(plan.actions);
          state.plan = plan;
          state.planChanged = false;
          state.status = 'PENDING_APPROVAL';
          pushAudit('plan_revalidated');
          return snapshot();
        },

        /* Varian skenario demo, semuanya tetap data contoh. */
        variant: function (name) {
          state = blank();
          engine.ingest({ type: 'document', filename: F.document.filename, size_bytes: F.document.size_bytes, text: F.document.text });
          engine.clarify(F.sampleAnswers);
          if (name === 'blocked') {
            state.plan = clone(F.variants.blockedPlan);
            state.plan.status = 'BLOCKED';
            state.plan.can_approve = false;
            state.status = 'BLOCKED';
            state.stage = 4;
            state.maxStage = 5;
            /* Rencana yang diblokir tidak pernah sampai ke tahap permintaan
               persetujuan; jangan tampilkan peristiwa yang tidak terjadi. */
            state.audit = state.audit.filter(function (e) { return e.type !== 'approval_requested'; });
            state.reason = 'Varian demo: kebijakan memblokir pengiriman karena penerima tidak tercatat hadir dalam rapat.';
          } else if (name === 'rejected') {
            engine.approve('REJECTED');
            state.reason = 'Varian demo: rencana ditolak. Tidak ada eksekusi yang dijalankan.';
          } else if (name === 'changed') {
            state.plan = clone(F.variants.changedPlan);
            state.plan.can_approve = false;
            state.planChanged = true;
            state.stage = 4;
            state.reason = 'Varian demo: rencana berubah setelah diedit; hash dan persetujuan sebelumnya tidak berlaku.';
          }
          return snapshot();
        }
      };

      return engine;
    }
  };
})();
