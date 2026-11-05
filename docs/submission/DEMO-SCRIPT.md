# DEXTRA — Demo Script (7 menit)

Setiap langkah di bawah adalah hal yang benar-benar terlihat di layar. Tidak ada
agen yang disebut namanya kalau agen itu tidak berjalan.

## 0:00–0:30 — Identitas & masalah
- Tagline: "Specialized AI workers. Human-defined authority. Accountable execution."
- Masalah: instruksi informal, multi-departemen, penerima ambigu, prompt injection, tidak ada bukti.

## 0:30–1:30 — Menerima instruksi
- Input teks di `/assistant`: "Buat notulen rapat, kirim ke Pak Budi, jadwalkan tindak lanjut Jumat siang."
- `compose()` memanggil `find_precedent("Budi")` → **dua kandidat setara**.
- DEXTRA berhenti dan bertanya: "Ada 2 kandidat penerima… sebutkan departemennya." Tidak memilih salah satu (TC-001).
- Sebutkan yang dimaksud; rencana disusun untuk orang itu.

## 1:30–2:30 — Rencana disusun server
- `create_plan` menyimpan rencana: penerima, kanal, jadwal, isi, risiko.
- Tunjukkan `plan_id` dan `plan_hash` — yang disetujui nanti adalah versi ini, bukan ringkasan.
- Sebut jujur: penyusunnya deterministik (`packages/plan`), bukan LLM. Tidak ada Dispatcher.

## 2:30–3:30 — Policy Validator
- Deterministic engine: office hours, hari libur, zona waktu, recipient scope, bulk egress, injection.
- Tunjukkan finding: jadwal Jumat 12.00 → `FRIDAY_PRAYER_CONFLICT`, status `NEEDS_REVIEW`.
- Tawarkan alternatif jam, bukan memilih sendiri.

## 3:30–4:30 — Human approval
- Dashboard: rencana lengkap (penerima ter-mask, isi utuh, waktu + zona, `plan_hash`, temuan).
- Approver menyetujui → `submit_approval` mengikat keputusan pada hash itu.

## 4:30–5:30 — Execution (mock)
- Mock Executor memvalidasi mandat lagi (hash, `action_id`, penerima, waktu, TTL).
- Email simulasi muncul di Mock Inbox dengan `mock_message_id`.
- Sebut jujur: tidak ada email sungguhan yang dikirim.

## 5:30–6:30 — Audit trail
- Audit Center: request → plan → review → approval → mandate → execution.
- Tunjukkan blocked action (penerima di luar scope).
- **Ekspor audit** dan jalankan verifier di terminal:
  `npm run audit:verify -- data/exports/<id>.manifest.json`
  Semua PASS. Lalu ubah satu baris di artefak dan jalankan lagi → `NOT VERIFIED`,
  `chain.hash` gagal. Ini bukti yang bisa diperiksa orang lain tanpa dashboard.

## 6:30–7:00 — Penutup
- Ringkasan governance: baca boleh otomatis, tulis harus lewat mandat.
- Roadmap customer ops (bukan MVP).

## Prasyarat demo
- MCP server di 127.0.0.1:8765, dashboard lewat `npm run dev:dashboard`.
- Data di-seed: `npm run demo:reset`.
- Browser Chrome, viewport 1920×1080.
- Siapkan satu ekspor audit sebelum tampil, supaya langkah 5:30 tidak menunggu.
