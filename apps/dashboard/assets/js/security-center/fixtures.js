/* DEXTRA P12 — data contoh (DEMO).
 *
 * Semua yang ada di sini adalah contoh tertulis, BUKAN hasil server dan BUKAN
 * hasil audit nyata. Endpoint keamanan ada di backend v2 (router
 * security_center, backend/dextra/main.py:67 — GET /api/v1/security/overview,
 * /events, /login-history, /sessions, /tokens, /service-identities,
 * /mfa-status); jembatan security-center/api.js probe-aware memakai endpoint
 * itu bila live. Data ini hanya dipakai saat mode demo (backend tak
 * tercapai). Tidak ada kredensial, host, atau rahasia di berkas ini.
 */
(function () {
  'use strict';

  /* ---------- Peristiwa keamanan (12, campuran severity) ---------- */
  var events = [
    { id: 'evt_p12_001', type: 'auth.login_failed', severity: 'medium', actor: 'user_004', tenant: 'org_kenari',
      target: 'auth:login', at: '2026-11-03T08:12:44+07:00',
      metadata: { identifier: 'dimas.a@kenari.example', ip: '103.147.8.21', reason: 'invalid_password', attempts: 3 },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_002', type: 'auth.login_failed', severity: 'high', actor: 'unknown', tenant: 'org_kenari',
      target: 'auth:login', at: '2026-11-03T09:47:02+07:00',
      metadata: { identifier: 'admin@kenari.example', ip: '185.220.14.9', reason: 'unknown_account', attempts: 11 },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_003', type: 'auth.mfa_verified', severity: 'info', actor: 'user_002', tenant: 'org_kenari',
      target: 'auth:mfa', at: '2026-11-03T10:02:18+07:00',
      metadata: { method: 'totp', ip: '36.85.120.14', device: 'MacBook Pro · Chrome' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_004', type: 'access.denied', severity: 'medium', actor: 'user_001', tenant: 'org_kenari',
      target: 'mandate:mnd_118', at: '2026-11-03T11:26:37+07:00',
      metadata: { action: 'execute', reason: 'missing_capability', resource: 'mandate:mnd_118' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_005', type: 'token.revoked', severity: 'low', actor: 'user_002', tenant: 'org_kenari',
      target: 'token:tok_ci_old', at: '2026-11-03T13:15:09+07:00',
      metadata: { tokenName: 'ci-deploy-legacy', reason: 'rotation', revokedBy: 'user_002' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_006', type: 'approval.rejected', severity: 'medium', actor: 'user_003', tenant: 'org_kenari',
      target: 'approval:apr_552', at: '2026-11-03T14:48:51+07:00',
      metadata: { planId: 'plan_204', reasonCode: 'scope_exceeded', approver: 'user_003' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_007', type: 'access.denied', severity: 'high', actor: 'svc-report-export', tenant: 'org_kenari',
      target: 'report:finance-q3', at: '2026-11-03T16:03:27+07:00',
      metadata: { action: 'export', reason: 'scope_not_granted', resource: 'report:finance-q3' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_008', type: 'audit.integrity_checked', severity: 'info', actor: 'system', tenant: 'org_kenari',
      target: 'audit:chain', at: '2026-11-03T17:30:00+07:00',
      metadata: { verified: 1042, checkpoint: 'matches', malformedRows: 0 },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_009', type: 'service_account.disabled', severity: 'high', actor: 'user_002', tenant: 'org_kenari',
      target: 'svc:svc-legacy-sync', at: '2026-11-04T08:05:12+07:00',
      metadata: { serviceAccount: 'svc-legacy-sync', reason: 'unused_90d', disabledBy: 'user_002' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_010', type: 'auth.login_failed', severity: 'low', actor: 'user_005', tenant: 'org_kenari',
      target: 'auth:login', at: '2026-11-04T09:20:40+07:00',
      metadata: { identifier: 'lestari.h@kenari.example', ip: '36.85.120.77', reason: 'mfa_timeout', attempts: 1 },
      integrityStatus: 'unverified', source: 'demo fixture' },
    { id: 'evt_p12_011', type: 'access.denied', severity: 'medium', actor: 'user_004', tenant: 'org_kenari',
      target: 'settings:integrations', at: '2026-11-04T10:41:19+07:00',
      metadata: { action: 'update', reason: 'missing_capability', resource: 'settings:integrations' },
      integrityStatus: 'verified', source: 'demo fixture' },
    { id: 'evt_p12_012', type: 'audit.integrity_checked', severity: 'critical', actor: 'system', tenant: 'org_kenari',
      target: 'audit:chain', at: '2026-11-04T11:00:00+07:00',
      metadata: { verified: 0, checkpoint: 'head_mismatch', malformedRows: 0, note: 'contoh skenario gagal — bukan kejadian nyata' },
      integrityStatus: 'unverified', source: 'demo fixture' }
  ];

  /* ---------- Aktivitas login (5) ---------- */
  var loginActivity = [
    { id: 'login_001', identifier: 'farhan.p@kenari.example', result: 'success', ip: '36.85.120.14',
      userAgent: 'MacBook Pro · Chrome 130', at: '2026-11-04T07:58:11+07:00', reason: null, tenant: 'org_kenari' },
    { id: 'login_002', identifier: 'sari.w@kenari.example', result: 'success', ip: '36.85.120.14',
      userAgent: 'MacBook Pro · Chrome 130', at: '2026-11-04T08:31:47+07:00', reason: null, tenant: 'org_kenari' },
    { id: 'login_003', identifier: 'dimas.a@kenari.example', result: 'failed', ip: '103.147.8.21',
      userAgent: 'Windows 11 · Firefox 132', at: '2026-11-03T08:12:44+07:00', reason: 'invalid_password', tenant: 'org_kenari' },
    { id: 'login_004', identifier: 'admin@kenari.example', result: 'blocked', ip: '185.220.14.9',
      userAgent: 'Unknown · curl/8.5.0', at: '2026-11-03T09:47:02+07:00', reason: 'unknown_account', tenant: 'org_kenari' },
    { id: 'login_005', identifier: 'lestari.h@kenari.example', result: 'failed', ip: '36.85.120.77',
      userAgent: 'Android 15 · Chrome Mobile', at: '2026-11-04T09:20:40+07:00', reason: 'mfa_timeout', tenant: 'org_kenari' }
  ];

  /* ---------- Sesi aktif (3; satu ditandai current) ---------- */
  var sessions = [
    { id: 'sess_001', userId: 'user_002', displayName: 'Sari Wulandari', device: 'MacBook Pro · Chrome 130',
      ip: '36.85.120.14', lastSeenAt: '2026-11-04T10:52:03+07:00', current: true,
      createdAt: '2026-11-04T08:31:47+07:00', status: 'active' },
    { id: 'sess_002', userId: 'user_002', displayName: 'Sari Wulandari', device: 'iPhone 15 · DEXTRA Mobile',
      ip: '36.85.120.77', lastSeenAt: '2026-11-04T07:12:30+07:00', current: false,
      createdAt: '2026-11-02T18:20:00+07:00', status: 'active' },
    { id: 'sess_003', userId: 'user_001', displayName: 'Farhan Pratama', device: 'Windows 11 · Edge 130',
      ip: '103.147.8.44', lastSeenAt: '2026-11-03T22:14:55+07:00', current: false,
      createdAt: '2026-11-03T13:05:26+07:00', status: 'active' }
  ];

  /* ---------- Cakupan MFA ---------- */
  var mfaStatus = [
    { userId: 'user_001', displayName: 'Farhan Pratama', enrolled: true, method: 'totp', lastVerifiedAt: '2026-11-04T07:58:20+07:00', state: 'ok' },
    { userId: 'user_002', displayName: 'Sari Wulandari', enrolled: true, method: 'webauthn', lastVerifiedAt: '2026-11-04T08:32:01+07:00', state: 'ok' },
    { userId: 'user_003', displayName: 'Rina Kusuma', enrolled: true, method: 'totp', lastVerifiedAt: '2026-11-03T16:20:44+07:00', state: 'ok' },
    { userId: 'user_004', displayName: 'Dimas Aryo', enrolled: false, method: null, lastVerifiedAt: null, state: 'missing' },
    { userId: 'user_005', displayName: 'Lestari Handayani', enrolled: true, method: 'sms', lastVerifiedAt: '2026-10-28T09:00:00+07:00', state: 'pending' }
  ];

  /* ---------- Inventaris token API (ringkas) ---------- */
  var tokenInventory = [
    { id: 'tok_001', name: 'ci-deploy-prod', owner: 'user_001', scopes: ['deploy:write', 'audit:read'],
      createdAt: '2026-08-14T10:00:00+07:00', expiresAt: '2026-11-30T10:00:00+07:00', lastUsedAt: '2026-11-04T06:00:00+07:00',
      status: 'expiring', rotationDue: true },
    { id: 'tok_002', name: 'report-readonly', owner: 'user_003', scopes: ['reports:read'],
      createdAt: '2026-09-02T09:00:00+07:00', expiresAt: '2027-03-02T09:00:00+07:00', lastUsedAt: '2026-11-03T17:45:12+07:00',
      status: 'active', rotationDue: false },
    { id: 'tok_003', name: 'ci-deploy-legacy', owner: 'user_001', scopes: ['deploy:write'],
      createdAt: '2026-03-11T09:00:00+07:00', expiresAt: '2026-10-11T09:00:00+07:00', lastUsedAt: '2026-10-02T11:30:00+07:00',
      status: 'revoked', rotationDue: false },
    { id: 'tok_004', name: 'backup-verify', owner: 'system', scopes: ['audit:read'],
      createdAt: '2026-05-20T09:00:00+07:00', expiresAt: '2026-11-10T09:00:00+07:00', lastUsedAt: null,
      status: 'expiring', rotationDue: true },
    { id: 'tok_005', name: 'integration-erp', owner: 'user_002', scopes: ['integrations:read', 'integrations:write'],
      createdAt: '2026-10-01T09:00:00+07:00', expiresAt: '2027-04-01T09:00:00+07:00', lastUsedAt: '2026-11-04T09:12:00+07:00',
      status: 'active', rotationDue: false }
  ];

  /* ---------- Inventaris identitas layanan (ringkas) ---------- */
  var serviceIdentities = [
    { id: 'svc_001', name: 'svc-billing-sync', purpose: 'Sinkronisasi tagihan ke ERP', scopes: ['billing:read', 'billing:write'],
      createdAt: '2026-07-01T09:00:00+07:00', lastUsedAt: '2026-11-04T05:30:00+07:00', status: 'active', rotationDue: false },
    { id: 'svc_002', name: 'svc-report-export', purpose: 'Ekspor laporan terjadwal', scopes: ['reports:read'],
      createdAt: '2026-06-12T09:00:00+07:00', lastUsedAt: '2026-11-03T16:03:27+07:00', status: 'review', rotationDue: true },
    { id: 'svc_003', name: 'svc-legacy-sync', purpose: 'Sinkronisasi data lama (nonaktif)', scopes: ['data:read'],
      createdAt: '2026-01-20T09:00:00+07:00', lastUsedAt: '2026-08-02T10:00:00+07:00', status: 'disabled', rotationDue: false },
    { id: 'svc_004', name: 'svc-audit-anchor', purpose: 'Penambatan rantai hash audit', scopes: ['audit:anchor'],
      createdAt: '2026-09-15T09:00:00+07:00', lastUsedAt: '2026-11-04T11:00:00+07:00', status: 'active', rotationDue: false }
  ];

  /* ---------- Access denied (turunan dari events + ringkas) ---------- */
  var accessDenied = events
    .filter(function (e) { return e.type === 'access.denied'; })
    .map(function (e) {
      return {
        id: e.id.replace('evt_', 'den_'),
        at: e.at,
        actor: e.actor,
        tenant: e.tenant,
        resource: e.metadata.resource || e.target,
        action: e.metadata.action || 'unknown',
        reason: e.metadata.reason || 'unknown',
        severity: e.severity === 'high' ? 'high' : (e.severity === 'low' ? 'low' : 'medium')
      };
    });

  /* ---------- Ringkasan (dihitung dari events DEMO, bukan dari server) ---------- */
  function countBy(list, pred) { return list.filter(pred).length; }
  var overview = {
    counts: {
      loginFailed: countBy(events, function (e) { return e.type === 'auth.login_failed'; }),
      accessDenied: countBy(events, function (e) { return e.type === 'access.denied'; }),
      activeSessions: sessions.filter(function (s) { return s.status === 'active'; }).length,
      tokensExpiringOrRotationDue: tokenInventory.filter(function (t) { return t.status === 'expiring' || t.rotationDue; }).length,
      mfaEnrolled: mfaStatus.filter(function (m) { return m.enrolled; }).length,
      mfaTotal: mfaStatus.length,
      serviceIdentitiesActive: serviceIdentities.filter(function (s) { return s.status === 'active'; }).length,
      serviceIdentitiesTotal: serviceIdentities.length,
      eventsTotal: events.length,
      criticalEvents: countBy(events, function (e) { return e.severity === 'critical'; })
    },
    demo: true,
    source: 'fixture DEMO di peramban — dihitung dari 12 peristiwa contoh, bukan dari server',
    generatedAt: '2026-11-04T12:00:00+07:00'
  };

  window.DEXTRA_P12_FIXTURES = {
    demo: true,
    generatedAt: '2026-11-04T12:00:00+07:00',
    overview: overview,
    events: events,
    loginActivity: loginActivity,
    sessions: sessions,
    mfaStatus: mfaStatus,
    tokenInventory: tokenInventory,
    serviceIdentities: serviceIdentities,
    accessDenied: accessDenied,
    accessDeniedTrend: [
      { label: '28 Okt', value: 1 },
      { label: '29 Okt', value: 2 },
      { label: '30 Okt', value: 0 },
      { label: '31 Okt', value: 3 },
      { label: '1 Nov', value: 2 },
      { label: '2 Nov', value: 1 },
      { label: '3 Nov', value: 2 },
      { label: '4 Nov', value: 1 }
    ]
  };
})();
