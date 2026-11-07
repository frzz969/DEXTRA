import Link from "next/link";
import "./team.css";

export const metadata = {
  title: "Tim AI Worker — DEXTRA",
  description:
    "Empat peran yang didefinisikan registri workforce DEXTRA: tipe, kapabilitas terdaftar, versi, dan status yang dikenal sistem."
};

/* Peran di bawah ini disalin apa adanya dari registri workforce:
 * SPECIALISTS di backend/dextra/modules/workforce/router.py (baris 25-30) dan
 * entri seed di database/seeds/seed.py (baris 36-65). Nama, tipe, deskripsi,
 * dan kapabilitasnya sama dengan yang tercatat di sana.
 *
 * Tidak ada status di sini. Status worker berubah setiap kali worker dipakai,
 * jadi halaman statis ini tidak boleh mencetaknya: roster beserta status
 * terkininya dibaca dari GET /agents di /agents. */
const ROLES = [
  {
    slug: "workforce-dispatcher",
    name: "Workforce Dispatcher",
    type: "orchestrator",
    description: "Membagi pekerjaan ke spesialis dan memantau kemajuannya.",
    capabilities: ["route_task", "read_workforce"]
  },
  {
    slug: "executive-assistant",
    name: "Executive Assistant",
    type: "assistant",
    description: "Menyusun rencana kerja dan ringkasan untuk manusia.",
    capabilities: ["create_plan", "read_calendar"]
  },
  {
    slug: "administrative-officer",
    name: "Administrative Officer",
    type: "operator",
    description: "Menyiapkan dokumen dan korespondensi sesuai mandat.",
    capabilities: ["draft_document"]
  },
  {
    slug: "adversarial-reviewer",
    name: "Adversarial Reviewer",
    type: "reviewer",
    description: "Mencari cacat rencana sebelum diajukan untuk persetujuan.",
    capabilities: ["review_plan"]
  }
];

/* Nilai status yang dikenal sistem (backend/dextra/models/workforce.py baris 27
 * dan AGENT_STATUSES di modul workforce). Nilai di luar daftar ini ditolak
 * dengan 422, bukan disimpan. */
const STATUSES = ["active", "idle", "busy", "disabled", "error"];

/* Arti tiap kapabilitas dibaca harfiah dari namanya. Tidak ada kapabilitas di
 * sini yang tidak muncul pada ROLES di atas. */
const GRANTED: [string, string][] = [
  ["route_task", "membagi pekerjaan ke spesialis"],
  ["read_workforce", "membaca entri registri workforce"],
  ["create_plan", "menyusun rencana kerja"],
  ["read_calendar", "membaca kalender"],
  ["draft_document", "menyiapkan draf dokumen"]
];

const NOT_GRANTED: [string, string][] = [
  ["approve", "menyetujui rencana"],
  ["issue_mandate", "menerbitkan mandat"],
  ["revoke_mandate", "mencabut mandat"],
  ["execute", "menjalankan tindakan"]
];

const CHAIN = ["Kapabilitas", "Rencana", "Mandat", "Persetujuan manusia", "Eksekusi"];

export default function TeamPage() {
  return (
    <>
      <section className="mkt-hero" aria-labelledby="team-title">
        <div className="mkt-wrap">
          <p className="mkt-kicker">Registri workforce · Empat peran</p>
          <h1 className="mkt-h1" id="team-title">
            <span>Tim AI Worker</span>
            <span className="mkt-h1__accent">yang didefinisikan DEXTRA</span>
          </h1>
          <p className="mkt-lead">
            Halaman ini menjelaskan peran yang tercatat di registri workforce: tipe, kapabilitas yang
            terdaftar, versi, dan status yang dikenal sistem. Roster sebenarnya dibaca dari registri saat
            runtime di halaman workforce. Yang di bawah ini adalah definisi peran, bukan klaim bahwa ada
            worker yang sedang aktif sekarang.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/agents">
              Workforce di dashboard
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/how-it-works">
              Cara kerja
            </Link>
          </div>

          <div className="mkt-principle">
            <span className="mkt-principle__label">Batas yang berlaku</span>
            <p className="mkt-principle__text">
              Kapabilitas adalah izin granular, bukan deskripsi pekerjaan.
            </p>
            <p className="mkt-principle__note">
              Worker tidak mendapat wewenang lebih dari yang terdaftar untuknya. Tindakan tulis tetap
              melewati mandat dan persetujuan manusia, dan worker tidak punya jalur langsung ke executor.
            </p>
          </div>
        </div>
      </section>

      {/* 01 */}
      <section className="mkt-sec" aria-labelledby="peran-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              01
            </span>
            <h2 className="mkt-h2" id="peran-title">
              Empat peran yang didefinisikan registri
            </h2>
            <p className="mkt-sec__lead">
              Nama, tipe, dan kapabilitas di bawah ini adalah nilai yang tercatat di registri, bukan nama
              untuk halaman ini. Tidak ada peran kelima di daftar ini.
            </p>
          </div>

          <ul className="team-registry">
            {ROLES.map((role) => (
              <li className="team-role" key={role.slug}>
                <div className="team-role__id">
                  <span className="team-role__slug">{role.slug}</span>
                  <h3 className="team-role__name">{role.name}</h3>
                  <span className="team-role__type">tipe: {role.type}</span>
                </div>
                <div className="team-role__body">
                  <p className="team-role__desc">{role.description}</p>
                  <ul className="team-role__caps" aria-label={`Kapabilitas terdaftar ${role.name}`}>
                    {role.capabilities.map((capability) => (
                      <li key={capability}>
                        <span className="tag">{capability}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>

          <div className="mkt-note">
            <h3 className="mkt-h3">Status tidak dicetak di halaman ini</h3>
            <p>
              Registri menyimpan status per worker, dan status itu berubah sepanjang hari. Karena halaman
              ini tidak membaca API, ia tidak menampilkan satu pun status, jumlah worker aktif, atau
              hitungan apa pun. Untuk yang tercatat sekarang, buka{" "}
              <Link className="team-link" href="/agents">
                Workforce
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* 02 */}
      <section className="mkt-sec mkt-sec--tint" aria-labelledby="bawaan-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              02
            </span>
            <h2 className="mkt-h2" id="bawaan-title">
              Yang dibawa satu worker
            </h2>
            <p className="mkt-sec__lead">
              Empat hal ini melekat pada setiap entri registri, dan semuanya dibaca dari registri saat
              runtime. Halaman ini menjelaskan artinya, bukan mencetak nilai milik worker tertentu.
            </p>
          </div>

          <div className="mkt-split__body">
            <dl className="mkt-defs">
              <div>
                <dt>Tipe</dt>
                <dd>
                  Nilai <code className="mono">agent_type</code> yang tercatat. Empat peran di halaman ini
                  memakai orchestrator, assistant, operator, dan reviewer.
                </dd>
              </div>
              <div>
                <dt>Kapabilitas</dt>
                <dd>
                  Daftar izin granular, tercatat satu per satu untuk worker itu. Yang tidak ada di daftar
                  tidak dimiliki worker tersebut.
                </dd>
              </div>
              <div>
                <dt>Versi</dt>
                <dd>
                  Setiap perubahan konfigurasi disimpan sebagai versi baru pada worker yang sama, jadi
                  riwayatnya tetap ada dan bukan ditimpa.
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  Satu dari lima nilai yang dikenal sistem. Nilai di luar kelimanya ditolak saat ditulis,
                  bukan disimpan apa adanya.
                </dd>
              </div>
            </dl>

            <div className="team-statuses-block">
              <h3 className="mkt-h3">Lima nilai status yang diterima</h3>
              <ul className="team-statuses">
                {STATUSES.map((status) => (
                  <li className="team-status" key={status}>
                    {status}
                  </li>
                ))}
              </ul>
              <p className="team-statuses__note">
                Nilai lain ditolak oleh API saat status ditulis. Halaman ini tidak menebak arti tiap nilai
                lebih jauh dari yang tercatat: yang menentukan adalah status di registri saat runtime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 03 */}
      <section className="mkt-sec" aria-labelledby="wewenang-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              03
            </span>
            <h2 className="mkt-h2" id="wewenang-title">
              Tidak ada jalur langsung dari worker ke executor
            </h2>
            <p className="mkt-sec__lead">
              Kapabilitas menentukan apa yang boleh diajukan. Yang menentukan apa yang benar-benar berjalan
              adalah mandat dan persetujuan manusia, dan keduanya berada di luar worker.
            </p>
          </div>

          <div className="team-boundary">
            <div className="team-boundary__col">
              <span className="team-boundary__label">Tercatat pada worker</span>
              <ul className="team-boundary__list">
                {GRANTED.map(([name, meaning]) => (
                  <li key={name}>
                    <code className="mono">{name}</code> {meaning}
                  </li>
                ))}
              </ul>
            </div>

            <div className="team-boundary__col team-boundary__col--quiet">
              <span className="team-boundary__label">Tidak tercatat pada satu pun worker di atas</span>
              <ul className="team-boundary__list">
                {NOT_GRANTED.map(([name, meaning]) => (
                  <li key={name}>
                    <code className="mono">{name}</code> {meaning}
                  </li>
                ))}
                <li>
                  Kapabilitas tulis ke sistem eksternal, mengubah kebijakan, dan mengelola anggota juga
                  tidak muncul di daftar mana pun di halaman ini.
                </li>
              </ul>
            </div>
          </div>

          <div className="mkt-lane mkt-lane--governed team-lane">
            <span className="mkt-lane__label">Jalur wewenang</span>
            <h3 className="mkt-lane__title">
              Worker berhenti di rencana. Tiga langkah terakhir dijalankan di luar worker.
            </h3>
            <div className="mkt-chain">
              {CHAIN.map((step, index) => (
                <span className="team-chain__item" key={step}>
                  <span className="mkt-chain__step">{step}</span>
                  {index < CHAIN.length - 1 ? (
                    <span className="mkt-chain__sep" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 04 */}
      <section className="mkt-sec mkt-sec--tint" aria-labelledby="skill-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              04
            </span>
            <h2 className="mkt-h2" id="skill-title">
              Skill dan workflow punya halamannya sendiri
            </h2>
            <p className="mkt-sec__lead">
              Kapabilitas bukan satu-satunya hal yang bisa ditambahkan ke worker, dan bukan tempat
              menyusun urutan pekerjaan.
            </p>
          </div>

          <div className="mkt-split__body">
            <dl className="mkt-defs">
              <div>
                <dt>Skill Registry</dt>
                <dd>
                  Katalog skill sistem dan skill milik tenant, beserta statusnya. Skill tambahan didaftarkan
                  di sini, bukan di halaman ini.
                </dd>
              </div>
              <div>
                <dt>Workflow Registry</dt>
                <dd>
                  Definisi workflow per tenant. Run dijalankan lewat idempotency key, dan gerbang{" "}
                  <code className="mono">waiting_approval</code> hanya bisa dilewati persetujuan manusia
                  yang memegang kapabilitas <code className="mono">approve</code>.
                </dd>
              </div>
            </dl>

            <div className="mkt-actions">
              <Link className="btn btn--primary" href="/agents">
                Workforce di dashboard
              </Link>
              <Link className="btn btn--secondary" href="/skills">
                Skill Registry
              </Link>
              <Link className="btn btn--secondary" href="/workflows">
                Workflow Registry
              </Link>
              <Link className="btn btn--ghost" href="/how-it-works">
                Cara kerja
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-cta" aria-labelledby="team-cta-title">
        <div className="mkt-wrap">
          <h2 className="mkt-cta__text" id="team-cta-title">
            Lihat roster yang sebenarnya
          </h2>
          <p className="mkt-cta__lead">
            Status per worker, kapabilitas yang tercatat, dan versinya dibaca dari registri di halaman
            workforce. Halaman ini hanya menjelaskan perannya.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/agents">
              Buka workforce
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/tutorial">
              Tutor
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
