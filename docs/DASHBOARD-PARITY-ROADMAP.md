# Roadmap: Parity Dashboard Next.js (:3000) ↔ Statis (:8900)

Target: tampilan dan perilaku `apps/web` (Next.js) identik dengan `apps/dashboard` (statis),
dengan data nyata dari API, tanpa regresi pada 25 route yang sudah ada.

Referensi desain: `apps/dashboard/index.html`, `apps/dashboard/styles/*`, `apps/dashboard/js/*`.
Target teknis: `apps/web` (Next.js 16, React 19, Tailwind 4 via globals.css, port 3000).

## Inventaris layar (statis → Next.js)

| # | Layar statis (hash route) | Route Next.js | Status |
|---|---|---|---|
| 1 | #/overview | / | Struktur ada, visual parsial |
| 2 | #/assistant | /assistant | Ada, perlu styling |
| 3 | #/office-agent | /office-agent | Ada |
| 4 | #/requests | (belum) | Belum ada |
| 5 | #/my-work | (belum) | Belum ada |
| 6 | #/work-packages | /work-packages | Ada |
| 7 | #/board | /board | Ada |
| 8 | #/execution | /executions | Ada (nama beda) |
| 9 | #/workforce | /agents | Ada (nama beda) |
| 10 | #/analytics | /analytics | Ada |
| 11 | #/explorer | /explorer | Ada |
| 12 | #/skills | /skills, /skills/[slug] | Ada |
| 13 | #/workflow | /workflows, /workflows/runs | Ada |
| 14 | #/approvals | /approvals | Ada |
| 15 | #/review | (belum) | Belum ada |
| 16 | #/mandates | /mandates | Ada |
| 17 | #/security | /security | Ada |
| 18 | #/audit | /audit | Ada |
| 19 | #/policies | /policies | Ada |
| 20 | #/permissions | /access | Ada (nama beda) |
| 21 | #/integrations | (belum) | Belum ada |
| 22 | #/data-management | /data-management | Ada |
| 23 | #/access | /access | Ada |
| 24 | #/tokens | /tokens | Ada |
| 25 | #/service-identities | (belum) | Belum ada |
| 26 | #/settings | (belum) | Belum ada |

Total: 26 layar statis, 25 route Next.js. Gap route: requests, my-work, review, integrations,
service-identities, settings (6 route baru).

## Fase P0 — Fondasi visual bersama (1 sesi)

Tujuan: semua layar Next.js otomatis terlihat seperti statis tanpa ubah per-halaman.

1. Port design tokens statis ke `apps/web/app/globals.css`: warna, spacing, radius, shadow, font (Plus Jakarta Sans + Inter), Material Symbols.
2. Buat komponen shared di `apps/web/components/`:
   - `Sidebar` (6 grup nav, collapsible, active state)
   - `Topbar` (breadcrumb, Copilot, search ⌘K, theme toggle, notifikasi, user menu)
   - `Tabs` (tab bar dengan close)
   - `KpiCard`, `Banner`, `DataTable`, `Chart` (7 hari)
3. Rewrite `apps/web/app/layout.tsx` memakai Sidebar + Topbar + Tabs (ganti inline sidebar lama).
4. Tambah route baru: `/requests`, `/my-work`, `/review`, `/integrations`, `/service-identities`, `/settings`.
5. Verifikasi: `pnpm --filter @dextra/web typecheck` + Playwright screenshot per route.

Deliverable: shell identik, semua route pakai layout baru.

## Fase P1 — Overview + Work Management (1 sesi)

Layar: Overview, Work Packages, Task Board, Execution History, My Requests, My Work.

1. Overview: greeting, 4 KPI, chart 7 hari (3 series), tabel work package, audit list,
   workforce card, approval queue, governance status, banner "Data v1 belum terhubung".
2. Work Packages: tabel + filter + sort + detail.
3. Task Board: kanban kolom.
4. Execution History: tabel eksekusi + status.
5. My Requests / My Work: list personal.

Data: pakai `getOverview`, `listPlans`, `listExecutions`, `listWorkPackages` dari `lib/api.ts`;
jika endpoint gagal → banner statis (bukan angka contoh).

## Fase P2 — Governance + Workforce + Intelligence (1 sesi)

Layar: Approval Inbox, Review & Validation, Mandates, Security Center, Audit Trail,
Policies, Permissions, Workforce, Analytics, Data Explorer, Skill Registry, Workflow.

1. Approval Inbox: antrean + detail + keputusan.
2. Review & Validation: validasi plan.
3. Mandates: list + detail + revoke.
4. Security Center: event keamanan.
5. Audit Trail: tabel append-only + verify chain.
6. Policies: list + versi.
7. Permissions: matriks role.
8. Workforce: roster agen.
9. Analytics: chart 7 hari + metrik.
10. Data Explorer: pencarian lintas entitas.
11. Skill Registry: list + detail.
12. Workflow: definisi + run.

## Fase P3 — Administration + Assistant + Office Agent (1 sesi)

Layar: Integrations, Data Management, Access Management, API Tokens, Service Identity,
Settings, AI Assistant, Office Agent.

1. Integrations: status konektor (email/calendar/docs) — baca dari API.
2. Data Management: seed/reset/export.
3. Access Management: user & role.
4. API Tokens: list/revoke.
5. Service Identity: service accounts.
6. Settings: konfigurasi.
7. AI Assistant: chat + "belum dikonfigurasi" state.
8. Office Agent: intake + plan + klarifikasi.

## Fase P4 — Polish & verifikasi (1 sesi)

1. Dark mode toggle berfungsi (persist localStorage).
2. Responsif: sidebar collapse di mobile, tab scroll.
3. Empty state konsisten ("Tidak ada hasil", "Belum ada data").
4. Error state konsisten (banner "Data v1 belum terhubung").
5. Loading skeleton.
6. Playwright E2E: screenshot diff tiap route vs statis (manual review).
7. Aksesibilitas: focus, aria-label, kontras.

## Urutan eksekusi

P0 → P1 → P2 → P3 → P4. Setiap fase diakhiri typecheck + build + screenshot review.

## Estimasi

- P0: 1 sesi (fondasi)
- P1: 1 sesi
- P2: 1 sesi
- P3: 1 sesi
- P4: 1 sesi
Total: ~5 sesi kerja.

## Catatan

- Jangan hapus route Next.js yang sudah ada; migrasi = styling + wiring, bukan penghapusan.
- Data tetap dari Python backend (:8000) dan MCP (:8765); jangan gandakan sumber data.
- Komponen shared dibuat sekali di P0, dipakai ulang di P1-P3.
- `apps/dashboard` tetap menjadi referensi visual (jangan dihapus) sampai parity tercapai.
