// DEXTRA Dashboard — vanilla JS, offline, no build step.
const API = 'http://127.0.0.1:8765';
const TOKEN = 'ops-dev-token';

const state = {
  org: null,
  plans: [],        // array of plan_id strings
  currentPlan: null,
  mandate: null,
  execution: null,
  audit: [],
  conn: 'checking',
};

function loadPlans() { try { state.plans = JSON.parse(localStorage.getItem('dextra_plans') || '[]'); } catch { state.plans = []; } }
function savePlans() { localStorage.setItem('dextra_plans', JSON.stringify(state.plans)); }

async function callTool(name, args) {
  const res = await fetch(API + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args || {} } }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  const text = json.result?.content?.[0]?.text;
  const parsed = text ? JSON.parse(text) : {};
  if (parsed.ok === false) throw new Error(parsed.error?.message || 'gagal');
  return parsed.data;
}

async function checkConn() {
  try { const r = await fetch(API + '/health'); state.conn = r.ok ? 'online' : 'offline'; }
  catch { state.conn = 'offline'; }
  const el = document.getElementById('conn-status');
  if (el) {
    el.innerHTML = `<span class="status-dot ${state.conn === 'online' ? 'online' : 'offline'}"></span>${state.conn === 'online' ? 'Terhubung' : 'Terputus'}`;
  }
}

function toast(msg, type) {
  type = type || 'info';
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'error' ? 'error' : type === 'success' ? 'success' : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3200);
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function fmtDate(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } }

function badgeStatus(s) {
  const map = { READY: ['badge-primary','Siap'], NEEDS_REVIEW: ['badge-warning','Perlu Tinjauan'], BLOCKED: ['badge-danger','Diblokir'], EXECUTED: ['badge-success','Terlaksana'], DRAFT: ['badge-neutral','Draf'], AWAITING_APPROVAL: ['badge-warning','Menunggu Persetujuan'], REJECTED: ['badge-danger','Ditolak'], MANDATED: ['badge-info','Bermanadat'] };
  const [cls, label] = map[s] || ['badge-neutral', s || '—'];
  return `<span class="badge ${cls}">${label}</span>`;
}
function badgeRisk(r) {
  const map = { low: ['risk-low','Rendah'], medium: ['risk-medium','Sedang'], high: ['risk-high','Tinggi'], critical: ['risk-critical','Kritis'] };
  const [cls, label] = map[r] || ['risk-medium', r || '—'];
  return `<span class="risk-badge ${cls}">${label}</span>`;
}

function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div style="width:32px;height:32px;border-radius:8px;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">D</div>
        <div><div class="logo">DEXTRA</div><div class="sub">Governed AI Workforce</div></div>
      </div>
      <div class="sidebar-nav">
        <div class="nav-group">
          <div class="nav-group-label">Workspace</div>
          <a class="nav-item" data-route="overview" href="#/overview">${icon('grid_view',18)} Overview</a>
          <a class="nav-item" data-route="buat" href="#/buat">${icon('send',18)} Buat Permintaan</a>
          <a class="nav-item" data-route="persetujuan" href="#/persetujuan">${icon('assignment_turned_in',18)} Kotak Persetujuan</a>
          <a class="nav-item" data-route="detail" href="#/detail">${icon('layers',18)} Work Package</a>
          <a class="nav-item" data-route="audit" href="#/audit">${icon('verified_user',18)} Aktivitas &amp; Audit</a>
        </div>
        <div class="nav-group">
          <div class="nav-group-label">Governance</div>
          <a class="nav-item" data-route="mandat" href="#/mandat">${icon('policy',18)} Mandat</a>
        </div>
        <div class="nav-group">
          <div class="nav-group-label">Settings</div>
          <a class="nav-item" data-route="pengaturan" href="#/pengaturan">${icon('settings',18)} Pengaturan</a>
        </div>
      </div>
      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="avatar">FP</div>
          <div><div class="name">Farhan Pratama</div><div class="role">Operations Manager</div></div>
        </div>
      </div>
    </aside>
    <div class="pl-[250px]">
      <header class="header">
        <button id="menu-btn" onclick="document.getElementById('sidebar').classList.toggle('open')" style="display:none;background:none;border:none;padding:4px;margin-right:8px;cursor:pointer;">☰</button>
        <div>
          <div class="header-title" id="page-title">DEXTRA</div>
          <div class="header-sub" id="page-sub">Governed AI Workforce</div>
        </div>
        <div class="header-right">
          <div class="badge-conn"><span class="status-dot" id="conn-dot"></span><span id="conn-status">Memeriksa...</span></div>
          <img src="https://placehold.co/32x32/7357E8/FFFFFF?text=FP" style="width:32px;height:32px;border-radius:50%;" alt="profil"/>
        </div>
      </header>
      <main class="main" id="main"></main>
    </div>
  `;
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(a => {
    const r = a.getAttribute('data-route');
    a.classList.toggle('active', r === route);
  });
}

function setTitle(title, sub) {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-sub').textContent = sub || '';
}

async function route() {
  const hash = location.hash || '#/overview';
  const parts = hash.replace('#/', '').split('/');
  const name = parts[0];
  const arg = parts[1] ? decodeURIComponent(parts[1]) : null;
  setActiveNav(name);
  const main = document.getElementById('main');
  main.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat...</div>';
  try {
    switch (name) {
      case 'overview': await renderOverview(main); break;
      case 'buat': await renderBuat(main); break;
      case 'persetujuan': await renderPersetujuan(main); break;
      case 'tinjau': await renderTinjau(main, arg); break;
      case 'detail': await renderDetail(main, arg); break;
      case 'audit': await renderAudit(main); break;
      case 'mandat': await renderMandat(main); break;
      case 'pengaturan': await renderPengaturan(main); break;
      default: await renderOverview(main);
    }
  } catch (e) {
    main.innerHTML = `<div class="error-state"><div class="icon">${icon('error',48)}</div><h3>Terjadi Kesalahan</h3><p>${escapeHtml(e.message)}</p><p style="margin-top:8px;font-size:12px;">Tidak ada tindakan yang dijalankan.</p></div>`;
  }
}

// ---------- Overview ----------
async function renderOverview(main) {
  setTitle('Overview', 'Ringkasan workforce AI Anda hari ini');
  loadPlans();
  const plans = await Promise.all(state.plans.map(id => callTool('get_plan', { plan_id: id }).catch(() => null)));
  const valid = plans.filter(Boolean);
  const awaiting = valid.filter(p => p.status === 'READY' || p.status === 'NEEDS_REVIEW').length;
  const blocked = valid.filter(p => p.status === 'BLOCKED').length;
  main.innerHTML = `
    <div class="metrics">
      <div class="metric-card"><div class="metric-icon" style="background:var(--primary-soft);color:var(--primary);">${icon('layers',20)}</div><div class="metric-num">${valid.length}</div><div class="metric-label">Work Package Aktif</div></div>
      <div class="metric-card"><div class="metric-icon" style="background:var(--warning-soft);color:var(--warning);">${icon('assignment_turned_in',20)}</div><div class="metric-num">${awaiting}</div><div class="metric-label">Menunggu Persetujuan</div></div>
      <div class="metric-card"><div class="metric-icon" style="background:var(--success-soft);color:var(--success);">${icon('check',20)}</div><div class="metric-num">${valid.filter(p=>p.status==='EXECUTED').length || 0}</div><div class="metric-label">Selesai Hari Ini</div></div>
      <div class="metric-card"><div class="metric-icon" style="background:var(--danger-soft);color:var(--danger);">${icon('error',20)}</div><div class="metric-num">${blocked}</div><div class="metric-label">Tindakan Diblokir</div></div>
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div><div class="card-title">Work Package Terbaru</div><div class="card-sub">Rencana yang telah disusun</div></div></div>
        ${valid.length ? valid.slice(0,6).map(p => `
          <div class="inbox-item" style="cursor:pointer;" onclick="location.hash='#/tinjau/${encodeURIComponent(p.plan_id)}'">
            <div style="flex:1;min-width:0;">
              <div class="subject">${escapeHtml(p.intent)}</div>
              <div class="meta">${fmtDate(p.created_at)} · ${p.actions?.length || 0} tindakan · ${badgeRisk(p.actions?.[0]?.risk || 'medium')}</div>
            </div>
            ${badgeStatus(p.status)}
          </div>`).join('') : '<div class="empty-state"><h3>Belum ada work package</h3><p>Buat permintaan baru untuk memulai.</p></div>'}
      </div>
      <div class="card">
        <div class="card-header"><div><div class="card-title">Workforce Status</div><div class="card-sub">Spesialis AI yang tersedia</div></div></div>
        ${['Executive Assistant','Administrative Officer','Compliance Reviewer'].map(n => `
          <div class="inbox-item">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-soft);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${n.split(' ').map(w=>w[0]).join('')}</div>
            <div style="flex:1;min-width:0;">
              <div class="subject">${n}</div>
              <div class="meta">Tersedia · Tidak memiliki wewenang eksekusi mandiri</div>
            </div>
            <span class="badge badge-success">Aktif</span>
          </div>`).join('')}
        <div style="margin-top:var(--space-md);padding:var(--space-sm);background:var(--bg);border-radius:var(--radius-md);font-size:12px;color:var(--muted);">
          <strong style="color:var(--text);">Ringkasan tata kelola:</strong> Semua tindakan eksternal wajib mandat. Tidak ada eksekusi tanpa persetujuan manusia.
        </div>
      </div>
    </div>
  `;
}

// ---------- Buat Permintaan ----------
async function renderBuat(main) {
  setTitle('Buat Permintaan', 'Delegasikan pekerjaan kantor ke DEXTRA');
  main.innerHTML = `
    <div class="card" style="max-width:720px;margin:0 auto;">
      <div class="card-header"><div><div class="card-title">Buat Permintaan Baru</div><div class="card-sub">DEXTRA akan menyusun rencana kerja untuk ditinjau. Tidak ada tindakan eksternal yang dijalankan tanpa persetujuan Anda.</div></div></div>
      <div style="margin-bottom:var(--space-md);">
        <label for="intent">Apa yang ingin Anda minta DEXTRA tangani?</label>
        <textarea id="intent" placeholder="Contoh: Siapkan notulen rapat hari ini, kirim ke Pak Budi, dan jadwalkan tindak lanjut hari Jumat."></textarea>
      </div>
      <div class="grid-2" style="margin-bottom:var(--space-md);">
        <div><label>Departemen</label><select id="dept"><option>Operasi</option><option>Keuangan</option><option>HR</option></select></div>
        <div><label>Konteks</label><input id="ctx" class="input" placeholder="mis. rapat proyek mingguan"/></div>
      </div>
      <div style="margin-bottom:var(--space-lg);">
        <label>Lampiran (opsional)</label>
        <input type="file" id="file" style="font-size:13px;"/>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:var(--space-sm);">
        <button class="btn btn-tertiary" onclick="location.hash='#/overview'">Batal</button>
        <button class="btn btn-primary" id="submit-req">${icon('send',16)} Kirim Permintaan</button>
      </div>
    </div>
  `;
  document.getElementById('submit-req').onclick = async () => {
    const intent = document.getElementById('intent').value.trim();
    if (!intent) { toast('Tulis permintaan terlebih dahulu.', 'error'); return; }
    try {
      const org = await callTool('get_org_rules', { org_id: 'org_kenari' });
      const plan = await callTool('create_plan', {
        org_id: 'org_kenari',
        request_id: 'req_' + Date.now(),
        intent,
        actions: [{
          action_type: 'send_email',
          target: { contact_id: 'c_budi_fin', display_name: 'Budi Santoso', channel: 'email', masked_address: 'b***@kenari.co.id' },
          schedule: { start_at: new Date(Date.now() + 86400000).toISOString(), timezone: 'Asia/Jakarta', all_day: false },
          content: { subject: 'Notulen Rapat', body: 'Halo Budi, berikut notulen rapat.', locale: 'id-ID' },
        }],
      });
      const validated = await callTool('validate_plan', { plan: plan.plan });
      const p = validated.plan;
      if (!state.plans.includes(p.plan_id)) { state.plans.push(p.plan_id); savePlans(); }
      toast('Rencana disusun. Menunggu tinjauan.', 'success');
      location.hash = '#/tinjau/' + encodeURIComponent(p.plan_id);
    } catch (e) { toast('Gagal: ' + e.message, 'error'); }
  };
}

// ---------- Kotak Persetujuan ----------
async function renderPersetujuan(main) {
  setTitle('Kotak Persetujuan', 'Tinjau persis apa yang ingin dilakukan DEXTRA');
  loadPlans();
  const plans = (await Promise.all(state.plans.map(id => callTool('get_plan', { plan_id: id }).catch(() => null)))).filter(Boolean);
  main.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header">
        <div><div class="card-title">Permintaan Menunggu Persetujuan</div><div class="card-sub">Setiap tindakan eksternal wajib mandat manusia.</div></div>
        <div style="display:flex;gap:var(--space-sm);">
          <button class="btn btn-tertiary btn-sm" onclick="filterPlans('all')">Semua</button>
          <button class="btn btn-tertiary btn-sm" onclick="filterPlans('pending')">Menunggu</button>
          <button class="btn btn-tertiary btn-sm" onclick="filterPlans('blocked')">Diblokir</button>
        </div>
      </div>
      <div id="plan-list">
        ${plans.length ? plans.map(p => `
          <div class="approval-card ${p.status === 'BLOCKED' ? 'blocked' : ''}" data-status="${p.status}" style="margin-bottom:var(--space-md);">
            <div class="approval-card-header">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:15px;margin-bottom:4px;">${escapeHtml(p.intent)}</div>
                <div style="font-size:12px;color:var(--muted);">${fmtDate(p.created_at)} · ${p.actions?.length || 0} tindakan · ${badgeRisk(p.actions?.[0]?.risk || 'medium')}</div>
              </div>
              ${badgeStatus(p.status)}
            </div>
            <div class="approval-card-body" style="display:flex;justify-content:flex-end;gap:var(--space-sm);">
              <button class="btn btn-tertiary btn-sm" onclick="location.hash='#/tinjau/${encodeURIComponent(p.plan_id)}'">Tinjau Detail</button>
            </div>
          </div>`).join('') : '<div class="empty-state"><h3>Tidak ada permintaan</h3><p>Buat permintaan baru untuk memulai.</p></div>'}
      </div>
    </div>
  `;
}

window.filterPlans = function(mode) {
  document.querySelectorAll('#plan-list .approval-card').forEach(c => {
    const s = c.getAttribute('data-status');
    let show = true;
    if (mode === 'pending') show = (s === 'READY' || s === 'NEEDS_REVIEW');
    if (mode === 'blocked') show = (s === 'BLOCKED');
    c.style.display = show ? '' : 'none';
  });
};

// ---------- Tinjau Work Package ----------
async function renderTinjau(main, planId) {
  setTitle('Tinjau Work Package', 'Ruang lingkup eksekusi & persetujuan');
  if (!planId) { main.innerHTML = '<div class="empty-state"><h3>Plan ID tidak ditemukan</h3></div>'; return; }
  const plan = await callTool('get_plan', { plan_id: planId });
  const p = plan.plan;
  state.currentPlan = p;
  const blocked = p.status === 'BLOCKED';
  const findings = p.findings || [];
  main.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header">
        <div><div class="card-title">Metadata Rencana</div></div>
        ${badgeStatus(p.status)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-md);font-size:13px;">
        <div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;">Plan ID</div><div class="mono" style="margin-top:4px;">${escapeHtml(p.plan_id)}</div></div>
        <div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;">Pemohon</div><div style="margin-top:4px;">Farhan Pratama</div></div>
        <div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;">Waktu</div><div style="margin-top:4px;">${fmtDate(p.created_at)}</div></div>
        <div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;">Risiko</div><div style="margin-top:4px;">${badgeRisk(p.actions?.[0]?.risk || 'medium')}</div></div>
        <div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;">Versi</div><div style="margin-top:4px;">v1 (Terkunci)</div></div>
        <div><div style="font-size:11px;color:var(--muted);font-weight:600;text-transform:uppercase;">Sidik Rencana</div><div class="mono" style="margin-top:4px;font-size:11px;">${escapeHtml((p.plan_hash||'').slice(0,18))}…</div></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header"><div class="card-title">Ruang Lingkup Eksekusi</div><div class="card-sub">Tindakan persis yang akan dijalankan jika disetujui.</div></div>
      ${(p.actions||[]).map((a, i) => `
        <div class="scope-panel">
          <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--primary);">TINDAKAN ${String(i+1).padStart(2,'0')} — ${escapeHtml(a.action_type).toUpperCase().replace('_',' ')}</div>
          <div class="scope-row"><div class="scope-key">Penerima</div><div class="scope-val">${escapeHtml(a.target.display_name)} (${escapeHtml(a.target.masked_address)})</div></div>
          <div class="scope-row"><div class="scope-key">Kanal</div><div class="scope-val">${escapeHtml(a.target.channel)}</div></div>
          <div class="scope-row"><div class="scope-key">Subjek</div><div class="scope-val">${escapeHtml(a.content?.subject || '—')}</div></div>
          <div class="scope-row"><div class="scope-key">Isi Pesan</div><div class="scope-val"><div class="scroll-box">${escapeHtml(a.content?.body || '')}</div></div></div>
          <div class="scope-row"><div class="scope-key">Jadwal</div><div class="scope-val">${escapeHtml(a.schedule?.start_at)} (${escapeHtml(a.schedule?.timezone)})</div></div>
          <div class="scope-row"><div class="scope-key">Risiko</div><div class="scope-val">${badgeRisk(a.risk)}</div></div>
          <div class="scope-row"><div class="scope-key">Status</div><div class="scope-val">${badgeStatus('READY')}</div></div>
        </div>`).join('')}
    </div>

    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header"><div class="card-title">Temuan Validasi</div></div>
      ${findings.length ? `<div class="findings">${findings.map(f => `
        <div class="finding ${f.severity === 'blocking' ? 'blocking' : f.severity === 'warning' ? 'warning' : 'info'}">
          <div>${icon(f.severity === 'blocking' ? 'error' : f.severity === 'warning' ? 'warning' : 'info', 18)}</div>
          <div class="finding-msg"><strong>${escapeHtml(f.code)}</strong> — ${escapeHtml(f.message)}</div>
        </div>`).join('')}</div>` : '<div style="color:var(--success);font-size:13px;display:flex;align-items:center;gap:6px;">' + icon('check',16) + ' Semua pemeriksaan lulus. Tidak ada temuan.</div>'}
    </div>

    <div class="card ${blocked ? 'blocked' : ''}">
      <div class="card-header"><div class="card-title">Panel Persetujuan Manusia</div></div>
      <p style="font-size:13px;color:var(--muted);margin-bottom:var(--space-md);">Anda memberi wewenang atas tindakan persis yang ditampilkan di atas. Persetujuan terikat pada versi rencana ini.</p>
      ${blocked ? `<div style="padding:var(--space-sm);background:var(--danger-soft);border-radius:var(--radius-md);color:var(--danger);font-size:13px;margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px;">${icon('error',16)} Rencana diblokir oleh kebijakan. Tombol setujui dinonaktifkan.</div>` : ''}
      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;flex-wrap:wrap;">
        <button class="btn btn-tertiary" onclick="doRevise('${p.plan_id}')">Minta Revisi</button>
        <button class="btn btn-danger" onclick="doReject('${p.plan_id}','${p.plan_hash}')">Tolak</button>
        <button class="btn btn-primary" id="approve-btn" ${blocked ? 'disabled' : ''} onclick="doApprove('${p.plan_id}','${p.plan_hash}')">Setujui &amp; Terbitkan Mandat</button>
      </div>
    </div>
  `;
}

window.doApprove = async function(planId, planHash) {
  const btn = document.getElementById('approve-btn');
  if (btn) btn.disabled = true;
  try {
    const r = await callTool('submit_approval', { plan_id: planId, plan_hash: planHash, decision: 'approve', approver_id: 'user_001', approval_token: 'apt_demo' });
    toast('Mandat diterbitkan.', 'success');
    if (r.mandate_id) {
      state.mandate = { mandate_id: r.mandate_id };
      location.hash = '#/detail/' + encodeURIComponent(planId);
    }
  } catch (e) { toast('Gagal: ' + e.message, 'error'); if (btn) btn.disabled = false; }
};
window.doReject = async function(planId, planHash) {
  try {
    await callTool('submit_approval', { plan_id: planId, plan_hash: planHash, decision: 'reject', approver_id: 'user_001', approval_token: 'apt_demo' });
    toast('Rencana ditolak.', 'success');
    location.hash = '#/persetujuan';
  } catch (e) { toast('Gagal: ' + e.message, 'error'); }
};
window.doRevise = function(planId) { toast('Permintaan revisi dicatat.', 'info'); };

// ---------- Work Package Detail & Audit ----------
async function renderDetail(main, planId) {
  setTitle('Work Package Detail', 'Proses & audit');
  if (!planId) { main.innerHTML = '<div class="empty-state"><h3>Plan ID tidak ditemukan</h3></div>'; return; }
  const plan = await callTool('get_plan', { plan_id: planId });
  const p = plan.plan;
  state.currentPlan = p;
  const exec = state.execution;
  const steps = ['Permintaan Diterima','Permintaan Diinterpretasi','Spesialis Ditugaskan','Work Package Disusun','Tinjauan Adversarial','Validasi Kebijakan','Persetujuan Manusia','Mandat Diterbitkan','Eksekusi Mock','Audit Dicatat'];
  main.innerHTML = `
    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header"><div class="card-title">${escapeHtml(p.intent)}</div>${badgeStatus(p.status)}</div>
      <div class="timeline">
        ${steps.map((s, i) => {
          let cls = '';
          if (i < 6) cls = 'done';
          else if (i === 6 && (p.status === 'READY' || p.status === 'NEEDS_REVIEW')) cls = 'active';
          else if (p.status === 'BLOCKED' && i >= 5) cls = 'blocked';
          return `<div class="timeline-step">
            <div class="timeline-dot ${cls}">${i+1}</div>
            <div class="timeline-content">
              <div class="timeline-title">${s}</div>
              <div class="timeline-meta">${i === 6 ? 'Menunggu persetujuan manusia' : i === 7 ? 'Setelah persetujuan' : 'Otomatis'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header"><div class="card-title">Ringkasan Penalaran AI</div></div>
      <p style="font-size:13px;color:var(--muted);">Instruksi dipecah menjadi tindakan diskret. Penerima diverifikasi. Jadwal diperiksa terhadap aturan organisasi. Tidak ada tindakan eksternal tanpa mandat.</p>
      ${p.findings?.length ? `<div class="findings" style="margin-top:var(--space-md);">${p.findings.map(f => `<div class="finding ${f.severity === 'blocking' ? 'blocking' : f.severity === 'warning' ? 'warning' : 'info'}"><div>${icon('info',16)}</div><div class="finding-msg"><strong>${escapeHtml(f.code)}</strong> — ${escapeHtml(f.message)}</div></div>`).join('')}</div>` : ''}
    </div>

    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="card-header"><div class="card-title">Eksekusi</div><div class="card-sub">Mock execution — tidak ada tindakan nyata.</div></div>
      <div id="exec-area">
        ${state.mandate ? `<button class="btn btn-primary" onclick="runExec('${state.mandate.mandate_id}','${p.actions[0]?.action_id}')">${icon('send',16)} Jalankan Eksekusi (Mock)</button>` : '<p style="font-size:13px;color:var(--muted);">Terbitkan mandat terlebih dahulu melalui Kotak Persetujuan.</p>'}
      </div>
      <div id="exec-result" style="margin-top:var(--space-md);"></div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">Mock Inbox</div><div class="card-sub">Pesan yang benar-benar terkirim (mock).</div></div>
      <div id="inbox-area">
        <div class="empty-state"><h3>Belum ada pesan</h3><p>Tidak ada yang dikirim tanpa mandat.</p></div>
      </div>
    </div>
  `;
}

window.runExec = async function(mandateId, actionId) {
  const resArea = document.getElementById('exec-result');
  const inbox = document.getElementById('inbox-area');
  try {
    const r = await callTool('execute_action', { mandate_id: mandateId, action_id: actionId, execution_key: 'exe_' + Date.now() });
    const result = r.result || r;
    const execRes = result.result || result;
    if (execRes === 'sent' || result.result === 'sent') {
      const ev = result.evidence || {};
      const mockId = ev.mock_message_id || ev.mock_event_id || ev.mock_task_id || '—';
      resArea.innerHTML = `<div style="padding:var(--space-md);background:var(--success-soft);border-radius:var(--radius-md);color:var(--success);font-size:13px;">${icon('check',16)} Eksekusi mock berhasil. ID: <span class="mono">${escapeHtml(mockId)}</span></div>`;
      inbox.innerHTML = `<div class="inbox-item"><div style="width:36px;height:36px;border-radius:var(--radius-md);background:var(--success-soft);color:var(--success);display:flex;align-items:center;justify-content:center;">${icon('send',18)}</div><div style="flex:1;"><div class="subject">Pesan terkirim (mock)</div><div class="meta">Execution ID: ${escapeHtml(result.execution_id || '—')} · ${fmtDate(result.executed_at)}</div></div><span class="badge badge-success">Terkirim</span></div>`;
      toast('Eksekusi mock berhasil.', 'success');
    } else {
      resArea.innerHTML = `<div style="padding:var(--space-md);background:var(--danger-soft);border-radius:var(--radius-md);color:var(--danger);font-size:13px;">${icon('error',16)} ${escapeHtml(result.reason_code || 'Gagal')}</div>`;
      toast('Eksekusi gagal: ' + (result.reason_code || ''), 'error');
    }
  } catch (e) {
    resArea.innerHTML = `<div style="padding:var(--space-md);background:var(--danger-soft);border-radius:var(--radius-md);color:var(--danger);font-size:13px;">${icon('error',16)} ${escapeHtml(e.message)}</div>`;
    toast('Gagal: ' + e.message, 'error');
  }
};

// ---------- Audit ----------
async function renderAudit(main) {
  setTitle('Aktivitas & Audit', 'Riwayat keputusan dan eksekusi');
  const data = await callTool('get_audit_log', { limit: 50 });
  const events = data.events || [];
  main.innerHTML = `
    <div class="card">
      <div class="card-header"><div class="card-title">Log Audit</div><div class="card-sub">${events.length} event tercatat. Append-only, tidak dapat diubah.</div></div>
      ${events.length ? `
      <div style="overflow-x:auto;">
        <table class="audit-table">
          <thead><tr><th>Waktu</th><th>Tipe</th><th>Pelaku</th><th>Subjek</th><th>Alasan</th><th>Detail</th></tr></thead>
          <tbody>
            ${events.slice().reverse().map(e => `
              <tr>
                <td class="mono">${fmtDate(e.at)}</td>
                <td><span class="badge badge-neutral">${escapeHtml(e.type)}</span></td>
                <td>${escapeHtml(e.actor)}</td>
                <td class="mono">${escapeHtml(e.plan_id || e.mandate_id || e.action_id || '—')}</td>
                <td>${e.reason_code ? `<span class="badge badge-danger">${escapeHtml(e.reason_code)}</span>` : '—'}</td>
                <td style="font-size:12px;color:var(--muted);">${escapeHtml(JSON.stringify(e.detail || {}))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="empty-state"><h3>Belum ada audit</h3><p>Event akan muncul setelah aktivitas.</p></div>'}
    </div>
  `;
}

// ---------- Mandat ----------
async function renderMandat(main) {
  setTitle('Mandat', 'Wewenang eksekusi yang telah diterbitkan');
  main.innerHTML = `<div class="card"><div class="empty-state"><h3>Daftar mandat</h3><p>Mandat muncul setelah persetujuan. Lihat detail di Work Package.</p></div></div>`;
}

// ---------- Pengaturan ----------
async function renderPengaturan(main) {
  setTitle('Pengaturan', 'Konfigurasi sistem');
  try {
    const org = await callTool('get_org_rules', { org_id: 'org_kenari' });
    const o = org;
    main.innerHTML = `
      <div class="card">
        <div class="card-header"><div class="card-title">Aturan Organisasi</div></div>
        <div class="scope-panel">
          <div class="scope-row"><div class="scope-key">Zona Waktu</div><div class="scope-val">${(o.timezones||[]).join(', ')}</div></div>
          <div class="scope-row"><div class="scope-key">Jam Kerja</div><div class="scope-val">${o.office_hours?.start} – ${o.office_hours?.end}</div></div>
          <div class="scope-row"><div class="scope-key">Salat Jumat</div><div class="scope-val">${o.friday_prayer ? o.friday_prayer.start + ' – ' + o.friday_prayer.end : 'Tidak ada'}</div></div>
          <div class="scope-row"><div class="scope-key">Hari Libur</div><div class="scope-val">${(o.holidays||[]).join(', ') || '—'}</div></div>
          <div class="scope-row"><div class="scope-key">Versi Matriks</div><div class="scope-val">${o.approval_matrix_version}</div></div>
        </div>
        <p style="font-size:12px;color:var(--muted);">Aturan bersifat read-only untuk pengguna saat ini. Hanya admin organisasi yang dapat mengubah.</p>
      </div>
    `;
  } catch (e) { main.innerHTML = `<div class="error-state"><h3>Gagal memuat</h3><p>${escapeHtml(e.message)}</p></div>`; }
}

// ---------- Init ----------
loadPlans();
renderShell();
checkConn();
setInterval(checkConn, 10000);
window.addEventListener('hashchange', route);
if (!location.hash) location.hash = '#/overview';
route();
