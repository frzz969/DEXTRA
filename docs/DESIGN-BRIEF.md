# DEXTRA — Design Brief (Dashboard)

**Versi:** 1.0.0
**Status:** menunggu referensi visual dari manusia
**Kontrak data:** `packages/contracts` (beku, v1.0.1)
**Batas:** tidak ada field di layar yang tidak berasal dari kontrak.

---

## 1. Batasan yang Tidak Bisa Ditawar

| Batasan | Konsekuensi desain |
| --- | --- |
| Offline penuh | Tanpa CDN. Font sistem atau file lokal. Tanpa Google Fonts, tanpa Tailwind CDN |
| Tiga layar saja | Approval Center, Audit Timeline, Mock Inbox |
| Tanpa build step | HTML + CSS + JS; file dibuka dari server lokal, bukan `file://` |
| Data ter-mask | Yang tersedia hanya `display_name`, `department`, `masked_address`, `tags` |
| Risiko harus terbaca < 3 detik | Severity tidak boleh hanya warna; butuh kata + ikon + posisi |
| Demo 5–8 menit | Layar utama harus bisa dipahami tanpa dijelaskan |

---

## 2. Inventaris Isi

### 2.1 Approval Center

**Sumber:** `Plan`, `PlanAction`, `Finding`

| Bagian | Field | Catatan |
| --- | --- | --- |
| Kepala | `intent`, `status`, `created_at` | Status menentukan warna seluruh kartu |
| Per tindakan | `action_type`, `target.display_name`, `target.masked_address`, `target.channel` | Penerima selalu tampil ter-mask |
| Waktu | `schedule.start_at`, `schedule.end_at`, `schedule.timezone` | Tampilkan zona secara eksplisit; jangan mengandalkan jam lokal juri |
| Isi | `content.subject`, `content.body` | Isi persis, tanpa potongan. Kalau panjang, scroll di dalam panel |
| Risiko | `risk`, `findings[].severity`, `findings[].message` | `blocking` = tidak bisa disetujui |
| Integritas | `plan_hash` | Tampilkan 12 karakter pertama + label "sidik rencana" |

**Status yang harus punya tampilan berbeda:** `READY`, `NEEDS_REVIEW`, `BLOCKED`, dan rencana yang sudah dieksekusi.

**Tombol:** `Setujui`, `Tolak`, `Minta revisi`. Ketiganya wajib berfungsi. Saat `BLOCKED`, tombol setujui **nonaktif dengan alasan tertulis**, bukan hilang.

### 2.2 Audit Timeline

**Sumber:** `AuditEvent`

| Bagian | Field |
| --- | --- |
| Baris waktu | `at`, `type` |
| Pelaku | `actor` |
| Subjek | `plan_id`, `mandate_id`, `action_id` |
| Alasan | `reason_code` |
| Detail | `detail` (sudah ter-redaksi) |

Urutan lama → baru. Tidak ada tombol edit atau hapus. Ini penting: menampilkan bahwa riwayat tidak bisa diubah lebih meyakinkan daripada menjelaskannya.

### 2.3 Mock Inbox

**Sumber:** `ActionResult` yang `result === "sent"`

| Keadaan | Tampilan |
| --- | --- |
| Sebelum persetujuan | Kosong, dengan teks "Belum ada pesan. Tidak ada yang dikirim tanpa mandat." |
| Setelah eksekusi | Satu pesan dengan waktu kirim dan `execution_id` |
| Ditolak | Kosong, dengan alasan penolakan |

Layar ini ada untuk demo, bukan untuk operasional. Fungsinya membuktikan perbedaan antara "direncanakan" dan "terkirim".

---

## 3. Keadaan yang Wajib Dirancang

Bukan hanya keadaan normal. Empat ini yang akan muncul di demo:

1. **Kosong** — belum ada rencana.
2. **Ambigu** — dua kandidat Budi, penerima belum dipilih.
3. **Diblokir** — `BLOCKED` dengan temuan `blocking`; tombol setujui mati.
4. **Gagal** — API lokal tidak merespons. Harus jelas bahwa tidak ada yang dieksekusi.

Keadaan gagal tidak boleh menampilkan spinner tanpa akhir. Harus ada kalimat yang menyatakan sistem tidak dapat memastikan, dan bahwa tidak ada tindakan dijalankan.

---

## 4. Yang Dinilai Saat Memilih Referensi

Pakai ini sebagai filter, bukan selera:

| Kriteria | Pertanyaan |
| --- | --- |
| Keterbacaan risiko | Bisakah kamu tahu ini berbahaya dalam 3 detik, tanpa membaca? |
| Kepadatan | Apakah muat daftar + detail dalam satu layar tanpa scroll halaman? |
| Kejelasan status | Apakah `BLOCKED` terlihat berbeda secara struktural, bukan hanya warna? |
| Kesederhanaan | Apakah bisa dibuat dengan HTML + CSS biasa tanpa framework? |
| Orisinalitas | Apakah ini bisa dipakai tanpa terlihat seperti template generator? |

**Yang sebaiknya dihindari:** gradient ungu-biru, kartu dengan bayangan lembut di mana-mana, ikon outline seragam, angka besar tanpa konteks. Semua itu penanda visual generik dan melemahkan klaim governance.

---

## 5. Arah Visual yang Saya Sarankan Dibandingkan

Tiga arah, bukan satu. Nanti dipilih satu:

| Arah | Ciri | Kesan |
| --- | --- | --- |
| **Ledger** | Monospace untuk angka dan hash, garis tipis, latar terang, tanpa bayangan | Seperti dokumen resmi; cocok untuk audit |
| **Kontrol Ruang** | Panel gelap, status sebagai pita warna tegas, kepadatan tinggi | Seperti konsol operasi; cocok untuk "gerbang" |
| **Surat** | Tipografi serif untuk isi pesan, metadata kecil di tepi | Menekankan bahwa yang disetujui adalah komunikasi nyata |

---

## 6. Yang Tidak Boleh Ada di Layar

- Tombol tanpa fungsi.
- Angka risiko tanpa penjelasan.
- Alamat email penuh, nomor telepon, NIK, gaji.
- Data contoh yang tidak sesuai dengan seed.
- Teks bahasa Inggris pada label antarmuka. Seluruh UI berbahasa Indonesia.
