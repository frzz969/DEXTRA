import Link from "next/link";
import "./about.css";

export const metadata = {
  title: "Tentang DEXTRA",
  description:
    "DEXTRA adalah Governed Enterprise AI Workforce & Operations Platform. Identitas, prinsip, arsitektur lapisan, batas wewenang, dan modul yang benar-benar ada di dalamnya."
};

/* Empat baris identitas. Isinya fakta yang sama dengan yang tertulis di
 * README dan di kode, bukan ringkasan pemasaran: yang terakhir menyatakan
 * instans ini lokal, karena itu yang akan ditemui pembaca saat mencoba. */
const IDENTITAS = [
  {
    label: "Nama",
    value: "DEXTRA, Governed Enterprise AI Workforce & Operations Platform."
  },
  {
    label: "Tagline",
    value: "Specialized AI workers. Human-defined authority. Accountable execution."
  },
  {
    label: "Prinsip operasi",
    value: "Baca boleh otomatis, tulis harus lewat mandat."
  },
  {
    label: "Instans ini",
    value: "Berjalan lokal untuk demonstrasi. Bukan deployment produksi."
  }
];

/* Tiga hal yang tidak diberikan oleh lapisan di bawah DEXTRA. Sudut pandangnya
 * berbeda dari bagian masalah di beranda: beranda menjelaskan kenapa agen
 * berbahaya, bagian ini menjelaskan apa yang tidak disediakan oleh model,
 * orkestrasi, dan log. */
const LAPISAN_HILANG = [
  {
    title: "Model memberi kemampuan, bukan wewenang",
    body: "Model bahasa bisa menyusun rencana pengiriman, mengubah status tiket, atau menyiapkan dokumen. Yang tidak dibawanya adalah jawaban atas siapa yang mengizinkan, untuk target mana, dan sampai kapan. Kemampuan tanpa jawaban itu tetap kemampuan, bukan izin."
  },
  {
    title: "Orkestrasi mengatur urutan, bukan izin",
    body: "Alat orkestrasi menyusun langkah dan menjalankannya berurutan. Urutan yang benar tidak sama dengan izin yang sah: rangkaian langkah bisa rapi seluruhnya, dan tetap tidak punya dasar untuk menyentuh sistem milik orang lain."
  },
  {
    title: "Log mencatat kejadian, bukan dasar keputusan",
    body: "Log aplikasi menjawab apa yang terjadi dan kapan. Saat ditanya mengapa sebuah tindakan diizinkan, log biasanya diam, karena izin tidak pernah dicatat sebagai objek tersendiri yang bisa diperiksa."
  }
];

/* Konsekuensi arsitektural dari prinsip. Bukan ulangan definisi Permission,
 * Policy, Mandate, dan Audit yang ada di beranda, melainkan bentuk yang
 * diambil sistem karena prinsip itu. */
const KONSEKUENSI = [
  {
    title: "Tidak ada jalur dari agen ke executor",
    body: "Executor hanya menerima perintah yang punya mandat terikat plan_hash dan sudah melewati persetujuan manusia. Tidak ada panggilan langsung dari rencana ke eksekusi."
  },
  {
    title: "Rencana dan izin adalah dua objek berbeda",
    body: "Rencana menyatakan apa yang akan dilakukan. Mandat menyatakan siapa yang mengizinkan dan sejauh mana. Yang satu tidak pernah otomatis menjadi yang lain."
  },
  {
    title: "Setiap izin punya cakupan dan masa berlaku",
    body: "Mandat menyebut tindakan, target, dan batas waktunya, lalu berhenti berlaku setelah dipakai. Cakupan yang sempit membuat satu izin tidak bisa dipakai ulang untuk pekerjaan lain."
  },
  {
    title: "Koreksi adalah event baru",
    body: "Riwayat tidak ditulis ulang. Kalau ada yang keliru, yang bertambah adalah catatan koreksi, bukan perubahan pada catatan lama. Karena itu urutan kejadian tetap bisa dibaca apa adanya."
  }
];

const DILAKUKAN = [
  "Menyusun rencana yang eksplisit: penerima, isi, jadwal, dan risiko tertulis sebelum apa pun berjalan.",
  "Memeriksa rencana terhadap policy aktif dan menampilkan setiap temuan, termasuk temuan yang memblokir.",
  "Menerbitkan mandat sempit yang terikat plan_hash, sekali pakai, dan bisa dicabut sebelum dieksekusi.",
  "Menahan eksekusi sampai ada keputusan manusia: setujui, tolak, atau minta revisi.",
  "Menonaktifkan tombol setujui saat rencana terblokir, dengan alasan tertulis di sebelah tombol itu.",
  "Mencatat setiap langkah dengan rantai hash, tanpa jalur ubah atau hapus di antarmuka maupun di API.",
  "Membatasi setiap permintaan API ke tenant pemanggil."
];

const TIDAK_DILAKUKAN = [
  "Tidak mengirim apa pun tanpa mandat dan persetujuan manusia.",
  "Tidak memberi token kemampuan melebihi pemilik token itu.",
  "Tidak menyediakan tombol edit atau hapus di jejak audit.",
  "Tidak menampilkan integrasi yang belum terpasang sebagai tersedia.",
  "Tidak menampilkan angka pemakaian, uptime, atau jumlah pelanggan yang tidak punya sumber. Angka di Analytics dihitung dari data instans ini, bukan dari klaim pemasaran.",
  "Tidak dipakai sebagai deployment produksi. Instans ini berjalan lokal untuk demonstrasi."
];

/* Enam lapisan, disusun mengikuti arah data: permintaan masuk lewat antarmuka,
 * melewati API, diperiksa kebijakan, diberi mandat, dijalankan executor, lalu
 * tercatat. Urutan ini sama dengan urutan pemeriksaan di backend, jadi
 * membacanya dari atas ke bawah tidak menyesatkan. */
const LAPISAN = [
  {
    name: "Antarmuka",
    body: "Aplikasi web Next.js 16 dan React 19 di apps/web. Seluruh halaman yang Anda buka dirender dari sini. Tidak ada penulisan data langsung dari browser ke basis data."
  },
  {
    name: "API",
    body: "FastAPI di backend/dextra. Setiap permintaan membawa identitas pemanggil beserta tenant-nya, lalu diperiksa capability sebelum menyentuh data."
  },
  {
    name: "Mesin kebijakan",
    body: "Mengevaluasi rencana terhadap policy aktif: jenis tindakan, target, jadwal, dan isi. Temuan blocking membuat rencana tidak bisa disetujui, dan alasannya ditampilkan tertulis."
  },
  {
    name: "Mesin mandat",
    body: "Menerbitkan izin untuk satu rencana, terikat plan_hash, dengan cakupan dan masa berlaku. Mandat bisa dicabut sebelum dieksekusi, dan berhenti berlaku setelah dipakai."
  },
  {
    name: "Executor",
    body: "Menjalankan tindakan sesuai cakupan mandat, tidak lebih luas dari itu. Untuk email dan kalender, hasilnya berkas lokal di data/outbox, bukan pengiriman ke server eksternal."
  },
  {
    name: "Jejak audit",
    body: "Menulis event berurutan dengan rantai hash. Tidak ada endpoint untuk mengubah atau menghapus entri, dan tidak ada tombol untuk itu di antarmuka."
  }
];

const WEWENANG = [
  {
    term: "Isolasi tenant",
    body: "Setiap permintaan API dibatasi ke tenant pemanggil. Catatan menyimpan tenant_id, dan query di repositori dibatasi ke tenant itu, sehingga data satu tenant tidak ikut terbaca dari tenant lain."
  },
  {
    term: "Capability principal",
    body: "Peran Anda di dalam tenant menentukan capability yang Anda miliki: jenis tindakan apa yang boleh diajukan sama sekali, sebelum ada rencana."
  },
  {
    term: "Capability token",
    body: "Token API tidak pernah memberi lebih dari pemiliknya. Capability efektif sebuah token adalah irisan scope token dengan capability principal yang memakainya, jadi token dengan scope luas tetap berhenti di batas pemilik."
  },
  {
    term: "Pencabutan dan kedaluwarsa",
    body: "Diperiksa setiap kali token dipakai, bukan hanya saat diterbitkan. Tidak ada cache yang membuat token yang sudah dicabut tetap hidup."
  }
];

/* Daftar modul yang benar-benar ada sebagai rute di app/(app). Dikelompokkan
 * menurut pekerjaan yang ditopangnya, bukan menurut urutan menu. Beranda sudah
 * menjelaskan sepuluh modul inti; peta ini menyebut sisanya supaya tidak ada
 * halaman yang hanya bisa ditemukan lewat coba-coba. */
const MODUL = [
  {
    group: "Operasional harian",
    items: [
      { href: "/overview", name: "Overview" },
      { href: "/assistant", name: "AI Assistant" },
      { href: "/office-agent", name: "Office Agent" },
      { href: "/requests", name: "Requests" },
      { href: "/work-packages", name: "Work Packages" },
      { href: "/board", name: "Task Board" },
      { href: "/executions", name: "Executions" }
    ]
  },
  {
    group: "Wewenang dan keputusan",
    items: [
      { href: "/approvals", name: "Approval Inbox" },
      { href: "/review", name: "Review & Validation" },
      { href: "/mandates", name: "Mandates" },
      { href: "/policies", name: "Policies" },
      { href: "/workflows", name: "Workflow Orchestration" }
    ]
  },
  {
    group: "Catatan dan bukti",
    items: [
      { href: "/audit", name: "Audit Trail" },
      { href: "/analytics", name: "Analytics" },
      { href: "/monitoring", name: "Monitoring" },
      { href: "/explorer", name: "Data Explorer" }
    ]
  },
  {
    group: "Identitas dan akses",
    items: [
      { href: "/access", name: "Access Management" },
      { href: "/tokens", name: "API Tokens" },
      { href: "/service-identities", name: "Service Identity" },
      { href: "/security", name: "Security Center" },
      { href: "/agents", name: "Workforce" }
    ]
  },
  {
    group: "Sistem dan integrasi",
    items: [
      { href: "/skills", name: "Skill Registry" },
      { href: "/integrations", name: "Integrations" },
      { href: "/data-management", name: "Data Management" },
      { href: "/settings", name: "Settings" }
    ]
  }
];

const FAQ = [
  {
    q: "Apakah ini bisa dipakai di produksi?",
    a: "Belum. Instans ini berjalan lokal untuk demonstrasi: satu mesin, SQLite sebagai basis data, dan autentikasi yang disimpan sendiri. Yang sudah terbukti di sini adalah alurnya, bukan ketahanan operasionalnya. Untuk produksi masih perlu deployment yang dikelola, basis data yang dikelola, dan rotasi kunci."
  },
  {
    q: "Apakah AI worker bisa mengirim sesuatu tanpa saya setujui?",
    a: "Tidak. Tindakan yang mengubah kondisi di luar DEXTRA berhenti di persetujuan manusia. Tanpa keputusan setujui, executor tidak dijalankan, walaupun mandatnya sudah terbit. Urutannya memang begitu: mandat memberi wewenang, persetujuan yang memakainya."
  },
  {
    q: "Kalau ada entri audit yang keliru, bagaimana mengoreksinya?",
    a: "Dengan menambah event koreksi, bukan mengubah entri lama. Di Audit Trail tidak ada tombol edit atau hapus, dan endpoint yang menyediakannya juga tidak ada. Urutan kejadian dan rantai hash-nya tetap bisa diperiksa ulang kapan saja."
  },
  {
    q: "Apakah data satu tenant bisa terlihat dari tenant lain?",
    a: "Setiap permintaan API dibatasi ke tenant pemanggil, dan catatan disimpan dengan tenant_id. Token milik satu tenant tidak membawa identitas tenant lain, jadi panggilan lintas tenant tidak punya jalur masuk."
  },
  {
    q: "Apakah token API bisa melakukan lebih dari pemiliknya?",
    a: "Tidak. Capability efektif sebuah token adalah irisan scope token dengan capability pemiliknya. Token yang scope-nya lebih luas dari pemiliknya tetap berhenti di batas pemilik, dan pencabutan token berlaku pada pemakaian berikutnya."
  },
  {
    q: "Integrasi apa yang benar-benar tersedia?",
    a: "Email dan kalender ditulis sebagai berkas lokal (.eml dan .ics) di data/outbox, bukan dikirim ke server eksternal. Kanal lain belum terpasang, dan halaman Integrations menyebutkan status tiap kanal apa adanya, termasuk yang belum diimplementasikan."
  }
];

export default function AboutPage() {
  return (
    <>
      {/* ---------- Identitas ---------- */}
      <section className="mkt-hero" aria-labelledby="about-title">
        <div className="mkt-wrap">
          <p className="mkt-kicker">Tentang DEXTRA</p>
          <h1 className="mkt-h1" id="about-title">
            <span>Platform kerja untuk AI worker</span>
            <span className="mkt-h1__accent">yang bisa dipertanggungjawabkan.</span>
          </h1>
          <p className="mkt-lead">
            DEXTRA menempatkan agen AI sebagai pekerja dengan peran, bukan sebagai kredensial. Setiap
            tindakan yang mengubah kondisi di luar platform harus punya izin tertulis yang cakupannya
            sempit, keputusan manusia, dan catatan yang tidak bisa ditulis ulang. Halaman ini menjelaskan
            apa yang dibangun, apa yang sengaja tidak dibangun, dan bagaimana lapisannya tersusun.
          </p>

          <dl className="about-id">
            {IDENTITAS.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------- 01 Lapisan yang hilang ---------- */}
      <section className="mkt-sec" aria-labelledby="hilang-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              01
            </span>
            <h2 className="mkt-h2" id="hilang-title">
              Lapisan yang tidak disediakan oleh model, orkestrasi, dan log
            </h2>
            <p className="mkt-sec__lead">
              Ketiga lapisan di bawah DEXTRA sudah bekerja. Yang tidak ada di antaranya adalah tempat
              menyimpan izin, sehingga pertanyaan siapa yang mengizinkan tidak punya jawaban yang bisa
              diperiksa.
            </p>
          </div>

          <ul className="mkt-probs">
            {LAPISAN_HILANG.map((item) => (
              <li className="mkt-prob" key={item.title}>
                <h3 className="mkt-h3">{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ul>

          <div className="mkt-note">
            <h3 className="mkt-h3">Yang hilang bukan kecerdasan modelnya</h3>
            <p>
              Yang hilang adalah lapisan wewenang: objek yang menyatakan izin, terpisah dari rencana,
              dengan cakupan yang bisa dibaca dan riwayat yang tidak bisa ditulis ulang. DEXTRA mengisi
              tempat itu, dan hampir seluruh bentuk sistemnya ditentukan oleh keputusan menaruh izin di
              sana.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 02 Prinsip dan konsekuensinya ---------- */}
      <section className="mkt-sec mkt-sec--tint" aria-labelledby="prinsip-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              02
            </span>
            <h2 className="mkt-h2" id="prinsip-title">
              Baca boleh otomatis, tulis harus lewat mandat.
            </h2>
            <p className="mkt-sec__lead">
              Satu kalimat itu bukan semboyan, melainkan batas yang menentukan bentuk sistem. Empat hal
              berikut adalah konsekuensinya, dan keempatnya bisa diperiksa di produk.
            </p>
          </div>

          <div className="mkt-split__body">
            <ol className="about-conseq">
              {KONSEKUENSI.map((item) => (
                <li key={item.title}>
                  <h3 className="mkt-h3">{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ---------- 03 Lakukan dan tidak lakukan ---------- */}
      <section className="mkt-sec" aria-labelledby="batas-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              03
            </span>
            <h2 className="mkt-h2" id="batas-title">
              Apa yang DEXTRA lakukan, dan apa yang tidak
            </h2>
            <p className="mkt-sec__lead">
              Dua daftar ini bukan ringkasan fitur. Kolom kanan sama pentingnya dengan kolom kiri, karena
              batas yang tidak ditulis akan diisi oleh anggapan pembacanya.
            </p>
          </div>

          <div className="about-does">
            <div className="about-does__panel">
              <h3 className="about-does__label">
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                Dilakukan
              </h3>
              <ul>
                {DILAKUKAN.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="about-does__panel about-does__panel--no">
              <h3 className="about-does__label">
                <span className="material-symbols-outlined" aria-hidden="true">
                  block
                </span>
                Tidak dilakukan
              </h3>
              <ul>
                {TIDAK_DILAKUKAN.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 04 Arsitektur ---------- */}
      <section className="mkt-sec" aria-labelledby="arsitektur-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              04
            </span>
            <h2 className="mkt-h2" id="arsitektur-title">
              Enam lapisan, satu arah
            </h2>
            <p className="mkt-sec__lead">
              Urutan di bawah mengikuti arah data, bukan urutan menu. Permintaan masuk lewat antarmuka,
              diperiksa, diberi izin, dijalankan, lalu dicatat. Tidak ada lapisan yang bisa dilewati.
            </p>
          </div>

          <div className="mkt-split__body">
            <ol className="about-stack">
              {LAPISAN.map((layer, index) => (
                <li className="about-layer" key={layer.name}>
                  <span className="about-layer__index" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="about-layer__body">
                    <h3 className="about-layer__name">{layer.name}</h3>
                    <p className="about-layer__text">{layer.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="about-stack__foot">
              Next.js 16 + React 19 di apps/web · FastAPI di backend/dextra · SQLite · font dan ikon
              di-host sendiri, tanpa permintaan ke pihak ketiga di jalur render.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 05 Isolasi dan wewenang ---------- */}
      <section className="mkt-sec mkt-sec--tint" aria-labelledby="wewenang-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              05
            </span>
            <h2 className="mkt-h2" id="wewenang-title">
              Isolasi tenant dan wewenang yang tidak bisa dinaikkan
            </h2>
            <p className="mkt-sec__lead">
              Wewenang di DEXTRA bertingkat, dan tiap tingkat hanya bisa mempersempit tingkat di atasnya.
              Tidak ada jalur untuk menambah kemampuan dari bawah.
            </p>
          </div>

          <div className="mkt-split__body">
            <dl className="mkt-defs">
              {WEWENANG.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>{item.body}</dd>
                </div>
              ))}
            </dl>

            <div className="mkt-note">
              <h3 className="mkt-h3">Kenapa batasnya di API, bukan di tampilan</h3>
              <p>
                Antarmuka bisa menyembunyikan tombol, tetapi menyembunyikan tombol bukan batas keamanan.
                Pembatasan yang berlaku ada di lapisan API: capability, tenant, dan mandat diperiksa di
                sana. Klien yang memanggil endpoint langsung tidak menemukan jalan lain, dan itu alasan
                pemeriksaan diletakkan sekali di jalur yang sama untuk semua pemanggil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 06 Peta modul ---------- */}
      <section className="mkt-sec" aria-labelledby="modul-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              06
            </span>
            <h2 className="mkt-h2" id="modul-title">
              Peta modul yang ada di workspace
            </h2>
            <p className="mkt-sec__lead">
              Semua tautan di bawah menuju halaman yang sudah dibangun. Dikelompokkan menurut pekerjaan
              yang ditopangnya, supaya modul yang jarang disebut tetap bisa ditemukan.
            </p>
          </div>

          <div className="about-map">
            {MODUL.map((group) => (
              <div className="about-map__group" key={group.group}>
                <h3 className="about-map__title">{group.group}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link className="about-map__link" href={item.href}>
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 07 FAQ ---------- */}
      <section className="mkt-sec" aria-labelledby="faq-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              07
            </span>
            <h2 className="mkt-h2" id="faq-title">
              Pertanyaan yang pantas diajukan sebelum mencoba
            </h2>
            <p className="mkt-sec__lead">
              Enam pertanyaan berikut yang paling sering muncul saat orang pertama kali membuka instans
              ini. Jawabannya menyebut batas, bukan hanya kemampuan.
            </p>
          </div>

          <div className="about-faq">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>
                  <span>{item.q}</span>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add
                  </span>
                </summary>
                <div className="about-faq__body">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA penutup ---------- */}
      <section className="mkt-cta" aria-labelledby="cta-title">
        <div className="mkt-wrap">
          <h2 className="mkt-cta__text" id="cta-title">
            Alurnya lebih jelas kalau diikuti langkah demi langkah
          </h2>
          <p className="mkt-cta__lead">
            Cara Kerja memecah satu tindakan menjadi tujuh langkah, dan setiap langkah menunjuk rute
            tempat Anda bisa memeriksanya sendiri.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/how-it-works">
              Cara Kerja
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/audit">
              Audit Trail
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
