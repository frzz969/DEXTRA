import { Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Settings</h1>
          <p>Konfigurasi sistem DEXTRA. Perubahan sensitif wajib lewat API resmi dengan permission yang berlaku.</p>
        </div>
      </header>
      <Unavailable
        title="Pengaturan sistem"
        error="Belum ada endpoint konfigurasi sistem di backend. Halaman ini tidak menampilkan pengaturan contoh — tambahkan endpoint resmi sebelum UI bisa menampilkan dan mengubah konfigurasi nyata."
      />
    </>
  );
}
