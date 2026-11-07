import { test, expect } from "@playwright/test";

/*
 * Halaman pengenalan publik di "/" — sengaja TANPA app shell.
 *
 * Kontrak yang diuji di sini:
 *  - "/" menjawab 200 dan menyebut DEXTRA.
 *  - .sidebar/.topbar/.tabsbar tidak ada di DOM sama sekali. Dipakai
 *    toHaveCount(0), bukan toBeHidden(): shell yang hanya disembunyikan CSS
 *    (mis. body.is-bare) tetap dirender dan tetap membawa biaya render +
 *    markup yang tidak dipakai halaman publik.
 *  - ada jalan masuk ke dashboard di /overview, dan shell muncul di sana.
 *
 * Test ini sengaja tidak menguji angka dari API: backend mungkin tidak hidup
 * saat suite dijalankan, dan halaman publik tidak boleh bergantung padanya.
 */

test.describe("Halaman publik (/)", () => {
  test("menjawab 200, menyebut DEXTRA, tanpa app shell di DOM", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.locator("body")).toContainText("DEXTRA");

    // Assertion kunci: shell harus benar-benar tidak dirender.
    await expect(page.locator(".sidebar")).toHaveCount(0);
    await expect(page.locator(".topbar")).toHaveCount(0);
    await expect(page.locator(".tabsbar")).toHaveCount(0);
  });

  test("menautkan ke /overview dan shell muncul setelah tautan diklik", async ({ page }) => {
    await page.goto("/");

    const masuk = page.locator('a[href="/overview"]');
    await expect(masuk.first()).toBeVisible();

    await masuk.first().click();

    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.locator(".sidebar")).toHaveCount(1);
    await expect(page.locator(".topbar")).toHaveCount(1);
    await expect(page.locator(".tabsbar")).toHaveCount(1);
  });

  test("/overview tanpa sesi tetap merender shell dan h1 Overview", async ({ page }) => {
    const response = await page.goto("/overview");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.locator(".sidebar")).toHaveCount(1);
    await expect(page.locator(".topbar")).toHaveCount(1);
    await expect(page.locator(".tabsbar")).toHaveCount(1);
  });
});
