/**
 * Tangkapan layar halaman agen untuk bukti visual.
 *
 * Pemakaian (butuh dev/prod server Next yang sudah jalan di :3000 dan API
 * :8000 hidup, kalau API mati yang tertangkap adalah banner "tidak tersedia"
 * apa adanya — itu juga bukti yang sah):
 *
 *   cd apps/web && node e2e/agents-shots.mjs
 *
 * Hasil: e2e/screenshots/agents-1280.png, agents-390.png,
 *        agent-detail-1280.png, agent-detail-390.png
 * Plus angka overflow horizontal per halaman (harus <= 1 px).
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const SHOT = "./e2e/screenshots";
const VIEWPORTS = [
  { width: 1280, height: 900, tag: "1280" },
  { width: 390, height: 844, tag: "390" }
];

async function open(page, path) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await open(page, "/agents");
const heading = (await page.locator("h1").first().innerText().catch(() => "")).trim();
const cardCount = await page.locator(".grid--3 .spec-card").count();
const unavailable = await page.locator(".banner--warning").count();
const firstCard = page.locator('a[href^="/agents/"]').first();
const detailPath = (await firstCard.count()) > 0 ? await firstCard.getAttribute("href") : null;
const slugPath = detailPath ?? "/agents/workforce-dispatcher";
console.log(`/agents h1="${heading}" kartu=${cardCount} banner_peringatan=${unavailable}`);
console.log(`detail yang dipakai: ${slugPath}`);

for (const viewport of VIEWPORTS) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  for (const [name, path] of [
    ["agents", "/agents"],
    ["agent-detail", slugPath]
  ]) {
    await open(page, path);
    const file = `${SHOT}/${name}-${viewport.tag}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    console.log(`shot ${file} overflow=${overflow}`);
  }
}

await browser.close();
