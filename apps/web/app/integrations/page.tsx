import { Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>Integrations</h1>
          <p>Status konektor eksternal (email, kalender, dokumen, Telegram, WhatsApp) lewat integration layer DEXTRA.</p>
        </div>
      </header>
      <Unavailable
        title="Status konektor"
        error="Belum ada endpoint status konektor di backend. Halaman ini tidak menampilkan status contoh — integrasi perlu endpoint status resmi sebelum UI bisa menampilkan koneksi nyata."
      />
    </>
  );
}
