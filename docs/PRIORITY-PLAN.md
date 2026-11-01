# DEXTRA â€” Priority Plan

**Versi:** 1.0.0
**Fungsi:** satu tabel yang menentukan apa dikerjakan lebih dulu. Jika ragu, buka tabel ini, bukan PRD dari awal.
**Sumber requirement:** `docs/PRD.md` (Â§20 test matrix, Â§27 prioritas, Â§33.6 privasi)
**Aturan:** nomor besar tidak dikerjakan sebelum nomor kecil lulus test-nya.

---

## 1. Tiga Tingkat

| Tingkat | Arti | Konsekuensi jika tidak selesai |
| --- | --- | --- |
| **P0** | Produk tidak jujur tanpa ini | Demo gagal atau klaim palsu |
| **P1** | Membuat demo meyakinkan | Bisa didemokan, tapi terasa setengah |
| **P2** | Nilai tambah | Tidak apa-apa tidak selesai |

---

## 2. P0 â€” Wajib

| # | Modul | Isi | Bergantung pada | Test | Est. | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P0-1 | `packages/store` | Repository JSON tanpa SQL; masking di sumber; anti-enumerasi; batas 8 KB; seed data | contracts (beku) | TC-012, TC-013 | 2 j | **selesai** (13/13 test, typecheck hijau) |
| P0-2 | `packages/policy-engine` | Jam kerja, zona waktu, salat Jumat, hari libur, konflik jadwal | P0-1 | TC-001 | 1,5 j | **selesai** (14/14 test, typecheck hijau) |
| P0-3 | `packages/plan` | Susun rencana, findings, `plan_hash` kanonik | P0-1, P0-2 | TC-001, TC-006 | 2,5 j | belum |
| P0-4 | `packages/mandate-engine` | Terbitkan, validasi, cabut; HMAC; expiry; ikatan `plan_hash` | P0-3 | TC-003â€“TC-007 | 2,5 j | belum |
| P0-5 | `packages/executor` | Eksekusi idempoten; kunci `(mandate_id, action_id)`; status in-flight | P0-4 | TC-008 | 2 j | belum |
| P0-6 | `packages/audit` | Append-only; 16 jenis event; detail ter-redaksi | P0-1 | TC-004â€“TC-008 | 1 j | belum |
| P0-7 | `apps/mcp-server` (permukaan tool) | 12 tool; pemisahan token `agent` / `ops`; `tools/list` terfilter; penolakan allowlist | P0-1..P0-6 | TC-010 | 2 j | belum |
| P0-8 | Bulk egress guard | > 5 penerima atau > 3 pola PII â†’ `BLOCKED` | P0-3 | TC-011 | 1 j | belum |
| P0-9 | Karantina injection | Heuristik deterministik Indonesia; ambang tinggi/sedang | P0-3 | TC-002, TC-009 | 1,5 j | belum |

**Total P0: Â± 16 jam** â€” realistis 2 hari untuk dua orang.

Gate setelah P0-9: **G2 â€” review keamanan** (Oracle, sekali). Tidak ada penambahan fitur sebelum lulus.

---

## 3. P1 â€” Demo Meyakinkan

| # | Modul | Isi | Bergantung pada | Test | Est. |
| --- | --- | --- | --- | --- | --- |
| P1-1 | `apps/dashboard` â€” Approval Center | Penerima, waktu, isi, hash, blast radius, tombol setujui/tolak | P0-7 | TC-003 | 3 j |
| P1-2 | Klarifikasi ambiguitas | Dua Budi ditampilkan dengan bukti; pengguna memilih | P0-3 | TC-001 | 1,5 j |
| P1-3 | Revocation window | Jeda kirim + tombol batalkan; bukan menarik email terkirim | P0-5 | TC-005 | 1,5 j |
| P1-4 | Audit Center | Urutan kejadian, alasan berhasil/gagal | P0-6 | TC-004â€“008 | 1,5 j |

**Total P1: Â± 7,5 jam** â€” 1 hari.

Gate **G3 â€” review desain** setelah P1-4.

---

## 4. P2 â€” Nilai Tambah

| # | Modul | Isi | Est. |
| --- | --- | --- | --- |
| P2-1 | Precedent engine | Saran penerima berbasis riwayat; tetap bertanya saat ambigu | 2 j |
| P2-2 | Decision Replay | Memutar ulang satu keputusan dari audit | 1,5 j |
| P2-3 | Polish visual | Konsistensi warna, tipografi, empty state | 2 j |
| P2-4 | Materi demo | Rekaman 7 menit, cover image, skrip 90 detik | 2 j |

---

## 5. Definisi Lulus per Tingkat

**P0 lulus jika:**

- [ ] `npm test` hijau, termasuk TC-001â€“TC-013.
- [ ] Tidak ada jalur dari LLM ke executor.
- [ ] Tool ops menolak token agent dan tercatat di audit.
- [ ] Data sensitif tidak pernah keluar dari store dalam bentuk penuh.

**P1 lulus jika:**

- [ ] Alur demo 7 menit berjalan tanpa intervensi manual di terminal.
- [ ] Setiap tombol di dashboard berfungsi.
- [ ] Batalkan eksekusi benar-benar mencegah pengiriman.

**P2 lulus jika:** tidak merusak P0/P1.

---

## 6. Yang Dipotong Dulu Jika Waktu Habis

Urutan pemotongan, dari yang pertama dikorbankan:

1. P2-2 Decision Replay
2. P2-1 Precedent engine
3. P1-4 Audit Center (bisa diganti tampilan log mentah)
4. P2-3 Polish visual

**Tidak boleh dipotong:** P0-4, P0-5, P0-7. Ketiganya adalah klaim inti produk.

---

## 7. Aturan Kerja Harian

1. Satu lane aktif pada satu waktu sampai P0 selesai. Dua lane hanya setelah P0-7.
2. Sebelum mulai modul: tulis test-nya dulu, lalu implementasi.
3. Maksimum 2 putaran perbaikan per modul; putaran ketiga dieskalasi ke manusia.
4. Setiap modul selesai = commit + update kolom Status di tabel ini.
5. Kolom Status hanya boleh diubah setelah test disebut namanya dan lulus.
