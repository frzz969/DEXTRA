# DEXTRA — Authorization Test Matrix

Date: 2026-11-02
Runner: `npm test --workspace @dextra/mcp-server` (and `npm test` for the whole repo)

This document maps each authorization requirement to the test that verifies it, and states
honestly where no test exists because the mechanism does not exist.

Legend for **Level**:

- `HTTP` — a real server on a real socket, with a real bearer token. This is the boundary a
  client actually reaches, so it is the strongest evidence.
- `HANDLER` — `handleTool()` called directly, bypassing the transport. Used specifically to
  prove the defense-in-depth check, because direct invocation is the bypass route.
- `UNIT` — pure function / contract assertions.

---

## 1. Required cases from the brief

| # | Required case | Test | Level | Result |
| --- | --- | --- | --- | --- |
| 1 | Valid token, matching scope | `a valid token in the right scope is allowed` | HTTP | PASS |
| 2 | Valid token, wrong scope | `a valid token in the wrong scope is refused` | HTTP | PASS |
| 3 | Token with no principal identity | `caller context reports no principal and no invented identity` | UNIT | PASS |
| 3b | | `get_caller_context reports the scope and never invents a principal` | HTTP | PASS |
| 4 | Token expired | — | — | **NOT IMPLEMENTED** |
| 5 | Token revoked | — | — | **NOT IMPLEMENTED** |
| 6 | Users with different roles | `agent scope is a strict subset of ops scope` | UNIT | PASS (scopes, not roles) |
| 7 | Direct API request without permission | `a valid token in the wrong scope is refused` | HTTP | PASS |
| 8 | Client persona accessing a forbidden route | manual browser verification (see §5) | E2E | PASS |
| 9 | Unknown permission | `unknown capability names are not recognised` | UNIT | PASS |
| 10 | Scope mismatched to resource | — | — | **NOT IMPLEMENTED** (see §4) |
| 11 | Permission change after session start | `rotation takes effect without a restart, and the old token stops working` | UNIT | PARTIAL (see §4) |

Cases 4, 5, 10, and the resource half of 11 have no test because the mechanism does not
exist. Writing a test that passes against a stub would be worse than the gap: it would
retire the finding without closing it.

---

## 2. HTTP boundary — `tests/authorization.test.ts`

A real server on an ephemeral port, real tokens, real JSON-RPC. Assertions are on the
response the server actually returns.

| Test | What it proves |
| --- | --- |
| `a valid token in the right scope is allowed` | The happy path is not accidentally blocked |
| `a valid token in the wrong scope is refused` | `agent` cannot `execute_action`; `-32003` |
| `agent scope cannot read the audit log` | The audit trail is not readable by the planning scope |
| `a request with no token is unauthorized` | Missing credential fails closed (`-32001`) |
| `a request with a wrong token is unauthorized` | Unknown credential fails closed |
| `an unknown tool name is refused for both scopes` | Unknown names cannot fall through to a handler |
| `a refused call changes no state and is recorded in the audit log` | Two properties at once: no side effect, and a trace |
| `get_caller_context reports the scope and never invents a principal` | `principal === null`, capabilities match the contract |
| `tools/list matches the contract for each scope` | The advertised list equals the derived list — no drift |

The state test reads `mandates.json` before and after a denied call and asserts equality.
This is the check that distinguishes "refused" from "refused but did something first".

---

## 3. Handler boundary — defense in depth

`handleTool` is the only function that performs an operation. These tests call it directly,
with no transport in front of it.

| Test | What it proves |
| --- | --- |
| `an unresolvable scope is refused before any work happens` | `UNAUTHORIZED` for a bogus scope string |
| `an agent scope cannot execute an action even if called directly` | `ACTION_NOT_ALLOWED` |
| `an agent scope cannot issue a mandate even if called directly` | `ACTION_NOT_ALLOWED` |
| `a tool outside the contract is refused for the ops scope too` | Even the widest scope is bounded by the contract |

Before this change these four calls would have succeeded, because the handler never read its
`scope` argument. The tests are written against `handleTool` rather than the HTTP layer on
purpose: an HTTP test would pass either way, since `handleRpc` already refused the call.

---

## 4. Contract and token lifecycle — `tests/auth.test.ts`

| Test | What it proves |
| --- | --- |
| `agent token resolves to agent scope` | Basic resolution |
| `timingSafeEqual does not throw on length mismatch` | A short/long token is a refusal, not a crash |
| `agent scope cannot see execute/issue/submit/revoke/audit tools` | The planning scope cannot mutate |
| `the allowlist is derived from the capability contract, not hand-written` | `AGENT_TOOLS`/`OPS_TOOLS` equal `toolsForScope(...)` |
| `every tool in the contract appears in at least one scope` | No orphan tool |
| `agent scope is a strict subset of ops scope` | No scope escapes the other's boundary |
| `unknown tool names are denied for every scope` | Fail-closed on unknown input |
| `admin capabilities are unbacked, not denied` | The vocabulary distinguishes unimplemented from refused |
| `no scope grants an unbacked capability` | Admin access cannot be reached by any token |
| `caller context reports no principal and no invented identity` | `principal === null` by contract |
| `rotation takes effect without a restart...` | Lazy env read; the old token stops resolving |

### Why "permission change after session start" is only PARTIAL

Rotation is verified at the token level: change the variable, the old token stops working on
the next call. What is **not** verified — because it does not exist — is changing a
capability for an already-authenticated caller. Capabilities are a deployment-time constant
(`SCOPE_CAPABILITIES`); there is no runtime grant to change. The client refreshes its
capabilities only on boot.

### Why "scope mismatched to resource" has no test

`execute_action` and `revoke_mandate` do not check resource ownership. There is no
ownership attribute to check, and no principal to compare it against. A test asserting "org
A cannot act on org B's mandate" would fail today, correctly — and it cannot be made to pass
without the identity work in `IDENTITY_AUTHORIZATION_MODEL.md` §9.

---

## 5. Client-side verification (manual, scripted)

Performed in a headless browser against a live server and against demo mode. These are
recorded here because the route guard is part of the authorization story even though it is
not a security boundary.

| Scenario | Expected | Observed |
| --- | --- | --- |
| Live, valid `ops` token | `scope=ops`, 8 capabilities, `roleLabel="Token ops · server"` | As expected |
| Live, `/users`, `/permissions`, `/integrations` | "Belum tersedia", not "Akses ditolak" | As expected |
| Live, `capState('manage_users')` | `unavailable` | `unavailable` |
| Live, `capState('execute')` | `granted` | `granted` |
| Live, `capState('become_root')` | `denied` | `denied` |
| Live, invalid token | Token cleared, routed to `#/login`, scope `null` | As expected |
| Demo, no server | Persona "Operations Manager"; admin routes "Akses ditolak" | Unchanged (no regression) |
| Live, all 20 data routes | No render error, no horizontal overflow | Clean |

The demo row matters: the change was required to be invisible to demo mode, and it is. Demo
mode still uses its simulated matrix, because there is no server to ask.

---

## 6. Adjacent controls (regression)

These were already covered and were re-run unchanged:

- Origin policy: 10 tests (`origin-policy.test.ts`) — narrowing-only allowlist, fail-closed
  on malformed entries.
- Origin hardening: 4 tests — strict origin parsing, empty-Origin handling.
- HTTP surface: 12 tests (`http-verification.verify.ts`) — loopback binding, CORS grants,
  DNS-rebinding refusal.
- Manifest: 2 tests (`agent-manifest.test.ts`) — `workbuddy/mcp.json` equals `AGENT_TOOLS`,
  and no ops-only tool is exposed to the agent. This test is what caught the drift when
  `get_caller_context` was added.
- Governance: `execution-flow.test.ts`, `list-tools.test.ts`.

---

## 7. Totals

| Suite | Tests | Result |
| --- | --- | --- |
| `@dextra/mcp-server` | 75 | 75 pass, 0 fail |
| Whole repo (`npm test`) | 171 | 171 pass, 0 fail |

Baseline before this work was 150 across the repo. The increase is the new authorization
suite (15) plus the expanded contract tests in `auth.test.ts` (5 → 12). No existing test was
removed or weakened; two count assertions (`10`/`15`) were replaced with contract-derived
assertions (`11`/`16`) because a hardcoded count cannot notice a tool being added.
