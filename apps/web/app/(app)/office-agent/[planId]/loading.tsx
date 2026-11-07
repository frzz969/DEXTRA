import { LoadingSkeleton } from "@/components/states";

/**
 * Keadaan "memuat" untuk rute detail rencana. Next menampilkannya saat server
 * component masih menunggu API — jadi tidak ada panel kosong yang sempat
 * berkedip seolah rencananya tidak punya isi.
 */
export default function Loading() {
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Memuat rencana…</h1>
          <p>Mengambil lingkup tindakan, temuan, eksekusi, dan jejak audit dari API.</p>
        </div>
      </header>
      <div className="grid grid--sidebar">
        <div className="stack">
          <LoadingSkeleton lines={4} />
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
        <div className="stack">
          <LoadingSkeleton lines={2} />
          <LoadingSkeleton lines={4} />
        </div>
      </div>
    </>
  );
}
