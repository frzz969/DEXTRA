# DEXTRA Dashboard — Design Spec

## 1. Design System

**Warna (CSS vars)**
- `--bg:#F7F7FC`, `--surface:#FFFFFF`, `--surface-low:#F1EEFF`
- `--text:#202033`, `--muted:#77778C`, `--border:#EAE9F1`, `--border-strong:#D4D3E0`
- `--primary:#7357E8`, `--primary-hover:#5741BD`, `--primary-soft:#F1EEFF`
- `--success:#269B72` (`--success-soft:#E8F7F1`), `--warning:#E6A23C` (`--warning-soft:#FEF7ED`)
- `--danger:#D95362` (`--danger-soft:#FDF2F3`), `--info:#4688D8` (`--info-soft:#EDF4FC`)

**Tipografi (offline)**: `font-family: 'Segoe UI','Helvetica Neue',system-ui,sans-serif;` Monospace untuk hash/id: `Consolas,'Courier New',monospace`.
- headline-xl 32/700, headline-lg 24/600, headline-md 20/600, headline-sm 16/600
- body-lg 16/400, body-md 14/400, body-sm 12/400, label-sm 11/600 uppercase

**Spacing**: xs 4, sm 8, md 16, lg 24, xl 32. Gutter 24 (mobile 16), margin 32 (mobile 16).
**Radius**: sm 4, md 8, lg 16, xl 20, full 9999.
**Shadow**: L1 `0 2px 8px -2px rgba(32,32,51,.04),0 1px 4px -1px rgba(32,32,51,.02)`; L2 `0 8px 24px -4px rgba(115,87,232,.08),0 2px 6px -1px rgba(32,32,51,.04)`; L3 `0 16px 40px -8px rgba(32,32,51,.12),0 0 0 1px rgba(234,233,241,.8)`.

## 2. Layout Shell
- Sidebar kiri 240px (mobile: drawer), nav hash: `#overview`, `#buat`, `#persetujuan`, `#tinjau`, `#detail`, `#audit`, `#inbox`, `#mandat`.
- Header 64px: judul halaman + status koneksi API (online/offline) + badge operator.
- Main: max-width 1280px, padding 32px, grid 12 kolom.

## 3. Komponen Reusable
- `.card` (bg surface, border, radius-lg, shadow-L1, padding 24)
- `.badge` pill: `.badge--success/warning/danger/info` (warna+ikon+teks)
- `.status-badge` pill dengan ikon: READY/NEEDS_REVIEW/BLOCKED/EXECUTED
- `.risk-badge` (severity: low/medium/high/critical) kata+ikon+posisi kiri
- `.btn` primary/secondary/tertiary/danger
- `.metric-card` (angka + label + delta)
- `.approval-card` (header status, penerima, waktu, isi scroll, risiko, hash, aksi)
- `.scope-panel` (action scope: action_type, target masked, channel, schedule)
- `.findings` list (severity badge + message utuh)
- `.timeline` (audit events lama→baru, actor, reason_code, detail)
- `.audit-table` (at, type, actor, subject, reason, detail)
- `.empty-state`, `.error-state`, `.loading-skeleton`

## 4. Layar

### 4.1 Overview (#overview)
- Grid: 4 metric card (rencana menunggu, diblokir, dieksekusi, mandat aktif) + 2 kolom (aktivitas terbaru timeline | antrian persetujuan).
- State: loading skeleton, empty "Belum ada rencana".

### 4.2 Buat Permintaan (#buat)
- Form: intent (textarea), penerima (search dropdown masked), channel (select), jadwal (start/end/timezone), konten (subject, body utuh), submit "Buat Rencana".
- State: validating, error validasi per field.

### 4.3 Kotak Persetujuan (#persetujuan)
- List approval cards. Tiap card: status badge, intent, penerima masked, jadwal zona, isi pesan utuh (scroll), risk badge, findings list, plan_hash (12 char + "sidik rencana").
- Aksi: Setujui (disabled + alasan jika BLOCKED), Tolak, Minta revisi.
- State: empty "Belum ada pesan. Tidak ada yang dikirim tanpa mandat.", loading, error.

### 4.4 Tinjau Work Package / Scope Inspector (#tinjau)
- Panel kiri: action scope (action_type, target masked, channel, schedule). Panel kanan: findings + risk + hash. Bawah: isi pesan utuh.
- State: ambiguous (dua kandidat Budi, pilih penerima) dengan radio; blocked (tombol setujui mati + alasan tertulis).

### 4.5 Work Package Detail & Audit (#detail/#audit)
- Tab Detail: metadata, scope, content, risk, hash, status.
- Tab Audit: timeline lama→baru + tabel audit. Tombol ekspor tidak ada (hindari tanpa fungsi).

## 5. Interaksi & State
- Navigasi hash-based (location.hash). Fetch ke `http://127.0.0.1:8765` JSON-RPC dengan token ops.
- Loading: skeleton, bukan spinner tanpa akhir.
- Empty: pesan Indonesia.
- Blocked: struktur berbeda (border kiri danger 4px + ikon peringatan + label "DIBLOKIR" + alasan tertulis + tombol setujui disabled).
- Error: "Sistem tidak dapat memastikan. Tidak ada tindakan dijalankan." + tombol coba lagi.
- Data sensitif ter-mask (masked_address).

## 6. Ikon (inline SVG)
- check, alert-triangle, x, clock, user, mail, shield, hash, arrow-right, refresh, menu, search, calendar.

## 7. Catatan untuk Fixer
- Implementasi: shell, routing hash, fetch JSON-RPC, render 5 layar, state handling, masked data, blocked structural.
- Mock: data seed untuk demo; label "mock execution" pada inbox; tidak ada ekspor.
- Jangan tambah tombol tanpa handler. Jangan pakai CDN/font eksternal. Inline SVG saja.
