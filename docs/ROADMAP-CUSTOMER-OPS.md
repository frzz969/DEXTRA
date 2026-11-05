# DEXTRA — Roadmap: Customer Operations (Arah Ekspansi)

> Status: **Roadmap / Pengembangan**. Belum diimplementasikan di MVP hackathon. Ditampilkan sebagai arah ekspansi produk.

## 1. Dua Lini Layanan DEXTRA

| Lini | Status | Deskripsi | Spesialis |
|------|--------|-----------|-----------|
| **DEXTRA Internal Workforce** | MVP (aktif) | Membantu operasional internal perusahaan | Executive Assistant, Administrative Officer, Workforce Dispatcher, Adversarial Reviewer, Policy Validator |
| **DEXTRA Customer Operations** | Pengembangan | Melayani pelanggan dan mengelola komunikasi eksternal | Customer Support Officer, Complaint Resolution Officer, Sales Assistant, Order Management Officer, Customer Relationship Officer, Service Recovery Officer |

Keduanya menggunakan **satu fondasi AI dan governance yang sama**, bukan dua produk terpisah.

## 2. Arsitektur Bersama

```
Kanal komunikasi (WhatsApp, Telegram, Email, Web)
        │
        ▼
Communication Gateway
  - Terima pesan, identifikasi kanal, sesi, konteks pelanggan
        │
        ▼
DEXTRA Dispatcher
  - Memahami maksud, menentukan spesialis yang dibutuhkan
        │
   ┌────┴────┐
   ▼         ▼
Internal    Customer
Workforce   Operations
   │         │
   └────┬────┘
        ▼
Shared Governance Layer
  - Policy validation (deterministik)
  - Human approval
  - Mandate (scoped, verifiable)
  - Audit (append-only)
```

**Prinsip kritis:** WhatsApp dan Telegram adalah kanal komunikasi bersama, tetapi **identitas, konteks, dan hak akses internal vs eksternal harus dipisahkan**. Pelanggan tidak boleh bisa mengakses data atau menjalankan tindakan internal perusahaan hanya karena berbicara dengan DEXTRA melalui kanal yang sama.

## 3. Spesialis Customer Operations (rancangan target, bukan aktif)

| Spesialis | Tanggung jawab | Status |
|-----------|----------------|--------|
| Customer Support Officer | Pertanyaan umum dan informasi layanan | Roadmap |
| Complaint Resolution Officer | Keluhan, keterlambatan, dan eskalasi | Roadmap |
| Sales Assistant | Informasi produk dan bantuan pembelian | Roadmap |
| Order Management Officer | Status pesanan dan tindak lanjut | Roadmap |
| Customer Relationship Officer | Riwayat interaksi dan follow-up | Roadmap |
| Service Recovery Officer | Menyiapkan rekomendasi penyelesaian masalah | Roadmap |

**Batas governance:** AI boleh memberikan informasi dan menyiapkan rekomendasi, tetapi refund, kompensasi, diskon khusus, perubahan pesanan, dan komitmen bisnis tetap harus mengikuti kebijakan serta mandat yang berlaku.

## 4. Standar Komunikasi Pelanggan

DEXTRA harus terdengar seperti staf perusahaan yang profesional, bukan chatbot yang kaku. Lihat `docs/COMMUNICATION-STYLE-GUIDE.md` untuk standar lengkap.

Contoh:
- **Keluhan:** "Mohon maaf atas keterlambatan pesanan Anda. Saya bantu periksa terlebih dahulu agar bisa memberikan informasi yang akurat. Boleh diinformasikan nomor pesanannya?"
- **Diskon:** "Terima kasih atas minatnya. Untuk pembelian dalam jumlah tersebut, saya bisa membantu menyiapkan permintaan penawaran harga khusus. Besaran diskon perlu dikonfirmasi terlebih dahulu oleh tim terkait."
- **Pelanggan marah:** "Saya memahami bahwa situasi ini membuat Anda kecewa, terlebih karena sudah beberapa kali menyampaikan keluhan. Saya akan membantu menelusuri riwayat laporan Anda dan meneruskannya kepada tim yang berwenang agar dapat ditindaklanjuti."

## 5. Rencana Pengembangan (5 tahap)

1. **Tahap 1 — Communication Foundation:** standar komunikasi, identitas pelanggan, session management, conversation history.
2. **Tahap 2 — Customer Service:** pertanyaan umum, komplain, status pesanan, eskalasi.
3. **Tahap 3 — Sales & Order Operations:** informasi produk, penawaran, permintaan pembelian, tindak lanjut.
4. **Tahap 4 — Channel Integration:** WhatsApp Business Platform dan Telegram Bot API.
5. **Tahap 5 — Enterprise Integration:** CRM, ERP, sistem pesanan, inventaris, basis pengetahuan perusahaan.

## 6. Untuk Hackathon

Fokus tetap pada **Office Agent dan governance**. Customer Operations ditampilkan sebagai **arah ekspansi produk**, kecuali memang sudah sempat diimplementasikan dan diuji. Jangan klaim 6 spesialis customer operations sudah aktif di MVP.

## 7. Positioning Final

> **DEXTRA — Governed Enterprise AI Workforce & Customer Operations Platform**
>
> AI workforce untuk membantu perusahaan bekerja dari dalam, sekaligus AI customer operations untuk melayani pelanggan dari luar.