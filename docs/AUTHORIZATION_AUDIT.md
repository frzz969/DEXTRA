# DEXTRA — Authorization Audit

Date: 2026-11-02
Scope: authentication flow, token structure, server authorization, client persona, permission
matrix, route guards, admin protection, WorkBuddy MCP access, existing tests.

Method: read the implementation before changing it. Every finding below cites the file and
behaviour that produced it. Findings that were fixed are marked and reference the commit.

---

## Summary

| ID | Finding | Severity | Status |
| --- | --- | --- | --- |
| A-01 | `handleTool` received `scope` and never used it | **High** | Fixed |
| A-02 | Client persona was the effective authority for the UI; never derived from the token | **High** | Fixed |
| A-03 | Admin routes denied by a client matrix, implying a server decision that never happened | **High** | Fixed |
| A-04 | Tokens captured at import; no rotation; the auth test proved nothing | Medium | Fixed |
| A-05 | `issue_mandate` minted a mandate with no audit event | Medium | Fixed |
| A-06 | `issue_mandate` described as "service only" while exposed to `ops` | Low | Fixed (description) |
| A-07 | No resource-scope checks: any `ops` caller may act on any mandate | **High** | **Open — blocked** |
| A-08 | No token expiry or revocation | Medium | **Open — documented** |
| A-09 | No principal; `approver_id` is caller-asserted and unverified | **High** | **Open — blocked** |
| A-10 | Client permission matrix duplicated business rules with no server counterpart | Medium | Partially fixed |

---

## A-01 — `handleTool` accepted a scope it never read

**File:** `apps/mcp-server/src/handlers.ts`

```ts
export async function handleTool(name: string, args: any, scope: string): Promise<any> {
  switch (name) { ... }   // scope never referenced
```

The only authorization was the allowlist check in `handleRpc`. That made the handler safe
*only when called the expected way*. Any future caller reaching it directly — an internal
job, a second transport, a test — bypassed authorization entirely, and the signature
implied a check that did not exist.

**Root cause:** authorization implemented at one layer while a lower layer accepted the
authority parameter without honouring it. The parameter's presence made the gap invisible
to review.

**Fix:** re-assert scope resolution and tool allowance at the top of `handleTool`. Both
checks are covered by tests that call the handler directly, because that is the bypass
route.

---

## A-02 — The client persona was the de facto authority

**Files:** `apps/dashboard/assets/js/core.js`, `assets/js/shell.js`

`session.can(cap)` read `D.demo.permMatrix[this.user.role]`, where `user.role` was the
hardcoded string `operations_manager`. The token's actual scope was never consulted, even
though the server reports it. Two authorization systems ran in parallel and disagreed:

- Server: token scope (`agent` / `ops`) — the real boundary.
- Client: a persona that no server ever saw.

Concrete symptom: with the `ops` token, the dashboard refused `/users`, `/permissions`, and
`/integrations` because an Operations Manager lacks `manage_users` — while the same token
could call `execute_action`, `issue_mandate`, and `revoke_mandate` freely. The UI
*understated* authority on some screens and *invented* an authority model on others.

**Root cause:** the client had no way to learn its scope, so it substituted a persona.

**Fix:** new read-only tool `get_caller_context` (both scopes) returns the authenticated
scope, its capabilities, and the list of unbacked capabilities. `D.boot()` calls it before
the first render; `session.capState()` reads the server answer. The persona is retained for
display only and is never consulted for a decision.

---

## A-03 — Admin routes implied a decision that never happened

**Files:** `assets/js/views/auth.js`, `assets/js/core.js`

`/users`, `/permissions`, `/integrations` rendered "Akses ditolak — peran *Operations
Manager* tidak memiliki izin", and advised asking an organisation administrator.

Both halves were false:

1. No authorization decision was made by the server. There is no admin concept server-side.
2. There is no organisation administrator to ask. `org_admin` exists only in demo data.

The copy described a permission system that does not exist.

**Root cause:** conflating "this build does not implement it" with "you are not allowed".
They have different causes, different owners, and different fixes.

**Fix:** a third state. `capState()` returns `granted` / `denied` / `unavailable`.
`unavailable` renders a distinct screen stating that the server implements no authorization
for that capability, that no token or persona change will open it, and naming the blocker.
Route states in `sources.js` were updated to match.

No access was granted. The pages remain closed; only the explanation changed.

---

## A-04 — Tokens captured at import; the test was decorative

**File:** `apps/mcp-server/src/auth.ts`

```ts
const AGENT_TOKEN = process.env.DEXTRA_AGENT_TOKEN ?? 'agent-dev-token';
```

Captured once at module load. Consequences:

- Rotation required a process restart.
- `auth.test.ts` set `process.env` inside the test body and then asserted against the
  already-captured constants. It passed only because the values it wrote matched the
  defaults. It would have passed identically if the code ignored the environment entirely.

**Root cause:** module-level configuration plus a test that exercised the default path
while claiming to exercise configuration.

**Fix:** tokens read at call time. A test now rotates the variable mid-suite and asserts the
old token stops resolving and the new one starts — which cannot pass against the old
implementation.

---

## A-05 — `issue_mandate` minted authority without an audit event

**File:** `apps/mcp-server/src/handlers.ts`

`submit_approval` with `approve` writes `approval_granted`. `issue_mandate` wrote nothing.
Both create a mandate. A mandate could therefore exist with no audit record of the request
that produced it — a hole in exactly the trace the governance model is built on.

**Fix:** `issue_mandate` now writes `mandate_issued` with `via`, `approval_id`, and `scope`.

---

## A-06 — A description that contradicted the allowlist

`issue_mandate` was described as "Issue a mandate after verified approval (service only)"
while `OPS_TOOLS` contained it. Either the description or the allowlist was wrong. The
description was; the tool is reachable by the `ops` scope. Corrected, and the audit event
from A-05 makes the second path traceable.

Removing the tool from `ops` was considered and rejected for this stage: nothing calls it
from a client, but the PRD treats mandate issuance as a service operation, and removing it
would be an API-surface change unrelated to the identity work. It is documented instead.

---

## A-07 — No resource-scope authorization (OPEN)

`execute_action`, `revoke_mandate`, `list_plans`, `list_mandates`, and `list_executions`
accept an identifier and act on it. None consults `Plan.org_id` or any ownership attribute.

With one organisation in the dataset this is unobservable. With two, any `ops` caller could
execute or revoke another organisation's mandate.

**Why not fixed here:** a check requires an ownership or tenancy attribute on the principal,
and there is no principal (A-09). Adding `org_id` comparisons against a single hardcoded
org would produce a check that always passes — the appearance of security without the
substance. That is worse than a documented gap, because it stops anyone looking.

**Blocker:** principal identity (A-09) and a tenancy attribute on the caller.

---

## A-08 — No token expiry or revocation (OPEN, documented)

There is no `exp`, no revocation list, and no issuance record. A configured token is valid
indefinitely. Rotation invalidates it for every caller at once.

**Why not fixed here:** implementing expiry without issuance produces tokens with invented
`exp` claims and no refresh path. Implementing a revocation list without identity gives a
list of tokens, not of sessions. Both would be scaffolding around a missing principal.

**Documented in:** `IDENTITY_AUTHORIZATION_MODEL.md` §2.

---

## A-09 - No principal; `approver_id` is unverified (PARTIAL)

The server cannot distinguish callers sharing a scope. `approver_id` arrives in the request
body and is stored as given.

This is not a bug in the code — it is the absence of a subsystem. It is recorded as a
finding because several other controls (A-07, A-08, and honest per-user views) are blocked
on it, and because a reviewer reading the approval flow could reasonably assume the
`approver_id` is authenticated.

**Explicitly not done:** adding `requester_id` to `Plan`. It would store an unverifiable
client claim and make `/requests` look authoritative while remaining untrustworthy.

**Status update (beba8ec):** prinsipal terverifikasi kini ada di jalur TypeScript —
`packages/contracts/src/identity.ts`, `apps/mcp-server/src/auth.ts` (`resolvePrincipal`,
`CallerContext.principal`), `data/principals.json`, dan `create_plan` merekam
`requester_id`/`assignee_id` dari prinsipal (bukan dari klien). Python backend
(`backend/dextra/core/security.py`) masih `principal=None` — parity belum dicapai.
Resource-scope enforcement (A-03) tetap **OPEN**: penegakan kepemilikan memerlukan
prinsipal di semua jalur + atribut ownership pada Mandate, yang belum ada.

---

## A-10 — Duplicated permission rules (PARTIALLY FIXED)

The client matrix in `assets/js/data.js` and the server allowlists in `auth.ts` described
overlapping rules in two independent implementations. They had already drifted: the client
required `can('approve') && can('issue_mandate')` to approve, while the server's
`submit_approval` issues the mandate internally with no such capability.

**Fix:** the server's allowlist is now derived from `packages/contracts/src/authorization.ts`
(`TOOL_CAPABILITY` + `SCOPE_CAPABILITIES` → `toolsForScope`). The client no longer holds an
opinion about server capabilities — it renders `get_caller_context`.

**Remaining:** the demo matrix still exists because demo mode has no server. It is labelled
as simulated and is only consulted when no server context is present.

---

## What was checked and found sound

- **Origin/Host policy** (`origin-policy.ts`): no wildcard CORS, exact-match allowlist that
  can only be narrowed, strict origin parsing, DNS-rebinding control via `Host`. Refuses
  missing `Host`, missing port, malformed origins.
- **Timing-safe token comparison** with a length guard.
- **Unknown tool names** cannot reach a handler.
- **Refusals are audited** without crashing the server on audit failure.
- **`get_audit_log` is ops-only**, so the agent cannot read the audit trail.
- **Manifest drift** is enforced by a test comparing `workbuddy/mcp.json` with `AGENT_TOOLS`.
- **Idempotency** keyed on `(mandate_id, action_id)`; `execution_key` cannot bypass it.

---

## Client-side route guard: UX only

`router.render()` redirects when a capability is missing. This is **not** a security
boundary and is documented as such in the code. Removing it by editing the URL yields a
screen whose every operation the server still refuses. The guard exists so a locked page
explains itself instead of failing three clicks later.

---

## Residual risk statement

The authorization boundary is real and enforced at the HTTP layer: a caller without a valid
token, or with a scope that lacks a tool, cannot execute anything. What the system does
**not** have is a notion of *who* the caller is. Every open finding above (A-07, A-08, A-09)
is a consequence of that single absence, and none of them can be closed honestly without
introducing a principal.
