# DEXTRA — Accountability Sheet (Hackathon)

Dokumen ini menggantikan lembar accountability lama yang isinya hitungan tes workspace v1. Versi hackathon ini berangkat dari jalur governance FastAPI v2 yang benar-benar ada di `backend/dextra/`, bukan dari paket TypeScript v1. Setiap baris di bawah menunjuk ke endpoint dan fungsi yang bisa dibuka di repo.

## Cara pakai lembar ini

Satu baris = satu tindakan agen. Kolom-kolomnya menjawab pertanyaan: atas mandat apa tindakan ini jalan, milik tenant siapa, role dan permission apa yang memegangnya, policy apa yang menilai, approval apa yang mengikatnya, audit event apa yang mencatatnya, dan bukti eksekusi apa yang tersimpan. Kalau satu kolom tidak bisa diisi dari data nyata, tulis *perlu dibuktikan saat demo* — jangan dikarang.

## Tabel tindakan agen

| # | Tindakan agen | Mandat | Tenant | Role | Permission (capability) | Policy | Approval | Audit event | Bukti executions |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Submit rencana Office Agent (`POST /office-agent/plans`) | Belum ada — mandat terbit belakangan setelah approval | `tenant_id` dari `require_tenant(caller)` (`modules/office_agent/router.py`) | Pemilik sesi atau service account Office Agent | `create_request` (`require_capability` di router) | `findings` + `validation` ikut tersimpan di payload rencana | Belum ada | `office_plan_received` (`audit_repo.append_event`, actor `user`/`service`) | Belum ada — eksekusi menunggu mandat |
| A2 | Evaluasi policy (`POST /policies/evaluate`) | Tidak relevan — evaluasi tidak mengeksekusi | Wajib ada; caller tanpa tenant ditolak 400 (`modules/policies/router.py`) | Pemanggil terautentikasi | `get_caller` saja di endpoint ini; penulisan policy butuh `edit_policy` | `governance/policy.py` → `evaluate`, reason code `RECIPIENT_NOT_ALLOWED`, `AMBIGUOUS_RECIPIENT`, `OUTSIDE_OFFICE_HOURS`, `HOLIDAY_CONFLICT`, `FRIDAY_PRAYER_CONFLICT`, `BULK_EGRESS_SUSPECTED`, `INJECTION_QUARANTINED` | Tidak relevan | Tidak menulis audit event di router ini; hasil evaluasi tersimpan sebagai `PolicyEvaluation` | Tidak ada |
| A3 | Approve satu tindakan (`POST /office-agent/plans/{plan_id}/actions/{action_id}/approve` atau `POST /approvals`) | Terbit otomatis bila `decision=approved`: `Mandate` dengan `params_hash`, `nonce`, `expires_at` (`governance/mandate.py` → `issue`) | Diwarisi dari approval, bukan dari klien; mismatch → `APPROVAL_TENANT_MISMATCH` | `approver` atau `admin` (lihat `ROLE_CAPABILITIES` di `core/security.py`) | `approve` | Rencana yang dinilai policy sebelumnya; penolakan policy tidak otomatis membatalkan approval — *perlu dibuktikan saat demo* apakah UI menampilkan temuan policy sebelum tombol approve ditekan | `Approval` dengan `approver_id` = `principal_id` terverifikasi, `mandate_id` terisi | `approval_recorded`, lalu `mandate_issued` bila approved (`governance/approval.py`) | Belum ada — eksekusi langkah berikutnya |
| A4 | Eksekusi tindakan (`POST /executions`) | Wajib; divalidasi ulang tepat sebelum jalan; gagal validasi → `action_blocked` dengan kode `MANDATE_REVOKED`/`MANDATE_EXPIRED`/`PARAMS_CHANGED`/`ACTION_NOT_IN_MANDATE` | Mandat milik tenant lain → `MANDATE_TENANT_MISMATCH`, tetap diaudit sebagai `deny` | `approver`/`admin` (scope `ops`) | `execute` | Tidak dievaluasi ulang di jalur ini; policy menilai rencana, mandat mengikat eksekusi — *perlu dibuktikan saat demo* bila ada pemanggilan policy di UI sebelum eksekusi | Terikat lewat `mandate.approval_id` | `action_executed` (allow) atau `action_blocked` (deny), membawa `execution_id` (`modules/execution/service.py`) | Baris `Execution`: `id`, `status`, `duration_ms`, `result_json` (`adapter`, `provider: outbox`, `result_id`, path file) |
| A5 | Cabut mandat (`POST /mandates/{mandate_id}/revoke`) | Mandat yang dicabut: `status=revoked`, `revoked_at` terisi (`governance/mandate.py` → `revoke`) | `assert_tenant_access` di router (`modules/mandates/router.py`) | `approver`/`admin` | `revoke_mandate` | Tidak relevan | Tidak relevan | `mandate_revoked` dengan `detail.reason` dari payload | Eksekusi berikutnya atas mandat itu ditolak `MANDATE_REVOKED` |
| A6 | Baca audit (`GET /audit-events`) dan verifikasi rantai (`GET /audit-events/verify`) | Tidak relevan | `require_tenant` + filter `tenant_id`; caller tanpa tenant menerima hasil kosong, bukan semua tenant (`repositories/audit.py` → `list_events`) | `auditor`, `approver`, `admin` | `view_audit` | Tidak relevan | Tidak relevan | `GET /audit-events` mengembalikan `seq`, `entry_hash`, `event_type`, `plan_id`, `mandate_id`, `execution_id` | Tidak ada — ini jalur baca bukti |
| A7 | WorkBuddy memanggil tool MCP lewat token agent (`workbuddy/mcp.json`, `127.0.0.1:8765`) | Tidak bisa menerbitkan mandat — tool `issue_mandate`/`execute_action` tidak ada di `allowedTools` | Token gateway lama memakai `DEXTRA_LEGACY_TENANT`; tanpa pengikatan, endpoint ber-tenant menolaknya (fail-closed, `core/security.py` → `_bind_legacy_tenant`) | Scope `agent`, bukan role manusia | `view_own`, `view_all`, `create_request` saja (`SCOPE_CAPABILITIES`) | Tool `validate_plan`/`get_org_rules` memanggil policy engine yang sama | Tidak bisa membuat approval — `submit_approval` tidak diekspos ke agen | Event dari server tetap tercatat; pemanggilan tanpa capability menghasilkan 403 dan dicatat sebagai `access_denied` di security events (`_record_denial`) | Tidak ada — agen tidak bisa mengeksekusi. Koneksi live *perlu dibuktikan saat demo* (`docs/WORKBUDDY-INTEGRATION-TEST.md` status BELUM) |

## Baris demo 2026-11-06 (run yang sudah terjadi)

Run ini bukan contoh. Datanya hasil curl ke backend `:8000`, tenant `kenari`, dan setiap ID di bawah bisa dicari lagi lewat endpoint yang disebut. Screenshot-nya belum ada; lane screenshot akan mengisinya di path `docs/screenshots/S3-office-agent-detail.png`, `docs/screenshots/S6-executions.png`, dan `docs/screenshots/S7-audit.png`, mengikuti placeholder di `docs/SUBMISSION.md`.

| Langkah | Bukti konkret |
|---|---|
| A1 — rencana | `POST /api/v1/office-agent/plans` (`agent-dev-token`) → 201, `plan_id: pln_demo_20261106121723`, `plan_hash: c29c46cf...`, status `received` |
| A3 — approval + mandat | `POST /api/v1/office-agent/plans/{plan_id}/actions/{action_id}/approve` (`ops-dev-token`) → 201, `approval_id: apr_20261106051739_9437cdb0`, `mandate_id: mnd_cd1a740e913176a9`. `approver_id` tercatat `legacy:ops`, identitas token, bukan nama manusia; nama principal nyata butuh sesi login manusia |
| A4 — eksekusi | `POST /api/v1/executions` → 201, `execution_id: exe_1793942269804_1ea811`, `status: succeeded`, provider `outbox`, `result_id: 9c9b742fa297450d9e28ebb2f08f4c69`. File hasilnya lokal di `data/outbox`, bukan email terkirim |
| A6 — verify | `GET /api/v1/audit-events/verify` → 200, `ok: true`, `checked: 6` |

## Cara verifikasi audit chain

Endpoint: `GET /api/v1/audit-events/verify`, implementasi di `backend/dextra/modules/audit/router.py` → `verify_audit`, yang memanggil `repositories/audit.py` → `verify_chain(db)`.

Yang dilakukan verifier: ia membaca semua `AuditEvent` urut `seq` menaik, menghitung ulang `entry_hash` dari `prev_hash` dan payload kanonik (`_payload`), lalu membandingkan dengan `prev_hash` dan `entry_hash` yang tersimpan. Payload baris chain versi 2 menyertakan `tenant_id`, sehingga atribusi tenant ikut ter-hash dan tidak bisa disunting diam-diam.

Respons sukses: `{"ok": true, "checked": <jumlah event>, "chain_versions": [1, 2]}`. Respons gagal: `{"ok": false, "broken_at_seq": <seq baris pertama yang rusak>, "checked": <jumlah event>}`. `OPERATOR-MANUAL.md` memberi instruksi operasionalnya: kalau verifikasi gagal, hentikan operasi, investigasi tampering, eskalasi. Di UI, helper-nya sudah ada sebagai `verifyAuditChain` di `apps/web/lib/api.ts`, dan halaman audit ada di `/audit`.

Daftar event audit yang dipakai di lembar ini muncul di kode yang sudah dibaca: `office_plan_received`, `approval_recorded`, `mandate_issued`, `mandate_revoked`, `action_executed`, `action_blocked`. Event lain mungkin ada di database demo; daftar lengkapnya *perlu dibuktikan saat demo* lewat `GET /audit-events?limit=100`.

## Human oversight per tingkat risiko

Pemetaan tingkat risiko di bawah memakai empat kategori dari `README.md` §Human Approval, lalu menunjuk ke penegak nyata di kode. Kategorinya bukan label marketing; tiap baris punya konsekuensi berbeda di API.

| Tingkat risiko | Contoh | Oversight manusia | Penegak di kode |
|---|---|---|---|
| Rendah — diizinkan langsung | Baca rencana, daftar mandat, daftar eksekusi, evaluasi policy | Tidak ada approval per tindakan; manusia melihat hasilnya di dashboard (`/`, `/mandates`, `/executions`, `/audit`) | Capability `view_own`/`view_all`; scope `agent` boleh membaca tanpa approval |
| Sedang — perlu konfirmasi | Eksekusi tindakan dengan mandat yang sudah terbit | Manusia menekan approve pada satu `action_id` spesifik; mandat terbit dengan TTL default 30 menit | `POST /office-agent/plans/{plan_id}/actions/{action_id}/approve` + `governance/approval.py` + `governance/mandate.py` (`params_hash`, `nonce`, `expires_at`) |
| Tinggi — approval khusus | Tindakan yang policy tandai `review`: penerima ambigu (`AMBIGUOUS_RECIPIENT`), bulk egress (`BULK_EGRESS_SUSPECTED`), di luar jam kerja, hari libur, bentrok salat Jumat | Manusia yang punya capability `approve` (role `approver`/`admin`) memutuskan; keputusan dicatat dengan `reason` | `POST /policies/evaluate` menghasilkan `review` + `reason_code`; `POST /approvals` mencatat `approver_id` terverifikasi. Apakah UI mewajibkan reason untuk temuan `review` *perlu dibuktikan saat demo* |
| Dilarang — ditolak policy | Penerima di luar scope (`RECIPIENT_NOT_ALLOWED`), instruksi tersisip (`INJECTION_QUARANTINED`) | Tidak ada jalur approve yang mengesahkan tindakan ini; penolakan tercatat dan manusia menerima alasan | `governance/policy.py` → `evaluate` mengembalikan `deny`; `deny` mengalahkan `review`. Penegakan pada jalur eksekusi memakai mandat (`PARAMS_CHANGED`, `MANDATE_REVOKED`, `MANDATE_TENANT_MISMATCH`) |

Satu catatan penting: `README.md` menyebut capability `manage_users`, `manage_integrations`, dan `edit_policy` pernah tidak ber-backing endpoint, tetapi di kode yang dibaca sekarang ketiganya sudah masuk `CAPABILITIES` dan `ROLE_CAPABILITIES` untuk role `admin`, dan `enforced_capabilities()` dihitung dari dependency HTTP plus tool MCP yang benar-benar terpasang (`core/security.py`). Klaim "capability ini belum tersedia" dari dokumen lama sudah tidak berlaku untuk ketiga capability itu; yang benar sekarang adalah `GET /api/v1/meta` melaporkan `unbacked_capabilities` secara terhitung.

## Batasan yang masih berlaku

Eksekusi memakai adapter `outbox` (`modules/execution/service.py`): hasilnya file di `data/outbox`, bukan kiriman ke layanan eksternal. Telegram adapter masih TODO/post-MVP dan WhatsApp belum diimplementasikan (`docs/CHANNEL-SETUP.md`). PostgreSQL adalah target produksi, tetapi migrasi dan tes sesi pengembangan berjalan di SQLite (`README.md`, `docs/DEPLOYMENT.md`). Token gateway lama (`DEXTRA_AGENT_TOKEN`/`DEXTRA_OPS_TOKEN`) tidak membawa identitas dan tidak punya expiry; rotasinya manual lewat environment variable (`README.md` §Batasan). Semua batas ini ditulis agar juri tidak perlu menebak.
