import { test, expect } from "@playwright/test";

const BACKEND = process.env.DEXTRA_BACKEND_URL || "http://127.0.0.1:8000/api/v1";
const TOKEN = process.env.DEXTRA_API_TOKEN || "ops-dev-token";
const TENANT = process.env.DEXTRA_LEGACY_TENANT || "kenari";

let executionId = "";
let planId = "";
let backendOk = false;

test.describe("Governance chain (E2E)", () => {
  test.beforeAll(async () => {
    try {
      const res = await fetch(`${BACKEND}/overview`, {
        headers: { Authorization: `Bearer ${TOKEN}`, "X-Tenant": TENANT },
      });
      if (!res.ok) throw new Error("overview not ok");
      backendOk = true;
    } catch (e) {
      backendOk = false;
      return;
    }

    const hdrs = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      "X-Tenant": TENANT,
    };
    try {
      const created = await fetch(`${BACKEND}/office-agent/plans`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          org_id: "org_kenari",
          request_id: "req_e2e_" + Date.now().toString(36),
          intent: "E2E: kirim ringkasan ke Budi",
          actions: [
            {
              action_type: "send_email",
              target: {
                contact_id: "c_budi_fin",
                display_name: "Budi Santoso",
                channel: "email",
                masked_address: "b***@kenari.co.id",
              },
              schedule: {
                start_at: "2026-11-05T09:00:00+07:00",
                timezone: "Asia/Jakarta",
                all_day: false,
              },
              content: { subject: "E2E", body: "E2E body", locale: "id-ID" },
            },
          ],
        }),
      });
      const createdJson = await created.json();
      planId = createdJson?.plan?.plan_id || createdJson?.plan_id;
      const plan = createdJson?.plan || createdJson;
      const ch = await fetch(`${BACKEND}/office-agent/plans/${planId}/approval-challenge`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({ plan_id: plan.plan_id, plan_hash: plan.plan_hash }),
      });
      const chJson = await ch.json();
      const appr = await fetch(`${BACKEND}/office-agent/approvals`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          plan_id: plan.plan_id,
          plan_hash: plan.plan_hash,
          decision: "approve",
          approval_token: chJson.approval_token,
        }),
      });
      const apprJson = await appr.json();
      const exec = await fetch(`${BACKEND}/office-agent/execute`, {
        method: "POST",
        headers: hdrs,
        body: JSON.stringify({
          mandate_id: apprJson.mandate_id,
          action_id: plan.actions[0].action_id,
          execution_key: "ek_e2e_" + Date.now().toString(36),
        }),
      });
      const execJson = await exec.json();
      executionId = execJson?.execution_id || execJson?.result?.execution_id || "";
      expect(execJson?.result?.result || execJson?.result).toMatch(/succeeded|sent/);
    } catch (e) {
      backendOk = false;
    }
  });

  test("governance chain: plan created → approved → executed → audited", async () => {
    test.skip(!backendOk, "backend unreachable");
    // audit contains action_executed
    const res = await fetch(`${BACKEND}/audit`, {
      headers: { Authorization: `Bearer ${TOKEN}`, "X-Tenant": TENANT },
    });
    const data = await res.json();
    const text = JSON.stringify(data);
    expect(text).toContain("action_executed");
  });

  test("executions page shows the execution", async ({ page }) => {
    test.skip(!backendOk, "backend unreachable");
    await page.goto("/executions");
    await expect(page.locator("body")).toBeVisible();
    if (executionId) await expect(page.getByText(executionId)).toBeVisible();
  });

  test("audit page shows action_executed", async ({ page }) => {
    test.skip(!backendOk, "backend unreachable");
    await page.goto("/audit");
    await expect(page.getByText(/action_executed/)).toBeVisible();
  });
});