/* View — AI Assistant (workspace for composing plans).
 *
 * The planning rules live in copilot.js, not here, because the same assistant is
 * also available as a panel on every other route. Two copies of "who is the
 * recipient?" would drift, and then the assistant would give two answers to the
 * same question depending on where you opened it.
 */
(function () {
  'use strict';
  var D = window.DEXTRA, U = D.util, ui = D.ui, esc = U.esc;
  var store = D.store;

  var thread = [];

  function bubble(m) {
    if (m.role === 'user') {
      return '<div class="msg msg--user"><div class="msg__bubble">' + esc(m.text).replace(/\n/g, '<br>') + '</div>' +
        '<span class="avatar avatar--sm">' + esc(U.initials(D.session.user.name)) + '</span></div>';
    }
    var inner = '<div class="msg__bubble">' + esc(m.text).replace(/\n/g, '<br>') + '</div>';
    if (m.steps && m.steps.length) {
      inner += '<div class="msg__steps">' + m.steps.map(function (s, i) {
        return '<div class="row" style="gap:8px;padding:6px 0"><span class="badge badge--outline" style="min-width:20px;justify-content:center">' + (i + 1) + '</span><span class="small">' + esc(s) + '</span></div>';
      }).join('') + '</div>';
    }
    if (m.recipient && m.recipient.candidates && m.recipient.candidates.length) {
      var RES = { unique: 'terpilih', ambiguous: 'seri — perlu keputusan manusia', none: 'tidak ada', error: 'gagal' };
      inner += '<div class="msg__steps" style="margin-top:8px">' +
        '<div class="tiny faint" style="margin-bottom:5px">Kandidat penerima · ' + esc(RES[m.recipient.resolution] || m.recipient.resolution) + '</div>' +
        m.recipient.candidates.slice(0, 3).map(function (c, i) {
          return '<div class="row" style="gap:8px;padding:5px 0;align-items:flex-start">' +
            '<span class="badge badge--' + (m.recipient.resolution === 'ambiguous' && i === 0 ? 'warning' : 'outline') + '" style="min-width:46px;justify-content:center">' + Math.round((c.score || 0) * 100) + '%</span>' +
            '<div style="min-width:0"><div class="small strong">' + esc(c.display_name) +
              (c.department ? ' <span class="muted">· ' + esc(c.department) + '</span>' : '') +
              (c.disputed ? ' <span class="badge badge--warning">disputed</span>' : '') + '</div>' +
              '<div class="tiny muted">' + esc(c.masked) + ' · ' + esc((c.evidence || [])[0] || 'tanpa bukti') + '</div></div></div>';
        }).join('') + '</div>';
    }
    if (m.plan) {
      inner += '<div class="msg__plan"><div class="row" style="gap:8px;margin-bottom:6px">' +
        '<span class="mono tiny faint">' + esc(m.plan.plan_id) + '</span>' + D.statusBadge(m.plan.status) + '</div>' +
        '<div class="small strong" style="margin-bottom:8px">' + esc(m.plan.intent) + '</div>' +
        (m.plan.actions || []).map(function (a) {
          return '<div class="tiny" style="padding:8px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface)">' +
            '<div class="row" style="gap:6px;margin-bottom:2px"><span class="material-symbols-outlined" style="font-size:13px;color:var(--brand-600)">' +
            (a.action_type === 'schedule_event' ? 'event' : 'mail') + '</span><b>' + esc(a.action_type.replace(/_/g, ' ')) + '</b>' +
            '<span class="spacer"></span>' + D.riskBadge(a.risk) + '</div>' +
            '<div class="muted">' + esc(a.target.display_name) + ' · ' + esc(a.target.masked_address) + ' · ' + esc(a.target.channel) + '</div>' +
            '<div class="muted">' + esc(a.schedule.start_at ? U.fmtDate(a.schedule.start_at) : '—') + '</div>' +
          '</div>';
        }).join('') +
        '<div class="row" style="gap:6px;margin-top:8px"><a class="btn btn--primary btn--sm" href="#/review/' + encodeURIComponent(m.plan.plan_id) + '">Tinjau rencana' +
        '<span class="material-symbols-outlined">arrow_forward</span></a>' +
        '<button class="btn btn--secondary btn--sm" data-ask-more>Ubah instruksi</button></div></div>';
    }
    if (m.blocked) {
      inner += '<div class="banner banner--danger" style="margin-top:8px"><span class="material-symbols-outlined">block</span>' +
        '<div>Diblokir <b>' + esc(m.blocked.code) + '</b> — ' + esc(m.blocked.message) + '</div></div>';
    }
    return '<div class="msg"><span class="spec-avatar" style="width:26px;height:26px;border-radius:7px"><span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span></span>' +
      '<div style="min-width:0">' + inner + '<div class="tiny faint" style="margin-top:4px">' + esc(U.rel(m.at)) + '</div></div></div>';
  }

  D.views.assistant = function (root) {
    thread = store.assistantThread.map(function (m) {
      return {
        role: m.role, text: m.text, at: m.at, steps: m.steps,
        plan: m.plan_id ? store.plan(m.plan_id) : null,
        blocked: m.blocked ? { code: 'TIME-03', message: 'Jendela 11:30–13:00 pada hari Jumat dilindungi.' } : null
      };
    });

    root.innerHTML =
      ui.pageHead({
        eyebrow: 'Workspace · AI Assistant',
        title: 'AI Assistant',
        desc: 'Menyusun rencana dari permintaan bebas. Asisten tidak pernah mengeksekusi; setiap tindakan berhenti di persetujuan manusia.',
        actions: '<button class="btn btn--secondary" id="open-copilot"><span class="material-symbols-outlined">auto_awesome</span>Copilot di halaman ini</button>' +
          '<a class="btn btn--secondary" href="#/requests"><span class="material-symbols-outlined">send</span>Permintaan saya</a>'
      }) +
      ui.prototypeBanner('Balasan disusun oleh aturan lokal di peramban, bukan model AI. Pencarian penerima memakai <b>find_precedent</b> saat server MCP aktif; tanpa server, daftar kontak contoh yang dipakai. Tidak ada pesan, jadwal, atau data yang benar-benar dibuat.') +
      '<div class="grid chat-grid" style="grid-template-columns:minmax(0,1fr) 320px">' +
        '<div class="card chat-card">' +
          '<div class="card__head"><div><h2>Percakapan</h2><p>Riwayat sesi ini · tidak disimpan ke server</p></div><div class="spacer"></div>' +
            '<span class="badge badge--outline"><span class="material-symbols-outlined" style="font-size:13px">lock</span>Local only</span></div>' +
          '<div class="assistant-scroll" id="chat"></div>' +
          '<div style="border-top:1px solid var(--border);padding:14px 16px">' +
            '<div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:9px" id="suggest">' +
              ['Siapkan notulen rapat Q4 dan kirim ke Budi Santoso', 'Jadwalkan review anggaran Jumat 11:30', 'Hapus arsip email lama', 'Kirim ringkasan kontrak ke Legal'].map(function (s) {
                return '<button class="chip" data-suggest="' + esc(s) + '">' + esc(s) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="row" style="gap:8px;align-items:flex-end">' +
              '<textarea class="textarea" id="composer" rows="2" placeholder="Tulis permintaan dalam bahasa biasa…" style="min-height:44px;max-height:120px"></textarea>' +
              '<button class="btn btn--primary" id="send" style="height:38px"><span class="material-symbols-outlined">send</span>Kirim</button>' +
            '</div>' +
            '<div class="tiny faint" style="margin-top:7px">Enter untuk mengirim · Shift+Enter baris baru. Asisten hanya menyusun rencana.</div>' +
          '</div>' +
        '</div>' +
        '<div class="stack chat-rail">' +
          ui.card({
            title: 'Batas yang berlaku',
            body: '<div class="stack" style="gap:10px">' +
              store.policies.filter(function (p) { return p.active; }).slice(0, 5).map(function (p) {
                return '<div class="row" style="align-items:flex-start;gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--warning-600);margin-top:2px">' +
                  (p.severity === 'blocking' ? 'block' : 'info') + '</span>' +
                  '<div><div class="tiny strong">' + esc(p.id) + ' · ' + esc(p.name) + '</div>' +
                  '<div class="tiny muted" style="line-height:1.4">' + esc(p.desc.length > 84 ? p.desc.slice(0, 84) + '…' : p.desc) + '</div></div></div>';
              }).join('') +
              '<a class="btn btn--ghost btn--sm" href="#/policies" style="justify-content:flex-start;padding-left:0">Lihat semua kebijakan<span class="material-symbols-outlined">arrow_forward</span></a></div>'
          }) +
          ui.card({
            title: 'Yang tidak dilakukan asisten',
            body: '<div class="stack" style="gap:8px">' +
              ['Tidak mengirim pesan', 'Tidak membuat jadwal', 'Tidak menyetujui work package', 'Tidak menerbitkan mandat', 'Tidak mengubah data pelanggan'].map(function (x) {
                return '<div class="row" style="gap:8px"><span class="material-symbols-outlined" style="font-size:15px;color:var(--faint)">remove</span><span class="small muted">' + esc(x) + '</span></div>';
              }).join('') + '</div>'
          }) +
          ui.card({
            title: 'Sesi', body:
              '<dl class="def-list"><dt>Organisasi</dt><dd>' + esc(store.org ? store.org.name : 'Kenari Group') + '</dd>' +
              '<dt>Zona waktu</dt><dd>Asia/Jakarta (WIB)</dd>' +
              '<dt>Peran</dt><dd>' + esc(D.session.roleLabel()) + '</dd>' +
              '<dt>Jalur data</dt><dd>Peramban → MCP lokal</dd></dl>'
          }) +
        '</div>' +
      '</div>';

    var chat = root.querySelector('#chat');
    var input = root.querySelector('#composer');

    function paint() {
      chat.innerHTML = thread.map(bubble).join('');
      chat.scrollTop = chat.scrollHeight;
      chat.querySelectorAll('[data-ask-more]').forEach(function (b) {
        b.addEventListener('click', function () { input.focus(); input.value = ''; });
      });
    }

    function send(text) {
      if (!text.trim()) return;
      thread.push({ role: 'user', text: text.trim(), at: new Date().toISOString() });
      paint();
      input.value = '';
      var typing = U.h('div', { class: 'msg' });
      typing.innerHTML = '<span class="spec-avatar" style="width:26px;height:26px;border-radius:7px"><span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span></span>' +
        '<div class="msg__bubble"><span class="tiny muted">Menyusun rencana…</span></div>';
      chat.appendChild(typing);
      chat.scrollTop = chat.scrollHeight;
      var pending = D.copilot.compose(text.trim());
      setTimeout(function () {
        typing.remove();
        pending.then(function (r) {
          r.role = 'assistant'; r.at = new Date().toISOString();
          thread.push(r);
          paint();
        });
      }, 420);
    }

    root.querySelector('#send').addEventListener('click', function () { send(input.value); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); }
    });
    root.querySelectorAll('[data-suggest]').forEach(function (b) {
      b.addEventListener('click', function () { send(b.getAttribute('data-suggest')); });
    });
    var cpBtn = root.querySelector('#open-copilot');
    if (cpBtn) cpBtn.addEventListener('click', function () { if (D.copilotPanel) D.copilotPanel.open(); });
    paint();
  };
})();
