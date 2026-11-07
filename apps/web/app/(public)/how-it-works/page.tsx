import { Fragment } from "react";
import Link from "next/link";
import "./how-it-works.css";

export const metadata = {
  title: "Cara Kerja — DEXTRA",
  description:
    "Satu tindakan di DEXTRA melewati tujuh langkah: permintaan, rencana, validasi kebijakan, mandat, persetujuan manusia, eksekusi, dan jejak audit. Setiap langkah menunjuk rute tempat Anda bisa memeriksanya."
};

/* Tiga keadaan yang sering dianggap sinonim. Bedanya bukan istilah, melainkan
 * siapa yang memutuskan di antara keduanya. */
const KEADAAN = [
  {
    label: "Direncanakan",
    title: "Rencana yang bisa diperiksa",
    text: "Rencana menyebut penerima, isi, jadwal, dan risiko, lalu diberi sidik plan_hash. Sampai di sini belum ada satu pun kondisi di luar DEXTRA yang berubah."
  },
  {
    label: "Disetujui",
    title: "Keputusan manusia atas satu rencana",
    text: "Persetujuan dan mandat terikat pada plan_hash yang sama. Kalau isi rencana berubah, sidiknya ikut berubah, dan izin yang lama tidak lagi cocok dengan rencana itu."
  },
  {
    label: "Terkirim",
    title: "Hasil yang tercatat, bukan yang diasumsikan",
    text: "Terkirim berarti executor sudah menjalankan tindakan dan hasilnya tercatat. Untuk email dan kalender, hasilnya berkas di data/outbox, bukan panggilan ke server eksternal."
  }
];

/* Tujuh langkah satu tindakan. gate menandai langkah yang bisa menghentikan
 * alur. stop hanya diisi untuk langkah yang punya kondisi berhenti yang
 * benar-benar diperiksa sistem, bukan untuk semua langkah. */
type Langkah = {
  title: string;
  body: string;
  gate?: boolean;
  stop?: string;
  routes: Array<{ href: string; label: string }>;
};

const LANGKAH: Langkah[] = [
  {
    title: "Permintaan masuk",
    body: "Manusia menulis permintaan dalam bahasa biasa: apa yang perlu dilakukan dan untuk siapa. Belum ada rencana dan belum ada izin, jadi tidak ada yang bisa dijalankan dari titik ini.",
    routes: [
      { href: "/requests", label: "Requests" },
      { href: "/office-agent", label: "Office Agent" }
    ]
  },
  {
    title: "Rencana disusun",
    body: "AI Worker mengubah permintaan menjadi rencana yang eksplisit: penerima, isi, jadwal, dan risiko yang mungkin timbul. Rencana diberi sidik plan_hash supaya versi yang disetujui tidak bisa tertukar dengan versi lain.",
    routes: [{ href: "/office-agent", label: "Office Agent" }]
  },
  {
    gate: true,
    title: "Validasi kebijakan",
    body: "Setiap tindakan diperiksa terhadap policy yang aktif: jenis tindakan, target, jadwal, dan isi. Temuan dengan tingkat blocking membuat rencana tidak bisa disetujui.",
    stop: "Berhenti di sini kalau ada temuan blocking. Alasannya ditampilkan tertulis, bukan disimpulkan dari warna tombol.",
    routes: [
      { href: "/policies", label: "Policies" },
      { href: "/review", label: "Review & Validation" }
    ]
  },
  {
    gate: true,
    title: "Mandat",
    body: "Wewenang diberikan sebagai objek tersendiri: cakupan tindakan, masa berlaku, dan terikat pada plan_hash. Mandat bisa dicabut sebelum eksekusi dijalankan.",
    stop: "Berhenti di sini kalau mandat dicabut atau masa berlakunya habis. Mandat yang sudah dipakai juga tidak bisa dipakai lagi untuk tindakan berikutnya.",
    routes: [{ href: "/mandates", label: "Mandates" }]
  },
  {
    gate: true,
    title: "Persetujuan manusia",
    body: "Di Approval Inbox, manusia memutuskan: setujui, tolak, atau minta revisi. Tombol setujui dinonaktifkan dengan alasan tertulis saat rencana terblokir, bukan disembunyikan.",
    stop: "Berhenti di sini kalau ditolak. Tidak ada eksekusi, dan tidak ada pengiriman susulan yang berjalan sendiri.",
    routes: [{ href: "/approvals", label: "Approval Inbox" }]
  },
  {
    title: "Eksekusi",
    body: "Executor menjalankan tindakan sesuai cakupan mandat, tidak lebih luas dari itu. Hasilnya, termasuk kegagalan dan alasan blokir, tercatat di Executions.",
    routes: [{ href: "/executions", label: "Executions" }]
  },
  {
    title: "Jejak audit",
    body: "Setiap langkah ditulis berurutan dengan hash entri. Tidak ada tombol ubah atau hapus di Audit Trail, dan endpoint yang menyediakannya juga tidak ada.",
    routes: [{ href: "/audit", label: "Audit Trail" }]
  }
];

/* Yang tersisa setelah eksekusi selesai. Ini bagian yang biasanya hilang dari
 * penjelasan alur: orang berhenti di kata "terkirim". */
const SISA = [
  {
    term: "Catatan eksekusi",
    body: "Status, adapter yang dipakai, dan alasan bila gagal atau diblokir. Riwayatnya ada di Executions, dan bisa difilter menurut status.",
    href: "/executions",
    label: "Executions"
  },
  {
    term: "Berkas di outbox",
    body: "Untuk email dan kalender, hasil eksekusi berupa berkas .eml dan .ics di data/outbox. Tidak ada server email atau kalender eksternal yang dihubungi.",
    href: "/integrations",
    label: "Integrations"
  },
  {
    term: "Entri audit",
    body: "Langkah yang sama muncul di Audit Trail dengan hash entri, berurutan setelah langkah sebelumnya, dan bisa diverifikasi ulang bersama rantainya.",
    href: "/audit",
    label: "Audit Trail"
  }
];

export default function HowItWorksPage() {
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="mkt-hero" aria-labelledby="how-title">
        <div className="mkt-wrap">
          <p className="mkt-kicker">Cara Kerja</p>
          <h1 className="mkt-h1" id="how-title">
            <span>Tujuh langkah dari permintaan</span>
            <span>sampai jejak audit.</span>
            <span className="mkt-h1__accent">Tidak ada yang bisa dilewati.</span>
          </h1>
          <p className="mkt-lead">
            Halaman ini mengikuti satu tindakan dari permintaan masuk sampai entri audit. Tiga dari tujuh
            langkah itu adalah gerbang yang bisa menghentikan tindakan, dan langkah terakhir memastikan
            apa pun yang terjadi sudah tercatat sebelum Anda bertanya.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/approvals">
              Approval Inbox
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/about">
              Tentang DEXTRA
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- 01 Tiga keadaan ---------- */}
      <section className="mkt-sec" aria-labelledby="keadaan-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              01
            </span>
            <h2 className="mkt-h2" id="keadaan-title">
              Direncanakan, disetujui, dan terkirim bukan tiga kata untuk hal yang sama
            </h2>
            <p className="mkt-sec__lead">
              Sebagian besar kebingungan soal agen AI muncul karena ketiga keadaan ini disebut bergantian.
              Di DEXTRA ketiganya adalah titik berbeda, dengan pemutus yang berbeda.
            </p>
          </div>

          <div className="mkt-chain how-chain">
            <span className="mkt-chain__step">Direncanakan</span>
            <span className="mkt-chain__sep" aria-hidden="true">
              →
            </span>
            <span className="mkt-chain__step">Disetujui</span>
            <span className="mkt-chain__sep" aria-hidden="true">
              →
            </span>
            <span className="mkt-chain__step">Terkirim</span>
          </div>
          <p className="how-chain__note">
            Panah di antaranya adalah gerbang yang bisa berhenti, bukan perpindahan otomatis.
          </p>

          <div className="how-terms">
            {KEADAAN.map((item) => (
              <div className="how-term" key={item.label}>
                <p className="how-term__label">{item.label}</p>
                <h3 className="how-term__title">{item.title}</h3>
                <p className="how-term__text">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 02 Tujuh langkah ---------- */}
      <section className="mkt-sec" aria-labelledby="langkah-title">
        <div className="mkt-wrap">
          <div className="mkt-head">
            <span className="mkt-sec__index" aria-hidden="true">
              02
            </span>
            <h2 className="mkt-h2" id="langkah-title">
              Tujuh langkah, dan tiga di antaranya bisa menghentikan alur
            </h2>
            <p className="mkt-sec__lead">
              Langkah bertanda gerbang wewenang punya kondisi berhenti yang diperiksa sistem, bukan
              sekadar dicatat. Setiap langkah menunjuk halaman tempat kejadiannya bisa Anda lihat.
            </p>
          </div>

          <ol className="how-steps">
            {LANGKAH.map((step, index) => (
              <li className={`how-step${step.gate ? " how-step--gate" : ""}`} key={step.title}>
                <span className="how-step__index" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="how-step__body">
                  {step.gate ? <p className="how-step__gate">Gerbang wewenang</p> : null}
                  <h3 className="how-step__title">{step.title}</h3>
                  <p className="how-step__text">{step.body}</p>
                  {step.stop ? (
                    <p className="how-step__stop">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        block
                      </span>
                      <span>{step.stop}</span>
                    </p>
                  ) : null}
                  <p className="how-step__routes">
                    <span className="how-step__routes-label">Rute</span>
                    {step.routes.map((route, routeIndex) => (
                      <Fragment key={route.href}>
                        {routeIndex > 0 ? (
                          <span className="how-step__routes-sep" aria-hidden="true">
                            ·
                          </span>
                        ) : null}
                        <Link className="how-link" href={route.href}>
                          {route.label}
                        </Link>
                      </Fragment>
                    ))}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mkt-note">
            <h3 className="mkt-h3">Tidak ada jalur pintas antara rencana dan eksekusi</h3>
            <p>
              Executor tidak menerima rencana. Yang diterimanya adalah mandat yang terikat pada satu
              plan_hash, dan mandat itu hanya terbit setelah kebijakan selesai dievaluasi. Karena itu
              tidak ada urutan pemanggilan yang bisa melewati satu langkah pun, termasuk pemanggilan
              langsung ke endpoint eksekusi.
            </p>
            <p>
              Hal yang sama berlaku untuk catatan. Entri audit ditulis saat langkah terjadi, bukan
              dikumpulkan di akhir, jadi langkah yang gagal tetap meninggalkan jejak beserta alasannya.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 03 Setelah eksekusi ---------- */}
      <section className="mkt-sec" aria-labelledby="sisa-title">
        <div className="mkt-wrap mkt-split">
          <div className="mkt-split__head">
            <span className="mkt-sec__index" aria-hidden="true">
              03
            </span>
            <h2 className="mkt-h2" id="sisa-title">
              Yang tersisa setelah tindakan selesai
            </h2>
            <p className="mkt-sec__lead">
              Penjelasan soal agen biasanya berhenti di kata terkirim. Tiga hal berikut yang membuat
              sebuah tindakan bisa dipertanggungjawabkan setelah kejadiannya lewat.
            </p>
          </div>

          <div className="mkt-split__body">
            <dl className="mkt-defs">
              {SISA.map((item) => (
                <div key={item.term}>
                  <dt>{item.term}</dt>
                  <dd>
                    {item.body}{" "}
                    <Link className="how-link" href={item.href}>
                      {item.label}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ---------- CTA penutup ---------- */}
      <section className="mkt-cta" aria-labelledby="cta-title">
        <div className="mkt-wrap">
          <h2 className="mkt-cta__text" id="cta-title">
            Ikuti satu rencana dari awal sampai entri audit
          </h2>
          <p className="mkt-cta__lead">
            Antrean persetujuan adalah tempat alur ini paling jelas terlihat: rencana yang menunggu,
            rencana yang terblokir, dan alasan tertulis di sebelah tombol yang tidak bisa dipakai.
          </p>
          <div className="mkt-actions">
            <Link className="btn btn--primary btn--lg" href="/approvals">
              Buka Approval Inbox
            </Link>
            <Link className="btn btn--secondary btn--lg" href="/mandates">
              Lihat Mandates
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
