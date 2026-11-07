/**
 * Test untuk turunan data halaman detail rencana Office Agent.
 *
 * Jalankan dari apps/web (berkas dijalankan langsung, bukan lewat `--test`:
 * nama folder `[planId]` dibaca Node sebagai pola glob, sehingga `--test`
 * tidak menemukan berkasnya):
 *
 *   node --experimental-strip-types "app/office-agent/[planId]/view-model.test.mjs"
 *
 * Berkas ini .mjs (bukan .ts) supaya bisa mengimpor `view-model.ts` dengan
 * ekstensi eksplisit — Node mewajibkannya, sedangkan tsconfig proyek tidak
 * mengaktifkan `allowImportingTsExtensions`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  actionScope,
  buildTimeline,
  groupFindings,
  shortHash,
  summarizeResult,
  usesOfMandate
} from "./view-model.ts";

test("penerima ditampilkan apa adanya, termasuk bentuk tersamarkan", () => {
  const scope = actionScope({
    target: {
      contact_id: "c_budi_fin",
      display_name: "Budi Santoso",
      channel: "email",
      masked_address: "b***@kenari.co.id"
    },
    schedule: { start_at: "2026-11-05T09:00:00+07:00", timezone: "Asia/Jakarta" },
    content: { subject: "E2E", body: "Isi persis.", locale: "id-ID" }
  });
  assert.deepEqual(scope.recipients, ["Budi Santoso · b***@kenari.co.id"]);
  assert.equal(scope.channel, "email");
  assert.equal(scope.schedule, "2026-11-05T09:00:00+07:00 · Asia/Jakarta");
  assert.equal(scope.subject, "E2E");
  assert.equal(scope.body, "Isi persis.");
  // Kunci bersarang yang tidak tampil sebagai baris sendiri tetap terlihat.
  assert.deepEqual(scope.extras, [
    { key: "content.locale", value: "id-ID" },
    { key: "target.contact_id", value: "c_budi_fin" }
  ]);
});

test("params yang hanya punya to/subject tidak dikarang isinya", () => {
  const scope = actionScope({ to: "ops@example.com", subject: "Laporan mingguan" });
  assert.deepEqual(scope.recipients, ["ops@example.com"]);
  assert.equal(scope.subject, "Laporan mingguan");
  assert.equal(scope.channel, null);
  assert.equal(scope.schedule, null);
  assert.equal(scope.body, null);
  assert.deepEqual(scope.extras, []);
});

test("bentuk params tiap action_type dipetakan ke baris yang benar", () => {
  const calendar = actionScope({ title: "Rapat tindak lanjut", start: "2026-11-05T09:00" });
  assert.equal(calendar.subject, "Rapat tindak lanjut");
  assert.equal(calendar.schedule, "2026-11-05T09:00");

  const task = actionScope({ title: "Kirim laporan Q4", detail: "Detail tugas." });
  assert.equal(task.subject, "Kirim laporan Q4");
  assert.equal(task.body, "Detail tugas.");

  const note = actionScope({ title: "Notulen rapat", content: "Isi notulen." });
  assert.equal(note.body, "Isi notulen.");
});

test("params kosong tidak menghasilkan nilai tebakan", () => {
  const scope = actionScope({});
  assert.deepEqual(scope.recipients, []);
  assert.equal(scope.subject, null);
  assert.equal(scope.body, null);
});

test("temuan dikelompokkan menghalangi -> peringatan -> informasi", () => {
  const groups = groupFindings([
    { code: "tone_formal", message: "Nada formal.", decision: "allow" },
    { code: "body_contains_pii", message: "PII.", severity: "warning" },
    { code: "recipient_out_of_scope", message: "Luar lingkup.", decision: "deny" }
  ]);
  assert.deepEqual(
    groups.map((group) => [group.tone, group.items.map((item) => item.code)]),
    [
      ["danger", ["recipient_out_of_scope"]],
      ["warning", ["body_contains_pii"]],
      ["info", ["tone_formal"]]
    ]
  );
});

test("tanpa temuan tidak ada kelompok kosong", () => {
  assert.deepEqual(groupFindings([]), []);
});

test("jejak audit diurutkan terlama dulu dan memakai hash pendek", () => {
  const timeline = buildTimeline([
    {
      id: "evt_2",
      seq: 5,
      at: "2026-11-06T05:17:39.888236",
      event_type: "mandate_issued",
      actor: "office_agent",
      action: null,
      resource: "pln_x",
      decision: "allow",
      detail: { approval_id: "apr_1" },
      entry_hash: "eae693050cea25dad2ed167d266a997af3e42a6568c02d769305c8729154006b"
    },
    {
      id: "evt_1",
      seq: 4,
      at: "2026-11-06T05:17:39.881179",
      event_type: "approval_recorded",
      actor: "office_agent",
      action: null,
      resource: "pln_x",
      decision: "deny",
      detail: {},
      entry_hash: "47cc3a16690df319"
    }
  ]);
  assert.deepEqual(timeline.map((entry) => entry.seq), [4, 5]);
  assert.equal(timeline[0].tone, "is-blocked");
  assert.equal(timeline[1].tone, "is-done");
  assert.equal(timeline[1].label, "mandate issued");
  assert.equal(timeline[1].hashShort, "eae693050c…");
  assert.equal(timeline[0].detail, null);
});

test("hash kosong tidak ditampilkan sebagai hash palsu", () => {
  assert.equal(shortHash(""), "—");
  assert.equal(shortHash(null), "—");
  assert.equal(shortHash("abcdef"), "abcdef");
});

test("hasil eksekusi JSON dirapikan menjadi kunci=nilai", () => {
  assert.equal(
    summarizeResult('{"adapter": "outbox", "duration_ms": 8}'),
    "adapter=outbox · duration_ms=8"
  );
  assert.equal(summarizeResult("bukan json"), "bukan json");
  assert.equal(summarizeResult(null), null);
});

test("pemakaian mandat dihitung dari eksekusi yang tercatat", () => {
  const executions = [
    { id: "e1", plan_id: "p", mandate_id: "mnd_1", action_id: "a", status: "succeeded", adapter: "outbox", started_at: null, duration_ms: 5, result: null },
    { id: "e2", plan_id: "p", mandate_id: "mnd_1", action_id: "a", status: "succeeded", adapter: "outbox", started_at: null, duration_ms: 5, result: null },
    { id: "e3", plan_id: "p", mandate_id: "mnd_2", action_id: "a", status: "failed", adapter: "outbox", started_at: null, duration_ms: 5, result: null }
  ];
  assert.equal(usesOfMandate("mnd_1", executions), 2);
  assert.equal(usesOfMandate("mnd_tidak_ada", executions), 0);
});
