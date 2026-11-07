# DEXTRA — Deskripsi Produk (Product Sharing)

**Nama produk:** DEXTRA
**Tagline:** Specialized AI workers. Human-defined authority. Accountable execution.
**Kategori:** AI Agent / Office Automation / Governance / Customer Operations

## Masalah

Kantor kecil dan menengah membuang waktu untuk pekerjaan administratif berulang: notulen, penjadwalan, pengiriman email, ekstraksi dokumen. Alat AI yang ada bisa menulis draf, tapi tidak boleh mengirim apa pun atas nama organisasi tanpa pengawasan manusia. Kebanyakan "agen AI" yang menjanjikan otomatisasi penuh justru melewatkan satu hal: siapa yang bertanggung jawab kalau salah kirim.

## Solusi

DEXTRA adalah workforce AI yang bekerja seperti tim administrasi nyata, dengan satu perbedaan: setiap tindakan yang mengubah state eksternal wajib lewat mandat.

Alur yang **berjalan hari ini** (bukan rancangan):

1. Pengguna menulis instruksi dalam bahasa Indonesia di `/assistant`.
2. `compose()` mencari penerima lewat `find_precedent`. Kalau ada dua kandidat
   setara, ia **berhenti dan bertanya** — tidak memilih.
3. `create_plan` di server menyusun objek rencana: siapa, apa, kapan, di mana.
4. Validator deterministik memeriksa aturan organisasi dan menandai konflik
   (Salat Jumat, jam kerja, hari libur, bulk egress, instruksi tertanam).
5. Manusia meninjau penerima, waktu, isi, dan `plan_hash` di `/work-packages/:id`.
6. `submit_approval` mengikat keputusan pada hash itu.
7. Mandat diterbitkan dengan ruang lingkup tepat: tindakan, penerima, waktu, isi.
8. Executor memvalidasi mandat secara independen sebelum menjalankan.
9. Semua kejadian tercatat di audit log; ekspornya bisa diverifikasi di luar aplikasi.

Tidak ada Dispatcher, Spesialis, atau Adversarial Reviewer di jalur ini. Versi
sebelumnya menuliskan ketiganya sebagai langkah yang berjalan; itu tidak benar.
Yang menyusun rencana adalah `packages/plan` (deterministik), dan tidak ada LLM
di jalur produksi.

## Prinsip utama

"Baca boleh otomatis, tulis harus lewat mandat."

AI boleh membaca, menganalisis, menyiapkan, dan merekomendasikan. Tindakan yang mengubah state eksternal wajib persetujuan manusia dan mandat yang dapat diverifikasi.

## Yang membedakan

- **Mandat sebagai capability, bukan flag approval.** Tool eksekusi tidak pernah terekspos ke model. Pemisahan ini ditegakkan di server, bukan di prompt.
- **Validator deterministik.** Bukan agen LLM kedua. Aturan organisasi diperiksa dengan kode, bukan dengan prompt.
- **Layar persetujuan yang menampilkan teks persisnya.** Sebelum menyetujui, manusia melihat penerima (ter-mask), zona waktu dan jam, isi pesan utuh, `plan_hash`, serta temuan kebijakan. Yang disetujui adalah rencana versi itu — bukan ringkasan. Tidak ada field lampiran di kontrak rencana, jadi tidak ada yang diklaim di sini.
- **Audit append-only dengan rantai hash.** Setiap kejadian tercatat dengan alasan, dan setiap event membawa hash pendahulunya. Menghapus atau mengubah satu baris terdeteksi; ekspornya bisa diperiksa dengan perintah terpisah yang tidak butuh server. Rencana yang berubah setelah persetujuan membatalkan mandat lama.
- **Privasi by construction.** Data sensitif tidak pernah keluar dari store dalam bentuk penuh. Masking di sumber, bukan di tampilan.

## Teknologi

Dashboard lokal (HTML/CSS/JS, tanpa build step) + MCP server lokal (Node.js, 127.0.0.1:8765) + penyimpanan JSON. Tanpa database eksternal, tanpa cloud, tanpa akun tambahan. Setup di bawah 5 menit.

## Status

MVP selesai. **349 tes otomatis lulus** (`pnpm run test:inproc`, 2026-11-04). Demo 7 menit dengan satu test case 90 detik yang belum pernah dilihat. Mode offline tersedia, dan saat offline dashboard menyatakan datanya demo.

Batas yang dinyatakan, bukan disembunyikan: pengiriman email/kalender masih mock, notifikasi Telegram masih transport palsu, hanya satu zona waktu yang dikonfigurasi, dan belum ada identitas per pengguna dengan expiry.