#!/usr/bin/env node
/**
 * Uji ujung-ke-ujung dashboard, tanpa dependensi.
 *
 * Kenapa ada: commit beba8ec menulis literal `\n` di `core.js`, sehingga seluruh
 * dashboard gagal dimuat — layar kosong. `npm run test:all` tetap hijau karena
 * tidak ada pemeriksaan yang benar-benar MENJALANKAN halaman. `check-syntax.mjs`
 * menutup kasus itu, tetapi ia hanya mem-parse: berkas yang sintaksnya benar
 * masih bisa gagal saat dijalankan (ReferensiError, DOM yang tidak ada, API yang
 * berubah bentuk).
 *
 * Karena itu skrip ini membuka dashboard sungguhan di Chrome, memeriksa setiap
 * rute, dan gagal bila ada galat runtime atau layar kosong.
 *
 * Tanpa dependensi: `npm i` di repo ini gagal di Windows karena symlink
 * workspace `@dextra/*` (EISDIR), jadi Playwright tidak bisa dipasang. Chrome
 * dikendalikan lewat Chrome DevTools Protocol memakai `WebSocket` bawaan Node —
 * tidak ada paket yang perlu diunduh, dan Chrome yang dipakai adalah Chrome yang
 * sudah terpasang di mesin.
 *
 *   npm run test:e2e
 *
 * Variabel lingkungan:
 *   DEXTRA_CHROME   path Chrome/Chromium (kalau tidak ada di lokasi umum)
 *   DEXTRA_E2E_PORT port dashboard (default 8899)
 */
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const MCP_PORT = 8765;
const DASH_PORT = Number(process.env.DEXTRA_E2E_PORT || 8899);
const CDP_PORT = 9333;
const TOKEN = 'ops-dev-token';

/* Rute yang wajib merender isi. Rute `none` (login/forbidden/not-found) memang
   boleh pendek, jadi tidak masuk daftar ini. */
const ROUTES = [
  '/overview', '/requests', '/my-work', '/board', '/work-packages',
  '/execution', '/workforce', '/approvals', '/review', '/mandates',
  '/audit', '/policies', '/permissions', '/settings', '/assistant', '/integrations',
  '/analytics',
];

const CHROME_CANDIDATES = [
  process.env.DEXTRA_CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  for (const path of CHROME_CANDIDATES) {
    if (path && existsSync(path)) return path;
  }
  return null;
}

async function probe(url, timeoutMs = 400) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitFor(label, url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe(url)) return true;
    await sleep(250);
  }
  throw new Error(`${label} tidak siap dalam ${timeoutMs} ms (${url})`);
}

/** Klien CDP minimal: cukup untuk navigate, evaluate, dan menangkap galat. */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.consoleErrors = [];
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined) {
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        this.pending.delete(msg.id);
        if (msg.error) entry.reject(new Error(msg.error.message));
        else entry.resolve(msg.result);
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        this.exceptions.push((d.exception && d.exception.description) || d.text || 'exception');
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200));
      }
    });
  }

  static connect(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.addEventListener('open', () => resolve(new Cdp(ws)));
      ws.addEventListener('error', () => reject(new Error('gagal membuka WebSocket CDP')));
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`evaluate gagal: ${res.exceptionDetails.text}`);
    }
    return res.result.value;
  }

  reset() {
    this.exceptions = [];
    this.consoleErrors = [];
  }

  close() {
    try { this.ws.close(); } catch { /* sudah tertutup */ }
  }
}

const children = [];
function track(child) {
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    try { child.kill('SIGKILL'); } catch { /* sudah mati */ }
  }
}

async function main() {
  const chrome = findChrome();
  if (!chrome) {
    console.log('LEWATI: Chrome/Chromium tidak ditemukan.');
    console.log('Set DEXTRA_CHROME ke path browser, lalu jalankan lagi. Uji ini tidak dijalankan di CI.');
    return 0;
  }

  /*
   * Uji ini memiliki servernya sendiri, dan datanya sendiri.
   *
   * Sebelumnya server pengembangan yang sedang jalan dipakai ulang. Dua akibat:
   * setiap kali uji dijalankan, `data/plans.json` dan kawan-kawan ikut berubah —
   * jadi commit membawa `plan_e2e_*` palsu dan `git status` selamanya kotor; dan
   * ketika dua proses menulis berkas yang sama, uji gagal dengan
   * "EPERM ... plans.json.tmp" yang tidak ada hubungannya dengan kode.
   *
   * Data disalin ke direktori sementara lewat DEXTRA_DATA_DIR, sehingga uji tidak
   * pernah menyentuh `data/` di repo. Port yang sudah terpakai dilaporkan
   * terang-terangan: memakai server asing berarti menguji kode yang belum tentu
   * yang sedang diubah.
   */
  if (await probe(`http://127.0.0.1:${MCP_PORT}/health`)) {
    console.error(`GAGAL: port ${MCP_PORT} sudah dipakai. Hentikan server MCP lain dulu — uji ini menjalankan servernya sendiri.`);
    return 1;
  }
  if (await probe(`http://127.0.0.1:${DASH_PORT}/`)) {
    console.error(`GAGAL: port ${DASH_PORT} sudah dipakai. Hentikan dashboard lain dulu.`);
    return 1;
  }

  const dataDir = mkdtempSync(join(tmpdir(), 'dextra-e2e-data-'));
  for (const name of readdirSync(join(ROOT, 'data'))) {
    const src = join(ROOT, 'data', name);
    if (statSync(src).isFile()) copyFileSync(src, join(dataDir, name));
  }

  const spawned = [];
  spawned.push(track(spawn(process.execPath, ['--experimental-strip-types', 'apps/mcp-server/src/index.ts'], {
    cwd: ROOT, stdio: 'ignore', env: { ...process.env, DEXTRA_DATA_DIR: dataDir },
  })));
  spawned.push(track(spawn(process.execPath, ['scripts/serve-dashboard.mjs'], {
    cwd: ROOT, stdio: 'ignore', env: { ...process.env, DEXTRA_DASHBOARD_PORT: String(DASH_PORT) },
  })));
  await waitFor('server MCP', `http://127.0.0.1:${MCP_PORT}/health`);
  await waitFor('dashboard', `http://127.0.0.1:${DASH_PORT}/`);
  console.log(`ok     server siap (MCP ${MCP_PORT}, dashboard ${DASH_PORT})`);

  const profile = mkdtempSync(join(tmpdir(), 'dextra-e2e-'));
  track(spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${CDP_PORT}`,
    'about:blank',
  ], { stdio: 'ignore' }));

  let cdp = null;
  const failures = [];
  try {
    await waitFor('Chrome CDP', `http://127.0.0.1:${CDP_PORT}/json/version`);
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('Chrome tidak membuka target halaman');
    cdp = await Cdp.connect(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    /* Token ditanam sebelum aplikasi boot, supaya sesi langsung mode live.
       Mengubah hash TIDAK memuat ulang halaman, jadi reload harus eksplisit —
       tanpa itu seluruh uji berjalan di mode demo dan tetap hijau. */
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${DASH_PORT}/` });
    await sleep(1200);
    await cdp.evaluate(`sessionStorage.setItem('dextra_ops_token', ${JSON.stringify(TOKEN)}); 'ok'`);
    await cdp.send('Page.reload', { ignoreCache: true });
    await sleep(2500);

    const booted = await cdp.evaluate(`(function () {
      var root = document.getElementById('view-root');
      return {
        rootLength: root ? root.textContent.trim().length : -1,
        hasNav: !!document.querySelector('.sidebar, nav'),
        chip: (document.querySelector('.user-chip__meta b, .user-chip b') || {}).textContent || null,
        mode: window.DEXTRA && window.DEXTRA.store ? window.DEXTRA.store.mode : null,
        principal: window.DEXTRA && window.DEXTRA.session ? window.DEXTRA.session.principal : null
      };
    })()`);

    if (booted.mode !== 'live') {
      failures.push(`sesi tidak masuk mode live (mode = "${booted.mode}"). Uji di mode demo tidak membuktikan backend terpakai.`);
    }
    if (booted.rootLength < 200) {
      failures.push(`dashboard tidak boot: #view-root hanya ${booted.rootLength} karakter (layar kosong). Cek galat parse di console.`);
    }
    if (!booted.hasNav) failures.push('navigasi tidak dirender');
    if (!booted.principal) {
      failures.push(`server tidak mengikat principal ke token ops (principal = ${JSON.stringify(booted.principal)})`);
    }
    if (!booted.chip || /^Token /.test(booted.chip) || booted.chip === 'Farhan Pratama') {
      failures.push(`chip pengguna menampilkan "${booted.chip}" — bukan principal yang dinyatakan server`);
    }
    console.log(`ok     boot: mode ${booted.mode}, #view-root ${booted.rootLength} karakter, chip "${booted.chip}"`);

    for (const route of ROUTES) {
      cdp.reset();
      await cdp.evaluate(`location.hash = ${JSON.stringify('#' + route)}; 'ok'`);
      await sleep(900);
      const info = await cdp.evaluate(`(function () {
        var root = document.getElementById('view-root');
        return { len: root ? root.textContent.replace(/\\s+/g, ' ').trim().length : -1 };
      })()`);

      const problems = [];
      if (info.len < 120) problems.push(`isi ${info.len} karakter (layar kosong)`);
      if (cdp.exceptions.length) problems.push(`exception: ${cdp.exceptions[0]}`);
      if (cdp.consoleErrors.length) problems.push(`console error: ${cdp.consoleErrors[0]}`);

      if (problems.length) {
        failures.push(`${route}: ${problems.join('; ')}`);
        console.log(`gagal  ${route}`);
      } else {
        console.log(`ok     ${route} (${info.len} karakter)`);
      }
    }

    /*
     * Regresi A1 diperiksa SETELAH rantai tata kelola, bukan sebelum: data seed
     * `data/plans.json` kosong, jadi papan sebelum ada plan selalu 0 kartu dan
     * pemeriksaan atribusi menjadi hampa — hijau tanpa pernah memeriksa satu
     * kartu pun. Setelah rantai berjalan minimal ada satu kartu nyata.
     */

    /*
     * Rantai tata kelola: create -> approve -> mandate -> execute.
     *
     * Dijalankan lewat klien yang dipakai aplikasi (`DEXTRA.api`), bukan curl,
     * supaya yang diuji adalah jalur yang benar-benar dilalui pengguna. Setelah
     * itu UI harus mencerminkan hasilnya — server yang bekerja tetapi layar yang
     * tidak berubah tetap kegagalan.
     */
    cdp.reset();
    const chain = await cdp.evaluate(`(async function () {
      var api = window.DEXTRA.api;
      var stamp = Date.now().toString(36);
      try {
        var created = await api.call('create_plan', {
          org_id: 'org_kenari',
          request_id: 'req_e2e_' + stamp,
          intent: 'E2E: kirim ringkasan ke Budi',
          actions: [{
            action_type: 'send_email',
            target: { contact_id: 'c_budi_fin', display_name: 'Budi Santoso', channel: 'email', masked_address: 'b***@kenari.co.id' },
            schedule: { start_at: '2026-11-05T09:00:00+07:00', timezone: 'Asia/Jakarta', all_day: false },
            content: { subject: 'E2E', body: 'E2E body', locale: 'id-ID' }
          }]
        });
        var plan = created.plan;
        var appr = await api.call('submit_approval', {
          plan_id: plan.plan_id,
          plan_hash: plan.plan_hash,
          decision: 'approve',
          approval_token: 'apt_e2e_' + stamp
        });
        var exec = await api.call('execute_action', {
          mandate_id: appr.mandate_id,
          action_id: plan.actions[0].action_id,
          execution_key: 'ek_e2e_' + stamp
        });
        return { planId: plan.plan_id, planStatus: plan.status, mandateId: appr.mandate_id, result: exec.result.result, reason: exec.result.reason_code || null };
      } catch (e) {
        return { error: (e && e.message) || String(e) };
      }
    })()`);

    if (chain.error) {
      failures.push(`rantai tata kelola gagal: ${chain.error}`);
      console.log('gagal  rantai create -> approve -> execute');
    } else {
      if (chain.result !== 'sent') {
        failures.push(`rantai tata kelola: hasil eksekusi "${chain.result}" (${chain.reason || 'tanpa alasan'}), bukan "sent"`);
      }
      console.log(`ok     rantai: ${chain.planId} -> ${chain.mandateId} -> ${chain.result}`);

      /* Audit harus mencatat eksekusi, bukan hanya menerima permintaan. */
      cdp.reset();
      await cdp.evaluate(`location.hash = '#/audit'; 'ok'`);
      await sleep(1200);
      const audit = await cdp.evaluate(`(function () {
        var root = document.getElementById('view-root');
        var text = root ? root.textContent : '';
        return { hasPlan: text.indexOf(${JSON.stringify(chain.planId)}) >= 0, len: text.replace(/\\s+/g, ' ').trim().length };
      })()`);
      if (!audit.hasPlan) {
        failures.push(`/audit tidak menampilkan plan ${chain.planId} yang baru dieksekusi`);
      }
      console.log(`ok     /audit memuat ${chain.planId}: ${audit.hasPlan}`);

      /* Halaman eksekusi harus menyatakan hasil yang sama dengan server. */
      cdp.reset();
      await cdp.evaluate(`location.hash = '#/execution'; 'ok'`);
      await sleep(1200);
      const execView = await cdp.evaluate(`(function () {
        var root = document.getElementById('view-root');
        return root ? root.textContent.replace(/\\s+/g, ' ').trim() : '';
      })()`);
      if (!/terkirim|sent/i.test(execView)) {
        failures.push('/execution tidak menampilkan hasil eksekusi yang berhasil');
      }
      console.log(`ok     /execution mencerminkan hasil eksekusi`);

      /*
       * Regresi A1: kartu tidak boleh diatribusikan ke agen yang tidak ada.
       * Plan yang baru dibuat tidak punya assignee_id, jadi kartunya wajib
       * menyatakan "tanpa penugasan" — bukan nama agen yang tidak pernah
       * disentuh server.
       */
      cdp.reset();
      await cdp.evaluate(`location.hash = '#/board'; 'ok'`);
      await sleep(1200);
      const board = await cdp.evaluate(`(function () {
        var cards = Array.from(document.querySelectorAll('.kcard'));
        return {
          count: cards.length,
          fabricated: cards.filter(function (c) { return /Workforce Dispatcher/.test(c.textContent); }).length,
          hasPlan: cards.some(function (c) { return c.textContent.indexOf(${JSON.stringify(chain.planId)}) >= 0; }),
          unassigned: cards.filter(function (c) { return /tanpa penugasan/i.test(c.textContent); }).length
        };
      })()`);
      if (board.count < 1) {
        failures.push('/board: 0 kartu padahal server punya plan — papan tidak mencerminkan data');
      }
      if (!board.hasPlan) {
        failures.push(`/board tidak memuat plan ${chain.planId} yang baru dibuat`);
      }
      if (board.fabricated > 0) {
        failures.push(`/board: ${board.fabricated} kartu berlabel "Workforce Dispatcher" — atribusi yang tidak ada di data`);
      }
      console.log(`ok     /board: ${board.count} kartu, ${board.unassigned} "tanpa penugasan", ${board.fabricated} atribusi karangan`);

      /*
       * /analytics harus menampilkan angka dari server, dan harus menandai apa
       * yang BELUM terukur. Adapter yang berjalan tidak memanggil model, jadi
       * token dan biaya wajib kosong — kalau halaman mengaku mengukurnya, itu
       * angka karangan dan tes ini yang menangkapnya.
       */
      cdp.reset();
      await cdp.evaluate(`location.hash = '#/analytics'; 'ok'`);
      await sleep(1200);
      const analytics = await cdp.evaluate(`(function () {
        var root = document.getElementById('view-root');
        var text = root ? root.textContent.replace(/\\s+/g, ' ') : '';
        return {
          text: text.slice(0, 400),
          hasUnmeasured: /tidak diukur/i.test(text),
          summary: window.DEXTRA.store.executionSummary
        };
      })()`);
      if (!analytics.summary) {
        failures.push('/analytics: ringkasan eksekusi tidak diterima dari server');
      } else {
        if (analytics.summary.total < 1) {
          failures.push('/analytics: total 0 padahal baru ada eksekusi');
        }
        if (analytics.summary.tokens.measured !== 0) {
          failures.push(`/analytics: ${analytics.summary.tokens.measured} baris mengaku mengukur token, padahal adapter tiruan tidak memanggil model`);
        }
        if (analytics.summary.latency.measured < 1) {
          failures.push('/analytics: latensi tidak terukur padahal executor wajib mengukurnya');
        }
      }
      if (!analytics.hasUnmeasured) {
        failures.push('/analytics: tidak menandai angka yang belum terukur (token/biaya tampil seolah hasil)');
      }
      console.log(`ok     /analytics: total ${analytics.summary ? analytics.summary.total : '?'}, latensi terukur ${analytics.summary ? analytics.summary.latency.measured : '?'}, token terukur ${analytics.summary ? analytics.summary.tokens.measured : '?'}`);
    }

    /*
     * Izin: token `agent` tidak memegang kapabilitas keputusan. Menu yang
     * membutuhkannya harus tampil nonaktif, bukan menghilang tanpa penjelasan —
     * dan tidak boleh ada satu pun halaman keputusan yang tetap terbuka.
     */
    await cdp.evaluate(`sessionStorage.setItem('dextra_ops_token', 'agent-dev-token'); 'ok'`);
    await cdp.send('Page.reload', { ignoreCache: true });
    await sleep(2400);
    const agentView = await cdp.evaluate(`(function () {
      var denied = Array.from(document.querySelectorAll('[data-denied]')).map(function (b) { return b.getAttribute('data-denied'); });
      return {
        mode: window.DEXTRA.store.mode,
        scope: window.DEXTRA.session.scope,
        principal: window.DEXTRA.session.principal,
        denied: denied
      };
    })()`);
    if (agentView.mode !== 'live') failures.push(`token agent tidak masuk mode live (mode "${agentView.mode}")`);
    if (agentView.scope !== 'agent') failures.push(`token agent dilaporkan sebagai scope "${agentView.scope}"`);
    if (agentView.principal !== null) failures.push('token agent tidak punya principal, tetapi UI mengaku punya');
    if (!agentView.denied.length) failures.push('token agent tidak menonaktifkan satu pun menu keputusan');
    console.log(`ok     izin agent: scope ${agentView.scope}, principal null, ${agentView.denied.length} menu nonaktif`);

    /* Kembali ke ops untuk uji error state. */
    await cdp.evaluate(`sessionStorage.setItem('dextra_ops_token', ${JSON.stringify(TOKEN)}); 'ok'`);
    await cdp.send('Page.reload', { ignoreCache: true });
    await sleep(2400);

    cdp.reset();
    await cdp.evaluate(`location.hash = '#/rute-yang-tidak-ada'; 'ok'`);
    await sleep(900);
    const notFound = await cdp.evaluate(`(function () {
      var root = document.getElementById('view-root');
      return root ? root.textContent.replace(/\\s+/g, ' ').trim().slice(0, 140) : '';
    })()`);
    if (!/tidak ditemukan|not found/i.test(notFound)) {
      failures.push(`rute tak dikenal tidak menampilkan halaman not-found (isi: "${notFound}")`);
    }
    if (cdp.exceptions.length) {
      failures.push(`rute tak dikenal melempar exception: ${cdp.exceptions[0]}`);
    }
    console.log('ok     error state: rute tak dikenal -> halaman not-found');
  } finally {
    if (cdp) cdp.close();
    shutdown();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows kadang menahan berkas */ }
    try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* idem: proses server baru saja dimatikan */ }
  }

  if (failures.length) {
    console.error(`\n${failures.length} kegagalan:`);
    for (const f of failures) console.error(`  - ${f}`);
    return 1;
  }
  console.log(`\nSemua ${ROUTES.length} rute dirender tanpa galat runtime.`);
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(`\nGAGAL: ${err.message}`);
  shutdown();
  process.exit(1);
});
