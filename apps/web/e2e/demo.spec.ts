import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const PAGES: Array<[string, string]> = [
  ["requests", "/requests"],
  ["review", "/review"],
  ["approvals", "/approvals"],
  ["executions", "/executions"],
  ["audit", "/audit"],
  ["overview", "/"],
];

test("demo screenshots (pln_demo_20261106121723)", async ({ page }) => {
  const outDir = path.join(__dirname, "screenshots");
  fs.mkdirSync(outDir, { recursive: true });
  const report: Record<string, unknown> = {};
  for (const [name, route] of PAGES) {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    const file = path.join(outDir, `demo-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const text = await page.evaluate(
      () => document.body?.innerText?.slice(0, 6000) ?? ""
    );
    report[name] = {
      url: page.url(),
      file,
      bytes: fs.statSync(file).size,
      text,
    };
  }
  fs.writeFileSync(
    path.join(outDir, "demo-report.json"),
    JSON.stringify(report, null, 2)
  );
});
