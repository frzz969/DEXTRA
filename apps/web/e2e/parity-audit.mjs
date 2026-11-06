// Parity audit: apps/web (Next.js :3000) vs statis apps/dashboard (:8900)
// Jalankan: node e2e/parity-audit.mjs  (dari apps/web)
// Hasil: screenshots/*.png + parity-report.json
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const SHOT = new URL("./screenshots/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
mkdirSync(SHOT, { recursive: true });

const WEB_ROUTES = ["/","/board","/approvals","/audit","/agents","/executions","/analytics","/explorer","/skills","/workflows","/requests","/my-work","/review","/integrations","/service-identities","/settings","/assistant","/office-agent","/tokens","/access","/mandates","/policies","/security","/work-packages","/data-management","/monitoring"];
const STATIC_HASH = ["/overview","/assistant","/office-agent","/requests","/my-work","/work-packages","/board","/execution","/workforce","/analytics","/explorer","/skills","/workflow","/approvals","/review","/mandates","/security","/audit","/policies","/permissions","/integrations","/data-management","/access","/tokens","/service-identities","/settings"];

async function auditPage(job, url, slug) {
  const { page } = job;
  const errors = [], failedReq = [];
  const onErr = e => errors.push(String(e).slice(0, 200));
  const onFail = r => { const u = r.url(); if (u.includes("8000")||u.includes("8001")||u.includes("8765")) failedReq.push(`${r.method()} ${u.slice(0,140)} :: ${r.failure()?.errorText||"?"}`); };
  page.on("pageerror", onErr); page.on("requestfailed", onFail);
  let status = "?", title = "";
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    status = resp?.status() ?? "?";
    await page.waitForTimeout(2500);
    title = await page.title().catch(() => "");
    await page.screenshot({ path: `${SHOT}${slug}.png`, fullPage: false });
  } catch (e) { errors.push("NAV: " + String(e).slice(0, 200)); }
  const body = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) || "").catch(() => "");
  const buttons = await page.evaluate(() => [...document.querySelectorAll("button,a")].slice(0,40).map(el => (el.innerText||el.textContent||"").trim().slice(0,40)).filter(Boolean)).catch(() => []);
  page.off("pageerror", onErr); page.off("requestfailed", onFail);
  return { url, status, title, errors, failedReq: failedReq.slice(0,5),
    banner: /belum|not connected|offline|unavailable|tidak terhubung/i.test(body) ? body.match(/.{0,60}(belum|not connected|offline|unavailable|tidak terhubung).{0,60}/i)?.[0] : null,
    hasData: !/tidak ada data|no data|empty|kosong/i.test(body.slice(0,500)) || body.length > 800,
    textLen: body.length, buttons: buttons.slice(0,15), textHead: body.replace(/\n+/g," | ").slice(0,300) };
}

const browser = await chromium.launch();
const job = { page: await browser.newPage({ viewport: { width: 1440, height: 900 } }) };
const report = { date: new Date().toISOString(), web: [], static: [], interactions: [] };

// Web: sapu semua route
for (const r of WEB_ROUTES) {
  const slug = "web-" + (r === "/" ? "home" : r.slice(1).replace(/\//g, "-"));
  report.web.push({ route: r, ...(await auditPage(job, `http://localhost:3000${r}`, slug)) });
}
// Interaksi aman: klik tombol pertama yang terlihat di home + approvals (tanpa submit destruktif)
for (const r of ["/", "/approvals", "/board"]) {
  await job.page.goto(`http://localhost:3000${r}`, { waitUntil: "domcontentloaded" }).catch(()=>{});
  await job.page.waitForTimeout(1500);
  const btns = job.page.locator("button");
  const n = await btns.count();
  let clicked = null;
  for (let i = 0; i < Math.min(n, 8); i++) {
    const t = (await btns.nth(i).innerText().catch(() => "")).trim();
    if (/^(setujui|tolak|hapus|submit|kirim|buat|publish|eksekusi)/i.test(t)) continue; // hindari aksi destruktif
    if (t) { clicked = t.slice(0,40); await btns.nth(i).click().catch(()=>{}); break; }
  }
  await job.page.waitForTimeout(1200);
  await job.page.screenshot({ path: `${SHOT}web-interact-${r==="/"?"home":r.slice(1)}.png` });
  report.interactions.push({ route: r, clicked, urlAfter: job.page.url() });
}
// Statis: hash routes
for (const r of STATIC_HASH) {
  const slug = "static-" + r.slice(1).replace(/\//g, "-");
  report.static.push({ route: r, ...(await auditPage(job, `http://127.0.0.1:8900/index.html#${r}`, slug)) });
}
await browser.close();
writeFileSync(`${SHOT}../parity-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ web: report.web.map(x=>[x.route,x.status,x.errors.length,x.failedReq.length]), static: report.static.map(x=>[x.route,x.status,x.errors.length]), interactions: report.interactions }, null, 2));
