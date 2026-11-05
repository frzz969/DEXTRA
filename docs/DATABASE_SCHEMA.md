# DATABASE SCHEMA — DEXTRA v2

Status: **implemented; skema terverifikasi di SQLite pada sesi ini. PostgreSQL belum diverifikasi ulang di sesi ini**
(tidak ada klaim "PG 16.2 terverifikasi" / "206 tes lulus di PostgreSQL" tanpa bukti sesi ini).

Dokumen ini menjelaskan skema yang benar-benar ada di `backend/dextra/models/`
dan dibuat oleh sembilan migrasi di `database/migrations/versions/` (skema awal, P7,
P8, P9, Skill Registry + workflow, Office Agent, atribusi tenant pada audit,
backfill idempotensi FASE 2, lalu ciphertext MFA FASE 4). Rantai revisi:
`d9cd32b89961 → b1f7c2a9d4e6 → c4d8e1f6a2b3 → d2a6b8c41f07 → e7b3c9d51a84 → f5a2d7e93c18 → a8c1e5f70b92 → 27ba08c94572 → g6a3b4c5d6e7` (head).
Isinya bukan rancangan aspirasional: setiap tabel di sini bisa diperiksa dengan
`alembic upgrade head` lalu `\dt`.

Verifikasi pada sesi ini (SQLite): `py -m pytest tests/integration/test_migrations.py -q --tb=short`
lulus; `grep __tablename__ backend/dextra/models` = 33 tabel. Verifikasi
PostgreSQL historis (upgrade→33, downgrade→0, upgrade→33) **tidak** diulang di sesi ini
dan tidak dipertahankan sebagai klaim sesi ini. Perilaku transaksional PostgreSQL
diuji di `tests/integration/test_postgres_runtime.py` (dilewati bila
`DEXTRA_TEST_DATABASE_URL` bukan PostgreSQL).

## 1. Ringkasan

| Kelompok | Tabel |
|---|---|
| Tenancy | `tenants`, `memberships` |
| Identity & access | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions` |
| Machine identity | `service_accounts`, `api_tokens` |
| Security | `security_events`, `login_throttles` |
| Catalog | `skills`, `skill_versions` |
| Orchestration | `workflow_definitions`, `workflow_runs`, `workflow_step_runs` |
| Office Agent | `office_plan_requests` |
| Workforce | `agents`, `agent_capabilities`, `agent_versions`, `agent_assignments` |
| Work management | `work_packages`, `tasks` |
| Execution | `executions`, `execution_steps`, `action_records` |
| Governance | `policies`, `policy_versions`, `policy_evaluations`, `approvals`, `mandates` |
| Audit | `audit_events` |

Total 33 tabel aplikasi + `alembic_version`.

## 2. Keputusan yang perlu dijelaskan

**Identifier berupa string berprefiks, bukan UUID mentah.**
`mnd_2910f8ae0ed6d662`, `exe_1793665872565_a1b2c3`, `evt_00000001`. Alasannya:
identifier ini muncul di UI, log, dan audit, sehingga harus bisa dibaca manusia
dan dipotong saat ditampilkan. Kolomnya `String(64)`; nilai tetap unik.

**Timestamp memakai `DateTime(timezone=True)`.**
Targetnya `TIMESTAMPTZ` di PostgreSQL. Di SQLite timezone tidak disimpan, dan itu
menyebabkan bug nyata: hash audit yang dihitung saat menulis tidak cocok saat
diverifikasi. Perbaikannya ada di `repositories/audit._canonical_at()` yang
menormalkan waktu ke UTC tanpa timezone sebelum di-hash, sehingga representasinya
sama di kedua database.

**Metadata fleksibel disimpan sebagai `Text` berisi JSON, bukan JSONB.**
Ini kompromi yang harus dinyatakan: `JSONB` hanya ada di PostgreSQL dan tidak bisa
diuji di mesin ini. Kolom yang memakai pola ini: `detail_json`, `rules_json`,
`params_json`, `config_json`, `result_json`. Saat PostgreSQL tersedia, kolom-kolom
ini **sebaiknya** dimigrasikan ke `JSONB` agar bisa diindeks dan divalidasi —
lihat §6.

**Tidak ada cascade deletion yang tidak dibatasi.**
`CASCADE` hanya dipakai untuk anak yang tidak punya arti tanpa induknya
(`execution_steps` → `executions`, `agent_capabilities` → `agents`,
`role_permissions` → `roles`). Referensi antar-agregat memakai `SET NULL`
(`mandates.approval_id`, `tasks.assigned_agent_id`) supaya menghapus satu entitas
tidak menghapus riwayat tata kelola.

## 3. Tabel inti dan alasannya

### 3.1 `mandates`

Kontrol terkuat di sistem. Kolom yang mengikat satu tindakan konkret:

| Kolom | Fungsi |
|---|---|
| `plan_id` | Rencana yang disetujui |
| `approval_id` | Persetujuan manusia yang menerbitkannya |
| `action_id`, `action_type` | Aksi spesifik yang diizinkan |
| `params_hash` | Sidik parameter; perubahan parameter membatalkan mandate |
| `resource_scope`, `recipient_scope` | Batas sasaran |
| `approver_id` | Klaim klien, **tidak diverifikasi** |
| `nonce` (unik) | Mencegah penerbitan ganda |
| `expires_at`, `revoked_at` | Batas waktu dan pencabutan |

`params_hash` dihitung dari JSON yang dik canonikkan
(`governance/mandate.params_digest`): kunci diurutkan, tanpa spasi. Tanpa
kanonikalisasi, urutan kunci yang berbeda akan menghasilkan hash berbeda untuk
parameter yang sama, dan mandate akan ditolak secara acak.

### 3.2 `executions`

`idempotency_key` = `mandate_id:action_id:params_digest`, **unik di level database**.
Kolom `params_digest` menyimpan bagian ketiga kunci itu secara terpisah, dan
constraint uniknya adalah `(mandate_id, action_id, params_digest)` — satu
kontrak, tiga penegak yang sejalan (kolom `idempotency_key` unik, constraint
gabungan, dan kunci yang dibangun service).

Ini bukan hiasan. Pengecekan di aplikasi bisa dilewati bila proses mati di antara
"cek" dan "tulis"; constraint unik tidak bisa.

Catatan penting dari pengujian: kunci idempotensi **harus** memuat hash parameter.
Versi pertama hanya memakai `mandate_id:action_id`, dan akibatnya permintaan dengan
parameter yang sudah diubah mengembalikan hasil lama seolah sukses. Itu bug
keamanan, bukan bug kosmetik.

### 3.3 `audit_events`

Append-only, dengan rantai hash:

```
entry_hash = sha256(prev_hash + canonical_json(payload))
```

`seq` berurutan dan unik. `verify_chain()` merekonstruksi rantai dari awal dan
melaporkan `broken_at_seq` bila ada baris yang disunting.

**Rantai berversi.** Kolom `chain_version` menentukan bentuk payload yang di-hash:

- `1` — 12 kunci, tanpa `tenant_id`. Semua baris sebelum migrasi `a8c1e5f70b92`.
- `2` — 13 kunci, `tenant_id` ikut di-hash. Semua baris baru.

Baris lama **tidak** dihitung ulang; verifikasi memilih aturan menurut angka yang
tersimpan. Mengubah `tenant_id` atau menurunkan `chain_version` memutus rantai dan
terdeteksi (`tests/integration/test_audit_chain_versioning.py`). `verify_chain()`
mengembalikan `chain_versions` sehingga campuran v1/v2 terlihat, bukan ditebak.

Hash chaining **tidak** menggantikan izin database. `infra/docker/init/01-audit-permissions.sql`
mencabut `UPDATE` dan `DELETE` pada tabel ini dari role aplikasi. Keduanya
dibutuhkan: rantai mendeteksi, izin mencegah.

## 4. Index

| Index | Alasan |
|---|---|
| `executions.status`, `mandates.status` | Daftar dan filter status adalah query paling sering |
| `executions.plan_id`, `executions.mandate_id` | Menelusuri jejak dari plan/mandate |
| `audit_events.seq` (unik), `at`, `event_type` | Verifikasi rantai dan penelusuran waktu/jenis |
| `audit_events.plan_id`, `mandate_id`, `execution_id`, `correlation_id` | Menyusun jejak lintas entitas |
| `executions.correlation_id` | Menghubungkan satu permintaan dengan seluruh efeknya |

Index dibuat berdasarkan pola query yang benar-benar dipakai endpoint, bukan
daftar tebakan.

## 5. Batas transaksi

- Satu permintaan API = satu transaksi (`get_db` menutup sesi; `session_scope`
  commit/rollback).
- Penerbitan mandate + audit event berada dalam satu transaksi: mandate tidak
  boleh ada tanpa jejak.
- Eksekusi menulis `executions`, `execution_steps`, `action_records`, dan audit
  dalam satu commit. Kalau commit gagal, tidak ada eksekusi yang tercatat
  setengah jadi.

## 6. Yang belum ada dan tidak diklaim ada

| Hal | Status | Konsekuensi |
|---|---|---|
| Verifikasi terhadap PostgreSQL | **Belum diverifikasi ulang di sesi ini** | Sembilan migrasi (head `g6a3b4c5d6e7` via `27ba08c94572`) terverifikasi di SQLite pada sesi ini (`tests/integration/test_migrations.py` lulus). Klaim lama "PG 16.2, 206 tes lulus di PostgreSQL" **dicabut** tanpa bukti sesi ini. Yang belum: verifikasi PostgreSQL nyata, uji beban, uji failover, dan PostgreSQL terkelola (RDS/Cloud SQL). |
| `JSONB` | **Belum** | Metadata memakai `TEXT` berisi JSON; tidak bisa diindeks. |
| Row-level security | **Belum** | Pemisahan tenant ditegakkan di repository (setiap query menerima `tenant_id`), bukan oleh RLS PostgreSQL. Repository yang lupa memfilter tetap bisa bocor. |
| Tenant pada audit chain | **Selesai (berversi)** | `tenant_id` ada dan ikut di-hash pada rantai versi 2; baris versi 1 tetap sah tanpa ditulis ulang. Yang belum: filter `tenant_id` pada `GET /audit-events` — rantai sengaja dibaca utuh agar verifikasi tidak bisa dipersempit per tenant. |
| Retention/partisi audit | **Belum** | Tabel tumbuh tanpa batas; belum ada kebijakan arsip. |
| Migrasi data dari `data/*.json` | **Belum** | Data dashboard lama belum dipindahkan. |
| Backup & restore teruji | **Belum** | Belum ada prosedur yang dijalankan. |

Baris-baris di atas sengaja ditulis sebagai "belum", bukan "akan datang", karena
tidak ada tanggal yang bisa dijanjikan.
