# DEXTRA Dashboard

The DEXTRA operations dashboard — **Governed Enterprise AI Workforce & Operations Platform**.

> Specialized AI workers. Human-defined authority. Accountable execution.

This dashboard replaces the 14 standalone HTML files that used to live in this folder with a single
application shell, one design system, and a route-based information architecture.
The previous build is preserved untouched in `apps/dashboard-legacy/` as the reference of record.

## Run

No build step, no CDN, no dependencies.

```bash
cd apps/dashboard
python -m http.server 8899
# http://127.0.0.1:8899/index.html
```

Useful query parameters:

| Parameter | Values | Purpose |
|---|---|---|
| `role` | `operations_manager` (default), `governance_lead`, `legal_reviewer`, `finance_approver`, `requester`, `auditor`, `org_admin` | Preview the dashboard as another role. Navigation, buttons and gated routes react to it. |
| `theme` | `light`, `dark` | Force a theme without touching stored preference. |

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
**Workforce** — `/workforce` · `/specialists`
**Governance** — `/approvals` · `/review` · `/review/:id` · `/mandates` · `/audit` · `/policies`
**Administration** — `/users` · `/permissions` · `/integrations` · `/settings`
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

Current split across 23 routes: **10 live · 5 partial · 5 demo · 3 non-data**.

`/integrations` renders this table in the UI, so the claim can be checked rather than trusted.
Adding a route means adding an entry there; adding a tool to the MCP server means updating it.

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

- Approving a work package issues a mandate; it does **not** execute. The executor validates
  the mandate separately, and the UI says so.
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
  assets/js/views/*.js     one file per screen group
  assets/vendor/           self-hosted fonts and icon font
```

## Known gaps

Honest list of what is **not** finished, so it is not read as working:

- All mutations are in-memory. A refresh resets demo state. `D.api` is wired for the local
  MCP server but has no server to talk to in this build.
- `list_plans` / `list_mandates` exist, but the server reports no per-user ownership and no
  mandate consumption count. Routes that depend on those stay `partial` or show `—` rather than
  a guessed number.
- `/board` supports viewing and moving cards within the session; drag ordering is not persisted.
- `/integrations` cannot connect anything. Adapter status is descriptive only.
- Excel/CSV export on `/requests` and `/execution` produces a client-side file from demo rows.
- Rich-text / Markdown / JSON editors from the vue-element-admin reference were **not** adopted —
  DEXTRA has no content-authoring workflow that would justify them.
- Mobile navigation is functional (drawer + scrim) but not gesture-driven.
