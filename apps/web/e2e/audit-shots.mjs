import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = "http://127.0.0.1:3000";
const OUT = "e2e/shots";
mkdirSync(OUT, { recursive: true });

const PLAN = "pln_demo_20261106121723";

const pages = [
  ["overview", "/"],
  ["work-packages", "/work-packages"],
  ["office-agent-plan", `/office-agent/${PLAN}`],
  ["review-plan", `/review/${PLAN}`],
  ["agents", "/agents"],
  ["approvals", "/approvals"],
  ["mandates", "/mandates"],
  ["audit", "/audit"],
  ["security", "/security"],
  ["settings", "/settings"],
  ["account", "/account"],
  ["permissions", "/permissions"],
  ["integrations", "/integrations"],
  ["forbidden", "/forbidden?need=manage_integrations"],
  ["unavailable", "/unavailable?reason=Connection%20refused"],
  ["not-found", "/definitely-not-a-page"],
];

const browser = await chromium.launch();
const results = [];

// Desktop
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
for (const [name, path] of pages) {
  try {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    results.push(`${name.padEnd(20)} ${res?.status()}  h1="${h1.trim().slice(0, 46)}"`);
  } catch (e) {
    results.push(`${name.padEnd(20)} FAIL ${e.message.slice(0, 70)}`);
  }
}
await ctx.close();

// Mobile spot-check
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const mpage = await mctx.newPage();
for (const [name, path] of [["overview", "/"], ["office-agent-plan", `/office-agent/${PLAN}`], ["work-packages", "/work-packages"]]) {
  try {
    await mpage.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await mpage.waitForTimeout(400);
    await mpage.screenshot({ path: `${OUT}/m-${name}.png`, fullPage: true });
    const overflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const audit = await mpage.evaluate(() => {
      const sel = ".btn, .icon-btn, .chip, .menu-btn, .copilot-trigger";
      const small = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 44) small.push(`${el.className.split(" ")[0]}:${Math.round(r.height)}px`);
      }
      const fab = document.querySelector(".copilot-fab");
      let fabHits = 0;
      if (fab) {
        const f = fab.getBoundingClientRect();
        for (const el of document.querySelectorAll(".btn, .input, .select, a")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0) continue;
          const hit = !(r.right < f.left || r.left > f.right || r.bottom < f.top || r.top > f.bottom);
          if (hit) fabHits++;
        }
      }
      return { small: [...new Set(small)].slice(0, 8), smallCount: small.length, fabHits };
    });
    results.push(
      `m-${name.padEnd(18)} overflow-x=${overflow}px smallTargets=${audit.smallCount} ${audit.small.join(",") || ""} fabOverlaps=${audit.fabHits}`
    );
  } catch (e) {
    results.push(`m-${name.padEnd(18)} FAIL ${e.message.slice(0, 70)}`);
  }
}
await mctx.close();

await browser.close();
console.log(results.join("\n"));
