import { test, expect } from "@playwright/test";

/*
 * P4 polish smoke — transversal saja, tidak menguji logika P1-P3.
 * Semua halaman harus render tanpa pageerror fatal baik saat backend
 * :8000 hidup maupun mati (halaman menampilkan banner jujur, bukan
 * angka contoh). Screenshot disimpan di test-results/p4/.
 */

const ROUTES = [
  { path: "/", heading: /Selamat (pagi|siang|sore|malam)/ },
  { path: "/board", heading: "Papan Tugas" },
  { path: "/approvals", heading: "Approval Inbox" },
  { path: "/audit", heading: "Audit Center" },
  { path: "/agents", heading: "Workforce" },
] as const;

for (const route of ROUTES) {
  test(`P4 smoke ${route.path}: render tanpa error fatal`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    await expect(page.locator("body")).toBeVisible();
    expect(errors, `pageerror di ${route.path}: ${errors.join("; ")}`).toEqual([]);
  });

  test(`P4 smoke ${route.path}: screenshot desktop + mobile`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    const slug = route.path === "/" ? "overview" : route.path.slice(1);
    await page.screenshot({ path: `test-results/p4/${slug}-desktop.png`, fullPage: false });

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    await page.screenshot({ path: `test-results/p4/${slug}-mobile360.png`, fullPage: false });
  });
}

test("P4 dark toggle: persist localStorage + stabil setelah reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  // Tunggu hidrasi React (efek Topbar menandai <html data-theme>)
  // sebelum berinteraksi — klik sebelum hidrasi tidak berpengaruh.
  await page.waitForFunction(() => document.documentElement.dataset.theme !== undefined, { timeout: 15_000 });
  const toggle = page.getByRole("button", { name: /mode (terang|gelap)/i });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-pressed", /(true|false)/);

  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).toBe(before === "dark" ? "light" : "dark");
  await expect(page.evaluate(() => localStorage.getItem("dextra-theme"))).resolves.toBe(after);

  // aria-live mengumumkan tema baru
  await expect(page.getByRole("status").last()).toContainText(/Tema (gelap|terang) aktif/);

  await page.reload();
  // tunggu hidrasi + efek Topbar selesai sebelum membaca atribut tema
  await expect(page.getByRole("button", { name: /mode (terang|gelap)/i })).toBeVisible();
  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    after,
    { timeout: 10_000 },
  );
  await page.screenshot({ path: `test-results/p4/theme-${after}.png` });

  // kembalikan nilai awal agar test lain tidak terpengaruh
  await toggle.click();
  expect(errors).toEqual([]);
});

test("P4 responsif 360px: tanpa scroll horizontal halaman", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of ROUTES) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, `overflow horizontal di ${route.path}`).toBeLessThanOrEqual(1);
  }
});

test("P4 keyboard: fokus terlihat & tab bisa dinavigasi panah", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.theme !== undefined, { timeout: 15_000 });
  const toggle = page.getByRole("button", { name: /mode (terang|gelap)/i });
  await toggle.focus();
  await expect(toggle).toBeFocused();

  const firstTab = page.locator("[role='tab'] a").first();
  await firstTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[role='tab'] a").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(firstTab).toBeFocused();
});

test("P4 state konsisten: empty/error memakai banner yang sama", async ({ page }) => {
  // Banner di semua halaman memakai .banner + role status/alert.
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { level: 1, name: "Approval Inbox" })).toBeVisible();
  const banners = page.locator(".banner");
  // Halaman menampilkan setidaknya satu banner status (empty atau unavailable)
  // atau tabel berisi data nyata — keduanya sah.
  const hasBanner = (await banners.count()) > 0;
  const hasTable = (await page.locator("table.table").count()) > 0;
  expect(hasBanner || hasTable).toBe(true);
});
