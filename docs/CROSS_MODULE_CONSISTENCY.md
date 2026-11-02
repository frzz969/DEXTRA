# DEXTRA — Cross-Module Consistency Review

Date: 2026-11-02

Scope: execution history vs audit events, work packages vs task board, WorkBuddy MCP
manifest vs server tool registry, workforce registry.

Method: read each consumer and compare what it claims against what the server actually
provides. Where a claim could not be verified, it was corrected rather than left.

---

## Summary

| Area | Verdict | Action |
| --- | --- | --- |
| Execution History | **Was inconsistent** — fabricated IDs from audit events | Fixed |
| Work Packages ↔ Task Board | Consistent (same identity, same source) | Verified |
| WorkBuddy MCP manifest | Was drifted; now enforced by test | Fixed + guarded |
| Workforce / Specialists | Honest demo; no structured source exists | Documented, unchanged |

---

## 1. Execution History

### Finding

`hydrateLive()` falls back to audit events when `list_executions` fails. The fallback
manufactured execution records out of audit events:

```js
execution_id: 'EX-' + (5500 - i),   // invented
result: 'sent',                     // assumed
```

Three problems, in ascending order of severity:

1. **Invented identifiers.** `EX-5500` looked exactly like a real execution id. Anyone
   copying one into a support ticket or an audit query would search for a row that does not
   exist.
2. **Assumed success.** An audit event of type `action_executed` records that the executor
   ran something. It does not record that the send succeeded. The fallback asserted
   `result: 'sent'`, turning "we tried" into "it worked".
3. **Conflation of evidence.** An execution record and an audit event are different
   artefacts with different guarantees. Presenting one as the other makes the page claim
   more than the server said.

The page's own subtitle compounded it: *"Setiap baris di sini berarti mandat benar-benar
dipakai oleh executor."* That sentence is true of execution records and false of audit
events.

### Fix

- No fabricated id: `execution_id: null` when the executor did not supply one.
- No assumed result: `result: null`, rendered as **"tidak tercatat"**.
- `source: 'audit' | 'execution'` on every row.
- A banner appears when any row is audit-derived, naming the failed tool and the count.
- KPIs count only `source === 'execution'` rows, so "Berhasil" never includes a derived row.
- The drawer states the source explicitly and explains why id and result are unrecorded.
- The page subtitle no longer claims every row is an execution record.

The same class of bug existed in two more places and was fixed:

- `governance.js` recorded `execution_id: res.execution_id || 'EX-?'` after a live
  execution — inventing an id on the success path.
- `governance.js` printed `prior.execution_id` in a toast without a null guard.
- `workpackages.js` rendered `e.execution_id` directly, producing `null` in the evidence
  card.

### Verified

Stubbed `list_executions` to fail, re-hydrated against a store with two `action_executed`
audit events:

```
after fallback: rows=2 derived=2 fabricated-ids=0
derived row sample: {"execution_id":null,"source":"audit",...,"result":null,...}
banner present: true
"tidak tercatat" count: 3
contains "null": false
```

### Remaining limitation

`ActionResult` carries no `plan_id`; the store does not denormalise it. The dashboard
derives the work package from the mandate. When a mandate is missing, the row shows
`tidak tercatat` with the mandate id, rather than guessing.

---

## 2. Work Packages ↔ Task Board

### Verified consistent

Both read `store.plans`. Identity is `plan_id` in both. The board does not maintain a
second list of tasks.

| Property | Work Packages | Task Board |
| --- | --- | --- |
| Source | `store.plans` | `store.plans` |
| Identity | `plan_id` | `plan_id` |
| Live status source | `plan.status` | `STATUS_COL[plan.status]` |
| Specialist | `store.specialist(p.specialist)` | same lookup |

Column mapping is total: `DRAFT → draft`, `READY/NEEDS_REVIEW → review`, `BLOCKED/REJECTED
→ blocked`, `EXECUTED → done`, with `draft` as the fallback for an unknown status. A plan
cannot be silently dropped from the board because its status is unrecognised.

### Known limitation, stated rather than hidden

**Column position is not persisted.** `liveMove` is a client-side map used for drag
feedback. Moving a card changes nothing on the server, because there is no task-position
field and no tool to write one. Reloading returns the card to the column its status implies.

This is a real gap, not a rendering bug. It is not fixed here because fixing it requires a
schema and a tool, which is a larger change than this stage allows.

### No orphan cards

The board does not invent cards. Every card corresponds to a plan in the store. The reverse
is not guaranteed in demo mode, where `store.board` is a hand-written dataset independent of
`store.plans` — that is demo data behaving as demo data.

---

## 3. WorkBuddy MCP manifest

### Finding

`workbuddy/mcp.json` declares `allowedTools` for the agent-facing client. It had already
drifted once in this project (stale after three read tools were added). Adding
`get_caller_context` drifted it again — caught immediately by the existing test, which is
exactly what that test is for.

### Current state

| Scope | Tools | Manifest |
| --- | --- | --- |
| `agent` | 11 | 11 — exact match |
| `ops` | 16 | not exposed to the agent |

### Guard

`apps/mcp-server/tests/agent-manifest.test.ts` asserts:

1. The manifest lists **exactly** `AGENT_TOOLS`, sorted.
2. No ops-only tool (`execute_action`, `submit_approval`, `issue_mandate`,
   `revoke_mandate`) appears in the manifest or in `AGENT_TOOLS`.

Because `AGENT_TOOLS` is now derived from the capability contract, this test transitively
enforces three things: contract ↔ server ↔ manifest.

### No tools added speculatively

`get_caller_context` was added because the client needed to stop guessing its scope. No
other tool was added. Nothing in the manifest names a tool the server does not implement.

---

## 4. Workforce and Specialists

### Finding

`workbuddy/agents/` contains four Markdown files:

```
administrative-officer.md  adversarial-reviewer.md
executive-assistant.md     workforce-dispatcher.md
```

Each is prose: a `# Title`, then `## Peran` and `## Batas` paragraphs. There is no id, no
capability list, no model binding, no status.

### Decision: do not build a registry from Markdown

A registry needs stable identity and machine-checkable attributes. Parsing a heading for a
name and inventing the rest would produce a registry that looks authoritative and is
actually a guess. It would also make the Workforce page appear "live" while being built on
prose — the worst of both worlds.

**No structured registry exists**, so the routes stay `demo`:

| Route | State | Reason |
| --- | --- | --- |
| `/workforce` | `demo` | No agent registry API; workload figures are illustrative |
| `/specialists` | `demo` | Four specialists read from `data.js`, not from the server |

This is unchanged from before the review. It is recorded here so the status is a decision
rather than an oversight.

### What would unblock it

A structured source with, at minimum: `agent_id`, `display_name`, `capabilities[]`,
`status`, and a validator. Then a `list_agents` tool derived from that source, and the
routes move to `live`. Until then, `demo` with a visible demo banner is the honest state.

---

## 5. Cross-cutting observation

Three of the four areas had the same underlying pattern: **a client substituting a
plausible-looking value where the server had none** — a fabricated execution id, an assumed
`result: 'sent'`, a hardcoded persona. Each was individually small and collectively
significant, because a dashboard whose job is to show what actually happened must not
manufacture detail.

The rule applied throughout this review: when the server does not supply a value, render
"not recorded" and say why. Never fill the gap.
