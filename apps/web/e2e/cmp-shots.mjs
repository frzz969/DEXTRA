import { chromium } from '@playwright/test';
import fs from 'node:fs';
const out = 'e2e/screenshots';
fs.mkdirSync(out, { recursive: true });
const pages = [
  ['home','/'], ['login','/login'], ['requests','/requests'], ['approvals','/approvals'],
  ['assistant','/assistant'], ['audit','/audit'], ['board','/board'], ['executions','/executions'],
  ['settings','/settings'], ['account','/account'],
];
const staticMap = { home:'#/overview', login:'#/login', requests:'#/requests', approvals:'#/approvals', assistant:'#/assistant', audit:'#/audit', board:'#/board', executions:'#/execution', settings:'#/settings', account:'#/account' };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
for (const [name, path] of pages) {
  await p.goto('http://localhost:3000'+path, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/cmp-web-${name}.png` });
  console.log('web', name, await p.title());
}
for (const [name] of pages) {
  await p.goto('http://127.0.0.1:8900/index.html'+staticMap[name], { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/cmp-static-${name}.png` });
  console.log('static', name, await p.title());
}
// account dropdown on web (after fix) + static menu
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' }).catch(()=>{});
await p.waitForTimeout(500);
try { await p.click('[data-user-menu]', { timeout: 3000 }); await p.waitForTimeout(500); } catch(e){ console.log('web user-menu click fail', e.message); }
await p.screenshot({ path: `${out}/cmp-web-usermenu.png` });
await p.goto('http://127.0.0.1:8900/index.html#/overview', { waitUntil: 'networkidle' }).catch(()=>{});
await p.waitForTimeout(800);
try { await p.click('.sidebar__foot [data-user-menu]', { timeout: 3000 }); await p.waitForTimeout(500); } catch(e){ console.log('static user-menu click fail', e.message); }
await p.screenshot({ path: `${out}/cmp-static-usermenu.png` });
await browser.close();
console.log('done');
