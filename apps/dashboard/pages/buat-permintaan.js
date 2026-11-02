(function () {
  'use strict';
  var D = window.DEXTRA;
  if (!D) return;

  function pickContact(intent) {
    var t = (intent || '').toLowerCase();
    if (t.includes('prakoso')) return { id: 'c_budi_ops', name: 'Budi Prakoso', masked: 'b***@kenari.co.id' };
    if (t.includes('sari') || t.includes('hr')) return { id: 'c_sari_hr', name: 'Sari Wulandari', masked: 's***@kenari.co.id' };
    if (t.includes('andi') || t.includes('marketing')) return { id: 'c_andi_mkt', name: 'Andi Prasetyo', masked: 'a***@kenari.co.id' };
    if (t.includes('rina') || t.includes('legal')) return { id: 'c_rina_legal', name: 'Rina Kusuma', masked: 'r***@kenari.co.id' };
    if (t.includes('tim ops')) return { id: 'c_tim_ops', name: 'Tim Operasional', masked: 't***@kenari.co.id' };
    return { id: 'c_budi_fin', name: 'Budi Santoso', masked: 'b***@kenari.co.id' };
  }

  function findButton(text) {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      if ((btns[i].textContent || '').replace(/\s+/g, ' ').toLowerCase().includes(text.toLowerCase())) return btns[i];
    }
    return null;
  }

  function init() {
    var ta = document.querySelector('textarea');
    var specialist = document.getElementById('specialistSelect');
    if (specialist) { specialist.disabled = true; specialist.title = 'Pemilihan spesialis hanya ilustrasi; Dispatcher menentukan spesialis saat eksekusi.'; }

    var submitBtn = findButton('Kirim Permintaan');
    if (submitBtn) {
      submitBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var intent = (ta ? ta.value : '').trim();
        if (!intent) { D.toast('Tulis permintaan terlebih dahulu.', 'error'); return; }
        var c = pickContact(intent);
        var startAt = new Date(Date.now() + 86400000).toISOString();
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyusun rencana…';
        D.call('create_plan', {
          org_id: 'org_kenari',
          request_id: 'req_' + Date.now(),
          intent: intent,
          actions: [{
            action_type: 'send_email',
            target: { contact_id: c.id, display_name: c.name, channel: 'email', masked_address: c.masked },
            schedule: { start_at: startAt, timezone: 'Asia/Jakarta', all_day: false },
            content: { subject: 'Notulen Rapat', body: 'Halo ' + c.name + ', berikut notulen rapat.', locale: 'id-ID' }
          }]
        }).then(function (created) {
          var plan = created.plan;
          return D.call('validate_plan', { plan: plan }).then(function (validated) {
            var p = validated.plan;
            var stored = JSON.parse(localStorage.getItem('dextra_plans') || '[]');
            if (stored.indexOf(p.plan_id) < 0) { stored.push(p.plan_id); localStorage.setItem('dextra_plans', JSON.stringify(stored)); }
            D.toast('Rencana disusun. Menunggu tinjauan.', 'success');
            location.href = 'tinjau.html?plan=' + encodeURIComponent(p.plan_id);
          });
        }).catch(function (err) {
          D.toast('Gagal: ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Kirim Permintaan & Mulai Penyusunan Rencana (DRAFT)';
        });
      });
    }

    var templateBtn = findButton('Gunakan Template');
    if (templateBtn) {
      templateBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (ta) ta.value = 'Siapkan notulen rapat hari ini, kirim ke Pak Budi Santoso, dan jadwalkan tindak lanjut hari Jumat.';
        D.toast('Contoh instruksi dimasukkan. Sesuaikan lalu kirim.', 'info');
      });
    }
    var saveBtn = findButton('Simpan Draf');
    if (saveBtn) {
      saveBtn.addEventListener('click', function (e) { e.preventDefault(); D.toast('Penyimpanan draf lokal belum didukung di MVP.', 'info'); });
      saveBtn.disabled = true; saveBtn.title = 'Penyimpanan draf tidak tersedia di MVP.';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
