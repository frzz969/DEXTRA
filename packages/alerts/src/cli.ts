/**
 * Pemindai alert dari baris perintah.
 *
 *   node --experimental-strip-types packages/alerts/src/cli.ts --once
 *   node --experimental-strip-types packages/alerts/src/cli.ts --loop 60
 *
 * Env:
 *   TELEGRAM_BOT_TOKEN       — kalau kosong, transport palsu dipakai dan
 *                              setiap pengiriman ditandai `provider: 'fake'`
 *   TELEGRAM_ALERT_CHAT_ID   — tujuan. Wajib kalau token di-set.
 *
 * Keluaran sengaja berupa ringkasan angka, bukan pesan yang dikirim: pesan bisa
 * memuat id, dan id tidak perlu muncul di log terminal yang mungkin tersimpan.
 */
import { scanAndDispatch } from './scan.ts';
import { resolveTransport } from './transport.ts';

function parseArgs(argv: readonly string[]): { once: boolean; loopSeconds: number | null } {
  if (argv.includes('--once')) return { once: true, loopSeconds: null };
  const index = argv.indexOf('--loop');
  if (index >= 0) {
    const raw = argv[index + 1];
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error('--loop membutuhkan jumlah detik > 0');
    }
    return { once: false, loopSeconds: seconds };
  }
  return { once: true, loopSeconds: null };
}

async function scanOnce(): Promise<void> {
  const { transport, configured } = resolveTransport();
  const chatId = process.env.TELEGRAM_ALERT_CHAT_ID ?? '';

  if (configured && chatId.trim() === '') {
    /*
     * Token ada tetapi tujuan tidak. Mengirim ke chat id karangan akan tampak
     * berhasil di ringkasan dan gagal di dunia nyata; lebih baik berhenti dan
     * mengatakannya.
     */
    console.error('TELEGRAM_BOT_TOKEN di-set tetapi TELEGRAM_ALERT_CHAT_ID kosong: tidak ada yang dikirim.');
    process.exitCode = 1;
    return;
  }

  const result = await scanAndDispatch({
    transport,
    /* Transport palsu mengabaikan tujuan; nilai ini hanya agar bentuknya jujur. */
    chatId: chatId.trim() === '' ? 'unconfigured' : chatId,
  });

  console.log(
    [
      `provider=${result.provider}`,
      `terdeteksi=${result.detected}`,
      `diterima_provider=${result.accepted}`,
      `ditahan_duplikat=${result.suppressed}`,
      `gagal=${result.failed}`,
      `galat=${result.errored}`,
    ].join(' '),
  );

  if (!configured) {
    console.log('catatan: TELEGRAM_BOT_TOKEN tidak di-set — semua pengiriman memakai transport palsu dan tidak keluar dari proses ini.');
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.once) {
    await scanOnce();
    return;
  }

  const intervalMs = (args.loopSeconds ?? 60) * 1000;
  console.log(`pemindai alert berjalan setiap ${args.loopSeconds} detik. Ctrl+C untuk berhenti.`);
  for (;;) {
    try {
      await scanOnce();
    } catch (error) {
      /* Satu pemindaian gagal tidak boleh mematikan pemindai: justru saat ada
         masalah, alert paling dibutuhkan. */
      console.error('pemindaian gagal:', (error as Error).message);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

const isMain = process.argv[1] !== undefined && /cli\.ts$/.test(process.argv[1]);
if (isMain) {
  main().catch((error) => {
    console.error((error as Error).message);
    process.exit(1);
  });
}
