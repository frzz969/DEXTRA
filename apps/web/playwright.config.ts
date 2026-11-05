import { defineConfig } from "@playwright/test";

/**
 * Regresi route-by-route untuk aplikasi React di apps/web.
 *
 * Backend API harus sudah berjalan di http://127.0.0.1:8000 dengan env yang
 * benar (lihat README) sebelum suite dijalankan. Web server produksi di-
 * start otomatis oleh Playwright dengan variabel yang dibutuhkan server
 * komponen.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      DEXTRA_API_URL: "http://127.0.0.1:8001",
      DEXTRA_API_TOKEN: "ops-dev-token",
      DEXTRA_OPS_TOKEN: "ops-dev-token",
      DEXTRA_MCP_URL: "http://127.0.0.1:8765/",
      DEXTRA_ENV: "development",
    },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
