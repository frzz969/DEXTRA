/* DEXTRA P11 — data contoh (DEMO).
 *
 * Semua yang ada di sini adalah contoh tertulis, bukan hasil server. Tidak ada
 * endpoint P11 di MCP server maupun FastAPI; daftar ini hanya untuk mengisi
 * layar yang diberi label DEMO. Tidak ada kredensial, host, atau rahasia.
 * Semua prefix berawalan `dx_svc_demo_` dan bukan kredensial asli.
 * Tidak ada plaintext di berkas ini; satu-satunya plaintext muncul saat
 * rotasi DEMO dan hanya hidup di memori layar (tidak pernah ditulis ke sini).
 */
(function () {
  'use strict';

  var identities = [
    {
      id: 'svc_001',
      name: 'executive-assistant-worker',
      kind: 'worker',
      description: 'Worker asisten eksekutif: merangkum email masuk dan menyiapkan draf balasan untuk ditinjau manusia.',
      tenantId: 'org_kenari',
      tenantBinding: 'org_kenari',
      scopes: ['view_own', 'create_request'],
      permissions: ['view_own', 'create_request'],
      status: 'active',
      owner: 'farhan.pratama@kenari.co.id',
      createdAt: '2026-09-10T09:00:00+07:00',
      updatedAt: '2026-10-28T17:45:00+07:00',
      lastUsedAt: '2026-11-04T06:12:00+07:00',
      rotatedFromId: null,
      securityNotes: 'Akses baca terbatas pada kotak surat bersama; tidak boleh menyetujui atau mengeksekusi apa pun tanpa tinjauan manusia. Rotasi setiap 90 hari.',
      credentials: [
        { id: 'cred_001a', accountId: 'svc_001', label: 'Kredensial utama', prefix: 'dx_svc_demo_ea01', status: 'active', createdAt: '2026-09-10T09:00:00+07:00', expiresAt: '2027-03-10T09:00:00+07:00', lastUsedAt: '2026-11-04T06:12:00+07:00', revokedAt: null, rotatedFromId: null }
      ]
    },
    {
      id: 'svc_002',
      name: 'mcp-gateway',
      kind: 'mcp',
      description: 'Gerbang MCP lokal: meneruskan permintaan alat dari dashboard ke server MCP dengan konteks tenant terikat.',
      tenantId: 'org_kenari',
      tenantBinding: 'org_kenari',
      scopes: ['view_all', 'view_audit', 'create_request'],
      permissions: ['view_all', 'view_audit', 'create_request'],
      status: 'active',
      owner: 'maya.lestari@kenari.co.id',
      createdAt: '2026-08-01T10:00:00+07:00',
      updatedAt: '2026-10-28T17:45:00+07:00',
      lastUsedAt: '2026-11-04T08:30:00+07:00',
      rotatedFromId: null,
      securityNotes: 'Satu-satunya jalur alat MCP dari dashboard. Wajib view_audit; setiap panggilan dicatat di audit trail. Jangan diberikan scope approve atau execute.',
      credentials: [
        { id: 'cred_002a', accountId: 'svc_002', label: 'Kredensial gateway', prefix: 'dx_svc_demo_mcp2', status: 'active', createdAt: '2026-10-28T17:45:00+07:00', expiresAt: '2027-04-28T17:45:00+07:00', lastUsedAt: '2026-11-04T08:30:00+07:00', revokedAt: null, rotatedFromId: 'cred_000' }
      ]
    },
    {
      id: 'svc_003',
      name: 'audit-exporter',
      kind: 'integration',
      description: 'Ekspor audit trail terjadwal ke arsip kepatuhan (read-only) setiap malam.',
      tenantId: 'org_kenari',
      tenantBinding: 'org_kenari',
      scopes: ['view_audit', 'export_audit'],
      permissions: ['view_audit', 'export_audit'],
      status: 'expiring',
      owner: 'rina.kusuma@kenari.co.id',
      createdAt: '2026-08-18T13:30:00+07:00',
      updatedAt: '2026-10-30T16:40:00+07:00',
      lastUsedAt: '2026-10-30T16:40:00+07:00',
      rotatedFromId: null,
      securityNotes: 'Hanya baca audit; tanpa wewenang tulis. Kedaluwarsa 2026-11-18 — rotasi sebelum tanggal tersebut atau ekspor malam berhenti.',
      credentials: [
        { id: 'cred_003a', accountId: 'svc_003', label: 'Kredensial ekspor', prefix: 'dx_svc_demo_aud3', status: 'expiring', createdAt: '2026-08-01T10:00:00+07:00', expiresAt: '2026-11-18T10:00:00+07:00', lastUsedAt: '2026-10-30T16:40:00+07:00', revokedAt: null, rotatedFromId: null }
      ]
    },
    {
      id: 'svc_004',
      name: 'telegram-adapter',
      kind: 'integration',
      description: 'Adapter notifikasi Telegram untuk peringatan mandat; dinonaktifkan karena kanal migrasi ke email digest.',
      tenantId: 'org_kenari',
      tenantBinding: 'org_kenari',
      scopes: ['view_own'],
      permissions: ['view_own'],
      status: 'disabled',
      owner: 'dimas.aryo@kenari.co.id',
      createdAt: '2026-06-12T08:00:00+07:00',
      updatedAt: '2026-10-02T09:00:00+07:00',
      lastUsedAt: '2026-09-28T11:22:00+07:00',
      rotatedFromId: null,
      securityNotes: 'Dinonaktifkan 2026-10-02. Kredensial ikut dicabut. Jangan diaktifkan kembali tanpa tinjauan keamanan dan persetujuan pemilik tenant.',
      credentials: [
        { id: 'cred_004a', accountId: 'svc_004', label: 'Kredensial adapter', prefix: 'dx_svc_demo_tg04', status: 'revoked', createdAt: '2026-06-12T08:00:00+07:00', expiresAt: '2026-12-12T08:00:00+07:00', lastUsedAt: '2026-09-28T11:22:00+07:00', revokedAt: '2026-10-02T09:00:00+07:00', rotatedFromId: null }
      ]
    },
    {
      id: 'svc_005',
      name: 'invoice-ocr-worker',
      kind: 'worker',
      description: 'Worker OCR faktur: mengekstraksi nomor, tanggal, dan nominal untuk draf pencatatan; selalu ditinjau manusia.',
      tenantId: 'org_kenari',
      tenantBinding: 'org_kenari',
      scopes: ['view_own', 'create_request'],
      permissions: ['view_own', 'create_request'],
      status: 'active',
      owner: 'sari.wulandari@kenari.co.id',
      createdAt: '2026-10-05T15:20:00+07:00',
      updatedAt: '2026-10-05T15:20:00+07:00',
      lastUsedAt: null,
      rotatedFromId: null,
      securityNotes: 'Belum pernah dipakai (lastUsedAt null). Pantau pemakaian 30 hari pertama; bila tetap tidak terpakai, nonaktifkan. Hasil OCR bukan keputusan keuangan.',
      credentials: [
        { id: 'cred_005a', accountId: 'svc_005', label: 'Kredensial worker', prefix: 'dx_svc_demo_ocr5', status: 'active', createdAt: '2026-10-05T15:20:00+07:00', expiresAt: '2027-10-05T15:20:00+07:00', lastUsedAt: null, revokedAt: null, rotatedFromId: null }
      ]
    },
    {
      id: 'svc_006',
      name: 'demo-ci-bot',
      kind: 'agent',
      description: 'Bot CI contoh untuk pipeline demo; dicabut permanen setelah kebocoran konfigurasi contoh (tidak ada data nyata).',
      tenantId: 'org_kenari',
      tenantBinding: 'org_kenari',
      scopes: ['create_request'],
      permissions: ['create_request'],
      status: 'revoked',
      owner: 'maya.lestari@kenari.co.id',
      createdAt: '2026-07-01T09:00:00+07:00',
      updatedAt: '2026-10-15T14:00:00+07:00',
      lastUsedAt: '2026-10-10T22:05:00+07:00',
      rotatedFromId: null,
      securityNotes: 'DICABUT PERMANEN 2026-10-15. Tidak dapat diaktifkan kembali; buat akun baru bila pipeline demo dihidupkan lagi.',
      credentials: [
        { id: 'cred_006a', accountId: 'svc_006', label: 'Kredensial CI', prefix: 'dx_svc_demo_ci06', status: 'revoked', createdAt: '2026-07-01T09:00:00+07:00', expiresAt: '2027-01-01T09:00:00+07:00', lastUsedAt: '2026-10-10T22:05:00+07:00', revokedAt: '2026-10-15T14:00:00+07:00', rotatedFromId: null }
      ]
    }
  ];

  window.DEXTRA_P11_FIXTURES = {
    demo: true,
    generatedAt: '2026-11-04T00:00:00+07:00',
    tenant: { id: 'org_kenari', name: 'Kenari Group', slug: 'kenari' },
    identities: identities
  };
})();
