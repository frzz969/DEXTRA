# DEXTRA — Demo Script (7 menit)

## 0:00–0:30 — Identitas & masalah
- Tagline: "Specialized AI workers. Human-defined authority. Accountable execution."
- Masalah: instruksi informal, multi-departemen, penerima ambigu, prompt injection, tidak ada bukti.

## 0:30–1:30 — Office Agent menerima instruksi
- Input teks: "Buat notulen rapat, kirim ke Pak Budi, jadwalkan tindak lanjut Jumat siang."
- Workforce Dispatcher mengklasifikasikan: meeting_follow_up.
- Dua Budi ditemukan → bertanya klarifikasi (TC-001).

## 1:30–2:30 — Specialist execution
- Executive Assistant: draf email + agenda.
- Administrative Officer: notulen.
- Hasil digabung → Unified Work Package (status NEEDS_REVIEW / READY setelah klarifikasi).

## 2:30–3:30 — Policy Validator
- Deterministic engine: office hours, hari libur, zona waktu, recipient scope, bulk egress, injection.
- Tunjukkan finding (mis. jadwal Jumat 12.00 benturan salat Jumat → alternatif).

## 3:30–4:30 — Human approval
- Dashboard: tampilkan rencana lengkap (penerima, konten, waktu, risiko, temuan).
- Approver menyetujui → mandat diterbitkan.

## 4:30–5:30 — Execution (mock)
- Mock Executor validasi mandat (hash, action_id, recipient, waktu).
- Email simulasi muncul di Mock Inbox.
- Audit mencatat execution_completed.

## 5:30–6:30 — Audit trail
- Audit Center: request → plan → review → approval → mandate → execution.
- Tampilkan blocked action example (recipient di luar scope).

## 6:30–7:00 — Penutup
- Ringkasan governance: baca boleh otomatis, tulis harus lewat mandat.
- Roadmap customer ops (bukan MVP).

## Prasyarat demo
- MCP server di 127.0.0.1:8765, dashboard di 127.0.0.1:3000.
- Data di-seed: `npm run demo:reset`.
- Browser Chrome, viewport 1920×1080.