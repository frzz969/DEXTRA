# DEXTRA Dashboard

The DEXTRA operations dashboard — **Governed Enterprise AI Workforce & Operations Platform**.

> Specialized AI workers. Human-defined authority. Accountable execution.

This dashboard replaces the 14 standalone HTML files that used to live in this folder with a single
application shell, one design system, and a route-based information architecture.
The previous build lived in `apps/dashboard-legacy/`. That folder is git-ignored and therefore
**not present in this repository** — it only exists on the machine where the migration ran.
To see the old build, check out a commit before `a1ecbd3`.

## Run

No build step, no CDN, no dependencies.

```bash
# terminal 1 — MCP server on 127.0.0.1:8765
npm run dev:mcp

# terminal 2 — static dashboard on 127.0.0.1:8899
npm run dev:dashboard
# http://127.0.0.1:8899
```

Without a token the dashboard runs in **demo mode** and says so on every screen. To see live data,
paste the ops token on `/login`. The store starts empty — plans are only created through the
assistant, never written by hand — so populate it with records the real engine produced:

```bash
npm run demo:flow    # create -> approve -> execute, plus one waiting and one policy finding
npm run demo:reset   # empty the store again
```

`demo:flow` drives the actual MCP server, so what appears on screen is the output of the real
policy engine and executor, traceable in the audit trail. It is not seeded JSON.

Useful query parameters:

| Parameter | Values | Purpose |
|---|---|---|
| `role` | `operations_manager` (default), `governance_lead`, `legal_reviewer`, `finance_approver`, `requester`, `auditor`, `org_admin` | Preview the dashboard as another role. Navigation, buttons and gated routes react to it. |
| `theme` | `light`, `dark` | Force a theme without touching stored preference. |
| `mandate` | any mandate id | Opens that mandate's drawer on `/mandates`, then clears itself from the URL. |

## How the references were used

| Layer | Source | Applied to |
|---|---|---|
| Visual foundation | Adminator | Shell composition, sidebar/topbar, card and table patterns, KPI blocks, chart presentation, light/dark token contract, responsive breakpoints |
| Functional depth | vue-element-admin | Permission-aware navigation, breadcrumbs + open-page tabs, command palette, table sort/filter/search/paginate, drawers and dialogs, multi-step review, validation and empty/error states |
| Product identity | DEXTRA | Terminology, modules, governance rules, mandate model, specialist roles, audit semantics |

Nothing from either repository's business domain was copied.

## Route map

**Workspace** — `/overview` · `/assistant` · `/requests` · `/my-work`
**Work management** — `/work-packages` · `/work-packages/:id` · `/board` · `/execution`
**Workforce** — `/workforce`
**Governance** — `/approvals` · `/review` · `/review/:id` · `/mandates` · `/audit` · `/policies`
**Administration** — `/permissions` · `/integrations` · `/settings`
**Bare** — `/login` · `/forbidden` · `/not-found`

## Legacy → new mapping

Every original page is still reachable. Nothing was dropped.

| Legacy file | New route | Note |
|---|---|---|
| `index.html` | `/overview` | Entry redirect |
| `overview.html` | `/overview` | Recomposed with real DEXTRA metrics |
| `buat-permintaan.html` | `/assistant` + "Buat permintaan" | Free-text request → structured plan |
| `permintaan-saya.html` | `/requests` | Scoped to the current user |
| `work-package.html` | `/work-packages`, `/work-packages/:id` | List + detail |
| `kotak-persetujuan.html` | `/approvals`, `/review/:id` | Inbox + decision surface |
| `tinjau.html` | `/review`, `/review/:id` | Queue + single review |
| `mandat.html` | `/mandates` | Mandate directory |
| `kebijakan.html` | `/policies` | Rule catalogue with reason codes |
| `audit.html` | `/audit` | Append-only record |
| `workforce.html` | `/workforce` | Specialist load |
| `direktori-workforce.html` | `/specialists` | Capability cards |
| `pengaturan.html` | `/settings` | Organisation configuration |
| `masuk.html` | `/login` | Split auth screen |

### New screens (no legacy equivalent)

These are expansions, not migrations — flagged so they are not mistaken for existing product surface:

- `/my-work` — work needing *this* user's attention, distinct from requests and approvals
- `/board` — kanban view over the same work packages
- `/execution` — execution records with mandate, adapter, result and duration
- `/users`, `/permissions` — role administration and the capability matrix
- `/integrations` — runtime and adapter connections, each labelled by real status

## Design system

Single token contract in `assets/css/dashboard.css`. Light and dark consume the same
variables; no page defines its own palette.

- **Brand** `--brand-600 #5b3fd6`, with `500/700/300/100/050` ramp
- **Status** success / warning / danger / info, each with a `600` and `100` step
- **Neutrals** `--page`, `--surface`, `--surface-2/3`, `--border`, `--text`, `--text-2`, `--muted`, `--faint`
- **Radius** `4 / 6 / 9 / 12 / 16 / full`
- **Elevation** four shadow steps, used by cards, menus, modals and drawers
- **Type** Plus Jakarta Sans (display) + Inter (body), Material Symbols for icons — all self-hosted in `assets/vendor/`

Components are built once in `assets/js/ui.js` (`card`, `kpi`, `table`, `badge`, `modal`,
`drawer`, `menu`, `toast`, `confirm`, `bars`, …) and reused by every view. A view never
hand-rolls a table or a dialog.

## Route ↔ backend contract

`sources.js` is the single source of truth for what backs each route. Every route declares its
domain, its MCP tool(s), the repo modules that support it, and a state:

| State | Meaning |
|---|---|
| `live` | Renders real server data when the MCP server is running |
| `partial` | Some data is real; the rest is demo because no list/aggregate tool exists |
| `demo` | No backend surface exists yet — demo data only, and the UI says so |
| `none` | Not a data route (login, forbidden, not-found) |

Current split across 21 routes: **15 live · 3 partial · 0 demo · 3 non-data**.

`/requests`, `/my-work`, and `/board` moved from `partial` to `live` once the server began
recording `requester_id`/`assignee_id`; without a bound principal they degrade to the whole
workspace and say so, which is a stated limitation rather than missing backend surface.

There is no `demo` route left. Each one was either given a real backend surface or removed:
`/workforce` now reads the roster through `list_specialists`; `/permissions` renders the
capabilities the server reports for the token; `/users` and `/specialists` were deleted rather
than filled, because the identity model has no per-user roles and the roster was already covered
by `/workforce`.

Each route also declares its `intents` — what the Copilot may offer while the operator is
standing on that screen. The same rule applies: an intent may only name a tool that exists, a
compute that is implemented, and a route that is registered. `npm run test:dashboard` fails the
build if any of those stops being true, so a chip can never be dead.

`/integrations` renders this table in the UI, so the claim can be checked rather than trusted.
Adding a route means adding an entry there; adding a tool to the MCP server means updating it.

## Copilot — one assistant, every route

The assistant is not a page you have to visit. It is a panel (`Ctrl/⌘ + J`, or the **Copilot**
button in the topbar) that stays mounted while you navigate, so a question asked on `/mandates`
is still there when you land on `/audit`. When the route changes, the suggestions change with
it — the conversation does not.

Two rules decide what it may do, and they are the product's rules:

1. **It answers with what the server said.** `tool` intents call the same MCP bridge the page
   uses. When the server is not live it refuses and says so; it never substitutes a plausible
   number. A governance product cannot ship an assistant that guesses.
2. **It never decides.** `submit_approval`, `issue_mandate`, `execute_action` and
   `revoke_mandate` are unreachable from the assistant. Those intents are `handoff`: they open
   the right screen and explain why the human has to press the button. `copilot.js` contains no
   call to any of them, and the contract test enforces that.

Intent kinds, as declared per route in `sources.js`:

| Kind | Behaviour |
|---|---|
| `answer` | Computed from the store the page already hydrated. No write. |
| `tool` | Calls one MCP tool. Refuses when the server is not live. |
| `go` | Navigates. |
| `handoff` | Deliberately does not act; explains why a human must. |

Free text is matched against the route's intents by keyword — not a language model — so the same
question gives the same answer twice. When nothing matches confidently, it says so and lists the
options instead of picking one. `susun rencana …` routes to the same planner the `/assistant`
page uses, which is why the two surfaces can never disagree.

## Data honesty

The dashboard never implies a backend call that did not happen.

- `D.store.mode` is `demo` unless the local MCP server is detected.
- In demo mode a persistent banner states the data is example data and no real operation runs.
- Every state-changing action shows a toast that names demo vs live explicitly.
- Metrics are derived from work packages and the audit log. No model performance metrics
  (accuracy, latency, utilisation) are invented — the backend does not expose them, so those
  columns are deliberately absent.
- Integration cards state `Terhubung`, `Mock adapter`, or `Direncanakan` — never a blanket "connected".

## Governance rules enforced in the UI

- Approving a work package issues a mandate; it does **not** execute. Execution is a separate,
  explicit step: open the mandate and run the action, which calls `execute_action` against a
  re-validated mandate.
- A policy-blocked package renders a disabled approve button **with the blocking findings and
  reason codes shown**, not a silent dead control.
- Rejection and revision require a written reason. The confirm dialog blocks submission until
  the field is filled, and the reason is written to the audit trail.
- Authority-changing actions (issue mandate, revoke mandate, change policy) always go through
  a confirmation dialog with the consequence spelled out.
- Permission-restricted navigation stays visible but locked, so users can see that a capability
  exists and why they cannot reach it.

## Structure

```
apps/dashboard/
  index.html               shell host
  assets/css/dashboard.css design system + all component styles
  assets/js/core.js        router, store, permissions, formatting, theme
  assets/js/sources.js     route ↔ MCP tool ↔ module contract (route states)
  assets/js/data.js        demo dataset (org, plans, mandates, policies, audit)
  assets/js/ui.js          component library
  assets/js/shell.js       sidebar, topbar, breadcrumbs, tabs, command palette
  assets/js/copilot.js     assistant engine: route context, intents, computes, planner
  assets/js/copilot-panel.js  the panel itself (mounted once, survives navigation)
  assets/js/views/*.js     one file per screen group
  assets/vendor/           self-hosted fonts and icon font
  tests/                   contract test: no intent may point at a missing tool/compute/route
```

## Known gaps

Honest list of what is **not** finished, so it is not read as working:

- **Storage is files, not a database.** Every mutation goes through the local MCP server and is
  written to `data/*.json` (atomic write, serialized per file). It survives a refresh and a
  restart, but there is no concurrency control beyond a single process, no transactions, and no
  PostgreSQL yet — the schema for that exists in `database/` and has never been run against a
  live database.
- **Ownership is only partly recorded.** `requester_id`/`assignee_id` are filled by the server
  from the principal bound to the token, so plans created before that binding have neither. Those
  routes say so on screen instead of guessing.
- **`/board` drag is deliberately local.** The column is governance state, and governance state is
  decided by the policy engine plus a human approval — not by dragging a card. Persisting a move
  would let the UI claim a plan was approved because someone dragged it. The banner says this.
- **`/assistant` composes with local rules, not a model.** Recipients come from `find_precedent`;
  the plan draft is deterministic. It does not decide anything.
- **`/integrations` cannot connect anything.** `manage_integrations` is not granted to any scope,
  so the page is gated and adapter status is descriptive only.
- **Settings preferences are browser-local.** Organisation rules come from the server; theme and
  display choices do not.
- **The token has no expiry and no revocation.** One token maps to one principal; rotating it means
  changing an environment variable.

## Tests

```bash
npm run test:dashboard   # contract: no intent points at a missing tool/compute/route
npm run test:e2e         # opens the real dashboard in Chrome, checks every route
npm run test:all         # the full gate, including both of the above
```

`test:e2e` needs a Chrome or Chromium install (`DEXTRA_CHROME` overrides the path). It starts the
MCP server and the static server itself if they are not already running, then fails on any runtime
exception, any console error, or any route that renders an empty `#view-root`. It prints `LEWATI`
and exits 0 when no browser is found, so CI without Chrome stays green — which is why it is not the
only check: `scripts/check-syntax.mjs` covers the parse layer without a browser.

- Excel/CSV export on `/requests` and `/execution` produces a client-side file from demo rows.
- Rich-text / Markdown / JSON editors from the vue-element-admin reference were **not** adopted —
  DEXTRA has no content-authoring workflow that would justify them.
- Mobile navigation is functional (drawer + scrim) but not gesture-driven.
