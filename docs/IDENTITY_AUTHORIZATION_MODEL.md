# DEXTRA — Identity & Authorization Model

Status: **implemented (P7-P12), with documented gaps.** This document describes what the
system actually does today, not what it is intended to do eventually. Where a capability
does not exist, it says so instead of describing an aspiration.

Per 2026-11-04 the contract in §9 is no longer a proposal: sessions, role-based
capability resolution, tenant isolation, API tokens, service identities, MFA, and the
Security Center all exist and are covered by tests. §10 has been rewritten to match.

The two gaps that §10 used to list are now closed, and the closing is tested rather than
described:

- The **legacy gateway token is tenant-bound** via `DEXTRA_LEGACY_TENANT`. Without that
  setting it sees **no** tenant-scoped data at all — fail-closed, not fail-open.
- The **audit chain carries `tenant_id`** through a versioned payload: rows written
  before the change keep `chain_version = 1` and their original hash, new rows use
  `chain_version = 2` with `tenant_id` inside the hash.

Scope of this document: how a caller is identified, what a token authorises, how the
server decides, how the dashboard reflects that decision, and what is missing.

---

## 1. The trusted identity source

**There is no user identity in DEXTRA today.** This is the single most important fact in
this document, and every other section follows from it.

The MCP server authenticates a **bearer token**, and a token maps to a **scope**:

| Scope | Meaning |
| --- | --- |
| `agent` | Read and plan. Cannot approve, issue, execute, revoke, or read the audit log. |
| `ops` | Everything `agent` can do, plus approval, mandate issuance/revocation, execution, and audit read. |

Nothing else is authenticated. The server never receives a user id, never verifies a
signature over user attributes, and never consults a directory. A token is a **capability
set**, not a person.

Consequences that must be stated plainly:

- "Who did this?" cannot be answered from a token. Audit events record `actor` as one of
  `agent`, `dashboard`, `executor`, `service` — a role-like label, not a person.
- `approver_id` on an approval is a **caller-supplied string**. The server records it and
  does not verify it. It is evidence of what the caller claimed, not proof.
- Any per-user statement in the UI ("my requests", "assigned to you") is either simulated
  or explicitly labelled as unavailable.

### Why the dashboard persona is not an identity

`apps/dashboard/assets/js/core.js` contains a display persona (`Farhan Pratama`,
`operations_manager`). It exists so the demo has something to render. It is **never sent to
the server** and therefore cannot be a basis for any decision. Treating it as an identity
would be the classic mistake of trusting a client-asserted role.

---

## 2. How tokens are issued and verified

There is no issuance flow. Tokens are configured out of band:

| Variable | Default (dev) | Scope granted |
| --- | --- | --- |
| `DEXTRA_AGENT_TOKEN` | `agent-dev-token` | `agent` |
| `DEXTRA_OPS_TOKEN` | `ops-dev-token` | `ops` |

Verification (`apps/mcp-server/src/auth.ts`):

1. Read both configured tokens **at call time**, not at module load.
2. Compare using `timingSafeEqual`, guarded by a length check first (the function throws on
   length mismatch, which would otherwise become a crash oracle).
3. Return the matching scope, or `null`.

`null` is the only failure value and there is no fallback scope. An empty, missing, or
unknown token never resolves to a scope.

Reading tokens at call time is deliberate: it makes rotation possible without a restart. It
also fixed a misleading test — assigning `process.env` inside a test body had no effect on
constants captured at import, so the old test passed only because the defaults happened to
match the values it wrote.

### What is missing from token lifecycle

| Concern | Status | Consequence |
| --- | --- | --- |
| Expiry (`exp`) | **Not implemented** | A token is valid for as long as it is configured. |
| Revocation list | **Not implemented** | Rotating the variable invalidates the old token for everyone. There is no per-session revocation. |
| Issued-at / rotation audit | **Not implemented** | Rotation is an environment change, not an audited event. |
| Per-caller identity | **Not implemented** | See §1. |

These are documented rather than faked. A token that looks like it expires but does not
would be worse than one that plainly does not.

---

## 3. Principal, persona, role, scope, permission, resource scope, mandate

These seven words are used loosely in most systems and that ambiguity is exactly where
authorization bugs live. In DEXTRA:

| Concept | Definition here | Exists today? |
| --- | --- | --- |
| **Principal** | The authenticated actor. | **No.** Tokens carry no principal. |
| **Persona** | A display context in the dashboard (name, title, avatar). | Yes, but cosmetic only. Never trusted. |
| **Role** | An organisational authority group (approver, auditor, admin). | **Only in demo data.** No server counterpart. |
| **Scope** | What a token is allowed to do, at the tool level. | **Yes.** The real boundary. |
| **Permission** | A named capability (`approve`, `execute`, …). | Yes, as a derived contract. See §4. |
| **Resource scope** | Which individual records a caller may touch. | **No.** Any `ops` caller may act on any mandate. |
| **Mandate** | Authority for one specific action, issued after human approval, hash-bound to a plan. | **Yes.** The strongest control in the system. |

The relationship, stated as a chain:

```
token → scope → capability → tool → (governance) → mandate → execution
```

The dashboard persona sits entirely outside this chain. It affects what is drawn and
nothing else.

### Resource scope: the honest gap

`ops` is a single global capability set. It is not partitioned by organisation, owner, or
team. Concretely:

- `execute_action` accepts any `mandate_id`; it does not check that the caller "owns" it.
- `revoke_mandate` accepts any mandate.
- `list_plans` returns every plan in the store.

`Plan.org_id` and `Mandate.plan_id` exist, so the data model *could* support partitioning,
but no check consults them. With a single organisation in the dataset this is currently
unobservable; it becomes a real defect the moment a second organisation exists. It is
recorded here rather than papered over with a check that always passes.

---

## 4. Permission evaluation

There is exactly one source of truth: `packages/contracts/src/authorization.ts`.

```
TOOL_CAPABILITY   which capability each tool requires
SCOPE_CAPABILITIES what each scope grants
toolsForScope()   derived allowlist — never hand-maintained
```

The server derives `AGENT_TOOLS` and `OPS_TOOLS` from this contract. Nothing hand-writes a
second list, because a hand-written allowlist drifts, and drift in an authorization table is
a security defect rather than a typo.

Evaluation order for a `tools/call`:

1. `resolveScope(token)` → `null` ⇒ `-32001 Unauthorized`, audited as `action_blocked`.
2. `isAllowed(scope, tool)` → false ⇒ `-32003 Forbidden`, audited as `action_blocked`.
3. `handleTool(name, args, scope)` re-asserts both checks (see §6).
4. The handler runs. Governance (plan → approval → mandate → execution) applies on top.

Unknown tool names fail at step 2 because `scopeAllowsTool` returns false for any name
absent from `TOOL_CAPABILITY`. There is no path where an unrecognised name reaches a
handler.

### Unbacked capabilities

`unbacked_capabilities` is **empty**. Every capability in the vocabulary now has an
endpoint that enforces it and filters by tenant:

| Capability | Enforced by |
| --- | --- |
| `manage_users` | `/users`, `/roles`, cross-user session revocation in `/security` |
| `manage_integrations` | `/service-accounts`, `/tokens`, `PATCH`/`DELETE /agents` |
| `edit_policy` | `PATCH`/`DELETE /policies` |

`/meta` and `/permissions` compute this list from `require_capability` call sites, so a
capability that loses its enforcer reappears there automatically. The dashboard renders an
unbacked capability as **"not available"**, never as **"denied"** — because no decision was
made, and claiming one would be a false statement about the system's behaviour.

---

## 5. Default-deny

Default-deny is structural rather than a configured policy:

- No token ⇒ no scope ⇒ every call refused.
- Scope present but tool not in its derived set ⇒ refused.
- Tool not in the contract ⇒ refused for every scope.
- Capability in the vocabulary but granted to no scope ⇒ reported as unbacked; no UI path
  opens it.
- The dashboard's `session.can()` returns false when no server context has been applied
  (live mode before `get_caller_context` resolves, or after a rejection).

The last point matters: the client's default state is "nothing is granted", not "everything
is granted until proven otherwise".

---

## 6. Defense in depth

`handleRpc` refuses disallowed tools. `handleTool` **also** refuses them, on its own:

```ts
if (scope !== 'agent' && scope !== 'ops') return { ok: false, error: { code: 'UNAUTHORIZED' } };
if (!isAllowed(scope, name)) return { ok: false, error: { code: 'ACTION_NOT_ALLOWED' } };
```

This is not redundant. `handleTool` previously accepted a `scope` argument it never read,
which meant the handler was safe only when called the expected way. Any future internal
caller — a scheduled job, a second transport, a test — would have bypassed authorization
entirely. The handler is now safe on its own. Both checks are covered by tests that call
`handleTool` directly, precisely because that is the bypass route.

---

## 7. How authority changes are applied

| Change | Mechanism | Audited? |
| --- | --- | --- |
| Rotate a token | Change the environment variable; effective on the next call | No |
| Change what a scope may do | Edit `SCOPE_CAPABILITIES`; both server and client follow | Via code review and tests |
| Grant a capability to a person | **Not possible** — no per-person grants exist | n/a |
| Issue authority for an action | Human approval → mandate (hash-bound, expiring, revocable) | Yes |
| Revoke authority | `revoke_mandate` | Yes, `mandate_revoked` |

The important asymmetry: **capability changes are deployment-time, mandate changes are
runtime and audited.** DEXTRA deliberately does not support runtime re-granting of
capabilities, because that would require the identity system it does not have.

---

## 8. How audit records authorization decisions

Every refusal at the HTTP boundary writes an `action_blocked` event with the tool, the
scope (`none` when no scope resolved), and a redacted token hint. Audit failure is caught
and never crashes the server — a refusal must still happen even if logging fails.

Mandate issuance is audited on **both** paths:

- `submit_approval` with `approve` → `approval_granted` (includes the mandate id)
- `issue_mandate` → `mandate_issued` (records `via`, `approval_id`, `scope`)

The second path was previously unaudited, which would have allowed a mandate to exist with
no record of who asked for it.

What audit does **not** capture: the identity of the human. It captures the scope and the
claimed `approver_id`. See §1.

---

## 9. Required contract for real per-user identity

The six parts below are the contract P7-P12 implemented. They are kept in this form so
each part can be checked against a stated definition rather than a memory of one.

1. **Principal** — a verified `principal_id` bound to the token (signed assertion or a
   server-side session), not a client-supplied string.
2. **Role store** — server-side role→capability assignment, queryable and auditable.
3. **Resource scope** — an ownership or tenancy attribute on `Plan` and `Mandate`, and
   checks in `execute_action` / `revoke_mandate` / `list_*` that consult it.
4. **Token lifecycle** — `exp`, revocation, and an audit record per issuance and rotation.
5. **Admin authorization** — a role that can actually perform user, integration, agent, and
   policy management, plus the tools to do it. `admin` holds `manage_users`,
   `manage_integrations`, and `edit_policy`, and each is enforced by a tenant-filtered
   endpoint.
6. **Client handshake** — `get_caller_context` extended to return the principal and its
   capabilities, so the UI continues to render server truth rather than a persona.

Until 1–3 exist, adding a `requester_id` field to plans would record an unverifiable claim
and would make `/requests` look authoritative while remaining untrustworthy. That is why it
was not done.

---

## 10. Summary of what a caller can and cannot do today

Three kinds of caller now exist: a **session** (human, role-derived capabilities), an
**API token** (`dx_…`, capability = scope ∩ owner capabilities), and the **legacy gateway
token** (`agent`/`ops`, capability = fixed scope, tenant = `DEXTRA_LEGACY_TENANT`).

| Action | `viewer` | `operator` | `approver` | `auditor` | `admin` | `agent` | `ops` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Read org data | own only | all | all | all | all | all | all |
| Create a request | No | Yes | Yes | No | Yes | Yes | Yes |
| Approve / issue mandate | No | No | Yes | No | Yes | No | Yes |
| Execute under a mandate | No | No | Yes | No | Yes | No | Yes |
| Read the audit log | No | No | Yes | Yes | Yes | No | Yes |
| Manage users, tokens, service identities | No | No | No | No | Yes | No | No |
| Edit or delete agents, work packages, tasks | No | Yes (tasks) | Yes | No | Yes | No | No |
| Edit or delete policies | No | No | No | No | Yes | No | No |
| Assign an agent to a task | No | Yes | Yes | No | Yes | No | No |
| Act on another tenant's mandate | No (404) | No (404) | No (404) | No (404) | No (404) | No (404) | No (404) |

The last two columns used to say "Yes (no check)". They no longer do: the gateway token
is bound to one tenant, and every tenant-scoped read is filtered by it. When
`DEXTRA_LEGACY_TENANT` is empty the token resolves to **no** tenant and sees nothing —
`core.authz.scope_to_tenant` returns an always-false predicate instead of an unfiltered
query. A misconfigured slug returns `401` rather than silently restoring global access.
`tests/integration/test_authorization_rbac.py` covers all three states.
