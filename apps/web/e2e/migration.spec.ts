import { test, expect } from "@playwright/test";

const NO_CONSOLE_ERRORS = [/hydration/i, /Minified React error/i, /Text content does not match/i];

async function expectNoPageErrors(page: import("@playwright/test").Page, errors: string[]) {
  expect(errors).toEqual([]);
}

test.describe("Overview (/)", () => {
  test("menampilkan ringkasan operasional dari API", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText("Ringkasan operasional")).toBeVisible();
    await expect(page.getByText("Agen aktif")).toBeVisible();
    await expect(page.getByText("Work package terbuka")).toBeVisible();
    await expect(page.getByText("Approval menunggu")).toBeVisible();
    await expect(page.getByText("Data diambil pada")).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Workforce (/agents)", () => {
  test("papan kanban lima kolom tampil dengan empat agen", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/agents");
    await expect(page.getByRole("heading", { level: 1, name: "Workforce" })).toBeVisible();
    await expect(page.getByLabel("Papan kanban agen")).toBeVisible();
    for (const status of ["Active", "Idle", "Busy", "Disabled", "Error"]) {
      await expect(page.locator(`section[aria-label="Status ${status}"]`)).toBeVisible();
    }
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Work Packages (/work-packages)", () => {
  test("daftar paket kerja tampil dengan state kosong atau tabel", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/work-packages");
    await expect(page.getByRole("heading", { level: 1, name: "Work Packages" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada work package");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Papan (/board)", () => {
  test("kanban tampil dengan kolom-kolom tahap", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/board");
    await expect(page.getByRole("heading", { level: 1, name: "Papan Work Packages" })).toBeVisible();
    await expect(page.getByLabel("Papan work packages")).toBeVisible();
    for (const tahap of ["Draft", "Disetujui", "Berjalan", "Selesai", "Dibatalkan"]) {
      await expect(page.locator(`section[aria-label="Tahap ${tahap}"]`)).toBeVisible();
    }
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Skill Registry (/skills)", () => {
  test("katalog skill tampil dengan state kosong atau tabel", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/skills");
    await expect(page.getByRole("heading", { level: 1, name: "Skill Registry" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada skill terdaftar");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Workflow Registry (/workflows)", () => {
  test("definisi workflow tampil dengan state kosong atau tabel", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/workflows");
    await expect(page.getByRole("heading", { level: 1, name: "Workflow Registry" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada workflow terdaftar");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Workflow Runs (/workflows/runs)", () => {
  test("runs tampil dengan state kosong atau daftar", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/workflows/runs");
    await expect(page.getByRole("heading", { level: 1, name: "Workflow Runs" })).toBeVisible();
    const empty = page.getByText("Belum ada run workflow");
    const runs = page.locator("details.card");
    await expect(empty.or(runs.first())).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Akun & Izin (/account)", () => {
  test("menampilkan scope dan capability pemanggil", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/account");
    await expect(page.getByRole("heading", { level: 1, name: "Akun & Izin Saya" })).toBeVisible();
    await expect(page.getByText("Capability untuk scope ini")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Capability yang BELUM punya penegak" })).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Akses & Peran (/access)", () => {
  test("bagian anggota dan peran tampil jujur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/access");
    await expect(page.getByRole("heading", { level: 1, name: "Akses & Peran" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Anggota tenant" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Peran & capability" })).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Token & Service Account (/tokens)", () => {
  test("inventaris token dan service account tampil jujur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/tokens");
    await expect(page.getByRole("heading", { level: 1, name: "Token & Identitas Mesin" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Token API" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Service account" })).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Kebijakan (/policies)", () => {
  test("daftar kebijakan tampil dengan state apa adanya", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/policies");
    await expect(page.getByRole("heading", { level: 1, name: "Kebijakan" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada kebijakan terdaftar");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Analytics (/analytics)", () => {
  test("ringkasan eksekusi tampil dengan state apa adanya", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Explorer (/explorer)", () => {
  test("menampilkan tab entitas dan badge status MCP apa adanya", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/explorer");
    await expect(page.getByRole("heading", { level: 1, name: "Explorer" })).toBeVisible();
    for (const tab of ["Rencana", "Mandat", "Eksekusi", "Audit"]) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
    // Entitas approvals dan worker memang tidak ada di Explorer — disebutkan di UI.
    await expect(page.getByText(/Approval dan Worker tidak ada/)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Admin (/admin)", () => {
  test("menampilkan kesehatan layanan dari API", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Administrasi" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Kesehatan layanan" })).toBeVisible();
    await expect(page.getByText("Layanan API")).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Data Management (/data-management)", () => {
  test("menampilkan status migrasi data apa adanya", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/data-management");
    await expect(page.getByRole("heading", { level: 1, name: "Data Management" })).toBeVisible();
    await expect(page.getByText(/belum dimigrasikan/)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Login (/login)", () => {
  test("kredensial salah ditolak generik", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Masuk" })).toBeVisible();
    await page.getByLabel("Email").fill("budi.santoso@dextra.local");
    await page.getByLabel("Password").fill("password-salah-jelas");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Email atau password salah.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expectNoPageErrors(page, errors);
  });

  test("login lalu keluar mengganti konteks pemanggil", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("budi.santoso@dextra.local");
    await page.getByLabel("Password").fill("E2E-DevOnly-Password-2026");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await page.waitForURL(/\/$/);

    await page.goto("/account");
    await expect(page.getByText(/usr_budi_santoso/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Keluar" })).toBeVisible();

    await page.getByRole("button", { name: "Keluar" }).click();
    await page.waitForURL(/\/login$/);

    await page.goto("/account");
    await expect(page.getByText(/token gateway legacy/)).toBeVisible();
  });
});

test.describe("AI Assistant (/assistant)", () => {
  test("menampilkan state AI belum dikonfigurasi secara jujur bila env kosong", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/assistant");
    await expect(page.getByRole("heading", { level: 1, name: "AI Assistant" })).toBeVisible();
    await expect(page.getByText(/AI belum dikonfigurasi/).first()).toBeVisible();
    await expect(page.getByText(/DEXTRA_AI_API_KEY/).first()).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Office Agent (/office-agent)", () => {
  test("list rencana tampil dengan state kosong atau tabel", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/office-agent");
    await expect(page.getByRole("heading", { level: 1, name: "Office Agent" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada rencana Office Agent masuk");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Approval Challenge (/approvals)", () => {
  test("panel keputusan tampil dan dapat diisi", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/approvals");
    await expect(page.getByRole("heading", { level: 1, name: "Approval Challenge" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Keputusan" })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Setujui/ })).toBeChecked();
    await page.getByLabel("Plan ID *").fill("plan_e2e");
    await page.getByLabel("Action ID *").fill("act_e2e");
    await page.getByLabel("Tipe Aksi *").fill("deploy.production");
    await page.getByLabel("Plan Hash *").fill("sha256:e2e");
    await expect(page.getByRole("button", { name: /Kirim Keputusan/ })).toBeEnabled();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Audit Center (/audit)", () => {
  test("verifikasi rantai dan tabel jejak tampil", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/audit");
    await expect(page.getByRole("heading", { level: 1, name: "Audit Center" })).toBeVisible();
    await expect(page.getByText("Jejak audit append-only")).toBeVisible();
    // Rantai terverifikasi / rusak / tidak tersedia — salah satu harus tampil jujur.
    await expect(
      page.getByText(/Rantai audit terverifikasi|Rantai audit rusak|Verifikasi rantai tidak tersedia/).first(),
    ).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Executions (/executions)", () => {
  test("monitor eksekusi menampilkan data atau status kosong yang jujur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/executions");
    await expect(page.getByRole("heading", { level: 1, name: "Monitor Eksekusi" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada eksekusi");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Mandates (/mandates)", () => {
  test("daftar mandat tampil dengan tombol cabut atau state kosong", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/mandates");
    await expect(page.getByRole("heading", { level: 1, name: "Mandates" })).toBeVisible();
    const table = page.locator("table.table");
    const empty = page.getByText("Belum ada mandat terbit");
    await expect(table.or(empty)).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Security Center (/security)", () => {
  test("ringkasan dan bagian keamanan tampil jujur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/security");
    await expect(page.getByRole("heading", { level: 1, name: "Security Center" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Peristiwa keamanan terbaru" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sesi aktif tenant" })).toBeVisible();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("DEXTRA Copilot (panel global)", () => {
  test("tombol Copilot membuka panel di halaman mana pun; state AI jujur", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    const fab = page.getByRole("button", { name: "Buka DEXTRA Copilot" });
    await expect(fab).toBeVisible();
    await fab.click();
    await expect(page.getByRole("dialog", { name: "DEXTRA Copilot" })).toBeVisible();
    await expect(page.getByText(/AI belum dikonfigurasi/).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "DEXTRA Copilot" })).toBeHidden();
    await expectNoPageErrors(page, errors);
  });
});

test.describe("Navigasi sidebar", () => {
  test("berpindah antar route lewat nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Workforce/ }).click();
    await expect(page).toHaveURL(/.*\/agents$/);
    await page.getByRole("link", { name: /Assistant/ }).click();
    await expect(page).toHaveURL(/.*\/assistant$/);
    await page.getByRole("link", { name: /Paket Kerja/ }).click();
    await expect(page).toHaveURL(/.*\/work-packages$/);
    await page.getByRole("link", { name: /^Papan/ }).click();
    await expect(page).toHaveURL(/.*\/board$/);
    await page.getByRole("link", { name: /^Approval/ }).click();
    await expect(page).toHaveURL(/.*\/approvals$/);
    await page.getByRole("link", { name: /^Kebijakan/ }).click();
    await expect(page).toHaveURL(/.*\/policies$/);
    await page.getByRole("link", { name: /^Audit/ }).click();
    await expect(page).toHaveURL(/.*\/audit$/);
    await page.getByRole("link", { name: /^Mandates/ }).click();
    await expect(page).toHaveURL(/.*\/mandates$/);
    await page.getByRole("link", { name: /Security Center/ }).click();
    await expect(page).toHaveURL(/.*\/security$/);
    await page.getByRole("link", { name: /^Skills/ }).click();
    await expect(page).toHaveURL(/.*\/skills$/);
    await page.getByRole("link", { name: /^Workflow/ }).click();
    await expect(page).toHaveURL(/.*\/workflows$/);
    await page.getByRole("link", { name: /^Akun/ }).click();
    await expect(page).toHaveURL(/.*\/account$/);
    await page.getByRole("link", { name: /^Akses/ }).click();
    await expect(page).toHaveURL(/.*\/access$/);
    await page.getByRole("link", { name: /^Token/ }).click();
    await expect(page).toHaveURL(/.*\/tokens$/);
    await page.getByRole("link", { name: /^Admin/ }).click();
    await expect(page).toHaveURL(/.*\/admin$/);
    await page.getByRole("link", { name: /Data Management/ }).click();
    await expect(page).toHaveURL(/.*\/data-management$/);
    await page.getByRole("link", { name: /Executions/ }).click();
    await expect(page).toHaveURL(/.*\/executions$/);
    await page.getByRole("link", { name: /Explorer/ }).click();
    await expect(page).toHaveURL(/.*\/explorer$/);
    await page.getByRole("link", { name: /Analytics/ }).click();
    await expect(page).toHaveURL(/.*\/analytics$/);
    await page.getByRole("link", { name: /Overview/ }).click();
    await expect(page).toHaveURL(/.*\/$/);
  });
});
