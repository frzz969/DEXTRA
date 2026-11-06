import { test, expect } from "@playwright/test";

const BACKEND = "http://127.0.0.1:8001";
const TOKEN = "ops-dev-token";

test.describe("Governance chain (E2E)", () => {
  test.beforeAll(async () => {
    try {
      const res = await fetch(`${BACKEND}/health`);
      if (!res.ok) throw new Error("backend not ok");
    } catch (e) {
      test.skip(true, "backend unreachable: " + (e as Error).message);
    }
  });

  test("overview renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });

  test("approvals, executions, audit, board pages render", async ({ page }) => {
    for (const path of ["/approvals", "/executions", "/audit", "/board"]) {
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
