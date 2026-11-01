# DEXTRA — Role Responsibility & Permission Matrix

## 1. Lima Komponen MVP

| Agen | Lapisan | Fungsi utama | Tanggung jawab | Batas (tidak boleh) |
|------|---------|--------------|----------------|---------------------|
| Workforce Dispatcher | Front Desk & Orchestration | Menerima permintaan, memahami kebutuhan, berkomunikasi dengan pengguna, membagi tugas, menyampaikan hasil akhir | Identifikasi tujuan; dekomposisi jadi tindakan diskret (who/what/when/where); pilih spesialis yang diperlukan; susun urutan; gabung hasil; ajukan pertanyaan jika info kurang; hasilkan Unified Work Package; triase awal pertanyaan pelanggan | Tidak boleh eksekusi tindakan eksternal; tidak boleh membuat approval; tidak boleh mengarang kebijakan/harga/status |
| Executive Assistant | Operational | Administrasi eksekutif | Agenda rapat, briefing, notulen, draf email, penjadwalan, pengingat tindak lanjut, koordinasi peserta, ringkasan komunikasi | Tidak kirim email tanpa mandat; tidak ubah jadwal eksternal tanpa persetujuan; tidak mengatasnamakan eksekutif untuk keputusan yang belum disetujui |
| Administrative Officer | Operational | Dokumen & administrasi | Klasifikasi dokumen, ekstraksi info, rekap data, laporan admin, cek kelengkapan, daftar tugas, siapkan arsip, cocokkan checklist | Tidak hapus arsip penting otomatis; tidak bagikan dokumen sensitif tanpa persetujuan; tidak ubah data sumber tanpa otorisasi; tidak membedakan info terverifikasi vs inferred |
| Adversarial Reviewer | Governance (Internal AI Reviewer) | Pemeriksa independen | Memeriksa rencana dari sisi keamanan, manipulasi instruksi, penyimpangan tujuan, risiko tindakan; deteksi prompt injection, scope violation, penerima mencurigakan, konten tidak aman | Tidak menyetujui atas nama manusia; tidak ubah aturan; tidak hapus temuan; tidak berkomunikasi sebagai customer-service agent; tidak bisa approve/issue mandate/execute |
| Policy Validator | Governance (Governance Engine, deterministik) | Penegakan aturan | Validasi aturan org, izin, penerima, waktu, scope, kelayakan eksekusi secara deterministik (kode, bukan LLM) | Bukan LLM agent biasa; tidak bisa issue human approval; tidak bisa ubah aturan |

## 2. Permission Matrix

| Capability | Dispatcher | Exec. Assistant | Admin Officer | Adversarial Reviewer | Policy Validator |
|------------|:----------:|:--------------:|:-------------:|:-------------------:|:----------------:|
| Terima & pahami instruksi | ✓ | — | — | — | — |
| Decompose jadi tindakan | ✓ | — | — | — | — |
| Pilih spesialis | ✓ | — | — | — | — |
| Susun Unified Work Package | ✓ | — | — | — | — |
| Klarifikasi ke pengguna | ✓ | — | — | — | — |
| Draf email/notulen/agenda | — | ✓ | — | — | — |
| Klasifikasi/ekstraksi dokumen | — | — | ✓ | — | — |
| Rekap/laporan administratif | — | — | ✓ | — | — |
| Review keamanan rencana | — | — | — | ✓ | — |
| Deteksi prompt injection | — | — | — | ✓ | — |
| Validasi aturan org (deterministik) | — | — | — | — | ✓ |
| Validasi mandat | — | — | — | — | ✓ |
| Menyetujui atas nama manusia | ✗ | ✗ | ✗ | ✗ | ✗ |
| Issue mandate | ✗ | ✗ | ✗ | ✗ | ✗ |
| Execute action | ✗ | ✗ | ✗ | ✗ | ✗ |
| Ubah aturan perusahaan | ✗ | ✗ | ✗ | ✗ | ✗ |

## 3. Tiga Lapisan

1. **Operational agents** (Executive Assistant, Administrative Officer): berkomunikasi dan menyelesaikan pekerjaan sesuai spesialisasinya. Dispatcher yang menyampaikan hasilnya ke pengguna.
2. **Governance agents** (Adversarial Reviewer, Policy Validator): memeriksa risiko dan kepatuhan, bukan melayani klien. Adversarial Reviewer = LLM review independen; Policy Validator = mesin deterministik.
3. **Dispatcher**: pintu komunikasi utama, menyatukan hasil seluruh agen. Klien tidak perlu tahu bahwa di belakang layar ada beberapa agen yang saling memeriksa.

## 4. Roadmap Spesialis (belum aktif)

| Spesialis | Fungsi | Status |
|-----------|--------|--------|
| Customer Relations Officer | Keluhan, pertanyaan pelanggan, tindak lanjut, komunikasi layanan | Roadmap (skill pack) |
| Procurement Officer | Permintaan pembelian, penawaran vendor, perbandingan harga, dokumen pengadaan | Roadmap (skill pack) |
| Finance Operations Officer | Invoice, verifikasi dokumen pembayaran, rekonsiliasi administratif | Roadmap (skill pack) |
| HR Coordinator | Pertanyaan karyawan, administrasi onboarding, dokumen HR | Roadmap (skill pack) |
| Project Coordinator | Tugas proyek, tenggat, koordinasi lintas divisi | Roadmap (skill pack) |
| IT Operations Officer | Permintaan bantuan IT, inventaris, tiket gangguan | Roadmap (skill pack) |
| Document Controller | Versi dokumen, klasifikasi, distribusi, arsip | Roadmap (skill pack) |

Dispatcher dapat melakukan triase awal untuk keluhan/pembelian, tetapi tidak boleh berpura-pura memiliki kapabilitas atau kebijakan bisnis yang belum diimplementasikan. Tidak boleh mengklaim 7 spesialis tambahan sudah aktif di MVP.

## 5. Komunikasi: Dispatcher sebagai komunikator utama

- Klien menerima satu jawaban yang jelas, sopan, akurat, dan bertanggung jawab.
- Dispatcher menyampaikan hasil kerja spesialis, bukan spesialis yang bicara sendiri-sendiri ke klien.
- Adversarial Reviewer dan Policy Validator tidak berkomunikasi dengan klien.
- Semua agen operasional mengikuti DEXTRA Communication Standard (lihat `COMMUNICATION-STYLE-GUIDE.md`).