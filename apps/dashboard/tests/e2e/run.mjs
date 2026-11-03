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
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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

  /* Server yang sudah jalan dipakai ulang; yang belum, dinyalakan sendiri lalu
     dimatikan lagi. Tanpa ini, `npm run test:e2e` akan bertabrakan dengan sesi
     pengembangan yang sedang terbuka. */
  const spawned = [];
  if (!(await probe(`http://127.0.0.1:${MCP_PORT}/health`))) {
    spawned.push(track(spawn(process.execPath, ['--experimental-strip-types', 'apps/mcp-server/src/index.ts'], {
      cwd: ROOT, stdio: 'ignore',
    })));
  }
  if (!(await probe(`http://127.0.0.1:${DASH_PORT}/`))) {
    spawned.push(track(spawn(process.execPath, ['scripts/serve-dashboard.mjs'], {
      cwd: ROOT, stdio: 'ignore', env: { ...process.env, DEXTRA_DASHBOARD_PORT: String(DASH_PORT) },
    })));
  }
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

    /* Regresi A1: kartu tidak boleh diatribusikan ke agen yang tidak ada. */
    cdp.reset();
    await cdp.evaluate(`location.hash = '#/board'; 'ok'`);
    await sleep(900);
    const board = await cdp.evaluate(`(function () {
      var cards = Array.from(document.querySelectorAll('.kcard'));
      return {
        count: cards.length,
        fabricated: cards.filter(function (c) { return /Workforce Dispatcher/.test(c.textContent); }).length
      };
    })()`);
    if (board.fabricated > 0) {
      failures.push(`/board: ${board.fabricated} kartu berlabel "Workforce Dispatcher" — atribusi yang tidak ada di data`);
    }
    console.log(`ok     /board: ${board.count} kartu, ${board.fabricated} atribusi karangan`);
  } finally {
    if (cdp) cdp.close();
    shutdown();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows kadang menahan berkas */ }
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
