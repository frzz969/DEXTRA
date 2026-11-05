# @dextra/office-agent

Modul Office Agent DEXTRA — skenario **Meeting to Action**: notulen rapat menjadi
keputusan, action items, plan yang dapat diperiksa, lalu persetujuan manusia.

Paket ini berhenti pada **plan**. Ia tidak menyetujui, tidak menerbitkan mandate,
dan tidak mengeksekusi. Persetujuan memakai `submit_approval`, eksekusi memakai
`execute_action` dengan mandate — keduanya sudah ada sebelum paket ini.

## Alur

```
intake → normalisasi dokumen → dekomposisi → klarifikasi → office policy
      → plan (Plan Engine) → validator independen → simpan → audit
```

Dua urutan yang tidak boleh dibalik:

1. plan disimpan **setelah** validator menyatakan lulus;
2. event `plan_created` ditulis **setelah** insert berhasil.

## Berkas

| Berkas | Isi |
|---|---|
| `intake.ts` | Validasi permintaan, batas ukuran, antarmuka transkrip suara |
| `document.ts` | Blok + `block_id` + SHA-256 sumber, penandaan teks menyerupai instruksi |
| `decompose.ts` | Ekstraksi deterministik: keputusan, action, penerima, waktu, penerima ambigu |
| `clarify.ts` | Pertanyaan, jawaban terikat principal, validasi ulang |
| `resolve.ts` | Pencocokan penerima; dua kandidat berarti bertanya, bukan memilih |
| `policy.ts` | Di atas Policy Engine: zona waktu, `end_at`, masa lalu, konflik kalender, alternatif |
| `build.ts` | Penyusunan plan lewat Plan Engine + penggabungan temuan |
| `validator.ts` | Validator read-only: provenance, konsistensi, kesetiaan, integritas hash |
| `run.ts` | Orkestrasi vertical slice |
| `state.ts` | Sesi klarifikasi (`office-sessions.json`) — bukan audit |
| `audit.ts` | Penulisan ke audit chain DEXTRA yang sama |
| `integration.ts` | Handler siap-daftar + peta tool dashboard → backend |

## Menjalankan satu permintaan

```bash
node --experimental-strip-types packages/office-agent/src/cli.ts \
  --principal usr_nadia --request-id req_demo1 \
  --request "Tindak lanjuti notulen rapat" \
  --doc data/documents/notulen-rapat.md \
  --assume-time 09:00 --duration 60
```

Keluaran memuat status (`needs_clarification` / `plan_ready` / `blocked`), plan,
temuan, hasil validator, dan id event audit. `--json` untuk bentuk mentah.

## Batas yang diketahui

- **Dekomposisi deterministik.** Pola kata kerja Indonesia terbatas; kalimat yang
  tidak cocok masuk `unresolved` alih-alih ditebak. Antarmuka `Decomposer`
  disiapkan untuk pengganti berbasis model tanpa mengubah batas governance.
- **Penandaan instruksi bukan deteksi injeksi.** Ia menaikkan kecurigaan dan
  mencegah blok tersebut menjadi action. Pertahanan sebenarnya adalah
  arsitektur: tidak ada model yang membaca dokumen sebagai instruksi, dan
  planner tidak punya akses adapter.
- **Belum terdaftar di MCP.** `office_agent_run` belum ada di
  `contracts/authorization.ts`, `server.ts`, `handlers.ts`, maupun
  `registry.py` — keempatnya sedang disentuh pekerjaan P4. Lihat
  `INTEGRATION_STEPS` dan `FRONTEND_TOOL_MAP`.
- **Kontrak audit belum punya `clarification_requested`.** Saat ini dilaporkan
  sebagai `plan_blocked` dengan `detail.stage`.
- **Belum ada autentikasi manusia (P8).** Principal diambil dari adapter
  server-side, bukan dari sesi login.

## Menjalankan tes

```bash
node --test --experimental-strip-types "packages/office-agent/tests/*.test.ts"
```
