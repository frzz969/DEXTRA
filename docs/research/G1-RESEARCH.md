# Riset G1 — 2026-11-01

> Catatan rujukan (3 November 2026): nomor bagian PRD di dokumen ini mengacu pada PRD v1.4.0
> (§12.6, §34.3). PRD sudah diganti dengan v2.0.0 yang memakai penomoran berbeda, sehingga
> §-nya tidak lagi bisa dicari langsung. Dokumen ini dibiarkan apa adanya sebagai catatan riset
> pada tanggal tersebut, bukan diperbarui ke penomoran baru.

## Ringkasan

- **Klaim "tool eksekusi tidak terlihat LLM" tidak ditegakkan oleh MCP.** Tidak ada identitas pemanggil terautentikasi; `tools/list` hanya kosmetik. Harus di-enforce di server. Dampak: satu test tambahan menyelamatkan klaim demo.
- **`plan_hash` pakai JCS penuh (`canonicalize`, 24 KB, nol dependensi).** Jebakannya `NaN`/`undefined`/lone surrogate yang berubah senyap, bukan angka. Dampak: hash deterministik dan tidak bisa "diam-diam cocok".
- **`(mandate_id, action_id)` cukup sebagai kunci dedup; `execution_key` berbahaya bila jadi dasar dedup.** Retry setelah timeout wajib mengembalikan hasil terminal. Dampak: TC-008 lulus tanpa duplikasi.
- **`ToolAnnotations` default aman tapi hanya hint.** Set eksplisit + snapshot test `tools/list`. Dampak: murah, menutup pertanyaan juri.
- **Tidak ada detektor prompt injection Indonesia yang terverifikasi.** Prompt Guard 2 tidak dievaluasi untuk Indonesia. Dampak: jangan klaim akurasi.

## Temuan

### F1 — "Tool eksekusi tidak terlihat LLM" bukan batas keamanan MCP; tegakkan di server

- **Sumber:** https://modelcontextprotocol.io/specification/2026-07-28/server/tools · https://modelcontextprotocol.io/specification/2026-07-28/architecture · https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices · https://github.com/modelcontextprotocol/specification/blob/main/schema/2026-07-28/schema.ts
- **Terverifikasi (spesifikasi terbaru: 2026-07-28):**
  - Protokol stateless; tiap request membawa `_meta` (`protocolVersion`, `clientInfo`, `clientCapabilities`) — semuanya **diklaim klien**, bukan autentikasi.
  - `tools/call` hanya berisi `name` + `arguments`. Tidak ada field/header yang membedakan panggilan dari host vs model.
  - `tools/list` **"MUST NOT vary per-connection"**, tetapi **"MAY vary by the authorization presented on the request"** (kutipan). Variasi per peran sah hanya lewat kredensial berbeda.
  - Spesifikasi utama: *"While MCP itself cannot enforce these security principles at the protocol level, implementors SHOULD..."* (kutipan).
  - Security best practices: *"MCP servers that implement authorization MUST verify all inbound requests"*; *"MUST NOT treat possession of a state handle as authentication"* (kutipan).
  - `ToolAnnotations` adalah **hint**: klien tidak boleh mengambil keputusan berdasarkan anotasi dari server tak tepercaya.
- **Dampak:** §34.2 benar sebagai tujuan, salah sebagai kontrol. Model yang ter-inject tetap bisa menyebut `execute_action`; yang menentukan hanya apakah server menolak.
- **Rekomendasi (≤ 2 jam, pilih satu):**
  1. **Dua port/proses:** server "agent-facing" (baca + prepare) dan server "ops" (executor/dashboard) dengan bearer token acak yang hanya dibaca proses executor, tidak pernah masuk `workbuddy/mcp.json`. Server ops tidak pernah didaftarkan ke WorkBuddy.
  2. Atau satu server, dua token scope (`agent:*`, `ops:execute`), `tools/list` difilter per otorisasi — sah menurut spesifikasi.
  3. Di server ops, tolak `tools/call` di luar allowlist per token, dan catat `unauthorized_tool_attempt` ke audit. Jangan pakai `clientInfo` sebagai dasar izin (self-asserted); hanya untuk log.
- **Kalau diabaikan:** TC-003/TC-007 bisa lulus di demo tapi gagal di test 90 detik — satu prompt berisi nama tool cukup membuktikan klaim inti salah.

### F2 — `plan_hash`: JCS penuh; jebakannya `NaN`/`undefined`, bukan angka

- **Sumber:** https://www.rfc-editor.org/rfc/rfc8785.html · https://www.npmjs.com/package/canonicalize · https://registry.npmjs.org/canonicalize/latest
- **Terverifikasi:**
  - JCS = I-JSON + serialisasi primitif ECMAScript + sort properti rekursif per UTF-16 code unit, output UTF-8.
  - Di Node, `JSON.stringify` sudah memakai serialisasi number/string yang sama dan `Object.keys().sort()` membandingkan UTF-16. Untuk objek JSON-safe murni, sorted-keys + `JSON.stringify` **byte-identik** dengan JCS.
  - Divergensi hanya di luar I-JSON, dan **gagal senyap** (diuji langsung di Node): `NaN`/`Infinity` → `null`; properti `undefined` → dihapus; `-0` → `0`; `Date` → string ISO; `BigInt` → throw.
  - Lone surrogate: RFC mewajibkan error — *"occurrences of such data MUST cause a compliant JCS implementation to terminate with an appropriate error"* (kutipan). `JSON.stringify` tidak error; ia mengeluarkan `"\ud800"`.
  - `canonicalize` v5.1.0: Apache-2.0, **nol dependensi**, 24.474 byte unpacked, TypeScript types, mengklaim RFC 8785 dan membandingkan diri terhadap test vector RFC + 10.000 vektor number ES6.
- **Dampak:** hash dari objek in-memory vs objek hasil `JSON.parse` dari disk bisa berbeda. Validator menolak rencana sah (false BLOCKED), atau dua rencana berbeda menghasilkan hash sama karena `NaN` dan `null` sama-sama jadi `null`.
- **Rekomendasi (1–2 jam):**
  1. Hash **selalu** dari string hasil kanonikalisasi, bukan dari objek.
  2. Guard ~20 baris: tolak `INVALID_PLAN` bila ada `NaN`/`Infinity`/`undefined`/`BigInt`/`Date`/lone surrogate sebelum hashing. Ini menutup semua divergensi yang tersisa.
  3. Simpan string kanonik di record plan; verifikasi = kanonikalisasi ulang + bandingkan string.
  4. Jangan pakai `localeCompare`/`Intl.Collator` untuk sort kunci.
- **Kalau diabaikan:** TC-006 bisa lolos tak sengaja; hash tidak stabil antara proses seed dan runtime.

### F3 — Idempotency: dedup pada `(mandate_id, action_id)`; `execution_key` hanya untuk korelasi

- **Sumber:** https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/ · https://stripe.com/blog/idempotency
- **Terverifikasi:**
  - Draft IETF: key dibuat **klien**, unik, *"MUST NOT be reused with another request with a different request payload"*; server memakai **fingerprint** payload; retry setelah selesai → respons konsisten; retry saat request pertama **masih berjalan** → **409 Conflict**, bukan sukses.
  - Stripe: key menutup tiga mode gagal (koneksi gagal, gagal di tengah, sukses tapi respons hilang); pada kasus ketiga server membalas **hasil ter-cache**.
  - Keduanya menyarankan lookup key komposit dengan atribut yang hanya diketahui server.
- **Dampak:** PRD tidak konsisten — §12.6 menyebut key = mandat+tindakan, §34.3 sudah menerima `execution_key`. Bila `execution_key` jadi dasar dedup, klien yang retry dengan key baru (proses restart) menggandakan aksi. `(mandate_id, action_id)` sudah unik secara alami.
- **Rekomendasi (< 1 jam):**
  1. Kunci dedup kanonik = `(mandate_id, action_id)`, disimpan sebagai primary key eksekusi.
  2. `execution_key` hanya **attempt id** untuk audit/korelasi; bukan kunci dedup.
  3. Tulis record `queued` **sebelum** efek samping mock, atomik. Retry saat `queued` → `DUPLICATE_EXECUTION` dengan `result:"queued"`, **bukan** `sent`. Hanya hasil terminal (`sent`/`failed`/`blocked`) yang di-replay.
  4. Tambah satu kode error `EXECUTION_IN_PROGRESS` agar "belum selesai" tidak pernah dilaporkan sukses (bertentangan dengan §12.4).
- **Kalau diabaikan:** TC-008 lulus hanya karena tak ada yang menekan dua kali bersamaan; retry setelah timeout bisa mengirim dua email.

### F4 — `ToolAnnotations`: default aman, wajib eksplisit dan diuji

- **Sumber:** https://github.com/modelcontextprotocol/specification/blob/main/schema/2026-07-28/schema.ts
- **Terverifikasi:** `readOnlyHint` default **false**, `destructiveHint` default **true**, `idempotentHint` default **false**, `openWorldHint` default **true**. Klien wajib menganggap anotasi tidak tepercaya kecuali dari server tepercaya.
- **Dampak:** default sudah konservatif; nilai tambahnya adalah sinyal ke host dan konsistensi dokumen, bukan keamanan baru.
- **Rekomendasi (< 1 jam):** set eksplisit — `get_*`/`find_precedent`: `readOnlyHint:true`; `create_plan`/`validate_plan`: `destructiveHint:false, idempotentHint:true, openWorldHint:false`; tool tulis lain: `destructiveHint:true`. Tambah assertion bahwa `tools/list` server agent tidak memuat `execute_action`, `issue_mandate`, `submit_approval`.
- **Kalau diabaikan:** bukan celah; hanya kehilangan bukti bahwa permukaan tool sudah dipikirkan.

### F5 — Deteksi prompt injection Indonesia: tidak ada yang terverifikasi

- **Sumber:** https://huggingface.co/meta-llama/Llama-Prompt-Guard-2-86M · https://genai.owasp.org/llmrisk/llm01-prompt-injection/ · https://arxiv.org/abs/2503.18813
- **Terverifikasi:**
  - Prompt Guard 2 dievaluasi untuk Inggris, Prancis, Jerman, Hindi, Italia, Portugis, Spanyol, Thai — **Indonesia tidak termasuk**. Model 86M butuh Python/Transformers; 22M lebih lemah multibahasa.
  - OWASP LLM01: *"it is unclear if there are fool-proof methods of prevention"*; mitigasi yang disarankan: batasi perilaku, validasi output dengan kode deterministik, privilege control, human approval, **segregasi penanda konten eksternal**.
  - CaMeL memisahkan control flow dari data dan memakai *capability* saat tool dipanggil (77% task dengan keamanan terbukti). Ini memperkuat arsitektur mandat, bukan menggantikannya.
- **Dampak:** §14 sudah benar secara prinsip; yang bisa ditambah adalah bukti terukur, bukan model.
- **Rekomendasi (1–2 jam):** skorer deterministik < 100 baris — normalisasi Unicode/zero-width; pola imperatif ("kirim", "teruskan", "hapus", "transfer", "abaikan instruksi", "jangan beri tahu", "segera", "ke semua"); sapaan ke agen ("AI", "asisten", "bot") atau nama tool; kombinasi menaikkan skor. Ambang tinggi → `quarantined_instruction`, sedang → `needs_review`. Ukur presisi pada 10 dokumen demo dan laporkan angkanya; sebut "heuristik", bukan "deteksi akurat".
- **Kalau diabaikan:** TC-002 tetap lulus dengan satu contoh hardcoded, tapi tak ada bukti generalisasi — persis yang diuji test 90 detik.

## Tunda (bagus tapi mahal)

- **OAuth 2.1 + Resource Indicators / audience binding** untuk server ops: benar secara teori, berlebihan untuk localhost 6 hari.
- **Prompt Guard 2 lokal** (86M, Python sidecar): service tambahan, ~92 ms/klasifikasi di A100, tidak tervalidasi untuk Indonesia.
- **Hash chain audit log** (T-09): bagus untuk narasi, belum ada test yang menuntutnya.
- **Elicitation sebagai kanal persetujuan:** jangan — melewati host LLM (zona tak tepercaya), bukan bukti persetujuan.

## Tidak terverifikasi

- Perilaku WorkBuddy saat model menyebut nama tool yang tidak ada di `tools/list` (host mengirim `tools/call` atau menolak di klien). Tidak ada dokumentasi publik yang saya buka — **uji manual 10 menit**, hasilnya menentukan apakah lapis 2 F1 terpakai.
- Presisi/recall heuristik Indonesia F5: belum diukur.
- Apakah `canonicalize` lolos seluruh vektor number ES6 di versi Node tim: klaim vendor, belum saya jalankan.
- Dukungan Bahasa Indonesia Prompt Guard 2: tidak dievaluasi menurut model card; bukan berarti nol, tapi tidak boleh diklaim.

## Yang saya sarankan JANGAN diubah

- **Mandat sebagai capability** dan pemisahan "AI menyusun, manusia mengesahkan". CaMeL menunjukkan arah ini benar; jangan ganti dengan guardrail berbasis prompt.
- **Validator deterministik** sebagai satu-satunya gerbang eksekusi; jangan tambah "AI second opinion" di jalur keputusan.
- **Dua pemeriksaan `allowed_action_ids` + `allowed_action_types`** (T-12) — inilah yang menutup confused deputy.
- **Fail closed** (NFR-R1): validasi tidak tersedia → tolak. Jangan tambah fallback "lanjut dengan peringatan".
- **Kode error eksplisit** (§34.4): jangan gabungkan `DUPLICATE_EXECUTION` dengan sukses; pisahkan status in-flight (F3).
