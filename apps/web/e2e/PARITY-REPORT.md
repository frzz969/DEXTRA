# Parity Audit — apps/web (Next.js :3000) vs apps/dashboard statis (:8900)

Tanggal: 2026-11-06 · Alat: Playwright (Chromium, script `e2e/parity-audit.mjs`, data mentah `e2e/parity-report.json`, 55 screenshot di `e2e/screenshots/`).
Catatan: Playwright MCP tidak tersedia di sesi ini (katalog `execute` tidak memuatnya), jadi dipakai Playwright lokal yang sama engine-nya.

## Kondisi server saat audit
- Backend :8000, MCP :8765, statis :8900 sudah jalan. Web :3000 awalnya jalan dengan env salah (`DEXTRA_API_URL` menunjuk port mati :8001 → semua halaman "fetch failed"). Web di-restart dengan env benar (`DEXTRA_API_URL=http://127.0.0.1:8000`, `DEXTRA_API_TOKEN=ops-dev-token`, `DEXTRA_MCP_URL=http://127.0.0.1:8765/`). **Ini temuan proses #1: jangan start web dengan env playwright-config (:8001) di luar test.**
- Setelah restart: **26/26 route web HTTP 200, 0 pageerror, 0 request gagal.** Statis: 26/26 hash route dirender (status `?` karena SPA same-document; tidak ada pageerror).

## Hasil per halaman (web, setelah env benar)
Semua merender shell + sidebar + topbar + tabs identik. Data tenant `kenari` benar-benar kosong, jadi mayoritas menampilkan empty-state jujur ("Belum ada …"), bukan error. Itu benar secara UX.

| Route | Status | Catatan |
|---|---|---|
| `/` Overview | 200 | KPI 0 semua; banner `approval_response_time` belum dapat dihitung (jujur). Beda set KPI vs statis. |
| `/board` | 200 | **BUG**: tidak ada kolom kanban sama sekali saat kosong (hanya form filter + teks). Statis selalu render 5 kolom (Draf/Klarifikasi/Menunggu/Diblokir/Selesai). |
| `/approvals` | 200 | Lengkap: antrean + riwayat + form Challenge (Setujui/Tolak/Minta revisi). Interaksi aman teruji (toggle tema). |
| `/audit` | 200 | Empty-state jujur. |
| `/agents` (=statis `/workforce`) | 200 | Empty-state. Penamaan beda dari statis. |
| `/executions` (=statis `/execution`) | 200 | Empty-state. Penamaan beda dari statis. |
| `/analytics` | 200 | Banner jujur (metrik tak terukur ditandai). |
| `/explorer` | 200 | Banner jujur (tanpa pencarian server). |
| `/skills`, `/workflows` (=statis `/skills`,`/workflow`) | 200 | Empty-state; statis menampilkan konten DEMO. Penamaan beda (`workflows` vs `workflow`). |
| `/requests`, `/my-work` | 200 | Empty-state. |
| `/review` | 200 | Render ok. |
| `/integrations` | 200 | **GAP**: backend tidak punya endpoint status konektor → halaman hanya banner. Statis punya panel koneksi. |
| `/service-identities` | 200 | **403 nyata**: `GET /api/v1/service-accounts` → "Pemanggil tidak memiliki capability manage_integrations". Token ops-dev tidak punya scope itu; halaman menampilkan banner error, bukan state "tidak ada akses" yang rapi. |
| `/settings` | 200 | **GAP**: backend tidak punya endpoint konfigurasi. |
| `/assistant` | 200 | "AI belum dikonfigurasi" — `DEXTRA_AI_API_KEY` kosong (env, bukan bug). |
| `/office-agent` | 200 | Form ada, siap pakai. |
| `/tokens` | 200 | Render ok. |
| `/access` | 200 | **GAP**: backend tidak punya endpoint tambah/ubah/cabut akses (hanya baca). |
| `/mandates`, `/policies`, `/security` | 200 | Empty-state / render ok. |
| `/work-packages` | 200 | Empty-state. |
| `/data-management` | 200 | **GAP**: seed/reset/export tidak tersedia di backend. |
| `/monitoring` | 200 | Ekstra di web (tidak ada di statis). |
| `/permissions` | **404** | **GAP**: ada di statis (kapabilitas token), tidak ada di web. |
| `/admin`, `/account` | 200 | Ekstra di web (statis: `/account` ada, `/admin` tidak). |

## Parity visual (ui-ux-pro-max)
Bahasa desain sama: sidebar grup, KPI card lavender, banner warning, tabs bar, Copilot FAB. Perbedaan konkret:
1. **Overview**: web tanpa sparkline/footnote KPI, tanpa chart "Aktivitas eksekusi & keputusan" (statis render chart walau nol; web hanya teks empty-state), tanpa kartu "Antrean persetujuan" + CTA, identitas user generik ("DEXTRA Operator") vs statis ("Farhan Pratama, Operations Manager"). Topbar statis ada pill "Copilot"; web hanya FAB.
2. **Board**: gap terbesar — web kehilangan seluruh struktur kanban saat data kosong.
3. **Sidebar**: label web campuran ID/EN ("Papan", "Paket Kerja", "Kebijakan") vs statis konsisten EN ("Task Board", "Work Packages", "Policies"). Ikon Analytics & Monitoring sama (`monitoring`) — membingungkan.
4. Statis menampilkan banner "Data v1 belum terhubung … gateway MCP belum menerima token ops" di semua halaman; web tidak menampilkan status MCP sama sekali (padahal MCP :8765 hidup) — status koneksi backend/MCP tidak setara.

## Daftar gap prioritas
- **P0**: `/board` tidak render kolom kanban saat kosong → kolom harus selalu digambar (statis: 5 kolom + "Kosong").
- **P0**: `/service-identities` 403 dengan token ops-dev → putuskan: tambah capability ke token ops, atau tampilkan state 403 yang rapi. Bukti: `web-service-identities.png`, curl di atas.
- **P1**: `/permissions` 404 di web (ada di statis) → tambah route atau redirect ke `/access`.
- **P1**: Endpoint backend hilang: status konektor (`/integrations`), konfigurasi (`/settings`), mutasi akses (`/access`), seed/reset/export (`/data-management`).
- **P2**: Visual parity Overview (sparkline, chart aktivitas, kartu antrean, nama user, pill Copilot, status MCP di topbar).
- **P2**: Penamaan route beda dari statis (`agents/workforce`, `executions/execution`, `workflows/workflow`) — pertimbangkan alias/redirect agar link lama tidak putus.
- **P2**: Ikon Analytics vs Monitoring identik; label sidebar campuran bahasa.

## Bukti
- `e2e/screenshots/web-*.png` (26 route + 3 interaksi), `static-*.png` (26 hash route), `e2e/parity-report.json`.
- Interaksi aman yang diklik Playwright: toggle tema dark/light di `/`, `/approvals`, `/board` — semua berfungsi, URL tidak berubah, tidak ada aksi destruktif yang dijalankan.
