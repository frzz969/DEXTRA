# DEXTRA — Accountability Sheet

**Tim:** 2 orang
**Periode:** 1–7 November 2026
**Produk:** DEXTRA, agen AI kantor dengan eksekusi berbasis mandat

> Angka di dokumen ini diambil dari `npm run test:inproc` pada 2026-11-04,
> bukan dari ingatan. Versi sebelumnya menyebut 9 paket / 101 tes / 12 tool;
> ketiganya sudah tidak benar dan diganti dengan hasil hitung ulang.

## Yang dibangun

**14 paket workspace, 349 tes otomatis, semuanya lulus.**

| Paket | Fungsi | Tes |
|---|---|---|
| contracts | Skema data, ID bermerek, hash kanonik, kontrak otorisasi | 14 |
| store | Persistensi JSON, masking di sumber, audit rantai hash, checkpoint | 39 |
| policy-engine | Aturan organisasi: jam kerja, Jumat, hari libur, bulk egress, injection | 14 |
| plan | Penyusun rencana, findings, `plan_hash` | 13 |
| mandate-engine | Penerbitan, validasi 10 langkah, pencabutan, HMAC | 17 |
| executor | Eksekusi mock idempoten, validasi mandat | 12 |
| replay | Rekonstruksi satu keputusan dari audit | 6 |
| alerts | Deteksi, retry, dedup, transport palsu yang mengaku palsu | 50 |
| audit-export | Ekspor JSONL + manifest, verifier independen | 28 |
| skill-registry | Validasi manifest skill (metadata, belum tersambung ke tool) | 13 |
| workflow | Registry definisi workflow + catatan run | 4 |
| ui, design-system, api-client | Sumber kanonik komponen, token, dan klien JSON-RPC | 0 (diverifikasi `verify-packages`) |

Aplikasi:

| Aplikasi | Fungsi | Tes |
|---|---|---|
| mcp-server | 19 tool, pemisahan token agent/ops, batas HTTP | 116 |
| dashboard | SPA operasional, 25 rute, tanpa build step | 16 |
| telegram-adapter | Channel adapter (post-MVP) | 7 |

## Yang nyata vs yang mock

**Nyata:**
- Validasi mandat 10 langkah (termasuk confused deputy dan manipulasi jam).
- Hash rencana kanonik, stabil terhadap urutan key.
- Pemisahan token: tool eksekusi tidak terdaftar di `tools/list` untuk token agent.
  Token `agent` = 12 tool baca+rencana; token `ops` = 19 tool.
- Masking data sensitif di lapisan repository, bukan di tampilan.
- Audit log append-only dengan rantai hash, checkpoint, dan verdict yang
  membedakan `verified` / `unchained` / `broken`.
- Ekspor audit yang bisa diverifikasi di luar aplikasi (`npm run audit:verify`).
- Idempotensi pada `(mandate_id, action_id)` dan pada `request_id` untuk plan.
- Policy engine deterministik: `FRIDAY_PRAYER_CONFLICT`, `OUTSIDE_OFFICE_HOURS`,
  `HOLIDAY_CONFLICT`, `BULK_EGRESS_SUSPECTED`, `INJECTION_QUARANTINED`.

**Mock:**
- Pengiriman email, pembuatan acara kalender, pembuatan tugas. Tidak ada koneksi
  ke layanan eksternal. Semua hasil diberi label "mock" dan mencatat `mock_message_id`.
- Pengiriman notifikasi Telegram: transport palsu. Tidak ada pesan yang keluar
  dari proses, dan setiap record menyatakan `provider: 'fake'`.
- Data organisasi: satu perusahaan fiktif (`org_kenari`) dengan 6 kontak.

## Yang tidak dibangun (dan alasannya)

- Integrasi WhatsApp/Telegram dua arah: di luar 7 hari; adapter hanya kerangka.
- Front-end kustom yang memanggil WorkBuddy: API enterprise, tidak tersedia
  untuk akun peserta.
- Preseden engine penuh: diturunkan jadi opsional setelah regresi P02 (dua Budi) lulus.
- Eksekusi penjadwalan otonom: melanggar prinsip "tulis harus lewat mandat".
- Penyimpanan PostgreSQL: baru desain skema + migrasi; belum pernah dijalankan
  di PostgreSQL sungguhan (Docker tidak tersedia di mesin pengembangan).

## Keterbatasan yang diakui

- Penyerang dengan akses fisik ke perangkat dapat membaca file audit.
- Deteksi prompt injection adalah heuristik tiga pola, bukan model. Kami tidak
  mengklaim akurasi, dan tidak mengklaim cakupan.
- Ekspor audit adalah bukti, bukan tanda tangan: manifest yang ditulis ulang
  secara konsisten bersama artefaknya tidak bisa dibedakan tanpa jangkar di luar
  ekspor (lihat `design/AUDIT-EXPORT.md` §7).
- Audit retensi 90 hari, rencana 30 hari, preseden 180 hari. Angka ini keputusan
  MVP, bukan kewajiban regulasi.
- Tidak ada multi-tenant. Satu organisasi per instalasi.
- Hanya satu zona waktu di konfigurasi (`Asia/Jakarta`); permintaan WITA/WIT
  ditolak sebagai `UNKNOWN_TIMEZONE`, bukan dipahami.
- Token belum punya expiry/revocation; rotasi = ganti environment variable.

## Cara menjalankan

```
npm install
npm run demo:seed
npm start --workspace @dextra/mcp-server
# buka apps/dashboard/index.html lewat `npm run dev:dashboard`
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

**Catatan jujur:** daftar di atas adalah peran yang *dirancang*, bukan agen yang
berjalan. Yang benar-benar berjalan hari ini: penyusun rencana
(`packages/plan`, deterministik), policy validator (`packages/policy-engine`,
deterministik), executor mock, dan detektor alert. Tidak ada LLM di jalur
produksi; lihat `docs/submission/ARCHITECTURE-SUMMARY.md`.
