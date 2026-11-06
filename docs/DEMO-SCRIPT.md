# DEXTRA — Skrip Demo Hackathon (5–8 menit)

Skrip ini ditulis untuk presenter yang berdiri di depan layar, bukan untuk dibacakan kata per kata. Setiap langkah menyebut: klik apa, data apa yang tampil, dan apa yang harus ditunjukkan. Semua route dan endpoint di bawah berasal dari kode yang sudah dibaca (`apps/web/app/`, `apps/web/lib/api.ts`, `backend/dextra/modules/*/router.py`). Kalau langkah gagal di panggung, pakai rencana cadangan di bagian akhir — jangan mengarang data.

## Daftar kesiapan (sebelum juri masuk)

| Item | Nilai / perintah | Sumber |
|---|---|---|
| Database dev | `DATABASE_URL=sqlite+pysqlite:///./data/dextra-v2.db`, lalu `python -m alembic -c database/alembic.ini upgrade head` dan `python database/seeds/seed.py` | `README.md` §Menjalankan |
| Backend | `./scripts/dev-api.sh` → `http://127.0.0.1:8000/docs` | `README.md` |
| Web | `./scripts/dev-web.sh` → `http://127.0.0.1:3000` | `README.md` |
| MCP gateway (opsional untuk Explorer) | `pnpm run dev:mcp` → `http://127.0.0.1:8765` | `README.md` |
| Token web (server-side) | `DEXTRA_API_URL` dan `DEXTRA_API_TOKEN` terisi di environment web; token tidak pernah sampai ke browser | `apps/web/lib/api.ts`, `docs/DEPLOYMENT.md` |
| Token gateway | `DEXTRA_AGENT_TOKEN` dan `DEXTRA_OPS_TOKEN` diganti dari nilai default dev (`agent-dev-token`/`ops-dev-token`) bila demo memakai jalur gateway | `docs/DEPLOYMENT.md` |
| Tenant | `DEXTRA_LEGACY_TENANT` terisi dengan slug tenant demo (mis. `dextra-demo`); tanpa ini, token gateway lama ditolak endpoint ber-tenant | `docs/DEPLOYMENT.md`, `core/security.py` |
| User demo | Akun dengan role `approver` atau `admin` untuk login sesi, supaya capability `approve`/`execute`/`view_audit` tersedia | `core/security.py` → `ROLE_CAPABILITIES` |
| Seed governance | Satu rencana Office Agent yang sudah tersimpan (`GET /office-agent/plans`), satu mandat aktif, dan riwayat audit — siapkan lewat seed atau lewat API sebelum demo | `modules/office_agent/router.py`, `database/seeds/seed.py` |
| Bukti WorkBuddy | Siapkan penjelasan status integrasi dari `docs/WORKBUDDY-INTEGRATION-TEST.md`; jangan menjanjikan koneksi live sebelum diuji | `docs/WORKBUDDY-INTEGRATION-TEST.md` |

Cek cepat sebelum mulai: buka `http://127.0.0.1:8000/health` (harus `ok: true`), lalu buka `http://127.0.0.1:3000` dan pastikan Overview menampilkan angka, bukan banner "tidak tersedia". Kalau banner muncul, kebanyakan penyebabnya `DEXTRA_API_TOKEN` kosong atau backend mati — perbaiki dulu, jangan lanjut demo dengan layar kosong.

## Skrip langkah per langkah

### Menit 0–1: Pembuka dan Overview

Buka `/` (Overview, `apps/web/app/page.tsx`). Tunjukkan lima KPI: agen aktif, work package terbuka, approval menunggu, eksekusi gagal, mandat aktif — semuanya dihitung dari database lewat `GET /overview` (`modules/overview/router.py`), bukan angka contoh. Tunjukkan grafik "Eksekusi 7 hari" yang dihitung dari `started_at` eksekusi nyata. Katakan satu kalimat prinsipnya: *baca boleh otomatis, tulis harus lewat mandat.* Tunjukkan juga kartu Workforce, Approval queue, Status governance, dan Audit terbaru di halaman yang sama.

### Menit 1–2: Mandate Input

Buka `/office-agent`. Tunjukkan daftar rencana Office Agent dari `GET /office-agent/plans`. Pilih satu rencana dan buka detailnya di `/office-agent/[planId]` (`GET /office-agent/plans/{plan_id}` di `modules/office_agent/router.py`). Tunjukkan daftar `actions` di dalamnya: `action_id`, `action_type`, `params`, dan `source_ref` yang menunjuk asal tindakan di dokumen. Jelaskan bahwa rencana datang sebagai dokumen yang tidak dipercaya, lalu dinormalisasi dan dipecah jadi tindakan diskret sebelum ada yang disetujui.

### Menit 2–3: Governance Validation

Buka `/policies`, lalu tunjukkan hasil evaluasi untuk rencana yang sama. Endpoint-nya `POST /policies/evaluate` (`modules/policies/router.py`) yang memanggil policy engine deterministik di `governance/policy.py`. Tunjukkan `decision` dan `reason_code` — misalnya `AMBIGUOUS_RECIPIENT` bila ada dua kandidat penerima, atau `OUTSIDE_OFFICE_HOURS`. Tekankan dua hal: evaluatornya bukan model AI, jadi masukan sama selalu menghasilkan keputusan sama; dan penolakan (`deny`) mengalahkan permintaan review. Sebutkan juga bahwa WorkBuddy punya peran Adversarial Reviewer di paketnya (`workbuddy/agents/adversarial-reviewer.md`), tetapi penegakan final tetap di server.

### Menit 3–4: AI Orchestration (WorkBuddy)

Tunjukkan `workbuddy/mcp.json` di layar: server `dextra` di `http://127.0.0.1:8765`, `allowedTools` hanya 13 tool baca/rencana, dan catatan bahwa token ops tidak pernah diekspos ke agen. Buka juga `workbuddy/skills/workforce-dispatcher/SKILL.md` dan tunjukkan batasannya: tidak boleh eksekusi tindakan eksternal, tidak boleh membuat approval/mandate, tidak boleh mengarang kebijakan. Jujur soal status: pengujian koneksi langsung WorkBuddy Desktop tercatat BELUM di `docs/WORKBUDDY-INTEGRATION-TEST.md`, jadi bagian ini didemokan lewat manifest dan API, bukan klaim "live terhubung". Tunjukkan daftar empat spesialis dari `GET /agents` (`modules/workforce/router.py`): dispatcher, executive assistant, administrative officer, adversarial reviewer.

### Menit 4–5: Human Approval

Buka `/approvals` (`GET /approvals`). Pilih tindakan pada rencana demo dan klik approve (tombol memanggil `approvePlanAction` → `POST /office-agent/plans/{plan_id}/actions/{action_id}/approve`, `apps/web/lib/api.ts`). Tunjukkan responsnya: `approval_id` dan `mandate_id` terisi. Buka `/mandates` dan tunjukkan mandat barunya: `plan_id`, `action_id`, `status`, `issued_at`, `expires_at`, dan `usable`. Jelaskan bahwa approver yang tercatat adalah identitas terverifikasi dari sesi, bukan isian klien (`modules/approvals/router.py`), dan bahwa satu approval tidak bisa menerbitkan mandat kedua (`MANDATE_ALREADY_ISSUED` di `governance/mandate.py`).

### Menit 5–6: AI Worker Execution

Buka `/executions` (`GET /executions`). Jalankan eksekusi lewat `POST /executions` dengan `mandate_id`, `action_id`, `action_type`, dan `params` yang sama persis dengan yang disetujui — kalau parametrnya diubah, server menolak dengan `PARAMS_CHANGED` (`governance/mandate.py` → `validate_for_execution`). Tunjukkan baris eksekusi barunya: `status: succeeded`, `duration_ms`, dan `result_json` berisi `adapter: outbox`, `provider: outbox`, `result_id`, dan path file. Jujur di sini: adapter-nya `outbox` (`modules/execution/service.py`), artinya hasilnya file `.eml`/`.ics`/`.task.json` di `data/outbox`, bukan kiriman ke layanan eksternal. Itu batas demo, bukan fitur yang disembunyikan.

### Menit 6–8: Result & Accountability

Buka `/audit` (`GET /audit-events`). Tunjukkan rangkaian event dari demo ini: `office_plan_received`, `approval_recorded`, `mandate_issued`, `action_executed` — masing-masing membawa `seq`, `plan_id`, `mandate_id`, dan `execution_id`. Klik tombol verifikasi (`GET /audit-events/verify`, helper `verifyAuditChain` di `apps/web/lib/api.ts`) dan tunjukkan `{"ok": true, "checked": ...}`. Kalau mau menunjukkan sisi penolakan, coba eksekusi ulang dengan parameter berubah dan tunjukkan `action_blocked` dengan kode `PARAMS_CHANGED` masuk ke audit sebagai `deny`. Tutup dengan kembali ke Overview dan tunjukkan KPI mandat aktif serta approval menunggu yang berubah.

## Rencana cadangan bila endpoint gagal

Setiap halaman di `apps/web` memakai pola yang sama (`apps/web/lib/api.ts`): kalau API gagal, fungsinya mengembalikan `{ ok: false }` dan halaman menampilkan banner "tidak tersedia" alih-alih data contoh. Itu perilaku yang disengaja, dan presenter harus memperlakukannya sebagai bahan cerita, bukan disembunyikan.

| Gagal | Yang tampil | Yang presenter katakan |
|---|---|---|
| Backend mati (`:8000` tidak merespons) | Banner "tidak tersedia" di Overview dan halaman lain | "Banner ini bukti UI-nya jujur: ia tidak mengarang angka. Saya restart backend, lalu kita lanjut." |
| `DEXTRA_API_TOKEN` kosong | Banner berisi "DEXTRA_API_TOKEN belum diisi; UI tidak boleh mengarang data." | Tunjukkan pesan error apa adanya, isi env, restart web, muat ulang. Jangan lanjut dengan layar kosong. |
| `GET /overview` 401 | Banner HTTP 401 | "Semua endpoint butuh autentikasi, termasuk overview." Periksa sesi login atau token, lalu muat ulang. |
| `GET /audit-events/verify` gagal (`ok: false`) | `broken_at_seq` menunjuk baris pertama yang rusak | "Verifikasi menemukan baris yang tidak cocok dengan hash-nya. Sesuai manual operator, operasi berhenti dan ini dieskalasi." Jangan lanjut demo seolah tidak terjadi. |
| `POST /executions` 409 `PARAMS_CHANGED` | Error dari API | Gunakan sebagai demo sisi penolakan: parameter berubah sejak approval, jadi eksekusi ditolak dan tercatat `action_blocked`. |
| WorkBuddy Desktop tidak tersedia | Tidak ada layar live WorkBuddy | Jelaskan status BELUM dari `docs/WORKBUDDY-INTEGRATION-TEST.md`, tunjukkan `workbuddy/mcp.json` dan skill-nya, lanjutkan orchestration lewat API dan UI. |
| Halaman menampilkan "Belum ada data" | Empty state resmi (`page.tsx` menulisnya eksplisit) | "Datanya memang kosong di tenant demo ini." Seed ulang atau pakai tenant yang sudah punya rencana, jangan menampilkan fixture seolah nyata. |

Aturan terakhir untuk presenter: kalau presenter tidak yakin sebuah klaim terbukti di layar saat itu juga, ucapkan *perlu dibuktikan saat demo* dan lanjut ke langkah berikutnya. Juri lebih percaya presenter yang menandai batasnya daripada yang mengarang.
