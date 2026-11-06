# Demo evidence — Accountability A1–A7

Tanggal pengambilan: 2026-11-06T05:18:33Z, backend `http://127.0.0.1:8000`, token `ops-dev-token`.
Plan `pln_demo_20261106121723`, approval `apr_20261106051739_9437cdb0`, mandate `mnd_cd1a740e913176a9`, execution `exe_1793942269804_1ea811`.

File pisah: `approvals.json`, `executions.json`, `audit-verify.json`. Dokumen ini ringkasan; angka dan ID diambil langsung dari respons mentah di atas.

## Fakta teramati (dari respons, bukan interpretasi)

| # | Status demo | Bukti (endpoint) |
|---|---|---|
| A1 | Plan diterima. Status `partially_approved`, 1 aksi `act_demo_1` (`send_email` ke `ops@example.com`, subjek `Laporan mingguan`), `findings` kosong, `plan_hash` `c29c46cf...5ba1c56`. | `GET /office-agent/plans/pln_demo_20261106121723`; audit seq 3 `office_plan_received` |
| A2 | Tidak dieksekusi di sesi ini. Plan yang tersimpan punya `findings: []` dan `validation: {}` — tidak ada bukti evaluasi policy terpisah pada jalur demo ini. | Plan di atas; tabel A2 di accountability sheet |
| A3 | Approval `approved` dengan `reason` `Demo E2E disetujui.`, `decided_at` 2026-11-06T05:17:39.868645, `mandate_id` terisi. `approver_id` = `legacy:ops`. | `GET /approvals`; audit seq 4 `approval_recorded` |
| A4 | Mandat `mnd_cd1a740e913176a9` berasal dari approval itu, `issued_at` 05:17:39.885424, `expires_at` 05:47:39.885424 (selisih 30 menit), `params_hash` `50950e55...830b`, status teramati `executing` dan `usable: false`. Eksekusi `exe_1793942269804_1ea811` `succeeded`, adapter `outbox`, `duration_ms` 8, `result_id` `9c9b742f...f4c69`, path outbox lokal. | `GET /mandates`, `GET /executions?limit=5`; audit seq 5 `mandate_issued`, seq 6 `action_executed` |
| A5 | Tidak dilakukan di sesi ini. `revoked_at` masih `null`, tidak ada event `mandate_revoked` pada list audit. | `GET /mandates`; `GET /audit-events?limit=20` |
| A6 | `GET /audit-events/verify` → `ok: true, checked: 6, chain_versions: [2]`. `GET /audit-events` → 4 event seq 3–6 (`office_plan_received`, `approval_recorded`, `mandate_issued`, `action_executed`). | `audit-verify.json` |
| A7 | Tidak dibuktikan perubahan apa pun pada sesi ini. Tidak ada panggilan MCP baru yang diambil dalam langkah ini. | — (perlu bukti terpisah) |

## Yang TIDAK bisa dibuktikan dari data ini

- **Nama manusia approver.** `approver_id` adalah `legacy:ops` di approval, mandat, dan audit seq 4. Ini nama principal token, bukan nama orang. Jangan nyatakan "oleh Bapak/Ibu X disetujui" — tidak ada data itu.
- **Bahwa eksekusi mengirim email ke provider eksternal.** Adapter-nya `outbox` (file lokal `data/outbox/...task.json`). Alamat `ops@example.com` adalah alamat dummy di params plan.
- **Isi audit seq 1–2.** Verify memeriksa 6 event dan lolos, tapi list ber-filter tenant hanya mengembalikan 4 event. Kita tidak melihat seq 1–2; kita hanya tahu rantai tidak rusak di server.
- **Atribusi `tenant_id` dari respons audit.** Kolom ini tidak muncul di JSON list; atribusi tenant ikut hash chain v2 menurut kode (`docs/ACCOUNTABILITY-SHEET.md`), tapi tidak terlihat di output endpoint ini.
- **Alasan penolakan / revoke / policy deny.** Tidak ada event `action_blocked` atau `mandate_revoked` di sesi ini; jangan klaim jalur penolakan sudah teruji — hanya terbukti jalur lolosnya (`action_executed` dengan `decision: allow`).

## Rantai untuk ditunjukkan ke juri

`office_plan_received (seq 3)` → `approval_recorded (seq 4)` → `mandate_issued (seq 5)` → `action_executed (seq 6)`, dengan `verify` `ok: true`. Setiap baris di atas bisa dicek lewat `entry_hash` di `audit-verify.json`.
