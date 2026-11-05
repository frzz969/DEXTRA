#!/usr/bin/env node
/* Fill the dashboard with records the real engine produced.
 *
 * The store starts empty and plans are only ever created through the assistant,
 * so a freshly cloned checkout shows empty screens. Seeding a JSON file with
 * hand-written plans would be exactly the fabricated state this project refuses
 * to display, so this script does the opposite: it drives the actual MCP server
 * through create_plan -> submit_approval -> execute_action and lets the real
 * policy engine decide the outcome.
 *
 * Result: one executed plan, one waiting for a human, and one blocked by policy
 * — three genuinely different states, all traceable to audit events.
 *
 * Requires the MCP server to be running (npm run dev:mcp).
 */
const API = process.env.DEXTRA_API ?? 'http://127.0.0.1:8765';
const TOKEN = process.env.DEXTRA_OPS_TOKEN ?? 'ops-dev-token';

async function call(name, args) {
  const res = await fetch(API + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`${name}: ${json.error.message}`);
  const parsed = JSON.parse(json.result.content[0].text);
  if (parsed.ok === false) throw new Error(`${name}: ${parsed.error?.message ?? JSON.stringify(parsed.error)}`);
  return parsed.data;
}

function emailAction({ subject, body, to, contactId, startAt }) {
  return {
    action_type: 'send_email',
    target: { contact_id: contactId, display_name: to, channel: 'email', masked_address: 'b***@kenari.co.id' },
    schedule: { start_at: startAt, timezone: 'Asia/Jakarta', all_day: false },
    content: { subject, body, locale: 'id-ID' },
  };
}

const stamp = Date.now().toString(36);

async function createPlan(intent, actions) {
  const data = await call('create_plan', {
    org_id: 'org_kenari',
    request_id: `req_${stamp}_${Math.random().toString(36).slice(2, 6)}`,
    intent,
    actions,
  });
  return data.plan;
}

async function approve(plan) {
  return call('submit_approval', {
    plan_id: plan.plan_id,
    plan_hash: plan.plan_hash,
    decision: 'approve',
    approver_id: 'scope:ops',
    approval_token: `apt_${Date.now()}`,
  });
}

async function main() {
  const health = await fetch(API + '/health').then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error(`Server MCP tidak berjalan di ${API}. Jalankan: npm run dev:mcp`);
    process.exit(1);
  }

  // 1. Approved and executed.
  const done = await createPlan('Kirim notulen rapat koordinasi Q4 ke Budi Santoso', [
    emailAction({
      subject: 'Notulen rapat koordinasi Q4',
      body: 'Halo Budi, berikut notulen rapat koordinasi Q4 untuk ditindaklanjuti.',
      to: 'Budi Santoso',
      contactId: 'c_budi_fin',
      startAt: '2026-11-04T09:00:00+07:00',
    }),
  ]);
  console.log(`1. dibuat   ${done.plan_id}  status=${done.status}`);
  if (done.status === 'BLOCKED') {
    console.log('   diblokir kebijakan; tidak dilanjutkan.');
  } else {
    const appr = await approve(done);
    console.log(`2. disetujui ${appr.approval_id}  mandate=${appr.mandate_id}`);
    /* execute_action answers { result: ActionResult } — the nested name is the
       handler's, not a mistake here. */
    const { result: executed } = await call('execute_action', {
      mandate_id: appr.mandate_id,
      action_id: done.actions[0].action_id,
      execution_key: `ek_${stamp}`,
    });
    console.log(`3. eksekusi  ${executed.result}  ${JSON.stringify(executed.evidence)}`);
  }

  // 2. Waiting for a human decision.
  const waiting = await createPlan('Ringkas kontrak vendor Q4 untuk Legal', [
    emailAction({
      subject: 'Ringkasan kontrak vendor Q4',
      body: 'Berikut ringkasan kontrak vendor Q4 yang perlu ditinjau Legal.',
      to: 'Budi Santoso',
      contactId: 'c_budi_fin',
      startAt: '2026-11-05T10:00:00+07:00',
    }),
  ]);
  console.log(`4. menunggu  ${waiting.plan_id}  status=${waiting.status}`);

  // 3. Blocked by the office-hours rule (Friday prayer window).
  const blocked = await createPlan('Jadwalkan review anggaran Jumat 11:30', [
    {
      action_type: 'create_calendar_event',
      target: { contact_id: 'c_budi_fin', display_name: 'Budi Santoso', channel: 'calendar', masked_address: 'b***@kenari.co.id' },
      schedule: { start_at: '2026-11-06T11:30:00+07:00', end_at: '2026-11-06T12:00:00+07:00', timezone: 'Asia/Jakarta', all_day: false },
      content: { subject: 'Review anggaran Q4', body: 'Review anggaran Q4 bersama tim keuangan.', locale: 'id-ID' },
    },
  ]);
  /* Whatever the policy engine decided is what gets printed — this plan is
     expected to trip the Friday-prayer rule, but the rule decides whether that
     is a block or a review, not this script. */
  console.log(`5. kebijakan ${blocked.plan_id}  status=${blocked.status}`);

  const audit = await call('get_audit_log', { limit: 50 });
  console.log(`\nSelesai. ${audit.events.length} event audit tercatat.`);
  console.log('Buka web: npm run dev:web -> http://127.0.0.1:3000');
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
