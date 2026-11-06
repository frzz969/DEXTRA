# Desain — Telegram Alert

Status: **diimplementasikan 2026-11-03** (`packages/alerts`, tool `list_alerts`).
Bagian 1–8 di bawah adalah kontrak yang disetujui sebelum kode ditulis; §11
mencatat apa yang berubah saat implementasi dan alasannya.

## 1. Apa ini, dan apa yang bukan

**Ini:** kanal keluar. DEXTRA memberi tahu manusia bahwa sesuatu terjadi.

**Bukan:** kanal masuk yang memberi wewenang. Pesan Telegram tidak pernah menjadi
bukti otorisasi. `approve` dari chat tetap hanya membuka dashboard; mandat tetap
diterbitkan backend setelah principal terikat token dan `plan_hash` cocok.

Alasan aturan ini bukan formalitas: `fc1ba3e` mengikat mandate ke
`owner_principal_id` yang ditandatangani HMAC, dan principal diturunkan server dari
token. **User ID Telegram bukan principal.** Membiarkan chat menyetujui akan
membatalkan resource scope — cukup satu akun Telegram dibajak.

Adapter yang ada sekarang sudah benar: `/approve` hanya membuka tautan dashboard.

## 2. Kontrak

```ts
type AlertKind =
  | 'execution_failed'      // satu eksekusi gagal
  | 'repeated_failure'      // ≥3 kegagalan untuk action_type sama dalam 1 jam
  | 'mandate_expiring'      // < 24 jam sebelum expires_at
  | 'mandate_expired'       // sudah lewat expires_at, status masih active
  | 'approval_pending'      // menunggu > X jam
  | 'security_rejection';   // mandate_rejected / action_blocked
  | 'conversation_work_request'; // percakapan → permintaan kerja baru

interface Alert {
  alert_id: string;          // alrt_<hash8(kind + subject + bucket)>
  kind: AlertKind;
  severity: 'info' | 'warning' | 'critical';
  subject: {
    plan_id?: string;
    mandate_id?: string;
    execution_id?: string;
    action_id?: string;
  };
  dedupe_key: string;        // sha256(kind + subject ids + time bucket)
  created_at: string;        // ISO
  payload: Record<string, string>;  // isi pesan, sudah diredaksi
}

interface AlertAttempt {
  alert_id: string;
  attempt: number;           // 1..max
  at: string;
  status: 'accepted_by_provider' | 'retryable_failure' | 'permanent_failure';
  provider_status?: number;  // HTTP code
  error?: string;            // tanpa token, tanpa chat id
}
```

## 3. Status pengiriman — dan satu kata yang dilarang

| Status | Arti |
|---|---|
| `queued` | alert dibuat, belum dicoba |
| `dispatching` | percobaan sedang berjalan |
| `accepted_by_provider` | Telegram menjawab `ok:true` untuk `sendMessage` |
| `failed` | percobaan terakhir gagal permanen atau batas retry habis |
| `suppressed_duplicate` | `dedupe_key` sudah terkirim dalam jendela dedup |

**`delivered` tidak dipakai.** Telegram Bot API tidak memberi bukti pesan dibaca
atau diterima manusia. `ok:true` berarti "diterima server Telegram". Menulis
`delivered` berarti mengklaim sesuatu yang tidak bisa dibuktikan — persis pola yang
sudah kita hapus di `dispatch_rate` dan `success_rate`.

## 4. Retry

- Maksimum 5 percobaan.
- Backoff eksponensial: 2s, 8s, 30s, 120s, 600s (±20% jitter).
- Retry hanya untuk: timeout, koneksi gagal, HTTP 5xx, HTTP 429.
- HTTP 429 menghormati `retry_after` dari respons.
- **Tidak** retry untuk: 400 (payload salah), 401/403 (token salah), 404 (chat
  tidak ada). Mengulang permintaan yang pasti gagal hanya menambah kebisingan dan
  bisa memicu rate limit.
- Setelah batas habis: `failed`, dan itu tercatat.

## 5. Deduplikasi

- `dedupe_key = sha256(kind + plan_id + mandate_id + action_id + bucket)`.
- `bucket` = waktu dibulatkan ke 15 menit.
- Disimpan di `data/alerts.json` (status + key + at), dibaca sebelum kirim.
- Tujuan: satu kegagalan yang sama tidak menghasilkan 40 pesan saat retry berjalan.

Dedup berbasis waktu, bukan selamanya: kegagalan yang berulang **harus** memberi
tahu lagi setelah jendela lewat, kalau tidak, masalah yang berulang jadi senyap.

## 6. Audit — dan satu kontrak yang harus diubah

Setiap percobaan harus tercatat. Tetapi `AuditEventTypeSchema` adalah enum
tertutup dan tidak punya tipe untuk ini.

**Yang dibutuhkan:** dua nilai baru, `alert_dispatched` dan `alert_failed`.
Itu perubahan kontrak di `packages/contracts/src/audit.ts` — berkas yang saya
pegang, tetapi enum-nya juga dibaca dashboard dan tes. Perubahan ini harus
dinyatakan, bukan diselipkan.

Alternatif yang saya tolak: memakai `type: 'action_executed'` dengan detail
`kind: 'alert'`. Itu membuat audit trail tidak bisa dibedakan antara "AI
mengeksekusi tindakan" dan "sistem mengirim notifikasi" — dua hal yang berbeda
dalam audit.

## 7. Rahasia

- `TELEGRAM_BOT_TOKEN` hanya dibaca adapter dari `process.env`.
- Tidak pernah masuk `data/`, tidak pernah dikirim ke dashboard, tidak pernah
  ditulis ke log (termasuk pada error).
- Pesan error di-redaksi: token dan chat id diganti `[redacted]`.
- Tanpa token: adapter berjalan dengan `FakeTransport`, dan **setiap** alert
  ditandai `provider: 'fake'`. Alert palsu tidak boleh terlihat seperti terkirim.

## 8. Bisa diuji tanpa kredensial

Transport adalah antarmuka, bukan panggilan `fetch` langsung:

```ts
interface AlertTransport {
  send(chatId: string, text: string): Promise<{ ok: boolean; status?: number; retry_after?: number; error?: string }>;
}
```

Tes memakai transport palsu yang bisa disuruh gagal dengan pola tertentu.
Matriks tes:

| Kasus | Harapan |
|---|---|
| kirim sukses | `accepted_by_provider`, 1 percobaan |
| 500 lalu 200 | sukses pada percobaan 2 |
| 429 dengan `retry_after: 3` | menunggu 3s, bukan backoff default |
| 401 | `permanent_failure`, **tidak** retry |
| timeout 3× lalu sukses | sukses pada percobaan 4 |
| gagal 5× | `failed`, tidak ada percobaan ke-6 |
| alert sama 2× dalam 15 menit | yang kedua `suppressed_duplicate` |
| alert sama setelah 15 menit | dikirim lagi |
| tanpa token | `provider: 'fake'`, tidak ada klaim terkirim |

## 9. Berkas yang akan diubah

| Berkas | Perubahan |
|---|---|
| `packages/contracts/src/alert.ts` (baru) | `Alert`, `AlertAttempt`, `AlertKind`, status |
| `packages/contracts/src/audit.ts` | + `alert_dispatched`, `alert_failed` |
| `packages/alerts/src/transport.ts` (baru) | `AlertTransport`, `FakeTransport`, `TelegramTransport` |
| `packages/alerts/src/policy.ts` (baru) | retry, backoff, dedup — fungsi murni |
| `packages/alerts/src/dispatch.ts` (baru) | orkestrasi + tulis audit |
| `apps/telegram-adapter/src/alerts.ts` (baru) | pemasangan ke adapter yang ada |
| `apps/mcp-server/src/handlers.ts` | `list_alerts` (opsional, read-only) |

## 10. Kriteria selesai

- Semua baris matriks tes §8 lulus.
- Tidak ada jalur di mana pesan masuk Telegram mengubah status plan/mandat.
- Setiap percobaan menghasilkan tepat satu event audit.
- Tanpa token, sistem tetap berjalan dan menyatakan `provider: 'fake'`.

## 11. Yang berubah saat implementasi, dan alasannya

Empat penyimpangan dari desain di atas. Semuanya dicatat di sini karena
menyimpang tanpa mengatakannya persis kebiasaan yang dokumen ini ada untuk
mencegah.

**1. `suppressed_duplicate` bukan status tersimpan, melainkan hasil pemanggilan.**
Desain menaruhnya di daftar status pengiriman. Kalau diterapkan harfiah, alert
yang sudah diterima provider lalu dikirim lagi akan berubah statusnya menjadi
`suppressed_duplicate` — artinya catatan itu menyatakan "tidak pernah terkirim"
sementara manusia sedang melihat pesannya di Telegram. Sekarang:

- `AlertDeliveryStatus` (tersimpan): `queued | dispatching | accepted_by_provider | failed`
- `DispatchOutcomeStatus` (hasil satu pemanggilan): status di atas + `suppressed_duplicate`
- penahanan dihitung di `suppressed_count`, sehingga tetap terlihat di ringkasan.

**2. `alert_id` memakai 16 heksadesimal, bukan 8.** Id ini adalah kunci primer
sebuah record; tabrakan berarti dua insiden berbeda menyatu menjadi satu
pengiriman. 32 bit terlalu sempit untuk itu, dan biaya menambah 8 karakter nol.

**3. `data/alerts.json` adalah array record, bukan log append-only.** Pengiriman
punya siklus hidup (diklaim, dicoba, diulang, selesai). Dengan log append-only,
setiap pembaca harus memutar ulang seluruh berkas untuk tahu keadaan sekarang,
dan pemeriksaan dedupe harus memindai semuanya. Riwayat per percobaan tetap ada
— di audit log, tempat riwayat seharusnya berada.

**4. Ada modul yang tidak ada di desain: `detect.ts`.** Desain menetapkan cara
mengirim, bukan cara memutuskan apa yang layak dikirim. Tanpa itu paket ini
adalah pustaka tanpa pemanggil — kontrak tanpa produsen. `detectAlerts()`
murni: masukannya record yang sudah ada, keluarannya alert, tanpa jam, jaringan,
atau server. Enam jenis alert di §2 semuanya punya aturan nyata di sana.

### Tambahan yang muncul dari pengujian

- **Penyatuan di dalam satu batch.** Tiga eksekusi gagal untuk action yang sama
  dalam satu bucket menghasilkan tiga alert dengan `alert_id` identik, karena
  kunci dedupe sengaja tidak memuat `execution_id`. Tanpa penyatuan,
  `detected` melaporkan 3 untuk satu hal yang akan terkirim sekali.
- **Pengambilalihan `dispatching` yang basi.** Proses yang mati di tengah
  pengiriman meninggalkan status `dispatching` selamanya, dan alert itu tidak
  akan pernah dikirim maupun dilaporkan gagal. Record berstatus `dispatching`
  yang lebih tua dari 5 menit dianggap ditinggalkan — pola yang sama dengan
  deteksi lock basi di audit.
- **`retry_after` menang atas jadwal kita**, termasuk bila lebih pendek.

### Yang belum ada

- **Belum ada pengiriman nyata.** Tanpa `TELEGRAM_BOT_TOKEN`, transport palsu
  dipakai dan setiap record ditandai `provider: 'fake'`. Tidak ada satu pesan
  pun yang keluar dari proses ini. Itu keadaan yang benar untuk saat ini, dan
  dashboard harus menampilkannya apa adanya.
- **Belum ada loop di adapter.** `npm run alerts:scan` menjalankan satu
  pemindaian. `--loop <detik>` sudah ada, tetapi belum dijalankan sebagai
  layanan, dan adapter Telegram belum memanggilnya.
- **Pesan masuk Telegram tidak berubah.** Tidak ada jalur baru dari chat ke
  plan atau mandate; `/approve` tetap hanya membuka dashboard.
