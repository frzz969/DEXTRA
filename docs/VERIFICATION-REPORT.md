# DEXTRA - Verification Report

**Versi:** 1.0.0-rekonstruksi
**Tanggal:** 2 November 2026
**Cakupan:** Fase D - Security Remediation & Runtime Verification
**Sumber requirement:** `docs/PRD.md` (§20 test matrix, §33 Threat Model, §34 API & MCP Contract), `docs/DEVELOPMENT-GOVERNANCE.md`, `docs/PRIORITY-PLAN.md`, instruksi Fase D dari pemilik produk

---

## 0. Status dokumen ini

**Dokumen ini bukan dokumen asli yang ditemukan di repository.**

Saat Fase D dimulai, `docs/VERIFICATION-REPORT.md` tidak ada di working tree maupun di riwayat Git (`git log --all -- docs/VERIFICATION-REPORT.md` mengembalikan kosong). Dokumen ini disusun dari nol atas persetujuan pemilik produk, memakai dua sumber yang dipisahkan tegas di bawah:

1. **Fakta terverifikasi** - hal yang diperiksa langsung pada kode, status Git, dan output perintah.
2. **Belum diuji** - hal yang belum punya bukti eksekusi.

Tidak ada klaim keamanan di dokumen ini yang tidak disertai perintah dan hasil eksekusi. Klaim yang hanya berdasar pembacaan kode ditandai sebagai "dibaca, belum diuji runtime".

---

## 1. Metode dan environment

| Item | Nilai |
| --- | --- |
| Repository | `dextra` |
| Branch saat Fase D dimulai | `master` |
| Commit checkpoint | `b52125d` - `chore(checkpoint): simpan perubahan kerja sebelum fase D security remediation` |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| OS | Windows (shell PowerShell 5.1) |
| Perintah test utama | `npm run test:inproc` |
| Perintah typecheck | `npm run typecheck` |

**Batasan environment yang harus diketahui pembaca:** `npm test` gagal di mesin ini sebelum menyentuh kode apa pun, karena Node test runner mencoba membuat subprocess per file test dan sandbox proses memblokirnya (`spawn EPERM`). Karena itu ditambahkan script `test:inproc` yang menjalankan test yang sama secara in-process (`--experimental-test-isolation=none`). Script `npm test` **tidak diubah**, dan isi test juga tidak diubah untuk keperluan ini.

Konsekuensi yang jujur: hasil `test:inproc` membuktikan test lulus dalam satu proses Node, bukan bahwa `npm test` lulus di mesin tanpa sandbox. Keduanya dilaporkan terpisah.

---

## 2. Baseline sebelum remediation (commit `b52125d`)

Diukur pada working tree bersih di commit checkpoint, sebelum D-01 dikerjakan.

| Pemeriksaan | Perintah | Hasil aktual |
| --- | --- | --- |
| Test suite (in-process) | `node --test --experimental-strip-types --experimental-test-isolation=none "packages/*/tests/*.test.ts" "apps/*/tests/*.test.ts"` | 101 pass, 0 fail, 0 skip, 12 suite, 3,5 detik |
| Test suite (script repo) | `npm test` | Gagal: `spawn EPERM` pada node test runner (batasan sandbox, bukan kegagalan assertion) |
| Typecheck | `npm run typecheck` | **Gagal**. 7 workspace lolos; `@dextra/store` gagal dengan 6 error TS2322 di `tests/store.test.ts` (baris 123, 139, 157, 168, 169, 230) karena nilai `string` biasa diberi tipe branded `ExecutionId`/`EventId` |

**Error typecheck di atas adalah kegagalan baseline yang sudah ada.** Atas keputusan pemilik produk, error tersebut tidak diperbaiki pada fase security remediation ini dan tidak boleh diklaim sudah beres.

---

## 3. Temuan keamanan yang diverifikasi pada kode

Semua baris di bawah dibaca langsung pada commit `b52125d`. Status "diperbaiki" hanya diberikan bila ada test yang lulus pada bagian terkait.

### D-01 - CORS permisif dan tidak ada validasi origin/host

| Aspek | Isi |
| --- | --- |
| Lokasi | `apps/mcp-server/src/server.ts` |
| Bukti pada checkpoint | Handler mengirim `Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, OPTIONS`, `Allow-Headers`, lalu membalas `204` untuk semua `OPTIONS`; tidak ada pemeriksaan `Origin` maupun `Host` |
| Dampak | Halaman web mana pun yang dibuka di browser yang sama dapat mengirim POST JSON-RPC ke loopback dan membaca responsnya. Binding `127.0.0.1` tidak mencegah ini. |
| Status | **Diperbaiki pada Fase D, dibuktikan test** (lihat §4) |

### D-02 - Token agent dicetak ke console

| Aspek | Isi |
| --- | --- |
| Lokasi | `apps/mcp-server/src/server.ts` (callback `listen`), `apps/mcp-server/src/auth.ts` |
| Bukti pada checkpoint | `console.log("agent token: " + agentToken())` dijalankan setiap startup; `logUnauthorized` menyimpan 6 karakter pertama token ke audit (`token_hint`) |
| Status | **Belum diperbaiki** |

### D-03 - Kredensial ops permanen di browser

| Aspek | Isi |
| --- | --- |
| Lokasi | `apps/dashboard/app.js` |
| Bukti pada checkpoint | `const TOKEN = "ops-dev-token"` di bundel browser; token itu membuka 12 tool termasuk `execute_action`, `submit_approval`, `revoke_mandate` |
| Status | **Belum diperbaiki.** Arah yang disetujui: approval challenge sekali pakai + kode konfirmasi lewat terminal server |

### D-04 - Approval token tidak ditegakkan

| Aspek | Isi |
| --- | --- |
| Lokasi | `apps/dashboard/app.js`, `apps/mcp-server/src/handlers.ts` |
| Bukti pada checkpoint | Dashboard mengirim `approval_token: "apt_demo"` dan `approver_id: "user_001"` sebagai teks; `submit_approval` tidak memeriksa token, tidak menegakkan expiry/sekali-pakai, dan memakai `approver_id` dari argumen |
| Status | **Belum diperbaiki** |

### D-05 - Recipient scope tidak ditegakkan

| Aspek | Isi |
| --- | --- |
| Lokasi | `packages/policy-engine/src/rules.ts` |
| Bukti pada checkpoint | `checkRecipientScope()` selalu mengembalikan `null`; `target.contact_id` tidak pernah dicocokkan ke data kontak |
| Catatan skema | `Org` tidak memuat data departemen atau daftar penerima yang diizinkan, dan `Plan` tidak menyimpan departemen pemohon. Validasi lintas departemen **tidak dapat dibuktikan dengan skema saat ini** |
| Status | **Belum diperbaiki.** Arah yang disetujui: tegakkan hanya yang dapat dibuktikan (kontak ada, unik, tidak dipilih otomatis), dokumentasikan gap lintas departemen |

---

## 4. D-01 - Bukti perbaikan

**Commit:** lihat §7.
**File yang berubah:** `apps/mcp-server/src/server.ts` (dimodifikasi), `apps/mcp-server/src/origin-policy.ts` (baru), `apps/mcp-server/tests/origin-policy.test.ts` (baru), `package.json` (script `test:inproc`).

Yang dilakukan:

1. Wildcard `Access-Control-Allow-Origin: *` dihapus. CORS sekarang hanya diberikan dengan **echo origin persis** dari allowlist, ditambah `Vary: Origin`, `Allow-Methods`, `Allow-Headers`, `Max-Age`, dan tanpa `Allow-Credentials`.
2. `Host` diverifikasi lebih dulu: hanya `127.0.0.1`, `localhost`, atau `[::1]` dengan port yang benar-benar di-bind. Ini kontrol DNS rebinding, karena browser mengirim hostname penyerang di header `Host` meski koneksi sampai ke loopback.
3. `Origin` diverifikasi dengan pencocokan persis (bukan prefiks/sufiks). Origin `null` (file:// atau iframe sandbox) selalu ditolak. Daftar default: `http://127.0.0.1:3000` dan `http://localhost:3000` (dashboard, PRD §35.2) serta origin port server sendiri; dapat dipersempit lewat `DEXTRA_ALLOWED_ORIGINS`.
4. Preflight `OPTIONS` hanya dilayani untuk origin tepercaya (`204` + header terbatas); origin tidak tepercaya mendapat `403` tanpa header CORS; `OPTIONS` tanpa `Origin` ditolak `400`.
5. Binding tetap `127.0.0.1`, dan `startServer()` sekarang menerima `port`/`allowedOrigins` opsional agar perilaku ini dapat diuji tanpa memakai port tetap.

Hasil eksekusi (`node --test --experimental-strip-types --experimental-test-isolation=none "apps/mcp-server/tests/*.test.ts"`):

```
tests 25
pass 25
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 546.8094
```

Test D-01 yang benar-benar dijalankan (nama test):

| # | Nama test | Yang dibuktikan |
| --- | --- | --- |
| 1 | `allows the documented dashboard loopback origin` | Origin dashboard diizinkan, CORS diberikan |
| 2 | `rejects an external origin and returns no CORS grant` | Origin eksternal ditolak, tanpa header CORS |
| 3 | `allows a request without Origin as a non-browser caller, without CORS` | Tanpa Origin tetap jalan, tanpa CORS |
| 4 | `rejects suspicious origins: opaque, suffix attack, wrong scheme, wrong port` | `null`, `127.0.0.1:3000.evil.example`, skema salah, port salah ditolak |
| 5 | `rejects a preflight that carries no Origin` | `OPTIONS` tanpa Origin ditolak |
| 6 | `rejects a DNS-rebinding Host header even without Origin` | Host penyerang ditolak |
| 7 | `rejects a loopback Host whose port is not the bound port` | Host loopback dengan port salah ditolak |
| 8 | `accepts loopback Host forms: 127.0.0.1, localhost, [::1]` | Bentuk host sah tetap diterima |
| 9 | `origin allowlist never contains a wildcard or the opaque null origin` | Tidak ada wildcard di allowlist |
| 10 | `DEXTRA_ALLOWED_ORIGINS narrows the allowlist instead of widening it` | Env hanya mempersempit |
| 11 | `normalizeOrigin strips trailing slashes and lowercases` | Normalisasi origin |
| 12 | `parseHostHeader handles IPv6 and malformed values` | Parsing host |
| 13 | `binds to loopback only` | Alamat bind `127.0.0.1` |
| 14 | `allowed dashboard origin receives an exact CORS grant on /health` | CORS persis, bukan `*` |
| 15 | `external origin is refused with 403 and no CORS headers` | 403 tanpa CORS |
| 16 | `request without Origin still works and gets no CORS grant` | Non-browser tetap berfungsi |
| 17 | `OPTIONS preflight from the allowed origin answers 204 with scoped headers` | Preflight sah |
| 18 | `OPTIONS preflight from an untrusted origin is refused` | Preflight asing ditolak |
| 19 | `DNS-rebinding Host header is refused before any tool runs` | Host asing ditolak di HTTP layer |
| 20 | `non-browser JSON-RPC client without Origin still completes initialize` | Klien MCP tanpa Origin tetap bisa `initialize` |

Seluruh suite setelah D-01:

| Perintah | Hasil |
| --- | --- |
| `npm run test:inproc` | 121 pass, 0 fail, 0 skip, 14 suite, 4,0 detik |
| `npx tsc --noEmit` di `apps/mcp-server` | lolos (exit 0) |
| `npm run typecheck` (root) | gagal pada `@dextra/store` - kegagalan baseline §2, tidak diperbaiki |

---

## 5. Yang belum diuji / belum dibuktikan

1. **Koneksi dashboard nyata belum diuji end-to-end.** Test membuktikan origin yang diizinkan diterima pada `/health` dan `initialize`. Belum ada test yang menjalankan dashboard sungguhan terhadap server. Kalau dashboard dibuka lewat `file://` (origin `null`), semua request akan ditolak - sesuai desain, tetapi alur penyajian dashboard (PRD §35.2: `http://127.0.0.1:3000`) belum dipraktekkan pada fase ini.
2. **E2E 8 langkah belum dijalankan** (agent baca, buat plan, validasi, tampil di dashboard, approval, mandat, eksekusi mock, audit).
3. **D-02, D-03, D-04, D-05 belum dikerjakan.** Jadi token agent masih dicetak, kredensial ops masih ada di browser, approval token masih tidak ditegakkan, dan recipient scope masih tidak divalidasi.
4. **Test negatif untuk token ops dari origin tepercaya** belum ada; D-01 hanya menutup jalur cross-origin, bukan penyalahgunaan kredensial yang sudah ada di browser (itu D-03).
5. **`npm test` di lingkungan non-sandbox** belum pernah dijalankan pada fase ini.

---

## 6. Pernyataan jujur tentang tingkat keamanan

Setelah D-01, server **tidak lagi** memberikan grant CORS kepada origin mana pun yang tidak ada di allowlist, dan menolak request dengan `Host` non-loopback. Itu yang dibuktikan test di §4.

Yang **belum** benar dan tidak boleh diklaim:

- Dashboard masih memegang kredensial ops permanen (D-03).
- Approval token masih dapat dipalsukan dari browser (D-04).
- Recipient scope belum ditegakkan (D-05).
- Token agent masih tercetak di console (D-02).
- Klaim README saat ini ("dashboard tidak menyimpan token ops", "endpoint approval/eksekusi dilindungi origin/CSRF") belum seluruhnya benar dan akan diperbarui pada Tahap 4 dokumentasi.

---

## 7. Riwayat commit Fase D

| Commit | Isi |
| --- | --- |
| `b52125d` | Checkpoint sebelum Fase D (dua perubahan kerja yang sudah ada) |
| `6d4dd41` | D-01: origin allowlist + Host check + test (`fix(mcp-server): ganti CORS wildcard dengan allowlist origin dan cek host (D-01)`) |
| (commit dokumen ini) | Laporan verifikasi rekonstruksi + bukti D-01 |