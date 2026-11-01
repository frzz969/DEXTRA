# DEXTRA — Accountability Sheet

**Tim:** 2 orang
**Periode:** 1–7 November 2026
**Produk:** DEXTRA, agen AI kantor dengan eksekusi berbasis mandat

## Yang dibangun

Sembilan paket kode, semuanya lolos typecheck dan test otomatis:

| Paket | Fungsi | Test |
|---|---|---|
| contracts | Skema data, ID bermerek, hash kanonik | 14 |
| store | Penyimpanan JSON, masking di sumber, anti-enumerasi | 20 |
| policy-engine | Aturan organisasi, Jumat, hari libur, bulk egress, injection | 14 |
| plan | Penyusun rencana, findings, plan_hash | 13 |
| mandate-engine | Penerbitan, validasi 10 langkah, pencabutan, HMAC | 17 |
| executor | Eksekusi mock idempoten, validasi mandat | 12 |
| mcp-server | 12 tool, pemisahan token agent/ops, health check | 5 |
| replay | Rekonstruksi satu keputusan dari audit | 6 |
| dashboard | 5 layar, binding API nyata, offline | manual |

Total: 101 test otomatis. Semua hijau.

## Yang nyata vs yang mock

**Nyata:**
- Validasi mandat 10 langkah (termasuk confused deputy dan manipulasi jam).
- Hash rencana kanonik, stabil terhadap urutan key.
- Pemisahan token: tool eksekusi tidak terdaftar di `tools/list` untuk token agent.
- Masking data sensitif di lapisan repository, bukan di tampilan.
- Audit log append-only dengan detail ter-redaksi.
- Idempotensi pada `(mandate_id, action_id)`.

**Mock:**
- Pengiriman email, pembuatan acara kalender, pembuatan tugas. Tidak ada koneksi ke layanan eksternal. Semua hasil diberi label "mock" dan mencatat `mock_message_id`.

## Yang tidak dibangun (dan alasannya)

- Integrasi WhatsApp/Telegram: tidak realistis dalam 7 hari.
- Front-end kustom yang memanggil WorkBuddy: API enterprise, tidak tersedia untuk akun peserta.
- Preseden engine penuh: diturunkan jadi opsional setelah regresi P02 (dua Budi) lulus.
- Eksekusi penjadwalan otonom: melanggar prinsip "tulis harus lewat mandat".

## Keterbatasan yang diakui

- Penyerang dengan akses fisik ke perangkat dapat membaca file audit.
- Deteksi prompt injection adalah heuristik, bukan model. Kami tidak mengklaim akurasi.
- Audit retensi 90 hari, rencana 30 hari, preseden 180 hari. Angka ini keputusan MVP, bukan kewajiban regulasi.
- Tidak ada multi-tenant. Satu organisasi per instalasi.

## Cara menjalankan

```
npm install
npm run seed --workspace @dextra/store
npm start --workspace @dextra/mcp-server
# buka apps/dashboard/index.html
```

Target setup: di bawah 5 menit dari clone sampai dashboard terbuka.
## Klaim keamanan yang jujur (bukan absolut)

- **Local-Only Service Exposure**, bukan anti-eksfiltrasi absolut: semua layanan listen di 127.0.0.1 (loopback). Ini membatasi eksposur langsung, tetapi tidak mencegah eksfiltrasi lewat kemampuan jaringan WorkBuddy, browser, proses lokal lain, atau celah aplikasi.
- **Scoped Execution Authorization**: pemisahan token agent/ops ditegakkan di server, bukan di prompt. MCP server hanya menerima caller yang diotorisasi; dashboard tidak menyimpan token ops; endpoint approval/eksekusi dilindungi origin/CSRF; tidak ada CORS permisif; respons error tidak membocorkan data sensitif.


## Visi Ekspansi (Roadmap, bukan MVP)

DEXTRA memiliki visi jangka panjang sebagai Governed Enterprise AI Workforce & Customer Operations Platform. Dua lini layanan:

1. DEXTRA Internal Workforce (MVP): Executive Assistant, Administrative Officer, Workforce Dispatcher, Adversarial Reviewer, Policy Validator.
2. DEXTRA Customer Operations (pengembangan): Customer Support Officer, Complaint Resolution Officer, Sales Assistant, Order Management Officer, Customer Relationship Officer, Service Recovery Officer.

Keduanya menggunakan satu fondasi AI dan governance yang sama. Untuk hackathon, fokus tetap Office Agent + governance. Lihat docs/ROADMAP-CUSTOMER-OPS.md.

