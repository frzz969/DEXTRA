import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const SHOT = "./e2e/screenshots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const shots = [
  ["flow-login.png", "/login"],
  ["flow-requests.png", "/requests"],
  ["flow-approvals.png", "/approvals"],
  ["flow-mandates.png", "/mandates"],
  ["flow-executions.png", "/executions"],
  ["flow-audit.png", "/audit"],
];
for (const [name, path] of shots) {
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 }).catch(() => page.goto(BASE + path));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOT}/${name}` });
  console.log("shot", name);
}

// Assistant live chat
await page.goto(BASE + "/assistant", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
await page.waitForTimeout(2000);
const banner = await page.locator("text=AI belum dikonfigurasi").count();
console.log("assistant AI banner count =", banner);
const box = page.locator("#assistant-composer");
await box.fill("Ringkas langkah persetujuan pengadaan dalam 3 bullet.");
await page.locator("button[type=submit]").last().click();
await page.waitForTimeout(25000);
const replyText = await page.locator("[role=log]").innerText().catch(() => "NO-LOG");
console.log("REPLY:", replyText.slice(0, 600));
await page.screenshot({ path: `${SHOT}/flow-assistant.png` });
await browser.close();
