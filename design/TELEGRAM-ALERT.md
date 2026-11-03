# Desain — Telegram Alert

Status: **desain, belum diimplementasikan.**
Tujuan dokumen ini: menetapkan kontrak dan batas sebelum satu baris kode ditulis.

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
