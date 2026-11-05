# DEXTRA
## Product Requirements Document (PRD)
### Version 2.0.0 — Full Product Specification

**Product Name:** DEXTRA  
**Product Category:** Governed Enterprise AI Workforce & Operations Platform  
**Document Status:** Target Product Specification  
**Previous Baseline:** DEXTRA PRD v1.4.0  
**Implementation Approach:** Incremental Migration with Functional Parity  
**Primary Principle:** Baca boleh otomatis, tulis harus lewat mandat.

---

# 1. EXECUTIVE SUMMARY

DEXTRA adalah platform AI workforce dan operations yang memungkinkan organisasi mendelegasikan pekerjaan kepada spesialis AI dengan batas kewenangan yang ditentukan, dikontrol, dan diaudit oleh manusia.

DEXTRA tidak sekadar menyediakan chatbot atau kumpulan AI Agent. Platform ini mengatur siklus pekerjaan dari permintaan, perencanaan, delegasi, pelaksanaan, pemeriksaan, persetujuan, hingga pencatatan hasil.

DEXTRA menggunakan pendekatan governed execution: AI dapat membaca, menganalisis, menyusun rencana, dan mengusulkan tindakan berdasarkan izin yang diberikan. Namun, tindakan yang mengubah data atau menghasilkan side effect harus melewati mekanisme otorisasi, approval, dan mandate yang tervalidasi.

Prinsip utamanya:

- AI tidak boleh menentukan kewenangannya sendiri.
- AI tidak boleh menerbitkan mandat untuk dirinya sendiri.
- AI tidak boleh menyetujui tindakannya sendiri.
- Approval harus berasal dari identitas manusia yang terverifikasi.
- Mandate harus memiliki batas tindakan, resource, penerima, masa berlaku, dan status.
- Executor wajib memvalidasi mandat secara independen sebelum melakukan side effect.
- Setiap keputusan dan tindakan harus memiliki jejak audit.
- Sistem harus mampu menghentikan, membatalkan, memulihkan, dan merekonsiliasi pekerjaan secara aman.

DEXTRA harus dikembangkan sebagai produk yang benar-benar operasional, bukan prototype yang hanya terlihat berfungsi.

---

# 2. PRODUCT VISION

## 2.1 Vision

Membangun platform AI workforce yang memungkinkan organisasi menggunakan tenaga kerja AI secara terstruktur, aman, transparan, dan dapat dipertanggungjawabkan.

## 2.2 Mission

1. Mengubah permintaan pekerjaan menjadi workflow yang dapat dikelola.
2. Menyediakan spesialis AI dengan tanggung jawab dan kapabilitas yang jelas.
3. Mengendalikan seluruh tindakan sensitif melalui governance.
4. Menyediakan visibilitas terhadap status pekerjaan dan keputusan.
5. Menjaga setiap eksekusi agar dapat ditelusuri dan dievaluasi.
6. Mengintegrasikan AI dengan sistem kerja organisasi tanpa menghilangkan kendali manusia.

## 2.3 Product Positioning

DEXTRA bukan:

- Pengganti ERP, HRIS, CRM, atau sistem operasional organisasi.
- Chatbot generik.
- Direktori AI Agent tanpa tata kelola.
- Sistem otomatisasi yang memberikan akses tulis bebas kepada AI.
- Dashboard analitik yang menampilkan angka tanpa sumber data.

DEXTRA adalah lapisan orkestrasi dan governance yang menghubungkan manusia, AI workforce, workflow, integrasi eksternal, dan sistem operasional.

## 2.4 Core Workflow

**Plan → Delegate → Execute → Review → Approve → Track → Analyze**

Setiap pekerjaan harus mempunyai status, pemilik, konteks, batas akses, dan riwayat yang dapat diperiksa.

---

# 3. PRODUCT PRINCIPLES

## 3.1 Human-Defined Authority

Kewenangan ditentukan oleh manusia melalui role, permission, policy, approval, dan mandate.

## 3.2 Least Privilege

Setiap pengguna, layanan, worker, dan AI Agent hanya memperoleh akses minimum yang dibutuhkan.

## 3.3 Separation of Duties

Pihak yang mengusulkan, menyetujui, menerbitkan mandat, dan menjalankan tindakan harus dipisahkan sesuai tingkat risiko.

## 3.4 Deterministic Governance

Keputusan izin dan validasi mandat harus dilakukan oleh sistem deterministik, bukan berdasarkan penilaian bebas LLM.

## 3.5 Accountable Execution

Setiap eksekusi memiliki identitas pemanggil, konteks, resource, action, mandat, hasil, dan audit record.

## 3.6 Fail Securely

Jika identitas, policy, mandate, resource scope, atau status eksekusi tidak dapat diverifikasi, sistem harus menolak tindakan sensitif.

## 3.7 No Fabricated State

Dashboard, API, AI Agent, dan laporan tidak boleh membuat status, aktivitas, angka, ID, maupun hasil eksekusi yang tidak berasal dari data sebenarnya.

## 3.8 Recoverability

Kegagalan tidak boleh menyebabkan sistem menganggap suatu tindakan berhasil tanpa bukti. Sistem harus mendukung recovery dan reconciliation.

---

# 4. PRODUCT SCOPE

## 4.1 Core Scope

DEXTRA mencakup:

- User and identity management.
- Role-based access control.
- Permission and capability management.
- AI workforce management.
- Task and work package management.
- Workflow orchestration.
- Approval management.
- Mandate management.
- Governed execution.
- Review and validation.
- Audit trail.
- Integration management.
- Background job processing.
- Notifications.
- Operational monitoring.
- Administrative configuration.

## 4.2 Initial Workforce Scope

Spesialis AI awal:

| Specialist | Tanggung jawab |
|---|---|
| Workforce Dispatcher | Memahami permintaan dan menentukan spesialis yang relevan |
| Executive Assistant | Membantu koordinasi, ringkasan, komunikasi, dan administrasi eksekutif |
| Administrative Officer | Membantu pekerjaan administratif dan pengelolaan dokumen |
| Adversarial Reviewer | Menguji asumsi, menemukan kelemahan, dan meninjau hasil pekerjaan |
| Policy Validator | Komponen deterministik untuk validasi policy, bukan AI Agent |

Jumlah dan jenis spesialis dapat berkembang berdasarkan kebutuhan organisasi.

## 4.3 Out of Scope

Hal berikut tidak menjadi tanggung jawab inti DEXTRA:

- Menggantikan seluruh sistem bisnis organisasi.
- Menjalankan tindakan sensitif tanpa otorisasi.
- Memberikan akses database langsung kepada LLM.
- Membuat klaim bahwa hasil AI selalu benar.
- Menganggap output AI sebagai bukti persetujuan.
- Menampilkan metrik operasional yang tidak mempunyai sumber data.

---

# 5. USER ROLES AND ACCESS MODEL

Sistem harus mendukung identitas pengguna, role, permission, capability, dan scope.

Role awal yang dapat disesuaikan:

| Role | Tanggung jawab |
|---|---|
| Organization Owner | Kepemilikan dan konfigurasi organisasi |
| Administrator | Administrasi sistem sesuai kewenangan |
| Manager | Pengelolaan tim dan pekerjaan |
| Approver | Persetujuan tindakan sesuai batas kewenangan |
| Operator | Pengelolaan pekerjaan dan operasional |
| Reviewer | Pemeriksaan dan validasi hasil |
| Member | Pengajuan dan pemantauan pekerjaan |
| Service Account | Akses antarlayanan dengan scope terbatas |

Role tidak boleh menjadi satu-satunya dasar otorisasi. Keputusan akses harus mempertimbangkan permission, resource scope, organisasi, identitas terverifikasi, dan policy yang berlaku.

## 5.1 Authorization Context

Setiap request sensitif harus memiliki konteks otorisasi yang dibentuk oleh backend, sekurang-kurangnya mencakup:

- Principal ID.
- Principal type.
- Organization ID.
- Role dan permission efektif.
- Resource scope.
- Authentication method.
- Session atau token identity.
- Request correlation ID.
- Waktu autentikasi dan masa berlaku kredensial.

Field identitas yang dikirim oleh pengguna atau AI Agent tidak boleh dianggap sebagai bukti identitas.

---

# 6. FUNCTIONAL REQUIREMENTS

## 6.1 Overview

Dashboard Overview harus menampilkan kondisi sistem berdasarkan data aktual:

- Active work.
- Pending approvals.
- Work awaiting review.
- Workforce status.
- Recent executions.
- Recent audit events.
- Workload distribution.
- Operational alerts.

Semua angka harus berasal dari API dan memiliki definisi serta sumber data.

Jika data tidak tersedia, tampilkan kondisi unavailable atau empty state. Jangan mengganti data yang hilang dengan angka demo.

## 6.2 AI Assistant

Pengguna dapat:

- Mengirim permintaan pekerjaan.
- Memberikan konteks dan dokumen.
- Melihat interpretasi permintaan.
- Memeriksa rencana kerja.
- Menyetujui atau mengubah rencana.
- Memantau pekerjaan.
- Melihat hasil dan alasan keputusan.

AI Assistant tidak boleh langsung menjalankan tindakan sensitif hanya karena pengguna memberikan instruksi dalam percakapan.

## 6.3 Work Management

Sistem mendukung:

- Work request.
- Work package.
- Task.
- Subtask.
- Assignment.
- Priority.
- Deadline.
- Dependency.
- Status.
- Attachment.
- Comment.
- Activity history.

Status pekerjaan harus konsisten dan memiliki aturan transisi yang terdokumentasi.

## 6.4 Workforce Management

Pengguna berwenang dapat:

- Melihat spesialis AI.
- Melihat deskripsi tanggung jawab.
- Memeriksa kapabilitas.
- Melihat status operasional.
- Mengelola konfigurasi yang diizinkan.
- Melihat riwayat pekerjaan.

Status spesialis tidak boleh sekadar indikator dekoratif. Status harus berasal dari kondisi aktual sistem.

## 6.5 Approval Management

Approval harus mencatat:

- Approval ID.
- Request ID.
- Organization ID.
- Approver principal ID.
- Action yang diminta.
- Resource yang menjadi sasaran.
- Scope.
- Risiko.
- Waktu keputusan.
- Alasan keputusan.
- Versi policy.
- Evidence yang relevan.

Keputusan approval minimal:

- Pending.
- Approved.
- Rejected.
- Cancelled.
- Expired.

Persetujuan harus dilakukan oleh principal yang terautentikasi dan mempunyai kewenangan sesuai policy.

## 6.6 Mandate Management

Mandate adalah otorisasi terbatas untuk menjalankan tindakan tertentu.

Mandate harus mempunyai:

- Mandate ID.
- Approval reference.
- Issuer identity.
- Principal atau executor yang diizinkan.
- Organization scope.
- Action allowlist.
- Resource scope.
- Recipient constraints jika relevan.
- Parameter constraints.
- Expiry.
- Revocation status.
- Usage constraints.
- Idempotency constraints.
- Audit reference.

Mandate tidak boleh diterbitkan hanya berdasarkan klaim AI Agent atau request payload.

## 6.7 Governed Execution

Sebelum melakukan side effect, executor wajib memeriksa:

1. Identitas pemanggil.
2. Status autentikasi.
3. Kewenangan pemanggil.
4. Keberadaan mandat.
5. Validitas tanda tangan atau bukti integritas mandat.
6. Masa berlaku.
7. Status pencabutan.
8. Action allowlist.
9. Resource scope.
10. Recipient constraints.
11. Parameter constraints.
12. Idempotency.
13. Status eksekusi sebelumnya.
14. Policy yang berlaku.

Jika salah satu pemeriksaan wajib gagal, tindakan harus ditolak.

Executor tidak boleh mempercayai hasil validasi dari AI Agent.

## 6.8 Review and Validation

Sistem harus mendukung:

- Pemeriksaan hasil pekerjaan.
- Pemeriksaan kelengkapan.
- Pemeriksaan kesesuaian instruksi.
- Pemeriksaan policy.
- Catatan reviewer.
- Revisi.
- Approval hasil akhir.

Adversarial Reviewer dapat memberikan analisis dan rekomendasi. Keputusan otorisasi tetap berada pada governance engine dan pihak manusia yang berwenang.

## 6.9 Audit Trail

Audit harus mencatat:

- Actor.
- Principal type.
- Organization.
- Action.
- Resource.
- Timestamp.
- Request ID.
- Correlation ID.
- Policy decision.
- Approval reference.
- Mandate reference.
- Execution result.
- Failure reason.
- Source service.

Audit harus tahan terhadap perubahan tidak sah dan mempunyai kontrol akses khusus.

Data sensitif harus dimasking. Jangan menyimpan credential, token, atau seluruh isi dokumen sensitif ke log.

## 6.10 Integration Management

Integrasi eksternal harus menggunakan adapter dan credential management yang terpisah.

Setiap integrasi wajib mempunyai:

- Provider.
- Connection status.
- Authentication method.
- Granted scope.
- Health status.
- Last successful synchronization.
- Error history.
- Credential expiry.
- Revoke/disconnect capability.

Integrasi tidak boleh memperoleh permission yang lebih luas daripada kebutuhan fungsinya.

---

# 7. DOMAIN MODEL AND STATE MANAGEMENT

Domain utama DEXTRA:

- Organization.
- User.
- Principal.
- Role.
- Permission.
- Capability.
- Team.
- Specialist.
- WorkRequest.
- WorkPackage.
- Task.
- Workflow.
- Approval.
- Mandate.
- Execution.
- Review.
- Policy.
- Integration.
- CredentialReference.
- AuditEvent.
- Notification.
- BackgroundJob.

## 7.1 State Machine

Setiap entitas yang memiliki lifecycle harus mempunyai state machine.

Contoh lifecycle pekerjaan:

`draft → submitted → planned → assigned → in_progress → review → completed`

Status alternatif:

- Rejected.
- Cancelled.
- Blocked.
- Failed.
- Suspended.

Contoh lifecycle approval:

`pending → approved | rejected | cancelled | expired`

Contoh lifecycle mandate:

`active → consumed | expired | revoked | suspended`

Transisi harus divalidasi di backend. Frontend hanya menampilkan dan mengirim permintaan transisi.

Status tidak boleh diubah hanya melalui manipulasi state frontend.

---

# 8. GOVERNANCE ARCHITECTURE

Governance adalah otoritas keamanan dan eksekusi DEXTRA.

Komponen:

1. Identity and Authentication.
2. Authorization Engine.
3. Policy Engine.
4. Approval Engine.
5. Mandate Engine.
6. Execution Guard.
7. Audit Service.
8. Replay and Reconciliation Service.

## 8.1 Policy Engine

Policy Engine merupakan komponen deterministik.

Input:

- Principal.
- Organization.
- Action.
- Resource.
- Scope.
- Context.
- Risk classification.
- Policy version.

Output:

- Allow.
- Deny.
- Require approval.
- Require additional validation.

Policy decision harus menyimpan alasan dan versi policy yang digunakan.

## 8.2 Approval Engine

Approval Engine memastikan keputusan berasal dari identitas terverifikasi yang memiliki kewenangan.

Tidak boleh menerima `approver_id` sebagai bukti identitas tanpa mencocokkannya dengan principal hasil autentikasi.

## 8.3 Mandate Engine

Mandate Engine menerbitkan mandat hanya setelah seluruh prasyarat terpenuhi.

Mandate Engine harus memeriksa:

- Approval valid.
- Approver berwenang.
- Policy masih berlaku.
- Resource scope jelas.
- Action terdefinisi.
- Expiry ditentukan.
- Batas penggunaan ditentukan.

## 8.4 Execution Guard

Execution Guard adalah pemeriksaan independen sebelum side effect.

Execution Guard tidak boleh mempercayai keputusan dari LLM, frontend, atau MCP client.

## 8.5 Separation of Duties

AI Agent tidak boleh memiliki tool langsung untuk:

- Approve request.
- Issue mandate.
- Modify authorization policy.
- Bypass execution guard.
- Modify audit records.
- Perform unrestricted database writes.

Akses internal service harus menggunakan identitas layanan dan permission yang dibatasi.

---

# 9. AI WORKFORCE AND ORCHESTRATION

## 9.1 Orchestration

LangGraph digunakan untuk mengelola workflow AI, state, checkpoint, handoff, dan pemulihan proses.

LangGraph bukan sumber otorisasi dan tidak menggantikan governance engine.

## 9.2 Dispatcher

Dispatcher bertugas:

- Memahami tujuan pekerjaan.
- Mengidentifikasi kebutuhan.
- Memilih spesialis berdasarkan kapabilitas.
- Menyusun rencana.
- Membagi pekerjaan.
- Mengatur handoff.
- Memantau hasil.

Dispatcher tidak dapat memperluas permission spesialis.

## 9.3 Specialist Isolation

Setiap spesialis mempunyai:

- Identity.
- Capability manifest.
- Tool allowlist.
- Context scope.
- Execution limits.
- Model configuration.
- Timeout.
- Retry policy.
- Output schema.

Spesialis tidak boleh memperoleh akses global hanya karena berada dalam satu workflow.

## 9.4 Model Provider Abstraction

Integrasi model harus menggunakan provider adapter.

Persyaratan:

- Provider dapat diganti.
- API key tidak dikirim ke frontend.
- Credential disimpan di secret manager atau mekanisme aman.
- Model dan versi dicatat.
- Timeout dan retry dibatasi.
- Token usage dapat dipantau.
- Kegagalan provider ditangani secara eksplisit.

## 9.5 AI Output Validation

Output AI harus divalidasi berdasarkan schema, konteks, dan policy sebelum digunakan.

Output tidak boleh dianggap sebagai fakta terverifikasi tanpa pemeriksaan sumber yang sesuai.

---

# 10. TARGET SYSTEM ARCHITECTURE

Arsitektur target menggunakan pemisahan frontend, API, worker, MCP gateway, governance, orchestration, dan infrastructure.

## 10.1 Technology Stack

| Area | Target Technology |
|---|---|
| Monorepo | pnpm Workspaces + Turborepo |
| Frontend | Next.js App Router |
| Frontend Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend API | Python + FastAPI |
| Data Validation | Pydantic |
| ORM | SQLAlchemy 2.x |
| Database | PostgreSQL |
| Migration | Alembic |
| Database Driver | Psycopg 3 |
| AI Orchestration | LangGraph |
| Agent Integration | MCP |
| TypeScript Validation | Zod |
| Python Dependency Management | uv |
| Background Processing | Queue-based worker |
| Frontend Testing | Vitest + Playwright |
| Backend Testing | pytest |
| Containerization | Docker |
| CI/CD | GitHub Actions |

Teknologi tersebut merupakan target arsitektur. Penggunaannya harus melalui migrasi terencana dan tidak boleh diklaim telah diterapkan sebelum diverifikasi.

## 10.2 Architecture Rules

- Frontend tidak boleh mengakses database secara langsung.
- Semua perubahan data harus melewati backend.
- MCP tidak boleh menjadi jalur bypass governance.
- Worker harus melakukan validasi otorisasi saat memproses pekerjaan sensitif.
- AI orchestration tidak boleh mengendalikan policy.
- Governance harus tetap bekerja meskipun provider AI tidak tersedia.
- Semua layanan harus memiliki identitas dan permission yang terpisah.
- Komunikasi antarlayanan harus menggunakan kontrak yang terdokumentasi.

---

# 11. COMPLETE MONOREPO STRUCTURE

Struktur berikut adalah struktur target arsitektur DEXTRA. Folder tidak wajib dibuat sekaligus. Setiap direktori hanya boleh dibuat ketika tanggung jawab dan implementasinya memang diperlukan.

```text
dextra/
│
├── apps/
│   ├── web/
│   │   ├── public/
│   │   │   ├── images/
│   │   │   ├── icons/
│   │   │   └── fonts/
│   │   │
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── callback/
│   │   │   │   │
│   │   │   │   ├── (workspace)/
│   │   │   │   │   ├── overview/
│   │   │   │   │   ├── assistant/
│   │   │   │   │   ├── requests/
│   │   │   │   │   ├── work/
│   │   │   │   │   ├── work-packages/
│   │   │   │   │   ├── tasks/
│   │   │   │   │   ├── workforce/
│   │   │   │   │   ├── approvals/
│   │   │   │   │   ├── reviews/
│   │   │   │   │   ├── mandates/
│   │   │   │   │   ├── audit/
│   │   │   │   │   └── settings/
│   │   │   │   │
│   │   │   └── api/
│   │   │       └── health/
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── navigation/
│   │   │   ├── data-display/
│   │   │   ├── forms/
│   │   │   ├── feedback/
│   │   │   └── governance/
│   │   │
│   │   ├── features/
│   │   │   ├── overview/
│   │   │   ├── workforce/
│   │   │   ├── task-management/
│   │   │   ├── approvals/
│   │   │   ├── mandates/
│   │   │   ├── audit-trail/
│   │   │   └── administration/
│   │   │
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── providers/
│   │   ├── stores/
│   │   ├── styles/
│   │   ├── types/
│   │   ├── tests/
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   ├── security.py
│   │   │   │   ├── authentication.py
│   │   │   │   ├── authorization.py
│   │   │   │   ├── exceptions.py
│   │   │   │   └── logging.py
│   │   │   │
│   │   │   ├── api/
│   │   │   │   └── v1/
│   │   │   │       ├── router.py
│   │   │   │       └── endpoints/
│   │   │   │           ├── auth.py
│   │   │   │           ├── users.py
│   │   │   │           ├── workforce.py
│   │   │   │           ├── tasks.py
│   │   │   │           ├── work_packages.py
│   │   │   │           ├── approvals.py
│   │   │   │           ├── mandates.py
│   │   │   │           ├── executions.py
│   │   │   │           ├── reviews.py
│   │   │   │           ├── policies.py
│   │   │   │           ├── audit.py
│   │   │   │           └── integrations.py
│   │   │   │
│   │   │   ├── dependencies/
│   │   │   ├── middleware/
│   │   │   └── schemas/
│   │   ├── tests/
│   │   └── pyproject.toml
│   │
│   ├── worker/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── workers/
│   │   │   │   ├── execution_worker.py
│   │   │   │   ├── notification_worker.py
│   │   │   │   ├── schedule_worker.py
│   │   │   │   └── recovery_worker.py
│   │   │   ├── jobs/
│   │   │   ├── queues/
│   │   │   └── monitoring/
│   │   ├── tests/
│   │   └── pyproject.toml
│   │
│   ├── mcp-server/
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── transport/
│   │   │   ├── authentication/
│   │   │   ├── authorization/
│   │   │   ├── tools/
│   │   │   ├── resources/
│   │   │   ├── prompts/
│   │   │   ├── middleware/
│   │   │   └── config/
│   │   ├── tests/
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── telegram-adapter/
│       ├── src/
│       │   ├── bot.ts
│       │   ├── handlers/
│       │   ├── middleware/
│       │   ├── commands/
│       │   ├── services/
│       │   └── config/
│       ├── tests/
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── contracts/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── workforce/
│   │   │   ├── tasks/
│   │   │   ├── approvals/
│   │   │   ├── mandates/
│   │   │   ├── executions/
│   │   │   ├── policies/
│   │   │   ├── audit/
│   │   │   ├── events/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── api-client/
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── endpoints/
│   │   │   ├── errors/
│   │   │   ├── interceptors/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── primitives/
│   │   │   ├── feedback/
│   │   │   ├── overlays/
│   │   │   └── index.ts
│   │   ├── tests/
│   │   └── package.json
│   │
│   ├── design-system/
│   │   ├── tokens/
│   │   ├── themes/
│   │   ├── typography/
│   │   ├── icons/
│   │   └── package.json
│   │
│   ├── validators/
│   │   ├── src/
│   │   │   ├── common/
│   │   │   ├── auth/
│   │   │   ├── requests/
│   │   │   ├── approvals/
│   │   │   ├── mandates/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── config/
│   │   ├── eslint/
│   │   ├── typescript/
│   │   ├── prettier/
│   │   └── package.json
│   │
│   └── python/
│       ├── dextra_domain/
│       │   ├── entities/
│       │   ├── value_objects/
│       │   ├── events/
│       │   └── exceptions/
│       │
│       ├── dextra_infrastructure/
│       │   ├── database/
│       │   ├── repositories/
│       │   ├── messaging/
│       │   └── observability/
│       │
│       ├── dextra_security/
│       │   ├── identity/
│       │   ├── permissions/
│       │   ├── credentials/
│       │   └── secrets/
│       │
│       ├── dextra_governance/
│       │   ├── policy_engine/
│       │   ├── approval_engine/
│       │   ├── mandate_engine/
│       │   ├── execution_guard/
│       │   └── audit/
│       │
│       ├── dextra_orchestration/
│       │   ├── graph/
│       │   ├── dispatcher/
│       │   ├── specialists/
│       │   ├── state/
│       │   └── checkpoints/
│       │
│       └── pyproject.toml
│
├── database/
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   ├── seeds/
│   ├── schemas/
│   └── README.md
│
├── infra/
│   ├── docker/
│   │   ├── web.Dockerfile
│   │   ├── api.Dockerfile
│   │   ├── worker.Dockerfile
│   │   └── mcp-server.Dockerfile
│   ├── compose/
│   │   ├── docker-compose.dev.yml
│   │   ├── docker-compose.test.yml
│   │   └── docker-compose.prod.yml
│   ├── monitoring/
│   ├── reverse-proxy/
│   └── deployment/
│
├── scripts/
│   ├── dev/
│   ├── database/
│   ├── migration/
│   ├── testing/
│   ├── security/
│   └── release/
│
├── tests/
│   ├── integration/
│   ├── contract/
│   ├── end-to-end/
│   ├── security/
│   ├── resilience/
│   └── fixtures/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── MONOREPO-MAP.md
│   ├── DOMAIN-MODEL.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── MCP.md
│   ├── GOVERNANCE.md
│   ├── SECURITY.md
│   ├── THREAT-MODEL.md
│   ├── DEPLOYMENT.md
│   ├── OPERATIONS.md
│   ├── TESTING.md
│   ├── ADR/
│   ├── runbooks/
│   └── diagrams/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── security.yml
│   │   ├── test.yml
│   │   └── release.yml
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── .changeset/
├── .husky/
├── .env.example
├── .gitignore
├── .npmrc
├── .prettierignore
├── .prettierrc
├── eslint.config.js
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── pyproject.toml
├── uv.lock
├── Makefile
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

## 11.1 Directory Responsibilities

| Directory | Responsibility |
|---|---|
| `apps/web` | Frontend, workspace, dashboard, user interaction |
| `apps/api` | API, authentication, authorization, application services |
| `apps/worker` | Asynchronous processing, scheduling, notifications, recovery |
| `apps/mcp-server` | MCP gateway and AI-client access boundary |
| `apps/telegram-adapter` | Telegram integration adapter |
| `packages/contracts` | Shared API, event, and data contracts |
| `packages/api-client` | Typed frontend API client |
| `packages/ui` | Reusable UI components |
| `packages/design-system` | Design tokens, themes, typography |
| `packages/validators` | TypeScript validation schemas |
| `packages/config` | Shared development and lint configuration |
| `packages/python` | Shared Python domain and infrastructure libraries |
| `database` | Database migration, schema, and seed |
| `infra` | Container, deployment, proxy, monitoring |
| `scripts` | Development, migration, testing, security, release utilities |
| `tests` | Cross-service tests |
| `docs` | Technical and operational documentation |

## 11.2 Dependency Rules

1. `apps/web` must not connect directly to PostgreSQL.
2. `apps/web` communicates with backend through documented API contracts.
3. `apps/mcp-server` must not bypass the API and governance layer.
4. `apps/telegram-adapter` must use the same authorization boundary.
5. `apps/worker` must revalidate authorization before sensitive execution.
6. AI orchestration must not be the authority for policy decisions.
7. Governance must not depend on LLM availability.
8. Domain logic must not depend on frontend frameworks or MCP transport.
9. Shared contracts must not contain implementation-specific business side effects.
10. Database schema changes must be versioned through migrations.
11. Secrets must not be committed to source control.
12. No service may receive broad privileges solely for implementation convenience.

## 11.3 Workspace Management

Use:

- pnpm for TypeScript applications and packages.
- Turborepo for task orchestration and caching.
- uv for Python dependencies and environments.
- Separate dependency manifests for TypeScript and Python.
- Explicit package boundaries and dependency declarations.

Do not force TypeScript and Python into one package-management mechanism.

---

# 12. DATABASE ARCHITECTURE

PostgreSQL menjadi sumber kebenaran utama untuk data operasional DEXTRA.

## 12.1 Database Requirements

Database harus mendukung:

- Referential integrity.
- Transactions.
- Unique constraints.
- Foreign keys.
- Indexing.
- Optimistic concurrency where appropriate.
- Organization-level data isolation.
- Auditability.
- Backup and restore.
- Schema migration.
- Data retention policies.

## 12.2 Initial Domain Tables

Tabel inti yang harus dirancang:

- organizations
- users
- principals
- sessions
- roles
- permissions
- role_permissions
- user_roles
- teams
- team_members
- specialists
- specialist_capabilities
- work_requests
- work_packages
- tasks
- task_dependencies
- workflow_runs
- workflow_checkpoints
- approvals
- approval_events
- mandates
- mandate_actions
- executions
- execution_attempts
- reviews
- policies
- policy_versions
- audit_events
- integrations
- integration_credentials
- notifications
- background_jobs
- idempotency_records

Daftar ini merupakan domain target. Detail kolom, relasi, indeks, constraint, dan retention harus ditetapkan dalam desain database sebelum implementasi.

## 12.3 Data Integrity

- Setiap data organisasi harus mempunyai organization scope.
- Relasi antarentitas harus divalidasi.
- Foreign key harus digunakan untuk menjaga integritas.
- Perubahan status harus dilakukan melalui service yang berwenang.
- Approval dan mandate harus dapat ditelusuri.
- Audit tidak boleh bergantung pada data yang mudah diubah oleh pengguna biasa.
- Penghapusan data harus mengikuti retention dan legal requirements.

## 12.4 Migration

Alembic digunakan untuk migrasi skema.

Setiap migration harus:

- Memiliki revision ID.
- Memiliki dependency yang jelas.
- Dapat diuji pada database kosong.
- Dapat diuji terhadap versi sebelumnya.
- Menangani perubahan data secara aman.
- Memiliki strategi rollback atau forward recovery.
- Tidak menghapus data produksi tanpa rencana migrasi dan backup.

---

# 13. API ARCHITECTURE

FastAPI menjadi backend API utama.

## 13.1 API Principles

- Versioned API.
- Consistent response envelope.
- Typed request and response schemas.
- Centralized exception handling.
- Authentication middleware.
- Authorization dependencies.
- Request correlation ID.
- Rate limiting.
- Input validation.
- Structured logging.
- OpenAPI documentation.

## 13.2 Target API Groups

`/api/v1/auth`

`/api/v1/users`

`/api/v1/organizations`

`/api/v1/teams`

`/api/v1/workforce`

`/api/v1/requests`

`/api/v1/work-packages`

`/api/v1/tasks`

`/api/v1/workflows`

`/api/v1/approvals`

`/api/v1/mandates`

`/api/v1/executions`

`/api/v1/reviews`

`/api/v1/policies`

`/api/v1/audit`

`/api/v1/integrations`

`/api/v1/notifications`

`/api/v1/administration`

## 13.3 API Security

- Authentication must be verified server-side.
- Authorization must be checked for every protected operation.
- Resource ownership and organization scope must be checked.
- Client-supplied identity is untrusted.
- Sensitive operations must use idempotency controls.
- Error responses must not leak secrets or internal stack traces.
- API credentials must support expiry and revocation.
- Rate limiting must protect sensitive and expensive endpoints.

---

# 14. MCP ARCHITECTURE

MCP Server berfungsi sebagai gateway antara AI client dan kapabilitas DEXTRA.

## 14.1 MCP Responsibilities

- Expose approved tools and resources.
- Authenticate supported clients.
- Resolve server-side caller identity.
- Enforce capability allowlists.
- Validate tool arguments.
- Forward permitted requests to backend.
- Return bounded and sanitized results.
- Record relevant audit events.

## 14.2 MCP Security

MCP client metadata tidak boleh dianggap sebagai bukti identitas yang tepercaya.

Setiap caller harus memiliki authentication context yang dapat diverifikasi oleh server.

MCP Server tidak boleh:

- Mengeluarkan mandate berdasarkan permintaan AI.
- Menyetujui approval.
- Melakukan unrestricted database writes.
- Mengubah policy.
- Memanipulasi audit.
- Menganggap tool availability sebagai bukti otorisasi.

MCP Server hanya boleh menyediakan tindakan yang memang didukung backend.

---

# 15. BACKGROUND WORKER AND JOB PROCESSING

Worker menangani pekerjaan asynchronous yang tidak cocok dijalankan langsung dalam request-response.

Jenis pekerjaan:

- Workflow execution.
- Notifications.
- Scheduled tasks.
- External synchronization.
- Retry processing.
- Recovery.
- Reconciliation.
- Periodic maintenance.

## 15.1 Job Requirements

Setiap job harus memiliki:

- Job ID.
- Job type.
- Payload schema.
- Organization scope.
- Correlation ID.
- Created timestamp.
- Retry policy.
- Timeout.
- Status.
- Result reference.
- Error information.

Job queue bukan bukti otorisasi. Worker harus memvalidasi kembali identitas layanan, konteks mandat, dan batas tindakan sebelum side effect.

## 15.2 Failure Handling

Sistem harus membedakan:

- Pending.
- Running.
- Succeeded.
- Failed.
- Retry scheduled.
- Cancelled.
- Unknown outcome.
- Requires reconciliation.

Status unknown outcome tidak boleh ditampilkan sebagai success.

---

# 16. FRONTEND AND DASHBOARD REQUIREMENTS

## 16.1 Design Principles

Dashboard harus:

- Konsisten dengan identitas visual DEXTRA.
- Memprioritaskan kejelasan operasional.
- Memiliki hierarchy visual yang jelas.
- Responsif pada desktop, tablet, dan mobile.
- Menampilkan data aktual.
- Menyediakan loading, empty, error, denied, dan unavailable states.
- Tidak menampilkan tombol yang tidak memiliki fungsi.
- Tidak menampilkan metrik atau aktivitas fiktif.

## 16.2 Navigation Structure

Struktur navigasi target:

**WORKSPACE**
- Overview
- AI Assistant
- My Requests
- My Work

**WORK MANAGEMENT**
- Work Packages
- Task Board
- Execution History

**WORKFORCE**
- Workforce
- Specialist Directory

**GOVERNANCE**
- Approval Inbox
- Review & Validation
- Mandates
- Audit Trail
- Policies

**ADMINISTRATION**
- Users & Roles
- Permissions
- Integrations
- Settings

**SUPPORT**
- Help & Support
- User Profile

Navigasi final harus disesuaikan dengan permission pengguna. Menu tersembunyi tidak boleh menjadi pengganti authorization backend.

## 16.3 Dashboard Pages

Setiap halaman harus memiliki:

- Page title.
- Page description.
- Breadcrumb bila relevan.
- Primary action yang benar-benar berfungsi.
- Data source yang jelas.
- Filter dan pencarian bila dibutuhkan.
- Pagination bila relevan.
- Loading state.
- Empty state.
- Error state.
- Access denied state.
- Detail view.
- Activity history jika relevan.

## 16.4 Responsive Requirements

Target viewport:

- Desktop: 1440 × 900.
- Desktop: 1366 × 768.
- Tablet: 768 × 1024.
- Mobile: 390 × 844.

Tidak boleh ada horizontal overflow yang tidak disengaja, elemen tertutup, atau kontrol yang tidak dapat digunakan.

## 16.5 Accessibility

Target implementasi harus memperhatikan:

- Semantic HTML.
- Keyboard navigation.
- Visible focus.
- Accessible labels.
- Color contrast.
- Screen-reader compatibility.
- Reduced motion.
- Form error association.

---

# 17. SECURITY AND THREAT MODEL

Keamanan merupakan persyaratan inti, bukan tahap tambahan setelah fitur selesai.

## 17.1 Threat Categories

- Authentication bypass.
- Authorization bypass.
- Privilege escalation.
- Cross-organization access.
- Prompt injection.
- Tool misuse.
- Credential leakage.
- Sensitive data exfiltration.
- Replay attacks.
- Mandate tampering.
- Approval spoofing.
- Race conditions.
- Duplicate execution.
- Audit tampering.
- Supply-chain compromise.
- SSRF.
- Injection vulnerabilities.
- Insecure integration.
- Unbounded resource consumption.

## 17.2 Identity Security

- Password harus di-hash dengan algoritma yang sesuai.
- Session harus memiliki expiry.
- Token harus memiliki expiry dan revocation mechanism.
- Refresh token harus dikelola secara aman.
- Service identity harus dipisahkan dari user identity.
- Principal tidak boleh ditentukan dari request body.
- MFA dapat diwajibkan berdasarkan risiko dan kebijakan organisasi.

## 17.3 Approval Security

Approval harus berasal dari principal yang:

- Terautentikasi.
- Aktif.
- Memiliki permission yang diperlukan.
- Berada pada organization scope yang sesuai.
- Memenuhi separation-of-duties policy.

## 17.4 Mandate Security

Mandate harus:

- Terikat pada approval yang sah.
- Memiliki action allowlist.
- Memiliki resource scope.
- Memiliki expiry.
- Dapat dicabut.
- Tidak dapat diperluas oleh executor.
- Memiliki integrity protection.
- Memiliki aturan pemakaian dan replay protection.

## 17.5 Sensitive Data

- Secrets tidak boleh masuk log.
- Token tidak boleh ditampilkan di UI.
- Data sensitif harus dimasking.
- Output AI harus dibatasi berdasarkan scope.
- Bulk data export harus dikontrol.
- Database tidak boleh diekspos langsung kepada LLM.
- Retention harus terdokumentasi.

## 17.6 Security Testing

Pengujian wajib mencakup:

- Unauthorized access.
- Missing token.
- Expired token.
- Revoked token.
- Invalid principal.
- Invalid organization scope.
- Missing resource scope.
- Unauthorized action.
- Forged approver identity.
- Expired mandate.
- Revoked mandate.
- Replay attempt.
- Duplicate execution.
- Cross-tenant access.
- Audit integrity.
- Credential leakage.

---

# 18. EXECUTION RELIABILITY AND RECOVERY

## 18.1 Idempotency

Tindakan yang dapat menghasilkan side effect harus memiliki idempotency strategy.

Key harus terikat pada identitas operasi dan konteks yang tepat, bukan hanya string bebas dari caller.

## 18.2 Execution Record

Sebelum side effect dilakukan, sistem harus mencatat intent atau execution record yang diperlukan untuk mencegah duplikasi dan mendukung recovery.

## 18.3 Replay Protection

Replay harus ditolak jika:

- Mandate sudah expired.
- Mandate sudah revoked.
- Action tidak cocok.
- Resource tidak cocok.
- Request hash tidak cocok.
- Idempotency key sudah digunakan untuk payload berbeda.
- Eksekusi sebelumnya sudah berhasil atau masih berjalan.

## 18.4 Reconciliation

Jika sistem kehilangan koneksi setelah side effect mungkin terjadi, status harus menjadi unknown outcome sampai hasilnya dapat diverifikasi.

Sistem tidak boleh melakukan retry buta terhadap operasi yang berpotensi menghasilkan efek ganda.

## 18.5 Recovery

Sistem harus mendukung:

- Job recovery.
- Execution reconciliation.
- Mandate revocation.
- Workflow cancellation.
- Safe retry.
- Database backup and restore.
- Operational incident record.

---

# 19. OBSERVABILITY AND OPERATIONS

## 19.1 Structured Logging

Log harus memiliki:

- Timestamp.
- Severity.
- Service.
- Environment.
- Correlation ID.
- Request ID.
- Principal reference jika aman.
- Event type.
- Error code.

Jangan menyimpan credential, token, atau payload sensitif secara utuh.

## 19.2 Metrics

Metrik operasional yang dapat dikembangkan:

- API latency.
- Error rate.
- Request volume.
- Job queue depth.
- Job failure rate.
- Execution duration.
- Approval waiting time.
- Workflow completion rate.
- Provider availability.
- Recovery count.

Metrik hanya boleh ditampilkan jika benar-benar dikumpulkan dan mempunyai definisi yang jelas.

## 19.3 Health Checks

Setiap layanan harus memiliki health checks yang membedakan:

- Liveness.
- Readiness.
- Dependency availability.

Health check tidak boleh menampilkan informasi rahasia.

---

# 20. DEPLOYMENT AND ENVIRONMENT

Target environment:

- Local development.
- Automated test.
- Staging.
- Production.

## 20.1 Containerization

Docker digunakan untuk konsistensi deployment.

Setiap service harus memiliki konfigurasi yang sesuai dan tidak menjalankan proses dengan privilege berlebihan.

## 20.2 Configuration

Konfigurasi harus dipisahkan berdasarkan environment.

- `.env.example` hanya berisi nama variabel dan contoh nonrahasia.
- Secret produksi tidak boleh berada dalam repository.
- Credential harus dikelola melalui mekanisme secret management.
- Konfigurasi harus divalidasi saat startup.

## 20.3 Backup

Backup harus mencakup:

- Database.
- File storage yang relevan.
- Konfigurasi operasional yang aman.
- Kunci pemulihan sesuai kebijakan.

Backup harus diuji melalui restore drill. Keberadaan file backup saja bukan bukti bahwa sistem dapat dipulihkan.

---

# 21. TESTING AND QUALITY REQUIREMENTS

## 21.1 Test Levels

- Unit tests.
- Integration tests.
- Contract tests.
- API tests.
- Database migration tests.
- End-to-end tests.
- Security tests.
- Resilience tests.
- Recovery tests.
- UI accessibility tests.

## 21.2 Backend

pytest digunakan untuk menguji:

- Domain logic.
- Policy engine.
- Approval engine.
- Mandate engine.
- Execution guard.
- API.
- Database.
- Worker.
- Integration adapters.

## 21.3 Frontend

Vitest dan Playwright digunakan untuk:

- Component behavior.
- State transitions.
- API integration.
- Navigation.
- Responsive behavior.
- Authentication flows.
- Authorization states.
- Critical user journeys.

## 21.4 Critical End-to-End Scenarios

Minimal pengujian:

1. User mengirim work request.
2. Dispatcher membuat rencana.
3. Request dialokasikan ke specialist.
4. Specialist menghasilkan proposal tindakan.
5. Policy menentukan apakah approval diperlukan.
6. Approver terverifikasi menyetujui tindakan.
7. Mandate Engine menerbitkan mandat.
8. Executor memvalidasi mandat.
9. Eksekusi dilakukan.
10. Hasil diperiksa.
11. Audit record tersedia.
12. Pengguna dapat melihat hasil dan riwayat.

Skenario negatif:

- Caller tanpa autentikasi.
- Approver tidak berwenang.
- Resource di luar scope.
- Mandate expired.
- Mandate revoked.
- Action tidak diizinkan.
- Replay request.
- Duplicate request.
- Database unavailable.
- AI provider unavailable.
- Worker crash.
- Side effect dengan unknown outcome.

## 21.5 Quality Gates

Perubahan tidak boleh dinyatakan selesai hanya karena aplikasi dapat dijalankan.

Quality gate harus meliputi:

- Type checking.
- Lint.
- Unit tests.
- Integration tests.
- Contract tests.
- Security tests.
- Migration tests.
- E2E tests untuk alur kritis.
- Build.
- Manual verification untuk area yang tidak dapat diuji otomatis.

Semua kegagalan harus dicatat dan diselesaikan atau diterima secara eksplisit sebagai risiko yang terdokumentasi.

---

# 22. MIGRATION STRATEGY FROM CURRENT REPOSITORY

## 22.1 Current Baseline

Berdasarkan audit repository yang telah dilaporkan, kondisi saat ini:

- 3 aplikasi: `apps/dashboard`, `apps/mcp-server`, `apps/telegram-adapter`.
- 7 package pada `packages/`.
- Dashboard menggunakan vanilla JavaScript dan custom CSS.
- MCP Server menggunakan Node.js JSON-RPC.
- Zod digunakan untuk validasi.
- Penyimpanan menggunakan JSON file store.
- Dashboard memiliki 23 route yang tercatat dalam `sources.js`.
- 10 route live.
- 6 route partial.
- 4 route demo.
- 3 route non-data.
- WorkBuddy digunakan sebagai orchestrator eksternal.
- Belum terdapat Next.js, FastAPI, PostgreSQL, SQLAlchemy, Alembic, LangGraph, Psycopg 3, pytest, Playwright, atau Docker pada baseline audit tersebut.

Informasi ini adalah baseline yang dilaporkan dari audit. Status aktual harus diverifikasi kembali terhadap repository sebelum setiap tahap migrasi.

## 22.2 Migration Principles

1. Repository yang ada adalah sumber implementasi awal.
2. Jangan membuat repository atau proyek baru hanya untuk menampung arsitektur target.
3. Jangan menghapus fitur yang sudah berjalan tanpa analisis.
4. Jangan memindahkan file tanpa memahami dependency.
5. Jangan membuat folder kosong untuk sekadar menyerupai struktur target.
6. Jangan mengganti implementasi dengan mock agar pengujian terlihat berhasil.
7. Jangan mengklaim fitur selesai tanpa bukti.
8. Jangan melakukan migrasi besar tanpa rollback dan parity tests.
9. Setiap perubahan harus memiliki alasan teknis.
10. Perubahan arsitektur harus terdokumentasi.

## 22.3 Migration Phases

### Phase 0 — Repository Audit and Architecture Mapping

- Audit seluruh aplikasi dan package.
- Inventarisasi semua route.
- Inventarisasi fitur dan statusnya.
- Petakan domain model.
- Petakan API dan MCP tools.
- Petakan permission dan capability.
- Petakan storage.
- Petakan test coverage.
- Identifikasi security findings.
- Buat dependency graph.
- Buat migration matrix.

Output: baseline yang dapat diverifikasi dan daftar perubahan yang disetujui.

### Phase 1 — Domain and Contract Stabilization

- Tetapkan domain model.
- Tetapkan kontrak API.
- Tetapkan event contracts.
- Tetapkan state machine.
- Tetapkan error model.
- Tetapkan identity context.
- Tetapkan governance contracts.

Output: kontrak domain dan integrasi yang konsisten.

### Phase 2 — Security and Governance Hardening

- Verifikasi principal.
- Perbaiki authorization.
- Perbaiki resource scope.
- Perbaiki approval identity.
- Implementasikan token expiry dan revocation.
- Perkuat mandate lifecycle.
- Perkuat execution guard.
- Perkuat idempotency.
- Perkuat audit integrity.

Output: governance yang dapat diuji secara independen.

### Phase 3 — Database Migration

- Rancang PostgreSQL schema.
- Implementasikan SQLAlchemy models.
- Implementasikan Alembic migrations.
- Implementasikan repositories.
- Migrasikan data lama.
- Validasi jumlah dan integritas data.
- Jalankan parity tests.
- Siapkan backup dan rollback.

Output: database operasional dengan data yang tervalidasi.

### Phase 4 — Backend API Migration

- Implementasikan FastAPI.
- Implementasikan authentication.
- Implementasikan authorization.
- Implementasikan application services.
- Implementasikan endpoint.
- Integrasikan governance.
- Integrasikan database.
- Implementasikan API contract tests.

Output: backend API yang menggantikan fungsi lama secara terukur.

### Phase 5 — AI Orchestration Migration

- Implementasikan LangGraph.
- Implementasikan Dispatcher.
- Implementasikan specialist nodes.
- Implementasikan state dan checkpoint.
- Implementasikan tool adapters.
- Integrasikan governance.
- Implementasikan failure handling dan recovery.

Output: AI workforce yang terintegrasi dengan governance.

### Phase 6 — Frontend Migration

- Migrasikan dashboard ke Next.js secara bertahap.
- Pertahankan identitas visual DEXTRA.
- Migrasikan seluruh route yang dipertahankan.
- Hubungkan melalui API.
- Implementasikan loading, empty, error, denied, dan unavailable states.
- Jalankan visual dan functional parity tests.

Output: frontend baru dengan fungsi yang setara atau lebih baik.

### Phase 7 — MCP and External Adapter Migration

- Integrasikan MCP dengan backend.
- Verifikasi caller identity.
- Terapkan capability allowlist.
- Integrasikan Telegram Adapter.
- Pastikan semua adapter menggunakan governance yang sama.

Output: kanal integrasi yang konsisten dan aman.

### Phase 8 — Production Readiness

- Security assessment.
- Load and resilience testing.
- Backup and restore drill.
- Deployment verification.
- Monitoring verification.
- Documentation completion.
- Operational runbooks.
- Incident response procedures.

Output: sistem yang memenuhi kriteria kesiapan produksi.

## 22.4 Migration Completion Rule

Fitur lama hanya boleh dihentikan setelah:

- Pengganti sudah tersedia.
- Data telah dimigrasikan dan diverifikasi.
- Parity tests lulus.
- Security controls tervalidasi.
- Rollback atau recovery plan tersedia.
- Dokumentasi diperbarui.

---

# 23. RELEASE AND ACCEPTANCE CRITERIA

DEXTRA tidak boleh dinyatakan selesai hanya berdasarkan tampilan dashboard, jumlah folder, jumlah endpoint, atau keberhasilan build.

## 23.1 Functional Acceptance

- Pengguna dapat mengelola pekerjaan sesuai role.
- AI workforce dapat menjalankan workflow yang diizinkan.
- Approval berjalan dengan identitas terverifikasi.
- Mandate memiliki scope dan lifecycle yang benar.
- Executor memvalidasi mandat secara independen.
- Audit dapat ditelusuri.
- Integrasi menggunakan authorization yang konsisten.
- Dashboard menampilkan data aktual.

## 23.2 Security Acceptance

- Tidak ada jalur bypass governance yang diketahui dan belum ditangani.
- Identity dan authorization diuji.
- Resource scope diuji.
- Approval identity diuji.
- Mandate expiry dan revocation diuji.
- Replay protection diuji.
- Cross-organization access diuji.
- Secret leakage diuji.
- Audit integrity diuji.

## 23.3 Reliability Acceptance

- Duplicate execution dapat dicegah.
- Unknown outcome ditangani dengan benar.
- Recovery dan reconciliation berjalan.
- Backup dapat dipulihkan.
- Worker dapat pulih dari kegagalan.
- External provider failure tidak merusak governance.

## 23.4 Operational Acceptance

- Deployment terdokumentasi.
- Environment configuration tervalidasi.
- Monitoring berjalan.
- Logging aman.
- Runbook tersedia.
- Backup dan restore telah diuji.
- Incident handling terdokumentasi.

## 23.5 Documentation Acceptance

Dokumentasi minimum:

- PRD.
- Architecture.
- Monorepo Map.
- Domain Model.
- Database.
- API.
- MCP.
- Governance.
- Security.
- Threat Model.
- Deployment.
- Operations.
- Testing.
- Runbooks.
- ADR.

---

# 24. DEFINITION OF DONE

Sebuah fitur dinyatakan selesai jika:

1. Kebutuhan fungsional terpenuhi.
2. Implementasi terhubung ke sumber data yang benar.
3. Authorization diterapkan di backend.
4. Error handling tersedia.
5. Loading dan empty states tersedia bila relevan.
6. Unit tests lulus.
7. Integration tests lulus.
8. Security tests yang relevan lulus.
9. Tidak ada mock yang menyamar sebagai implementasi produksi.
10. Dokumentasi diperbarui.
11. Tidak merusak fitur lain.
12. Perubahan dapat diverifikasi.
13. Risiko yang belum terselesaikan dicatat.
14. Recovery tersedia untuk operasi yang dapat menghasilkan side effect.

Status pekerjaan harus dibedakan menjadi:

- Planned.
- In Progress.
- Implemented.
- Tested.
- Verified.
- Accepted.
- Production Ready.

Status tidak boleh dinaikkan hanya berdasarkan klaim implementer.

---

# 25. RISKS AND MITIGATION

| Risk | Mitigation |
|---|---|
| Migrasi merusak fitur lama | Functional inventory dan parity tests |
| Governance hanya diterapkan di prompt AI | Server-side deterministic enforcement |
| Approval dapat dipalsukan | Verified principal dan server-derived identity |
| Mandate terlalu luas | Action allowlist dan resource scope |
| Duplicate side effect | Idempotency dan reconciliation |
| Data hilang saat migrasi | Backup, validation, dan rollback |
| AI provider unavailable | Provider abstraction dan graceful failure |
| Worker crash | Durable job state dan recovery |
| Cross-tenant data leakage | Organization isolation dan authorization tests |
| Dashboard menampilkan data palsu | API-backed data dan source verification |
| Kompleksitas monorepo | Batas package dan dependency rules |
| Migrasi terlalu besar | Tahapan incremental dan acceptance gates |

---

# 26. DOCUMENT GOVERNANCE

Dokumen ini adalah spesifikasi target produk dan arsitektur.

Ketentuan:

1. PRD adalah sumber kebutuhan produk.
2. Architecture document menjelaskan keputusan implementasi.
3. ADR mencatat keputusan teknis yang berdampak besar.
4. Monorepo map menjelaskan struktur aktual dan target.
5. Security document menjelaskan kontrol dan threat model.
6. Testing document menjelaskan strategi verifikasi.
7. Perubahan scope harus memperbarui PRD.
8. Implementasi harus mengikuti PRD yang telah disetujui atau memiliki deviasi yang terdokumentasi.

## 26.1 Current State vs Target State

Semua dokumentasi wajib membedakan:

- **Current:** sudah ada dan dapat diverifikasi.
- **Partial:** sudah ada tetapi belum memenuhi kebutuhan.
- **Target:** direncanakan dalam arsitektur.
- **Implemented:** sudah dibuat.
- **Tested:** telah diuji.
- **Verified:** bukti pengujian telah diperiksa.
- **Accepted:** telah diterima berdasarkan acceptance criteria.

Keberadaan folder atau file tidak membuktikan bahwa fitur telah diimplementasikan.

---

# 27. FINAL PRODUCT REQUIREMENT

DEXTRA dianggap mencapai target produk ketika seluruh alur inti telah berfungsi sebagai satu sistem terintegrasi:

**Human Request → AI Planning → Specialist Delegation → Policy Evaluation → Human Approval → Mandate Issuance → Independent Execution Validation → Governed Execution → Review → Audit → Recovery and Monitoring**

Tidak boleh ada celah di mana AI dapat mengubah data atau menjalankan side effect tanpa melewati mekanisme governance yang berlaku.

Produk harus dapat dioperasikan, dipelihara, diuji, dipulihkan, dan dikembangkan tanpa bergantung pada klaim keberhasilan yang tidak dapat diverifikasi.

**Final Principle:**

> DEXTRA memberikan AI kemampuan untuk bekerja, tetapi manusia tetap menentukan kewenangan. Setiap tindakan harus memiliki alasan, batas, otorisasi, bukti, dan jejak pertanggungjawaban.