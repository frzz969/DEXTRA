(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  var params = new URLSearchParams(location.search);
  var planId = params.get('plan');

  function el(id) { return document.getElementById(id); }

  function renderPlan(p) {
    var acts = p.actions || [];
    var risk = acts.reduce(function (max, a) { return (a.risk === 'critical') ? 'critical' : (a.risk === 'high' && max !== 'critical') ? 'high' : (a.risk === 'medium' && max === 'low') ? 'medium' : max; }, acts[0] ? acts[0].risk : 'medium');
    var blocked = p.status === 'BLOCKED';
    var findings = (p.findings || []);

    // Metadata
    var meta = el('kp-meta');
    if (meta) meta.innerHTML =
      '<div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">' +
        '<div><div class="text-[11px] uppercase text-[#77778C] font-semibold">Plan ID</div><div class="font-mono text-xs mt-1">' + D.esc(p.plan_id) + '</div></div>' +
        '<div><div class="text-[11px] uppercase text-[#77778C] font-semibold">Pemohon</div><div class="mt-1">Farhan Pratama</div></div>' +
        '<div><div class="text-[11px] uppercase text-[#77778C] font-semibold">Waktu</div><div class="mt-1">' + D.fmtDate(p.created_at) + '</div></div>' +
        '<div><div class="text-[11px] uppercase text-[#77778C] font-semibold">Risiko</div><div class="mt-1">' + D.riskBadge(risk) + '</div></div>' +
        '<div><div class="text-[11px] uppercase text-[#77778C] font-semibold">Status</div><div class="mt-1">' + D.statusBadge(p.status) + '</div></div>' +
        '<div><div class="text-[11px] uppercase text-[#77778C] font-semibold">Sidik Rencana</div><div class="font-mono text-[11px] mt-1 break-all">' + D.esc(p.plan_hash || '') + '</div></div>' +
      '</div>';

    // Scope
    var scope = el('kp-scope');
    if (scope) scope.innerHTML = acts.length ? acts.map(function (a, i) {
      return '<div class="border border-[#EAE9F1] rounded-xl p-4 mb-3">' +
        '<div class="text-xs font-semibold text-[#7357E8] mb-2">TINDAKAN ' + (i + 1) + ' — ' + D.esc(a.action_type).toUpperCase().replace(/_/g, ' ') + '</div>' +
        '<div class="text-xs text-[#77778C] space-y-1">' +
          '<div><b>Penerima:</b> ' + D.esc(a.target && a.target.display_name) + ' (' + D.esc(a.target && a.target.masked_address) + ')</div>' +
          '<div><b>Kanal:</b> ' + D.esc(a.target && a.target.channel) + '</div>' +
          '<div><b>Subjek:</b> ' + D.esc(a.content && a.content.subject) + '</div>' +
          '<div><b>Isi:</b> <div class="bg-[#F7F7FC] p-2 rounded mt-1 whitespace-pre-wrap">' + D.esc(a.content && a.content.body) + '</div></div>' +
          '<div><b>Jadwal:</b> ' + D.esc(a.schedule && a.schedule.start_at) + ' (' + D.esc(a.schedule && a.schedule.timezone) + ')</div>' +
          '<div><b>Risiko:</b> ' + D.riskBadge(a.risk) + '</div>' +
        '</div>' +
      '</div>';
    }).join('') : '<p class="text-sm text-[#77778C]">Tidak ada tindakan dalam rencana ini.</p>';

    // Findings
    var fnd = el('kp-findings');
    if (fnd) fnd.innerHTML = findings.length
      ? findings.map(function (f) { return '<div class="p-3 rounded-lg bg-[#FDF2F3] text-xs text-[#D95362] mb-2"><b>' + D.esc(f.code) + '</b> — ' + D.esc(f.message) + '</div>'; }).join('')
      : '<div class="text-sm text-[#269B72] flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">check</span> Semua pemeriksaan lulus. Tidak ada temuan.</div>';

    // Approval panel
    var panel = el('kp-approval');
    if (panel) {
      if (blocked) {
        panel.innerHTML = '<div class="p-3 rounded-lg bg-[#FDF2F3] text-sm text-[#D95362] mb-3">Rencana diblokir oleh Policy Validator (Governance Engine). Tombol persetujuan dinonaktifkan.</div>';
        return;
      }
      panel.innerHTML =
        '<p class="text-sm text-[#77778C] mb-3">Anda memberi wewenang atas tindakan persis yang ditampilkan di atas. Persetujuan terikat pada versi rencana ini.</p>' +
        '<div class="flex flex-wrap gap-2 justify-end">' +
          '<button id="kp-revise" class="px-3 py-2 rounded-lg bg-[#F3F2F9] text-[#1A1A2C] text-sm font-medium">Minta Revisi</button>' +
          '<button id="kp-reject" class="px-3 py-2 rounded-lg bg-[#FDF2F3] text-[#D95362] text-sm font-medium border border-[#F8D7DA]">Tolak</button>' +
          '<button id="kp-approve" class="px-4 py-2 rounded-lg bg-[#7357E8] text-white text-sm font-semibold hover:bg-[#5741BD]">Setujui &amp; Terbitkan Mandat</button>' +
        '</div>';

      var approveBtn = el('kp-approve');
      if (approveBtn) approveBtn.addEventListener('click', function () {
        approveBtn.disabled = true; approveBtn.textContent = 'Menerbitkan…';
        D.call('submit_approval', { plan_id: p.plan_id, plan_hash: p.plan_hash, decision: 'approve', approver_id: 'user_001', approval_token: 'apt_' + Date.now() })
          .then(function (r) {
            D.toast('Mandat diterbitkan.', 'success');
            var box = el('kp-result');
            if (box) box.innerHTML = '<div class="p-3 rounded-lg bg-[#E8F7F1] text-sm text-[#269B72] mb-3">Mandat: <span class="font-mono">' + D.esc(r.mandate_id) + '</span> — <a class="underline" href="work-package.html?plan=' + encodeURIComponent(p.plan_id) + '">lihat detail &amp; eksekusi</a></div>';
          })
          .catch(function (e) { D.toast('Gagal: ' + e.message, 'error'); approveBtn.disabled = false; approveBtn.textContent = 'Setujui & Terbitkan Mandat'; });
      });
      var rejectBtn = el('kp-reject');
      if (rejectBtn) rejectBtn.addEventListener('click', function () {
        D.call('submit_approval', { plan_id: p.plan_id, plan_hash: p.plan_hash, decision: 'reject', approver_id: 'user_001', approval_token: 'apt_' + Date.now() })
          .then(function () { D.toast('Rencana ditolak.', 'success'); setTimeout(function () { location.href = 'kotak-persetujuan.html'; }, 600); })
          .catch(function (e) { D.toast('Gagal: ' + e.message, 'error'); });
      });
      var reviseBtn = el('kp-revise');
      if (reviseBtn) reviseBtn.addEventListener('click', function () {
         reviseBtn.disabled = true; reviseBtn.textContent = 'Mengirim…';
         D.call('submit_approval', { plan_id: p.plan_id, plan_hash: p.plan_hash, decision: 'revise', approver_id: 'user_001', approval_token: 'apt_' + Date.now() })
           .then(function () { D.toast('Permintaan revisi dicatat.', 'success'); reviseBtn.disabled = false; reviseBtn.textContent = 'Minta Revisi'; })
           .catch(function (e) { D.toast('Gagal: ' + e.message, 'error'); reviseBtn.disabled = false; reviseBtn.textContent = 'Minta Revisi'; });
       });
    }
  }

  function load() {
    if (!planId) {
      var main = document.querySelector('main') || document.getElementById('app');
      if (main) main.innerHTML = '<div class="p-8 text-center text-[#77778C]">Pilih work package dari <a class="text-[#7357E8] font-semibold" href="kotak-persetujuan.html">Kotak Persetujuan</a>.</div>';
      return;
    }
    D.call('get_plan', { plan_id: planId }).then(function (d) {
      renderPlan(d.plan);
    }).catch(function (e) {
      D.toast('Gagal memuat rencana: ' + e.message, 'error');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
