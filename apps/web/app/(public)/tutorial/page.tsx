import Link from "next/link";
import "./tutorial.css";

export const metadata = {
  title: "Tutor — DEXTRA",
  description:
    "Panduan sepuluh langkah memakai DEXTRA, dari masuk sampai memeriksa jejak audit, dengan rute dan label tombol seperti yang ada di aplikasi."
};

/* Label tombol, nama kolom, dan rute di bawah ini disalin dari kode halaman
 * masing-masing, bukan dikarang:
 *   /login              app/(bare)/login/LoginForm.tsx
 *   /overview           app/(app)/overview/page.tsx
 *   /assistant          app/(app)/assistant/page.tsx + AssistantChat.tsx
 *   /office-agent       app/(app)/office-agent/page.tsx + PlanIntakeForm.tsx
 *   /requests           app/(app)/requests/page.tsx + RequestIntakeForm.tsx
 *   /approvals          app/(app)/approvals/page.tsx + PlanActionButtons.tsx
 *   /mandates           app/(app)/mandates/page.tsx + ExecuteButton/RevokeButton
 *   /executions         app/(app)/executions/page.tsx
 *   /audit              app/(app)/audit/page.tsx
 *   /access, /tokens    app/(app)/access/page.tsx, app/(app)/tokens/page.tsx
 * Kalau sebuah tombol berubah nama, langkah di sini ikut berubah. */
type Step = {
  n: string;
  title: string;
  routes: { href: string; label: string }[];
  do: string;
  see: string;
  next: string;
  prereq?: string;
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Masuk",
    routes: [{ href: "/login", label: "/login" }],
    do: "Isi Email dan Password. Kolom Tenant boleh dikosongkan untuk memakai tenant default akun Anda. Tekan tombol Masuk.",
    see: "Kalau akun Anda mewajibkan MFA, formulir berganti ke kolom Kode authenticator dengan tombol Verifikasi & masuk. Kalau kredensial ditolak, pesan galatnya muncul di bawah tombol.",
    prereq:
      "Halaman ini tidak punya tombol login demo, dan tidak ada reset kata sandi mandiri. Akun dan kata sandi disiapkan administrator tenant.",
    next: "Setelah masuk, buka Overview."
  },
  {
    n: "02",
    title: "Overview",
    routes: [{ href: "/overview", label: "/overview" }],
    do: "Baca ringkasan lebih dulu: empat kartu indikator (work package aktif, menunggu persetujuan, diblokir kebijakan, dieksekusi 7 hari), lalu antrean persetujuan, status tata kelola, dan workforce di kolom kanan.",
    see: "Grafik aktivitas 7 hari, daftar work package terbaru, audit terakhir, dan panel Perlu perhatian. Kalau satu sumber tidak merespons, kartunya menampilkan banner bahwa datanya tidak tersedia, bukan angka nol.",
    next: "Tombol Buat permintaan membuka AI Assistant. Tombol Task board membuka papan tugas."
  },
  {
    n: "03",
    title: "AI Assistant",
    routes: [{ href: "/assistant", label: "/assistant" }],
    do: "Tulis permintaan di kolom Pesan untuk asisten, lalu tekan Kirim. Chip saran di atas kolom langsung mengirim pertanyaan yang tertulis di chip itu, jadi tidak perlu mengetik ulang.",
    see: "Balasan asisten berupa draf, dengan panel Batas yang berlaku, Alur persetujuan, dan Sesi & jalur data di sisi kanan.",
    prereq:
      "Kalau server tidak punya kunci AI, kolom tulis dinonaktifkan dan pengiriman tidak tersedia. Riwayat percakapan tidak disimpan ke database, jadi jangan dipakai sebagai catatan.",
    next: "Rencana yang siap diajukan disusun di Office Agent."
  },
  {
    n: "04",
    title: "Office Agent",
    routes: [{ href: "/office-agent", label: "/office-agent" }],
    do: "Isi Request ID, Plan ID, dan Teks permintaan (minimal 20 karakter). Pilih satu Tipe tindakan: Kirim email, Buat acara kalender, Buat tugas, atau Buat notulen. Tombol Isi ID otomatis mengisi ketiga ID. Tekan Kirim rencana.",
    see: "Kalau diterima, muncul banner berisi plan yang tersimpan beserta statusnya dan tautan ke detailnya. Detail rencana menampilkan tindakan, temuan validator, eksekusi, dan jejak audit, beserta plan_hash-nya.",
    prereq:
      "Satu kiriman membawa satu tindakan; tindakan berikutnya butuh Plan ID baru. Kalau server menolak, banner menampilkan alasannya beserta kode HTTP.",
    next: "Rencana yang masuk menunggu keputusan di Approval Inbox."
  },
  {
    n: "05",
    title: "Requests",
    routes: [{ href: "/requests", label: "/requests" }],
    do: "Formulir Buat request baru mengirim permintaan lewat tombol Kirim request. Di bawahnya ada tabel request; saring dengan kolom Cari judul / ID atau Status, lalu tekan Terapkan.",
    see: "Tabel berisi ID, Judul, Status, dan Dibuat, dengan tombol Detail di tiap baris. Tombol Ekspor CSV mengunduh daftar sesuai filter yang sedang aktif.",
    next: "Lanjut ke Approval Inbox untuk memutus rencananya."
  },
  {
    n: "06",
    title: "Approval Inbox",
    routes: [{ href: "/approvals", label: "/approvals" }],
    do: "Setiap rencana tampil sebagai kartu berisi tabel aksi. Di tiap baris ada tombol Setujui dan Tolak. Keduanya membuka kolom Alasan yang wajib diisi, lalu tombol Konfirmasi. Tombol Batal menutup formulir tanpa mengirim.",
    see: "Baris yang sudah diputus berubah menjadi badge disetujui atau ditolak. Riwayat keputusan di bawah halaman mencatat waktu, keputusan, plan, approver, alasan, dan mandat yang terbit.",
    prereq:
      "Temuan validator bertingkat blocking atau berkeputusan deny tampil di detail rencana (/office-agent/[planId]) sebagai banner merah berisi kode temuan dan pesannya, jadi alasannya tertulis dan bisa dibaca sebelum memutus. Di build ini tombol Setujui tidak dinonaktifkan oleh temuan itu; yang menghentikan eksekusi adalah mandat, dan mandat terbit dari persetujuan.",
    next: "Keputusan Setujui menerbitkan mandat. Lihat hasilnya di Mandates."
  },
  {
    n: "07",
    title: "Mandates",
    routes: [{ href: "/mandates", label: "/mandates" }],
    do: "Tabel mandat menampilkan aksi, plan, approver, waktu terbit, kedaluwarsa, dan status. Mandat yang masih bisa dipakai punya tombol Eksekusi; selama belum dicabut dan belum kedaluwarsa, barisnya juga punya tombol Cabut. Cabut meminta Alasan cabut lalu Konfirmasi cabut. Eksekusi meminta konfirmasi lewat tombol Konfirmasi eksekusi.",
    see: "Mandat sekali pakai: setelah dieksekusi, mandat yang sama tidak bisa dipakai lagi. Pencabutan tercatat di jejak audit. Tautan pada id mandat membuka Detail Mandate.",
    next: "Hasil eksekusi terlihat di Monitor Eksekusi."
  },
  {
    n: "08",
    title: "Monitor Eksekusi",
    routes: [{ href: "/executions", label: "/executions" }],
    do: "Lihat strip hitungan status di atas, lalu tabel eksekusi: status, adapter, mulai, durasi, hasil, dan id. Saring dengan kolom Cari id, plan, mandate, hasil, Status, dan Adapter, lalu tekan Terapkan.",
    see: "Eksekusi yang gagal atau diblokir muncul dengan statusnya sendiri beserta hasil atau alasannya. Tombol Detail membuka satu eksekusi; Ekspor CSV mengikuti filter yang aktif.",
    next: "Jejak lengkapnya ada di Audit Center."
  },
  {
    n: "09",
    title: "Audit Center",
    routes: [{ href: "/audit", label: "/audit" }],
    do: "Saring dengan Cari, Tipe peristiwa, dan Keputusan, lalu tekan Terapkan. Tombol Reset menghapus filter. Halaman berpindah dengan Sebelumnya dan Berikutnya, dan Ekspor JSONL mengunduh jejaknya.",
    see: "Banner verifikasi rantai hash: terverifikasi beserta jumlah entri yang diperiksa, atau rusak pada seq tertentu. Filter hanya berlaku pada event di halaman yang sedang tampil; untuk menyaring seluruh riwayat, pakai ekspor JSONL.",
    prereq:
      "Tidak ada tombol ubah atau hapus di halaman ini, dan endpoint-nya juga tidak ada. Koreksi dilakukan sebagai event baru, bukan dengan menulis ulang riwayat.",
    next: "Kalau perlu memeriksa wewenang, lanjut ke Akses & Peran."
  },
  {
    n: "10",
    title: "Akses & Peran, lalu Token",
    routes: [
      { href: "/access", label: "/access" },
      { href: "/tokens", label: "/tokens" }
    ],
    do: "Di Akses & Peran, saring anggota dengan Cari anggota dan Peran lalu tekan Terapkan, dan baca matriks kapabilitas per peran. Halaman itu read-only. Di Token & Identitas Mesin, baca daftar token (hanya prefix) lalu buat atau putar token lewat formulir Buat token, dan cabut yang tidak dipakai.",
    see: "Token API tampil sebagai prefix; secret hanya muncul sekali saat dibuat atau diputar. Service account tampil beserta kind, status, dan jumlah tokennya.",
    prereq:
      "Daftar anggota di /access dibaca lewat GET /users, dan endpoint itu membutuhkan kapabilitas manage_users. Tanpa kapabilitas itu, bagian anggota tampil sebagai tidak tersedia dengan pesan galatnya, sementara matriks peran tetap tampil. Membuat token butuh sesi login manusia; membuat service account butuh sesi dan kapabilitas manage_integrations.",
    next: "Selesai. Untuk memeriksa hasil pekerjaan, kembali ke Audit Center dan Monitor Eksekusi."
  }
];

export default function TutorialPage() {
  return (
    <>
      <section className="mkt-hero" aria-labelledby="tutorial-title">
        <div className="mkt-wrap">
          <p className="mkt-kicker">Panduan · Sepuluh langkah</p>
          <h1 className="mkt-h1" id="tutorial-title">
            <span>Tutor</span>
            <span className="mkt-h1__accent">Sepuluh langkah dengan rute aslinya</span>
          </h1>
          <p className="mkt-lead">
            Setiap langkah di bawah menunjuk rute yang benar-benar ada dan menyebut label tombol seperti
            yang tercetak di aplikasi. Urutannya mengikuti alur kerja nyata: masuk, membaca ringkasan,
            menyusun rencana, memutus, mengeksekusi, lalu memeriksa jejaknya.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/overview">
              Buka dashboard
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/login">
              Halaman masuk
            </Link>
          </div>

          <div className="mkt-principle">
            <span className="mkt-principle__label">Sebelum mulai</span>
            <p className="mkt-principle__text">
              Langkah pertama di luar workspace, sembilan sisanya di dalamnya.
            </p>
            <p className="mkt-principle__note">
              Halaman aplikasi membaca API. Kalau backend tidak merespons, bagian datanya tampil sebagai
              tidak tersedia beserta pesan galatnya, bukan sebagai daftar kosong.
            </p>
          </div>
        </div>
      </section>

      <section className="mkt-sec" aria-labelledby="daftar-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              01
            </span>
            <h2 className="mkt-h2" id="daftar-title">
              Daftar langkah
            </h2>
            <p className="mkt-sec__lead">
              Sepuluh tujuan berurutan. Tiap tautan melompat ke langkahnya di bawah.
            </p>
          </div>

          <ol className="tut-toc">
            {STEPS.map((step) => (
              <li key={step.n}>
                <a href={`#langkah-${Number(step.n)}`}>
                  <span className="tut-toc__num" aria-hidden="true">
                    {step.n}
                  </span>
                  <span>{step.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-sec mkt-sec--tint" aria-labelledby="langkah-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              02
            </span>
            <h2 className="mkt-h2" id="langkah-title">
              Langkah demi langkah
            </h2>
            <p className="mkt-sec__lead">
              Untuk tiap langkah: apa yang dilakukan, apa yang akan terlihat, dan ke mana setelahnya.
              Prasyarat disebut lebih dulu kalau sebuah langkah bisa ditolak backend.
            </p>
          </div>

          <ol className="tut-steps">
            {STEPS.map((step) => (
              <li className="tut-step" id={`langkah-${Number(step.n)}`} key={step.n}>
                <span className="tut-step__num" aria-hidden="true">
                  {step.n}
                </span>
                <div className="tut-step__body">
                  <div className="tut-step__head">
                    <h3 className="tut-step__title">{step.title}</h3>
                    {step.routes.map((route) => (
                      <Link className="tut-step__route" href={route.href} key={route.href}>
                        {route.label}
                      </Link>
                    ))}
                  </div>

                  {step.prereq ? (
                    <div className="tut-req">
                      <span className="tut-req__label">Prasyarat</span>
                      <p>{step.prereq}</p>
                    </div>
                  ) : null}

                  <dl className="tut-step__rows">
                    <div className="tut-step__row">
                      <dt className="tut-step__label">Lakukan</dt>
                      <dd className="tut-step__value">{step.do}</dd>
                    </div>
                    <div className="tut-step__row">
                      <dt className="tut-step__label">Terlihat</dt>
                      <dd className="tut-step__value">{step.see}</dd>
                    </div>
                    <div className="tut-step__row">
                      <dt className="tut-step__label">Lanjut</dt>
                      <dd className="tut-step__value">{step.next}</dd>
                    </div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mkt-cta" aria-labelledby="tutorial-cta-title">
        <div className="mkt-wrap">
          <h2 className="mkt-cta__text" id="tutorial-cta-title">
            Mulai dari Overview
          </h2>
          <p className="mkt-cta__lead">
            Ringkasan di sana menunjukkan apa yang menunggu keputusan Anda. Kalau yang dicari adalah
            penjelasan peran dan batas wewenangnya, buka Tim AI Worker.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/overview">
              Buka dashboard
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/team">
              Tim AI Worker
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
