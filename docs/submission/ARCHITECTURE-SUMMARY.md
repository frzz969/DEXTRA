# DEXTRA — Architecture Summary

Dokumen ini menyatakan **apa yang berjalan hari ini**, bukan alur yang dirancang.
Versi sebelumnya menulis "Instruction → Dispatcher → Specialists → Unified Work
Package → Adversarial Reviewer → Policy Validator" seolah semuanya berjalan.
Tidak ada Dispatcher, tidak ada Specialist, dan tidak ada Adversarial Reviewer
di jalur eksekusi. Yang ada: satu penyusun rencana deterministik, satu validator
kebijakan deterministik, satu executor mock.

## Komponen yang benar-benar berjalan

| Komponen | Peran | Nyata / mock |
|---|---|---|
| Dashboard SPA (`apps/dashboard`, 25 rute) | Permukaan manusia: menyusun permintaan, meninjau rencana, menyetujui, melihat audit | Nyata |
| MCP server (`apps/mcp-server`, 19 tool, 127.0.0.1:8765) | Satu-satunya pintu ke data dan aksi; menegakkan token → capability → tool | Nyata |
| `packages/plan` | Menyusun objek Plan + `plan_hash` kanonik | Nyata, deterministik |
| `packages/policy-engine` | Aturan: jam kerja, zona waktu, Salat Jumat, hari libur, bulk egress, injection | Nyata, deterministik |
| `packages/mandate-engine` | Menerbitkan/memvalidasi/mencabut mandat (HMAC, TTL, single-use) | Nyata |
| `packages/executor` | Menjalankan aksi setelah memvalidasi mandat | **Mock** (tidak ada email/kalender nyata) |
| `packages/store` | JSON + audit rantai hash + checkpoint + lock antar-proses | Nyata |
| `packages/audit-export` | Ekspor audit + verifier independen | Nyata |
| `packages/alerts` | Deteksi, retry, dedup notifikasi | Nyata, transport **palsu** (`provider: 'fake'`) |
| `backend/dextra` (FastAPI) | Referensi v2: 9 router, skema PostgreSQL, belum jadi jalur produksi | Referensi |

**Tidak ada LLM di jalur produksi.** Permintaan dari bahasa alami diurai oleh
aturan di `apps/dashboard/assets/js/copilot.js` (`compose()`), bukan oleh model.
Karena itu "agentic" di sini berarti *rangkaian langkah dengan keputusan di
setiap batas*, bukan penalaran model.

## Alur nyata, satu permintaan

```
1. Manusia menulis permintaan di /assistant
2. compose() memanggil find_precedent  -> ambigu? berhenti dan bertanya
3. compose() memanggil create_plan     -> server menyusun + memvalidasi
                                          (policy-engine menandai konflik)
4. Plan tersimpan; event `plan_created` ditulis SETELAH insert berhasil
5. Manusia meninjau /work-packages/:id -> penerima, waktu, isi, plan_hash
6. submit_approval (token ops)         -> approval terikat plan_hash
7. issue_mandate                       -> mandat HMAC, TTL 15 menit, single-use
8. execute_action                      -> executor memvalidasi mandat lagi
9. action_executed + alert (bila perlu) -> audit
```

Langkah 2–3 berjalan di peramban + server. Langkah 6–9 hanya bisa dipanggil
token `ops`; token `agent` tidak pernah melihat tool-nya di `tools/list`.

## Batas kepercayaan

| Batas | Di mana | Apa yang dijaga |
|---|---|---|
| Peramban ↔ MCP server | `Origin`/`Host` allowlist, tanpa CORS permisif, kontrol DNS-rebinding | Peramban lain tidak bisa memanggil server lokal |
| Token ↔ capability | `packages/contracts/src/authorization.ts` | Satu sumber kebenaran; allowlist diturunkan, bukan ditulis tangan |
| Agen ↔ eksekusi | `issue_mandate` + `execute_action` | Tidak ada jalur dari penyusun rencana ke executor |
| Rencana ↔ persetujuan | `plan_hash` di approval dan mandate | Rencana yang berubah tidak bisa dieksekusi dengan mandat lama |
| Konten ↔ instruksi | `content.body` tidak pernah dieksekusi | Instruksi tertanam di dokumen tidak menjadi perintah |
| Data ↔ tampilan | Masking di `packages/store`, bukan di UI | Endpoint tidak mengembalikan alamat lengkap |
| Audit ↔ pembaca | Rantai hash + checkpoint + verifier terpisah | Penghapusan/pengubahan terdeteksi, dan batasnya dinyatakan |

## Trade-off yang dipilih sadar

1. **JSON file, bukan database.** Cepat dibangun dan cukup untuk satu instalasi,
   tetapi lock antar-proses harus dibuat sendiri (`open(path,'wx')`) dan baca
   audit O(n). Solusi jangka panjangnya transaksi + outbox, belum dikerjakan.
2. **Deterministik, bukan LLM.** Policy engine bisa diuji dan dijelaskan; LLM
   tidak. Harga: permintaan bahasa alami hanya dikenali pola yang sudah dikenal.
3. **Satu token per scope, bukan identitas per pengguna.** Principal terikat di
   server, tetapi belum ada expiry/revocation. Dinyatakan, bukan disembunyikan.
4. **Mock executor.** Handbook membolehkan mock. Yang penting bukan pengirimannya,
   melainkan bahwa tidak ada jalur yang bisa mengirim tanpa mandat.
5. **Verifier audit terpisah.** Tiga salinan aturan hash, dijaga tes paritas.
   Duplikasi disengaja: verifier yang berbagi logika dengan penulis tidak
   memverifikasi apa pun.
