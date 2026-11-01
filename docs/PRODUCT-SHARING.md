# DEXTRA — Deskripsi Produk (Product Sharing)

**Nama produk:** DEXTRA
**Tagline:** Specialized AI workers. Human-defined authority. Accountable execution.
**Kategori:** AI Agent / Office Automation / Governance

## Masalah

Kantor kecil dan menengah membuang waktu untuk pekerjaan administratif berulang: notulen, penjadwalan, pengiriman email, ekstraksi dokumen. Alat AI yang ada bisa menulis draf, tapi tidak boleh mengirim apa pun atas nama organisasi tanpa pengawasan manusia. Kebanyakan "agen AI" yang menjanjikan otomatisasi penuh justru melewatkan satu hal: siapa yang bertanggung jawab kalau salah kirim.

## Solusi

DEXTRA adalah workforce AI yang bekerja seperti tim administrasi nyata, dengan satu perbedaan: setiap tindakan yang mengubah state eksternal wajib lewat mandat.

Alur:
1. Pengguna memberi instruksi dalam bahasa Indonesia.
2. Dispatcher memecah instruksi menjadi tindakan diskret (siapa, apa, kapan, ke mana).
3. Spesialis AI menyusun rencana dan draf.
4. Adversarial Reviewer memeriksa risiko, ambiguitas, dan konflik jadwal.
5. Validator deterministik memeriksa aturan organisasi.
6. Manusia menyetujui rencana versi tertentu.
7. Mandat diterbitkan dengan ruang lingkup tepat: tindakan, penerima, waktu, isi.
8. Executor memvalidasi mandat secara independen sebelum menjalankan.
9. Semua kejadian tercatat di audit log.

## Prinsip utama

"Baca boleh otomatis, tulis harus lewat mandat."

AI boleh membaca, menganalisis, menyiapkan, dan merekomendasikan. Tindakan yang mengubah state eksternal wajib persetujuan manusia dan mandat yang dapat diverifikasi.

## Yang membedakan

- **Mandat sebagai capability, bukan flag approval.** Tool eksekusi tidak pernah terekspos ke model. Pemisahan ini ditegakkan di server, bukan di prompt.
- **Validator deterministik.** Bukan agen LLM kedua. Aturan organisasi diperiksa dengan kode, bukan dengan prompt.
- **Scope Inspector.** Manusia melihat persis penerima, waktu, isi, dan lampiran sebelum menyetujui. Yang disetujui adalah teks persis, bukan ringkasan.
- **Audit append-only.** Setiap kejadian tercatat dengan alasan. Rencana yang berubah setelah persetujuan membatalkan mandat lama.
- **Privasi by construction.** Data sensitif tidak pernah keluar dari store dalam bentuk penuh. Masking di sumber, bukan di tampilan.

## Teknologi

WorkBuddy Desktop (agen LLM) + MCP server lokal (Node.js, 127.0.0.1) + dashboard lokal (HTML/CSS/JS). Tanpa database eksternal, tanpa cloud, tanpa akun tambahan. Setup di bawah 5 menit.

## Status

MVP selesai. 101 test otomatis lulus. Demo 7 menit dengan satu test case 90 detik yang belum pernah dilihat. Mode offline tersedia.