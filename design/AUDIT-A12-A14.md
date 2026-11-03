# Audit A12–A14 — bukti, bukan pendapat

Dijalankan 2026-11-03 terhadap `87e469b`, `7d7f0c3`, `21e5fa7`.
Semua angka di bawah berasal dari eksekusi nyata, bukan perkiraan.

## 1. Ringkasan verdict

| Klaim di commit | Status | Bukti |
|---|---|---|
| `dispatch_rate` tidak mengklaim penyelesaian tugas | **benar** | `mockSendEmail` hanya mengembalikan `msg_<hash>`; tidak ada I/O jaringan |
| `latency.scope = adapter_call` akurat | **benar** | pengukuran dibungkus di sekitar pemanggilan adapter saja |
| `cost_source` tercatat | **benar**, tetapi belum ada penghasil | adapter mock mengisi `null` |
| Rantai hash mendeteksi penyuntingan | **benar** | uji tamper: `broken_at` menunjuk event pertama yang gagal |
| Rantai hash mendeteksi penghapusan | **SEBAGIAN** | hapus tengah: terdeteksi. Hapus ekor: **tidak terdeteksi** |
| Lock mencegah penulisan bersamaan | **SALAH untuk antar-proses** | dua proses → rantai bercabang, `ok=false` |
| Baris rusak ditangani dengan jelas | **SALAH** | `StoreFileError` → seluruh audit tidak terbaca |
| Security Center bukan real-time dan menyatakannya | **benar** | E2E memeriksa kalimatnya ada |

## 2. Empat cacat, dengan reproduksi

### C1 — Lock hanya berlaku dalam satu proses (paling serius)

`withFileLock` adalah antrean promise pada `Map` di memori (`json-file.ts:39`).
Dua proses Node yang menulis audit bersamaan sama-sama membaca pendahulu yang
sama, lalu sama-sama menambahkan hash yang menunjuk ke pendahulu itu.

Reproduksi: dua proses, masing-masing 25 event.

```
total=50  verified=2  broken_at=evt_a_1  ok=false
```

Tidak ada yang menyentuh berkas. Yang terjadi adalah **penulisan sah** yang
dilaporkan sebagai pemalsuan. Dampaknya lebih buruk daripada tidak punya rantai:
alarm palsu membuat alarm diabaikan.

Pemicu nyata di repo ini: server MCP, `apps/telegram-adapter`, proses seed, dan
skrip uji semuanya dapat menulis audit. Selama dua di antaranya hidup bersamaan,
risiko ini aktif.

### C2 — Penghapusan event terakhir tidak terdeteksi

```
hapus ekor   → ok=true  verified=5  broken=null
```

Rantai hanya membuktikan "setiap event menunjuk pendahulunya". Tidak ada yang
membuktikan "ini event terakhir". Tanpa penanda di luar berkas, ekor bisa
dipotong tanpa jejak.

### C3 — Berkas dikosongkan terbaca "sehat"

```
kosongkan semua → ok=true  verified=0  unchained=0
```

`ok=true` dengan nol event adalah verdict paling berbahaya di seluruh sistem:
tampak seperti "tidak ada masalah", padahal artinya "tidak ada yang diperiksa".

### C4 — Baris setengah jadi membuat audit tidak terbaca

`readJsonLines` melempar `StoreFileError` pada satu baris rusak
(`json-file.ts:118-125`). Satu penulisan yang terpotong — crash, listrik mati,
disk penuh — membuat `get_audit_log` gagal total, sehingga `/audit` dan
`/security` ikut mati. Kegagalan ketersediaan, bukan kegagalan deteksi.

```
baris terpotong → PARSE_GAGAL(SyntaxError)
```

## 3. Matriks ancaman rantai hash

| Kemampuan penyerang | Terdeteksi? | Catatan |
|---|---|---|
| Menyunting isi satu event | ya | `broken_at` menunjuk event itu |
| Menyisipkan event palsu | ya | `prev_hash` tidak cocok |
| Menukar urutan dua event | ya | idem |
| Menghapus event di tengah | ya | idem |
| **Menghapus event terakhir** | **tidak** | tidak ada checkpoint |
| **Mengosongkan berkas** | **tidak** | terbaca `ok=true` |
| **Menulis ulang seluruh berkas + semua hash** | **tidak** | verifier lokal tidak punya pembanding |
| Menulis bersamaan dari proses lain | **ya, tapi salah** | dilaporkan sebagai pemalsuan (C1) |

Baris 5–7 adalah batas yang jujur dari hash chain lokal. Menyebutnya "tamper-proof"
akan salah; yang benar: **tamper-evident terhadap perubahan lokal, selama berkas
pembanding dipercaya**.

## 4. Yang dibutuhkan untuk menutup C2, C3, dan penulisan ulang total

Tiga hal, berurutan menurut rasio manfaat/biaya:

1. **Checkpoint berkala di berkas terpisah** (`data/audit.checkpoint.json`):
   `{ event_count, head_hash, at }`, ditulis setiap N event atau T menit.
   Verifier membandingkan `head_hash` dan `event_count`. Menutup C2 dan C3.
   Tidak menutup penulisan ulang total bila penyerang juga menulis checkpoint.
2. **Ekspor keluar** (append-only ke tujuan lain: berkas terpisah di mesin lain,
   atau object storage). Menutup penulisan ulang total **hanya jika** penyerang
   tidak punya akses ke tujuan itu.
3. **Pemisahan hak tulis**: proses eksekusi menulis lewat satu komponen yang
   memegang berkas; proses lain hanya membaca. Ini masalah konfigurasi OS, bukan
   kode, dan tidak bisa dibuktikan di repo ini.

**Keputusan:** butir 1 layak dikerjakan sekarang (kecil, menutup dua cacat yang
terbukti). Butir 2 dan 3 memerlukan keputusan infrastruktur yang belum ada —
jangan dikerjakan sebelum target penyimpanannya ditentukan.

## 5. Perbaikan yang saya usulkan, berurutan

| # | Perbaikan | Menutup | Ukuran |
|---|---|---|---|
| P1 | Lock antar-proses (lockfile `wx` + retry + deteksi stale) | C1 | kecil |
| P2 | Checkpoint `{event_count, head_hash}` + verifier membandingkannya | C2, C3 | kecil |
| P3 | Baris rusak: berhenti di baris itu, laporkan `malformed_at`, jangan lempar seluruh berkas | C4 | kecil |
| P4 | Ekspor audit ke tujuan terpisah | penulisan ulang total | perlu keputusan infra |

P1–P3 tidak menambah konsep baru; ketiganya memperbaiki perilaku yang sudah
dijanjikan commit sebelumnya.

## 6. Catatan tentang `unchained`

Event lama tanpa hash dilaporkan `unchained` dan tidak dihitung `verified`. Itu
benar dan harus dipertahankan.

Kebijakan migrasi yang diusulkan: **jangan** memberi hash historis pada event
lama. Memberi hash surut berarti membuat bukti yang tidak pernah ada pada saat
event terjadi. Checkpoint pertama hanya boleh dibuat setelah jumlah `unchained`
didokumentasikan, sehingga batas kepercayaan jelas: sebelum titik itu, audit
adalah catatan, bukan bukti.
