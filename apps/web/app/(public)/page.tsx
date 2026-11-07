import Link from "next/link";

export const metadata = {
  title: "DEXTRA: Governed Enterprise AI Workforce",
  description:
    "Specialized AI workers. Human-defined authority. Accountable execution. DEXTRA mengelola AI worker, work package, mandat, persetujuan manusia, dan jejak audit dalam satu platform."
};

/* Empat peran ini berasal dari registri workforce: SPECIALISTS di
 * backend/dextra/modules/workforce/router.py dan entri seed di
 * database/seeds/seed.py. Nama, tipe, deskripsi, dan kapabilitasnya disalin
 * apa adanya dari sana. Halaman ini tidak membaca API karena halaman publik
 * harus tetap utuh saat backend mati; roster terkininya ada di /agents. */
const WORKERS = [
  {
    slug: "workforce-dispatcher",
    name: "Workforce Dispatcher",
    type: "orchestrator",
    icon: "account_tree",
    description: "Membagi pekerjaan ke spesialis dan memantau kemajuannya.",
    capabilities: ["route_task", "read_workforce"]
  },
  {
    slug: "executive-assistant",
    name: "Executive Assistant",
    type: "assistant",
    icon: "assignment",
    description: "Menyusun rencana kerja dan ringkasan untuk manusia.",
    capabilities: ["create_plan", "read_calendar"]
  },
  {
    slug: "administrative-officer",
    name: "Administrative Officer",
    type: "operator",
    icon: "send",
    description: "Menyiapkan dokumen dan korespondensi sesuai mandat.",
    capabilities: ["draft_document"]
  },
  {
    slug: "adversarial-reviewer",
    name: "Adversarial Reviewer",
    type: "reviewer",
    icon: "fact_check",
    description: "Mencari cacat rencana sebelum diajukan untuk persetujuan.",
    capabilities: ["review_plan"]
  }
];

/* Setiap modul menunjuk rute yang benar-benar ada di app/(app). */
const MODULES = [
  {
    href: "/overview",
    icon: "space_dashboard",
    name: "Overview",
    description: "Ringkasan operasional: work package aktif, antrean persetujuan, eksekusi yang diblokir."
  },
  {
    href: "/assistant",
    icon: "forum",
    name: "AI Assistant",
    description: "Menyusun rencana dari permintaan, dengan langkah yang bisa diperiksa sebelum diajukan."
  },
  {
    href: "/office-agent",
    icon: "auto_awesome",
    name: "Office Agent",
    description: "Menyiapkan dokumen dan korespondensi sebagai rencana, bukan sebagai kiriman."
  },
  {
    href: "/requests",
    icon: "send",
    name: "Requests",
    description: "Permintaan masuk yang menjadi titik awal setiap work package."
  },
  {
    href: "/approvals",
    icon: "assignment_turned_in",
    name: "Approvals",
    description: "Keputusan manusia atas rencana: setujui, tolak, atau minta revisi."
  },
  {
    href: "/mandates",
    icon: "verified_user",
    name: "Mandates",
    description: "Cakupan wewenang per rencana, terikat plan_hash dan sekali pakai."
  },
  {
    href: "/executions",
    icon: "play_circle",
    name: "Executions",
    description: "Riwayat eksekusi beserta hasil, kegagalan, dan alasan blokir."
  },
  {
    href: "/audit",
    icon: "receipt_long",
    name: "Audit Trail",
    description: "Jejak append-only untuk setiap langkah, dengan verifikasi rantai hash."
  },
  {
    href: "/access",
    icon: "admin_panel_settings",
    name: "Access",
    description: "Peran, kapabilitas, dan matriks wewenang yang berlaku di workspace."
  },
  {
    href: "/analytics",
    icon: "query_stats",
    name: "Analytics",
    description: "Volume eksekusi, keputusan, dan blokir per hari, dihitung dari data nyata."
  }
];

/* Tujuh jejak satu tindakan, dipakai sebagai ringkasan di hero. Urutannya
 * sama dengan bagian 03 di halaman ini: permintaan dan rencana berjalan tanpa
 * wewenang, lima langkah sesudahnya berada di jalur wewenang. Tidak ada nama
 * langkah baru di sini. */
const TRAIL_EARLY = ["Permintaan", "Rencana"];
const TRAIL_GOVERNED = ["Validasi kebijakan", "Mandat", "Persetujuan manusia", "Eksekusi", "Audit"];

/* Enam langkah alur kerja. Langkah 1 otomatis, langkah 2 sampai 6 berada di
 * jalur wewenang. Urutannya sama dengan yang dijalankan backend: rencana,
 * evaluasi kebijakan, mandat, persetujuan, eksekusi, audit. */
const GOVERNED_STEPS = [
  {
    title: "Validasi kebijakan",
    body: "Kebijakan aktif memeriksa jenis tindakan, target, jadwal, dan isi. Temuan blocking menghentikan rencana di sini, sebelum ada mandat."
  },
  {
    title: "Mandat terbit",
    body: "Mandat mengikat satu rencana lewat plan_hash, dengan cakupan sempit dan sekali pakai. Mandat bisa dicabut sebelum dieksekusi."
  },
  {
    title: "Persetujuan manusia",
    body: "Manusia memutuskan: setujui, tolak, atau minta revisi. Tanpa keputusan ini tidak ada eksekusi."
  },
  {
    title: "Eksekusi",
    body: "Executor menjalankan tindakan sesuai cakupan mandat, tidak lebih luas dari itu."
  },
  {
    title: "Audit append-only",
    body: "Setiap langkah tercatat berurutan dengan rantai hash untuk verifikasi, tanpa jalur ubah atau hapus."
  }
];

export default function LandingPage() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="mkt-hero" aria-labelledby="hero-title">
        <div className="mkt-wrap mkt-hero__grid">
          <div className="mkt-hero__main">
            <p className="mkt-kicker">
              <span className="mkt-kicker__text">
                Governed Enterprise AI Workforce
                <span className="mkt-kicker__tail"> &amp; Operations Platform</span>
              </span>
            </p>
            <h1 className="mkt-h1" id="hero-title">
              <span>Specialized AI workers.</span>
              <span>Human-defined authority.</span>
              <span className="mkt-h1__accent">Accountable execution.</span>
            </h1>
            <p className="mkt-lead">
              DEXTRA adalah platform kerja untuk agen AI di dalam perusahaan: satu tempat untuk mengelola
              AI worker, work package, mandat, persetujuan manusia, dan jejak audit. Setiap tindakan yang
              mengubah kondisi sistem eksternal melewati wewenang yang ditetapkan manusia lebih dulu, lalu
              tercatat dan tidak bisa diubah.
            </p>
            <div className="mkt-actions">
              <Link className="btn btn--primary btn--lg" href="/overview">
                Dashboard
              </Link>
              <Link className="btn btn--secondary btn--lg" href="/how-it-works">
                Cara Kerja
              </Link>
            </div>
          </div>

          {/* Diagram jejak, bukan tangkapan antarmuka: tujuh langkah yang sama
              dengan bagian 03, digambar sebagai daftar bernomor supaya kolom
              kanan hero tidak kosong di layar lebar. */}
          <aside className="mkt-hero__panel" aria-labelledby="hero-trail-title">
            <p className="mkt-trail__label" id="hero-trail-title">
              Satu tindakan, tujuh jejak
            </p>
            <ol className="mkt-trail" role="list">
              {TRAIL_EARLY.map((step, index) => (
                <li className="mkt-trail__step" key={step}>
                  <span className="mkt-trail__idx" aria-hidden="true">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mkt-trail__boundary" aria-hidden="true">
              <span>Batas wewenang</span>
            </p>
            <ol className="mkt-trail" role="list" start={TRAIL_EARLY.length + 1}>
              {TRAIL_GOVERNED.map((step, index) => (
                <li className="mkt-trail__step mkt-trail__step--governed" key={step}>
                  <span className="mkt-trail__idx" aria-hidden="true">
                    {index + TRAIL_EARLY.length + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            <p className="mkt-trail__note">Rincian tiap langkah ada di bagian 03.</p>
          </aside>

          <div className="mkt-principle">
            <span className="mkt-principle__label">Prinsip inti</span>
            <p className="mkt-principle__text">Baca boleh otomatis, tulis harus lewat mandat.</p>
            <p className="mkt-principle__note">
              Satu kalimat yang memisahkan apa yang boleh dilakukan agen sendiri dari apa yang harus
              melewati manusia.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 01 Masalah ---------- */}
      <section className="mkt-sec" aria-labelledby="masalah-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              01
            </span>
            <h2 className="mkt-h2" id="masalah-title">
              Kenapa agen AI di perusahaan berbahaya tanpa batas
            </h2>
            <p className="mkt-sec__lead">
              Tiga hal ini muncul berulang sebelum ada batas wewenang yang eksplisit. Ketiganya soal izin
              dan catatan, bukan soal kemampuan model.
            </p>
          </div>

          <ul className="mkt-probs">
            <li className="mkt-prob">
              <h3 className="mkt-h3">Agen menulis ke sistem eksternal tanpa jejak</h3>
              <p>
                Satu panggilan API sudah cukup untuk mengirim email, mengubah status tiket, atau
                memindahkan data. Kalau tidak ada catatan siapa yang mengizinkan dan atas dasar apa,
                kejadian itu tidak bisa ditelusuri kembali.
              </p>
            </li>
            <li className="mkt-prob">
              <h3 className="mkt-h3">Izin tidak jelas batasnya</h3>
              <p>
                Agen sering diberi kredensial yang luasnya sama dengan milik manusia, lalu dipakai untuk
                pekerjaan yang jauh lebih sempit. Tidak ada yang menyatakan tindakan apa yang boleh, ke
                target mana, dan sampai kapan.
              </p>
            </li>
            <li className="mkt-prob">
              <h3 className="mkt-h3">Audit tidak bisa direkonstruksi</h3>
              <p>
                Log aplikasi mencatat bahwa sesuatu terjadi, bukan bahwa sesuatu diizinkan. Saat diminta
                membuktikan dasar sebuah keputusan, tim hanya punya potongan yang tidak bisa disusun
                ulang.
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* ---------- 02 Prinsip ---------- */}
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
              Pemisahan ini yang menentukan bentuk seluruh sistem. Pekerjaan baca berjalan sendiri karena
              tidak mengubah apa pun di luar DEXTRA. Pekerjaan tulis tidak.
            </p>
          </div>

          <div className="mkt-split__body">
            <div className="mkt-lanes">
              <div className="mkt-lane">
                <span className="mkt-lane__label">Otomatis</span>
                <h3 className="mkt-lane__title">Membaca, menganalisis, menyusun rencana, memberi rekomendasi</h3>
                <p className="mkt-lane__text">
                  Tidak ada kondisi di sistem mana pun yang tersentuh, jadi tidak perlu mandat. Hasilnya
                  tetap bisa diperiksa manusia sebelum menjadi tindakan.
                </p>
              </div>

              <div className="mkt-flow__boundary" aria-hidden="true">
                <span>Batas wewenang</span>
              </div>

              <div className="mkt-lane mkt-lane--governed">
                <span className="mkt-lane__label">Wajib wewenang</span>
                <h3 className="mkt-lane__title">Mengirim, mengubah, menghapus di sistem eksternal</h3>
                <p className="mkt-lane__text">
                  Empat lapis dilalui berurutan sebelum tindakan berjalan. Tidak ada jalur dari agen
                  langsung ke executor.
                </p>
                <div className="mkt-chain">
                  <span className="mkt-chain__step">Permission</span>
                  <span className="mkt-chain__sep" aria-hidden="true">
                    →
                  </span>
                  <span className="mkt-chain__step">Validasi kebijakan</span>
                  <span className="mkt-chain__sep" aria-hidden="true">
                    →
                  </span>
                  <span className="mkt-chain__step">Mandat</span>
                  <span className="mkt-chain__sep" aria-hidden="true">
                    →
                  </span>
                  <span className="mkt-chain__step">Persetujuan manusia</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 03 Alur kerja ---------- */}
      <section className="mkt-sec" aria-labelledby="alur-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              03
            </span>
            <h2 className="mkt-h2" id="alur-title">
              Dari rencana sampai jejak audit dalam enam langkah
            </h2>
            <p className="mkt-sec__lead">
              Ini alur sebuah work package di DEXTRA. Langkah pertama berjalan otomatis. Lima langkah
              berikutnya berada di jalur wewenang, dan semuanya meninggalkan catatan.
            </p>
          </div>

          <div className="mkt-flow">
            <div className="mkt-flow__lane">
              <span className="mkt-flow__lane-label">Otomatis, tanpa wewenang</span>
              <ol className="mkt-flow__list mkt-flow__list--one">
                <li className="mkt-flow__step">
                  <span className="mkt-flow__index" aria-hidden="true">
                    1
                  </span>
                  <div>
                    <h3>Rencana disusun</h3>
                    <p>
                      AI worker menyusun langkah, target, jadwal, dan isi tindakan. Belum ada yang berubah
                      di sistem mana pun.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className="mkt-flow__boundary" aria-hidden="true">
              <span>Batas wewenang</span>
            </div>

            <div className="mkt-flow__lane mkt-flow__lane--governed">
              <span className="mkt-flow__lane-label">Jalur wewenang, setiap langkah tercatat</span>
              <ol className="mkt-flow__list mkt-flow__list--five" start={2}>
                {GOVERNED_STEPS.map((step, index) => (
                  <li className="mkt-flow__step" key={step.title}>
                    <span className="mkt-flow__index" aria-hidden="true">
                      {index + 2}
                    </span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 04 AI Worker ---------- */}
      <section className="mkt-sec" aria-labelledby="worker-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              04
            </span>
            <h2 className="mkt-h2" id="worker-title">
              Empat peran spesialis
            </h2>
            <p className="mkt-sec__lead">
              Peran yang didefinisikan DEXTRA dan terdaftar di registri workforce. Tipe dan kapabilitas di
              bawah ini adalah nilai yang tercatat di sana, bukan nama untuk halaman ini.
            </p>
          </div>

          <div className="mkt-split__body">
            <div className="mkt-workers">
              {WORKERS.map((worker) => (
                <div className="card spec-card" key={worker.slug}>
                  <div className="spec-card__top">
                    <span className="spec-avatar" aria-hidden="true">
                      <span className="material-symbols-outlined">{worker.icon}</span>
                    </span>
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <h3>{worker.name}</h3>
                      <div className="role">{worker.type}</div>
                    </div>
                  </div>
                  <p className="spec-card__desc">{worker.description}</p>
                  <div className="tag-row">
                    {worker.capabilities.map((capability) => (
                      <span className="tag" key={capability}>
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mkt-workers__foot">
              <p className="mkt-workers__note">
                Roster sebenarnya ada di dashboard: daftar agen, status terkininya, dan kapabilitas yang
                tercatat dibaca langsung dari registri. Halaman ini hanya menjelaskan perannya.
              </p>
              <Link className="btn btn--secondary" href="/team">
                Tim AI Worker
              </Link>
              <Link className="btn btn--ghost" href="/agents">
                Workforce di dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- 05 Modul ---------- */}
      <section className="mkt-sec" aria-labelledby="modul-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              05
            </span>
            <h2 className="mkt-h2" id="modul-title">
              Modul yang tersedia di dashboard
            </h2>
            <p className="mkt-sec__lead">
              Sepuluh halaman berikut sudah ada di workspace. Setiap baris menuju rutenya masing-masing,
              jadi yang dijelaskan di sini bisa langsung dibuka.
            </p>
          </div>

          <ul className="mkt-mods">
            {MODULES.map((module) => (
              <li key={module.href}>
                <Link className="mkt-mod" href={module.href}>
                  <span className="mkt-mod__icon material-symbols-outlined" aria-hidden="true">
                    {module.icon}
                  </span>
                  <span className="mkt-mod__body">
                    <span className="mkt-mod__name">{module.name}</span>
                    <span className="mkt-mod__desc">{module.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- 06 Governance ---------- */}
      <section className="mkt-sec mkt-sec--tint" aria-labelledby="governance-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              06
            </span>
            <h2 className="mkt-h2" id="governance-title">
              Wewenang, kebijakan, dan catatan yang tidak bisa dihapus
            </h2>
            <p className="mkt-sec__lead">
              Empat hal ini yang membuat eksekusi bisa dipertanggungjawabkan: siapa yang boleh mengajukan,
              apa yang diperiksa, sejauh mana izin berlaku, dan apa yang tersisa setelah semuanya selesai.
            </p>
          </div>

          <div className="mkt-split__body">
            <dl className="mkt-defs mkt-defs--duo">
              <div>
                <dt>Permission</dt>
                <dd>
                  Kapabilitas yang dimiliki sebuah peran. Menentukan jenis tindakan yang boleh diajukan
                  sama sekali, sebelum ada rencana.
                </dd>
              </div>
              <div>
                <dt>Policy</dt>
                <dd>
                  Aturan yang dievaluasi pada rencana: jenis tindakan, target, jadwal, dan isi. Temuan
                  blocking menghentikan rencana sebelum mandat terbit.
                </dd>
              </div>
              <div>
                <dt>Mandate</dt>
                <dd>
                  Izin sempit untuk satu rencana: terikat plan_hash, satu kali pakai, dan bisa dicabut
                  sebelum dieksekusi.
                </dd>
              </div>
              <div>
                <dt>Audit append-only</dt>
                <dd>
                  Event ditulis berurutan dengan rantai hash untuk verifikasi. Tidak ada jalur ubah atau
                  hapus, baik di antarmuka maupun di API.
                </dd>
              </div>
            </dl>

            <div className="mkt-note">
              <h3 className="mkt-h3">Audit tidak bisa diubah</h3>
              <p>
                Di Audit Trail tidak ada tombol edit atau hapus, dan endpoint yang menyediakannya juga
                tidak ada. Kalau ada yang perlu dikoreksi, koreksinya adalah event baru, bukan penulisan
                ulang riwayat. Karena itu urutan dan rantai hash-nya bisa diperiksa ulang kapan saja.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA penutup ---------- */}
      <section className="mkt-cta" aria-labelledby="cta-title">
        <div className="mkt-wrap">
          <h2 className="mkt-cta__text" id="cta-title">
            Masuk ke workspace
          </h2>
          <p className="mkt-cta__lead">
            Dashboard membuka workforce, work package, antrean persetujuan, mandat, dan audit untuk sesi
            Anda.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/overview">
              Dashboard
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/how-it-works">
              Cara Kerja
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
