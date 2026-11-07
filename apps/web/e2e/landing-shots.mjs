/**
 * Verifikasi halaman pengenalan publik "/" (shell pemasaran).
 *
 * Pemakaian, dari apps/web:
 *
 *   pnpm exec next dev -p 3101        (di terminal lain)
 *   node e2e/landing-shots.mjs
 *   # atau: SHOT_BASE=http://127.0.0.1:3101 node e2e/landing-shots.mjs
 *
 * Hasil:
 *   e2e/shots/landing-<lebar>.png            tangkapan layar penuh
 *   e2e/shots/landing-390-menu-terbuka.png   panel menu ponsel
 *   angka di stdout: scrollWidth/clientWidth, jumlah target < 44px,
 *   jumlah .sidebar, jumlah h1.
 *
 * Keluar dengan kode 1 kalau ada yang gagal, supaya bisa dipakai sebagai
 * gerbang. Backend TIDAK perlu hidup: halaman ini tidak membaca API.
 */
import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE ?? "http://127.0.0.1:3101";
const OUT = "./e2e/shots";

/* Lebar yang diminta brief: 320, 360, 390, 414, 768, 1024, 1440. */
const WIDTHS = [
  { w: 1440, h: 900 },
  { w: 1024, h: 900 },
  { w: 768, h: 900 },
  { w: 414, h: 900 },
  { w: 390, h: 844 },
  { w: 360, h: 800 },
  { w: 320, h: 800 }
];

const problems = [];
const fail = (message) => problems.push(message);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const response = await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
if (!response || response.status() !== 200) {
  fail(`GET / menjawab ${response ? response.status() : "tanpa respons"}`);
}
await page.locator("h1").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});

/* ---------- invarian yang tidak bergantung lebar ---------- */
const h1Count = await page.locator("h1").count();
if (h1Count !== 1) fail(`jumlah h1 = ${h1Count}, harus 1`);

const shellCount = await page.locator(".sidebar, .topbar, .tabsbar").count();
if (shellCount !== 0) fail(`shell aplikasi ada di DOM "/": ${shellCount} elemen`);

const headingLevels = await page.evaluate(() =>
  [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) => Number(el.tagName[1]))
);
for (let i = 1; i < headingLevels.length; i += 1) {
  if (headingLevels[i] - headingLevels[i - 1] > 1) {
    fail(`heading melompat dari h${headingLevels[i - 1]} ke h${headingLevels[i]}`);
  }
}

/* Setiap tautan internal harus menunjuk rute yang memang direncanakan ada.
 * /about, /team, /how-it-works, /tutorial belum dibuat, tetapi keempatnya
 * sudah ditetapkan, jadi masuk daftar yang diizinkan. */
const ALLOWED = new Set([
  "/",
  "/about",
  "/team",
  "/how-it-works",
  "/tutorial",
  "/overview",
  "/assistant",
  "/office-agent",
  "/requests",
  "/approvals",
  "/mandates",
  "/executions",
  "/audit",
  "/access",
  "/analytics",
  "/agents"
]);
const hrefs = await page.evaluate(() =>
  [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))
);
const unknown = [...new Set(hrefs)].filter((href) => !href.startsWith("#") && !ALLOWED.has(href));
if (unknown.length > 0) fail(`tautan ke rute di luar daftar: ${unknown.join(", ")}`);

const emptyHref = await page.locator('a[href=""], a[href="#"]').count();
if (emptyHref > 0) fail(`ada ${emptyHref} tautan tanpa tujuan`);

console.log(`GET / ${response ? response.status() : "-"} · h1=${h1Count} · shell=${shellCount}`);
console.log(`heading: ${headingLevels.map((n) => "h" + n).join(" ")}`);
console.log(`tautan unik: ${[...new Set(hrefs)].sort().join(", ")}`);

/* ---------- per lebar ---------- */
for (const { w, h } of WIDTHS) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("h1").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(400);

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const overflow = scrollWidth - clientWidth;

  /* Target sentuh: setiap kontrol yang benar-benar tampil harus >= 44px di
   * kedua sisi. Elemen yang display:none (mis. nav desktop di ponsel)
   * menghasilkan kotak 0x0 dan dilewati. */
  const small = await page.evaluate(() => {
    const selector =
      'a[href], button, summary, select, input, textarea, [role="button"], [role="tab"]';
    return [...document.querySelectorAll(selector)]
      .map((el) => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          cls: typeof el.className === "string" ? el.className : "",
          text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32),
          w: Math.round(box.width),
          h: Math.round(box.height),
          hidden: style.display === "none" || style.visibility === "hidden" || box.width === 0
        };
      })
      .filter((item) => !item.hidden && (item.w < 44 || item.h < 44));
  });

  const file = `${OUT}/landing-${w}.png`;
  await page.screenshot({ path: file, fullPage: true });

  console.log(
    `${w}px → scrollWidth ${scrollWidth} / clientWidth ${clientWidth} (selisih ${overflow}) · target <44px: ${small.length} · shot ${file}`
  );
  for (const item of small) {
    console.log(`   kecil: <${item.tag} class="${item.cls}"> ${item.w}x${item.h} "${item.text}"`);
  }

  if (overflow > 0) fail(`scroll horizontal di ${w}px: selisih ${overflow}px`);
  if (small.length > 0) fail(`${small.length} target < 44px di ${w}px`);
}

/* ---------- menu ponsel: buka, Escape, tutup ---------- */
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.locator("h1").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});

const trigger = page.locator(".mkt-menu-btn");
if ((await trigger.count()) !== 1) {
  fail("tombol menu ponsel tidak ada di 390px");
} else {
  const navVisible = await page.locator(".mkt-nav").isVisible();
  if (navVisible) fail("nav horizontal masih tampil di 390px");

  await trigger.click();
  await page.waitForTimeout(150);
  const expanded = await trigger.getAttribute("aria-expanded");
  if (expanded !== "true") fail(`aria-expanded setelah dibuka = ${expanded}`);
  const panelVisible = await page.locator("#mkt-menu-panel").isVisible();
  if (!panelVisible) fail("panel menu tidak tampil setelah tombol ditekan");
  await page.screenshot({ path: `${OUT}/landing-390-menu-terbuka.png`, fullPage: false });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const closed = await page.locator("#mkt-menu-panel").count();
  if (closed !== 0) fail("panel menu tidak tertutup oleh Escape");
  const expandedAfter = await trigger.getAttribute("aria-expanded");
  if (expandedAfter !== "false") fail(`aria-expanded setelah Escape = ${expandedAfter}`);
  const focusBack = await page.evaluate(() => document.activeElement?.className ?? "");
  if (!focusBack.includes("mkt-menu-btn")) fail("fokus tidak kembali ke tombol menu setelah Escape");

  console.log(`menu ponsel 390px: buka=${expanded} · panel=${panelVisible} · Escape menutup=${closed === 0} · fokus kembali=${focusBack.includes("mkt-menu-btn")}`);
}

/* ---------- keyboard: skip link & fokus pertama ---------- */
await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.keyboard.press("Tab");
const firstFocus = await page.evaluate(() => ({
  cls: document.activeElement?.className ?? "",
  text: (document.activeElement?.textContent ?? "").trim()
}));
if (!firstFocus.cls.includes("mkt-skip")) {
  fail(`Tab pertama tidak mendarat di tautan lompat: "${firstFocus.cls}" "${firstFocus.text}"`);
}
console.log(`Tab pertama: .${firstFocus.cls} "${firstFocus.text}"`);

await browser.close();

if (problems.length > 0) {
  console.error("\nGAGAL:");
  for (const problem of problems) console.error(` - ${problem}`);
  process.exit(1);
}
console.log("\nSEMUA PEMERIKSAAN LULUS");
