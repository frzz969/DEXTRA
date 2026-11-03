# Desain — Data Explorer

Status: **diimplementasikan 2026-11-03** (`/explorer`, `q`/`offset` pada empat
tool baca). §1–8 adalah kontrak yang disetujui sebelum kode ditulis; §9 mencatat
apa yang berubah saat implementasi dan alasannya.
Disusun dari struktur data aktual di repo, bukan dari asumsi.

## 1. Entitas yang benar-benar ada

| Entitas | Berkas | Kunci | Field yang ada |
|---|---|---|---|
| Plan | `data/plans.json` | `plan_id` | `org_id`, `request_id`, `created_at`, `status`, `intent`, `actions[]`, `findings[]`, `plan_hash`, `contract_version`, `requester_id?`, `assignee_id?` |
| Approval | `data/approvals.json` | `approval_id` | `plan_id`, `plan_hash`, `decision`, `approver_id`, `approval_token`, `issued_at`, `expires_at`, `status` |
| Mandate | `data/mandates.json` | `mandate_id` | `plan_id`, `plan_hash`, `approval_id`, `issued_at`, `expires_at`, `nonce`, `allowed_action_ids[]`, `allowed_action_types[]`, `max_risk`, `status`, `issued_by`, `owner_principal_id?`, `signature` |
| Execution | `data/executions.json` | `(mandate_id, action_id)` | `execution_id`, `execution_key`, `result`, `reason_code`, `executed_at`, `evidence`, `usage?` |
| Audit | `data/audit.jsonl` | `event_id` | `at`, `type`, `actor`, `plan_id?`, `mandate_id?`, `action_id?`, `plan_hash?`, `reason_code?`, `detail`, `prev_hash?`, `hash?` |
| Worker | `workbuddy/agents/*.md` | nama berkas | `id`, `name`, `role`, `limits[]`, `tools[]` |

## 2. Relasi — mana yang nyata, mana yang tidak

```
Plan ──1:n──> Approval        (Approval.plan_id)
Plan ──1:n──> Mandate         (Mandate.plan_id)
Plan ──1:n──> PlanAction      (actions[].action_id, di dalam dokumen)
Mandate ──1:n──> Execution    (Execution.mandate_id)
Execution ──1:1──> PlanAction (Execution.action_id = actions[].action_id)
Audit ──n:1──> Plan/Mandate/Action   (tiga field opsional)
Plan.assignee_id ──?──> Worker        (string bebas, TIDAK dijamin cocok)
```

**Yang nyata dan bisa di-join sekarang:** Plan↔Approval, Plan↔Mandate,
Mandate↔Execution, Execution↔PlanAction, Audit→(Plan|Mandate|Action).

**Yang TIDAK dijamin:** `Plan.assignee_id` adalah string bebas. Roster worker
dibaca dari nama berkas di `workbuddy/agents/`. Tidak ada foreign key, tidak ada
validasi. Jadi join ke worker harus diperlakukan sebagai *usulan*, bukan fakta:
bila id tidak ada di roster, UI menulis **"tidak ada di roster"** — bukan
mengosongkan diam-diam dan bukan mengarang nama.

**Yang tidak ada sama sekali:** durasi tugas, biaya per worker, beban kerja,
status worker. Empat hal ini sering diminta di dashboard dan tidak bisa dijawab
dari data di atas. Explorer tidak boleh menampilkannya.

## 3. Batasan arsitektur yang menentukan desain

Satu tool baru berarti satu entri di `packages/contracts/src/authorization.ts` —
berkas milik stream B. Aturan kita: jangan memperluas allowlist tanpa kebutuhan
dan evaluasi keamanan.

**Karena itu: tidak ada tool baru.** Sebagai gantinya, empat tool baca yang sudah
diizinkan diperluas dengan parameter yang aditif:

| Tool | Parameter baru | Efek |
|---|---|---|
| `list_plans` | `q`, `offset` | cari di `intent`/`plan_id`, halaman berikutnya |
| `list_mandates` | `offset` | halaman berikutnya |
| `list_executions` | `offset` | halaman berikutnya |
| `get_audit_log` | `q`, `before` | cari, halaman sebelumnya |

Semua parameter opsional: pemanggil lama tidak berubah perilakunya. Tidak ada
perubahan bentuk respons yang memutus dashboard yang ada.

**Yang ini tidak memberi:** peringkat relevansi lintas entitas, atau satu query
yang menggabungkan semua. Explorer akan menjalankan hingga 5 query paralel dengan
`q` yang sama, lalu menampilkan hasil **per entitas**, bukan sebagai satu daftar
campuran. Menggabungkannya menjadi satu daftar berperingkat akan mengarang
relevansi yang tidak dihitung siapa pun.

## 4. Pagination — kenapa harus di server

Sekarang dashboard memuat `list_plans {limit:200}` dan `list_executions
{limit:200}` sekaligus saat boot. Itu cukup untuk dashboard, tidak cukup untuk
Explorer: mencari di antara 200 baris pertama bukan pencarian, itu tebakan.

Explorer memakai pagination berbasis `offset` + `limit` (maks 100), dengan
`total` dari server sebagai dasar "halaman X dari Y". Tanpa cursor, karena
penyimpanannya array JSON — cursor akan menyiratkan konsistensi snapshot yang
tidak dimiliki berkas ini.

Batas jujur yang harus ditulis di UI: **"hasil diambil per entitas, bukan satu
pencarian gabungan"**.

## 5. Struktur halaman

```
/explorer
├── Search bar + pemilih entitas (Plan | Approval | Mandate | Execution | Audit | Worker)
├── Panel filter (status, rentang waktu, aktor) — hanya filter yang ada di data
├── Tabel hasil (server-side, 25/halaman)
└── Detail record (drawer)
    ├── field apa adanya
    ├── Relasi: plan → approval → mandate → execution (masing-masing dengan tautan)
    └── Bila relasi tidak ada: "tidak ada mandat untuk plan ini", bukan sel kosong
```

Aturan tampilan:

1. Field yang `null`/`undefined` ditampilkan `—`, bukan `0` atau teks karangan.
2. `evidence` ditampilkan sebagai bukti mentah (`mock_message_id`), dengan label
   bahwa adapter tiruan tidak mengirim apa pun.
3. `usage` yang `null` ditampilkan **"tidak diukur"**, konsisten dengan `/analytics`.
4. Relasi yang tidak ditemukan dinyatakan, tidak disembunyikan.
5. Tidak ada tombol "export semua" yang memuat seluruh berkas ke browser.

## 6. Risiko yang sudah teridentifikasi

| Risiko | Mitigasi |
|---|---|
| `q` diterapkan setelah `limit` → hasil menyesatkan | filter di server sebelum `slice`, dan `total` mencerminkan hasil filter |
| `assignee_id` dianggap foreign key | join bersifat usulan; UI menyatakan bila tidak cocok |
| Pencarian menyentuh `detail` audit yang berisi data sensitif | `detail` sudah melewati `assertNoSensitiveDetail`; Explorer tidak membuka field kontak mentah |
| Explorer jadi jalan pintas membaca seluruh DB | `limit` maksimum 100 ditegakkan server, bukan di klien |

## 7. Berkas yang akan diubah

| Berkas | Perubahan |
|---|---|
| `apps/mcp-server/src/handlers.ts` | `q`/`offset` pada empat case baca |
| `apps/mcp-server/src/server.ts` | schema input untuk parameter baru |
| `apps/dashboard/assets/js/views/explorer.js` (baru) | halaman |
| `apps/dashboard/assets/js/{shell,core,sources}.js` | rute, pemuatan, inventaris |
| `apps/dashboard/index.html` | skrip |
| `apps/mcp-server/tests/explorer-query.test.ts` (baru) | filter-sebelum-limit, offset, batas limit |
| `apps/dashboard/tests/e2e/run.mjs` | rute + assertion |

## 8. Kriteria selesai

- Filter diterapkan sebelum pagination; dibuktikan tes dengan data > limit.
- `total` konsisten dengan jumlah hasil filter, bukan jumlah baris halaman.
- Detail record menampilkan relasi yang ada dan menyatakan yang tidak ada.
- Tidak ada satu pun nilai yang ditampilkan tanpa asal di data.
- E2E: halaman memuat data nyata setelah rantai create→approve→execute.

## 9. Yang berubah saat implementasi, dan alasannya

**1. `q` diberikan ke keempat tool, bukan hanya `list_plans` dan `get_audit_log`.**
Tabel di §3 hanya memberi `q` ke dua tool, tetapi §4 menyatakan Explorer
"menjalankan hingga 5 query paralel dengan `q` yang sama". Keduanya tidak bisa
benar bersamaan: kalau mandate dan execution tidak menerima `q`, tab-nya akan
menampilkan seluruh isi sementara tab lain tersaring — dan pengguna membaca itu
sebagai "tidak ada mandat yang cocok". Parameter ini aditif dan opsional, jadi
pemanggil lama tidak berubah.

**2. `before` diganti `offset` pada `get_audit_log`.** Satu mekanisme untuk
keempat entitas lebih mudah diuji dan tidak menyiratkan apa pun tentang
konsistensi snapshot — keberatan yang sudah ditulis di §4. `offset` dihitung
dari ekor, karena log ditampilkan terbaru-dulu.

**3. Batas halaman 500, bukan 100.** Dashboard yang sudah ada meminta 200 untuk
daftar dan 500 untuk audit log. Batas 100 akan memotong data yang hari ini
terlihat — regresi yang tidak diminta siapa pun. Explorer meminta 25, jadi batas
ini tidak pernah mendekat. Batas yang jujur: ini mencegah satu permintaan tak
terbatas, bukan mencegah klien berwenang mengambil 500 baris berulang kali.

**4. Approval dan Worker tidak ada di Explorer.** Tidak ada `list_approvals`,
dan `list_specialists` membaca berkas roster tanpa pencarian. Menampilkan
keduanya berarti menyaring snapshot dashboard lalu menyebutnya "pencarian" —
hasilnya bergantung pada berapa baris yang kebetulan sudah dimuat. Alasan itu
ditulis di halaman, bukan disembunyikan. Jejak approval tetap bisa dilihat lewat
detail plan: event `approval_*` dan `mandate_*` di audit log, dengan label bahwa
itu jejak, bukan record approval.

**5. Pencarian audit mencakup kunci `detail`, bukan hanya nilainya.** "Cari
semua event yang punya field `reason`" adalah pertanyaan wajar, dan kuncinya
sudah dijamin bebas data sensitif oleh `assertNoSensitiveDetail` saat ditulis.

**6. `total` dan `scanned` adalah dua angka berbeda.** `total` = jumlah hasil
filter; `scanned` = ukuran seluruh log yang dibaca untuk verdict integritas.
Menyatukannya akan membuat "total" berubah arti tergantung ada tidaknya kata
kunci.

### Temuan selama implementasi

`create_plan` **tidak menulis event audit apa pun**. `plan_created` ada di
`AuditEventTypeSchema` tetapi belum ada yang menghasilkannya — kontrak tanpa
produsen. Tidak diperbaiki di sini karena di luar lingkup Explorer dan akan
mengubah isi audit log yang dilihat halaman lain; dicatat supaya tidak hilang.

### Bukti

- `apps/mcp-server/tests/explorer-query.test.ts` (13 tes): total vs panjang
  halaman, offset tanpa tumpang tindih, pencarian menemukan baris yang TIDAK ada
  di halaman pertama, pencarian tidak peka huruf besar-kecil, batas limit
  ditegakkan server, offset melewati akhir data, audit dipaginasi dari ekor, dan
  integritas tetap dihitung atas seluruh log meski halaman berisi 2 event.
- Kontrol negatif: mematikan `q` di server membuat 4 tes gagal, termasuk
  "pencarian menemukan baris yang tidak ada di halaman pertama".
- E2E: `/explorer` memuat plan hasil rantai create→approve→execute, `total` dari
  server, dan kata kunci tanpa hasil menghasilkan keadaan kosong — bukan halaman
  penuh berisi baris yang tidak relevan.
