# DEXTRA — Development Governance

**Versi:** 1.0.0
**Berlaku untuk:** pengembangan DEXTRA 1–7 November 2026
**Sumber kebenaran produk:** `docs/PRD.md`
**Hubungan dengan PRD:** PRD menjawab *produk bekerja bagaimana*. Dokumen ini menjawab *kita membangunnya bagaimana*.

---

# 1. Authority

1. `docs/PRD.md` adalah sumber kebenaran tunggal. Jika kode dan PRD berbeda, kode yang salah.
2. Perubahan terhadap PRD hanya melalui keputusan manusia (lihat §7).
3. Dokumen ini tidak boleh diubah oleh agent tanpa persetujuan manusia.

---

# 2. Peran

| Peran | Dipegang oleh | Tanggung jawab | Batas |
| --- | --- | --- | --- |
| **Orchestrator** | Sesi utama | Perencanaan, pembagian lane, integrasi, kontrol scope | Tidak menulis implementasi besar sendiri jika ada lane aktif |
| **Explorer** | subagent | Riset repo, dokumentasi, kompatibilitas | Tidak menulis kode |
| **Oracle** | subagent | Evaluasi arsitektur dan keamanan | Maks 2 pemanggilan sepanjang proyek |
| **Designer** | subagent | Alur dashboard dan approval UI | Maks 1 pemanggilan, setelah kontrak dibekukan |
| **Fixer** | subagent | Implementasi sesuai kontrak | Tidak mengubah kontrak, tidak memutuskan arsitektur |
| **Debugger** | subagent | Pengujian independen, diagnosis | Tidak memperbaiki; hanya melaporkan |
| **Reviewer** | subagent | Review desain dan konsistensi | Maks 2 pemanggilan (hari 5 dan hari 6) |
| **Human** | kamu berdua | Gate persetujuan, keputusan produk | — |

**Aturan pemakaian agent:** subagent dipanggil hanya jika ada alasan eksplisit. Pekerjaan yang bisa diselesaikan langsung oleh Orchestrator (dokumen, kontrak, keputusan) dikerjakan langsung. Memanggil agent tanpa alasan adalah pemborosan, bukan ketelitian.

**Writer tidak dipakai.** Dokumen submission ditulis oleh Orchestrator.

---

# 3. Model Kerja

## 3.1 Dua Tingkat

| Tingkat | Kapan | Siapa |
| --- | --- | --- |
| **Gate** (seremoni penuh) | 4 kali sepanjang proyek | Explorer / Oracle / Reviewer |
| **Lane** (ringan) | Setiap tugas implementasi | Fixer + Debugger |

## 3.2 Empat Gate

| Gate | Hari | Peserta | Keluaran |
| --- | --- | --- | --- |
| G1 — Kontrak & arsitektur | 1 | Explorer, Oracle, Human | Kontrak data dibekukan |
| G2 — Keamanan | 3 | Oracle, Human | Persetujuan alur mandat |
| G3 — Review desain | 5 | Reviewer | Daftar temuan prioritas |
| G4 — Pra-submit | 6 | Reviewer, Human | Persetujuan pengumpulan |

Gate lain berjalan otomatis tanpa persetujuan manusia.

## 3.3 Lane

- Maksimum **2 lane paralel**.
- Satu lane = satu penulis (Fixer) + satu verifikator (Debugger).
- Dua lane **tidak boleh** menyentuh file yang sama (lihat §5).
- Orchestrator menyatukan hasil sekali di akhir lane, bukan di setiap perubahan.

## 3.4 Batas Iterasi

- Maksimum **2 putaran perbaikan** per tugas.
- Putaran ketiga wajib dieskalasi ke Human dengan laporan kegagalan.
- Tugas yang macet > 45 menit dipotong scope-nya atau ditunda.

---

# 4. Disiplin Version Control

1. **Git sejak hari pertama.** Tidak ada pengecualian.
2. `main` selalu dalam keadaan dapat dijalankan.
3. Pekerjaan dilakukan pada branch `feat/<modul>` atau `fix/<modul>`.
4. Commit kecil dan sering. Satu commit = satu perubahan logis.
5. Pesan commit: `<tipe>(<modul>): <ringkasan>` — contoh `feat(mandate): validate plan hash on execute`.
6. Sebelum lane dimulai, Orchestrator mencatat commit awal. Jika lane gagal, `git reset --hard` ke commit itu.
7. Tidak ada commit yang menyentuh `node_modules`, data seed hasil uji, atau secret.
8. Tag `hackathon-submission` dibuat tepat setelah submit.

**File yang tidak boleh masuk repo:** `.env`, kunci HMAC, data pengguna nyata, rekaman video besar.

---

# 5. Peta Kepemilikan File

Dua lane tidak boleh menulis pada path yang sama. Jika terpaksa, kerjakan berurutan.

| Path | Pemilik | Catatan |
| --- | --- | --- |
| `packages/contracts/**` | Orchestrator | **Beku setelah G1.** Hanya Orchestrator mengubah |
| `packages/policy-engine/**` | Lane A | |
| `packages/mandate-engine/**` | Lane A | |
| `packages/audit/**` | Lane B | |
| `packages/mock-services/**` | Lane B | |
| `apps/mcp-server/src/tools/**` | Lane A | |
| `apps/mcp-server/src/executor/**` | Lane A | |
| `apps/dashboard/**` | Lane B | |
| `workbuddy/**` | Human / Orchestrator | Prompt dan manifest |
| `docs/**` | Orchestrator | |

**Aturan:** sebelum menyentuh file di luar kepemilikannya, agent harus melapor dan menunggu instruksi.

---

# 6. Aturan Implementasi

1. Periksa repository sebelum membuat atau mengubah file.
2. Jangan mengasumsikan teknologi, dependency, API, atau kemampuan WorkBuddy.
3. Jangan membuat fitur di luar PRD.
4. Jangan mengganti arsitektur yang sudah disepakati.
5. Jangan membuat mock yang diklaim sebagai integrasi sungguhan.
6. Jangan membuat tombol atau fungsi UI yang tidak bekerja.
7. Jangan menghapus fitur atau data tanpa persetujuan.
8. Jangan mengubah kontrak data tanpa Orchestrator.
9. Jangan menambah dependency baru tanpa alasan yang tercatat.

---

# 7. Gate Manusia

Hanya tiga hal yang memerlukan persetujuan manusia:

| Gate | Pertanyaan yang dijawab |
| --- | --- |
| **Pembekuan kontrak** | Apakah `Plan`, `Mandate`, dan `ActionResult` sudah benar dan tidak akan berubah? |
| **Perubahan scope** | Apakah tambahan ini layak mengorbankan waktu pengujian? |
| **Sebelum submit** | Apakah semua deliverable dan test case terbukti? |

Selain tiga itu, pengembangan berjalan tanpa intervensi manusia.

---

# 8. Aturan Keamanan

1. Tidak ada jalur eksekusi langsung dari LLM ke mock executor.
2. Tool `submit_approval`, `issue_mandate`, dan `execute_action` tidak diekspos ke model.
3. Persetujuan hanya berasal dari approval interface.
4. Mandat divalidasi independen oleh executor.
5. Perubahan rencana setelah approval wajib divalidasi ulang.
6. Tidak ada fallback yang melewati approval gate.
7. Kegagalan validasi menghasilkan penolakan.
8. Secret tidak pernah berada di prompt, kode, atau repo.

Pelanggaran salah satu poin di atas = kegagalan kritikal, bukan bug biasa.

---

# 9. Verifikasi dan Bukti

Agent tidak boleh menyatakan tugas selesai karena kode berhasil dibuat.

**Bukti minimum per tugas:**

| Jenis | Bukti |
| --- | --- |
| Schema | `npm run typecheck` lolos |
| Perilaku | `npm test` lolos, dengan nama test yang disebut |
| Test kritis | `npm run test:critical` lolos (TC-001–TC-008) |
| UI | Screenshot atau rekaman singkat |
| Keamanan | Output percobaan bypass yang gagal |

**Dilarang:** "sudah saya implementasikan", "seharusnya berjalan", "test lulus" tanpa nama test.

Debugger melaporkan hasil berdasarkan output aktual, bukan interpretasi.

---

# 10. Format Laporan Penyelesaian

Setiap agent mengakhiri pekerjaan dengan format ini:

```
STATUS:      selesai | sebagian | gagal
RUANG LINGKUP: file yang dibuat/diubah
KEPUTUSAN:   keputusan teknis + alasan singkat
BUKTI:       perintah yang dijalankan + hasil ringkas
BELUM:       pekerjaan yang tersisa
RISIKO:      ketergantungan atau hal yang bisa menggagalkan
```

Laporan tanpa bagian BUKTI dianggap tidak selesai.

---

# 11. Kontrol Scope

Jika muncul ide baru:

1. Catat sebagai proposal, jangan implementasikan.
2. Jelaskan manfaat dan biaya waktunya.
3. Nyatakan fitur apa yang harus dikorbankan sebagai gantinya.
4. Tunggu keputusan manusia.

**Skala prioritas yang mengikat** (dari PRD §27.2):

1. Plan Object
2. Approval Gate
3. Mandate Service
4. Mock Executor
5. Independent Validation
6. Audit Log
7. Prompt Injection Quarantine
8. Ambiguity Handling
9. Policy Rules
10. Dispatcher dan spesialis
11. Dashboard polish
12. Revocation
13. Precedent
14. Decision Replay

Apa pun di bawah nomor 10 tidak boleh dikerjakan sebelum nomor 1–9 terbukti lulus test.

**Daftar eksekusi yang mengikat ada di `docs/PRIORITY-PLAN.md`.** Jika daftar itu dan bagian ini berbeda, `PRIORITY-PLAN.md` yang dipakai, karena ia memuat status dan estimasi.

---

# 12. Definisi "Selesai" untuk Sebuah Tugas

Sebuah tugas selesai jika **semua** terpenuhi:

- [ ] Sesuai PRD, tanpa tambahan di luar requirement.
- [ ] Typecheck lolos.
- [ ] Test terkait lolos dan disebut namanya.
- [ ] Tidak menambah jalur bypass approval.
- [ ] Bukti dilampirkan.
- [ ] Tidak mengubah kontrak tanpa persetujuan.
- [ ] Commit dibuat dengan pesan yang jelas.

Jika satu kotak belum tercentang, status tugas adalah **sebagian**, bukan selesai.

---

# 13. Ringkasan Aturan yang Tidak Boleh Dilanggar

1. PRD adalah sumber kebenaran.
2. Kontrak dibekukan setelah G1.
3. Tidak ada eksekusi tanpa mandat.
4. Agent tidak memegang kredensial eksekusi.
5. Setiap klaim selesai wajib disertai bukti.
6. Maksimum dua putaran perbaikan.
7. Maksimum dua lane paralel, tanpa tumpang tindih file.
8. Git sejak hari pertama.
9. Perubahan scope menunggu manusia.
10. Kegagalan dilaporkan, bukan disembunyikan.

---

# 14. Skill Playbook

Skill OpenCode adalah alat **proses pengembangan**, bukan komponen produk. Karena itu tidak dicantumkan di PRD, dan tidak boleh muncul dalam deskripsi produk atau video demo.

## 14.1 Pemetaan Wajib

| Kapan | Skill | Dipakai oleh |
| --- | --- | --- |
| Menyusun estimasi waktu / menilai kelayakan jadwal | `ai-estimates` | Orchestrator, Human |
| Sebelum mulai implementasi modul baru | `verification-planning` | Orchestrator |
| Implementasi fitur atau perbaikan bug | `tdd` | Fixer |
| Menulis atau memperbaiki test | `testing-best-practices` | Debugger |
| Ada test gagal, bug, atau perilaku tak terduga | `systematic-debugging` | Debugger |
| Review kode pada G3 dan G4 | `code-review` | Reviewer |
| Desain dashboard dan approval center | `ui-ux-pro-max` | Designer |
| Implementasi komponen UI | `ui-styling` | Designer |
| Token warna, spacing, tipografi dashboard | `design-system` | Designer |
| Menulis accountability sheet, product sharing, deskripsi submission | `anti-ai-slop-writing` | Orchestrator |
| Merapikan prosa dokumen agar tidak terasa AI | `humanize-skill` | Orchestrator |
| Pesan commit | `commit-natural` | Semua |
| Scope melar, patch menumpuk, arah mulai kacau | `step-back` | Orchestrator |
| Setelah fitur stabil dan lolos test | `simplify` | Fixer |
| Perlu membaca source dependency (MCP SDK, WorkBuddy manifest) | `clonedeps` | Explorer |
| Lane paralel yang berisiko saling menimpa | `worktrees` | Orchestrator (opsional) |

## 14.2 Katalog Lengkap

Semua skill yang tersedia dipakai sesuai kebutuhan. Tidak ada yang dilarang — yang penting setiap pemakaian menjawab pekerjaan nyata.

| Skill | Dipakai untuk | Kapan |
| --- | --- | --- |
| `ai-estimates` | Estimasi realistis per modul; menilai apakah scope masih muat | Hari 1, dan setiap kali mau menambah fitur |
| `verification-planning` | Menentukan cara membuktikan modul berfungsi sebelum menulis kode | Awal setiap modul |
| `tdd` | Implementasi fitur lewat siklus red-green-refactor | Fixer, modul inti |
| `testing-best-practices` | Kualitas test: assertion kuat, bukan test yang selalu lulus | Debugger |
| `systematic-debugging` | Menelusuri kegagalan test dan perilaku tak terduga | Debugger, saat ada bug |
| `code-review` | Review keamanan dan kualitas diff sebelum merge | Reviewer, G3 dan G4 |
| `simplify` | Merapikan kode setelah fitur stabil | Fixer, akhir modul |
| `step-back` | Berhenti dan menilai ulang saat patch menumpuk atau scope melar | Orchestrator, kondisi darurat |
| `ui-ux-pro-max` | Alur dashboard, hierarki informasi approval center | Designer |
| `ui-styling` | Implementasi komponen dan layout dashboard | Designer |
| `design-system` | Token warna, spacing, tipografi agar dashboard konsisten | Designer |
| `design` | Logo dan ikon produk untuk cover image dan pembuka video | Designer, hari 6 |
| `banner-design` | Cover image 16:9 untuk online showcase | Designer, hari 6 |
| `brand` | Konsistensi nama, tagline, dan pesan di semua deliverable | Hari 6, saat menyusun submission |
| `hallmark` | Halaman project link (bonus) jika waktunya ada | Opsional, hari 6 |
| `slides` | Materi pendukung Demo Day bila diperlukan | Opsional, hari 7 |
| `anti-ai-slop-writing` | Accountability sheet, product sharing, deskripsi submission | Hari 6 |
| `humanize-skill` | Merapikan prosa dokumen agar tidak terasa mesin | Hari 6 |
| `commit-natural` | Pesan commit | Setiap commit |
| `clonedeps` | Membaca source MCP SDK saat perilakunya tidak terdokumentasi | Explorer, bila perlu |
| `codemap` | Peta kode untuk reviewer dan lane baru | Sekali, di G4 |
| `worktrees` | Isolasi dua lane yang berisiko saling menimpa | Opsional |
| `deepwork` | Fase integrasi besar bila koordinasi manual mulai kacau | Cadangan |
| `reflect` | Retrospektif harian singkat: apa yang macet, apa yang diubah | Akhir hari |
| `report` | Melaporkan bug tooling ke OpenCode bila menghambat | Bila terjadi |
| `oh-my-opencode-slim` | Menyesuaikan konfigurasi agent kalau alurnya terasa lambat | Bila perlu |
| `opencode` | Pertanyaan soal perilaku OpenCode itu sendiri | Bila perlu |

## 14.3 Aturan

1. Pakai skill yang menjawab masalah yang sedang dihadapi. Tidak perlu memaksakan skill yang tidak relevan, dan tidak perlu menahan diri jika relevan.
2. Skill tidak menggantikan bukti. `tdd` tidak membuat test otomatis dianggap benar.
3. Jika skill menyarankan perubahan arsitektur, kembali ke §11 — catat sebagai proposal, jangan implementasikan.
4. Dokumen panjang hasil skill (mis. `codemap`) dibuat sekali saja, bukan diulang setiap hari.
