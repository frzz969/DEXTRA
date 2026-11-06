/* DEXTRA — Skill Registry: data contoh (DEMO).
 *
 * Semua yang ada di sini adalah contoh tertulis, bukan hasil server dan bukan
 * registri skill yang sebenarnya. Endpoint katalog ada di backend v2 (router
 * skills, backend/dextra/main.py:67 — GET/POST /api/v1/skills, /{slug},
 * /{slug}/versions, /{slug}/status); jembatan skills/api.js probe-aware
 * memakai endpoint itu bila live. Data ini hanya dipakai saat mode demo
 * (backend tak tercapai), bukan sebagai bukti endpoint belum ada.
 * Tidak ada kredensial, host, atau rahasia di berkas ini.
 */
(function () {
  'use strict';

  function schema(summary, required, properties) {
    return { type: 'object', summary: summary, required: required.slice(), properties: properties };
  }

  function prop(type, description) { return { type: type, description: description }; }

  function mk(cfg) {
    var versions = cfg.versions.map(function (v, i) {
      return {
        version: v[0], releasedAt: v[1], author: v[2], notes: v[3],
        state: i === 0 ? 'current' : (cfg.lifecycle === 'deprecated' ? 'deprecated' : 'previous')
      };
    });
    return {
      id: cfg.id,
      name: cfg.name,
      description: cfg.description,
      domain: cfg.domain,
      version: cfg.version,
      lifecycle: cfg.lifecycle,
      status: cfg.status,
      risk: cfg.risk,
      permissions: cfg.permissions.slice(),
      inputSchema: cfg.inputSchema,
      outputSchema: cfg.outputSchema,
      owner: cfg.owner,
      updated_at: cfg.updated_at,
      usage_count: cfg.usage_count, /* DEMO — bukan telemetri nyata */
      testStatus: cfg.testStatus,
      reviewChecklist: cfg.reviewChecklist || null,
      versions: versions,
      changelog: cfg.changelog.slice(),
      policy: cfg.policy,
      timeline: cfg.timeline.slice()
    };
  }

  function pol(o) {
    return {
      reviewRequired: o.reviewRequired !== false,
      approverRole: o.approverRole || 'governance_lead',
      dataScope: o.dataScope,
      retentionDays: o.retentionDays == null ? 90 : o.retentionDays,
      allowedDomains: o.allowedDomains || ['internal'],
      auditLevel: o.auditLevel || 'standard'
    };
  }

  function tl(entries) {
    return entries.map(function (e) { return { at: e[0], event: e[1], by: e[2] }; });
  }

  var skills = [
    mk({
      id: 'skill_meeting_to_action', name: 'meeting-to-action',
      description: 'Mengubah transkrip rapat menjadi daftar keputusan, pemilik aksi, dan tenggat yang terstruktur.',
      domain: 'Produktivitas', version: '2.3.1', lifecycle: 'published', status: 'active', risk: 'low',
      permissions: ['calendar:read', 'tasks:write', 'transcripts:read'],
      inputSchema: schema('Transkrip rapat dan konteks peserta.', ['transcript'], {
        transcript: prop('string', 'Teks transkrip rapat (boleh panjang).'),
        participants: prop('array', 'Daftar peserta dengan peran opsional.'),
        language: prop('string', 'Kode bahasa, mis. "id".')
      }),
      outputSchema: schema('Keputusan dan item aksi terstruktur.', ['decisions', 'actions'], {
        decisions: prop('array', 'Keputusan yang diambil beserta konteks.'),
        actions: prop('array', 'Aksi: judul, pemilik, tenggat, prioritas.')
      }),
      owner: 'Tim Operasional', updated_at: '2026-10-28T09:20:00+07:00', usage_count: 1284,
      testStatus: { status: 'passed', passed: 34, total: 34, lastRun: '2026-10-27T14:00:00+07:00' },
      versions: [['2.3.1', '2026-10-28T09:20:00+07:00', 'rani@kenari.co.id', 'Perbaikan ekstraksi tenggat ambigu.'],
                 ['2.3.0', '2026-09-30T10:00:00+07:00', 'rani@kenari.co.id', 'Dukungan multi-bahasa transkrip.'],
                 ['2.2.0', '2026-08-12T11:30:00+07:00', 'bimo@kenari.co.id', 'Output aksi kini menyertakan prioritas.']],
      changelog: ['2.3.1 — perbaikan parsing tenggat relatif ("minggu depan").', '2.3.0 — deteksi bahasa otomatis.'],
      policy: pol({ dataScope: 'Transkrip rapat internal; tidak keluar dari tenant.', allowedDomains: ['internal'], auditLevel: 'minimal', retentionDays: 30 }),
      timeline: tl([['2026-06-02T08:00:00+07:00', 'Dibuat sebagai draft', 'rani@kenari.co.id'],
                    ['2026-06-20T13:00:00+07:00', 'Diajukan untuk review', 'rani@kenari.co.id'],
                    ['2026-07-01T09:00:00+07:00', 'Published v2.0.0', 'governance_lead'],
                    ['2026-10-28T09:20:00+07:00', 'Rilis v2.3.1', 'rani@kenari.co.id']])
    }),
    mk({
      id: 'skill_contract_review', name: 'contract-review',
      description: 'Meninjau draf kontrak: pasal berisiko, klausul yang hilang, dan penyimpangan dari kebijakan standar.',
      domain: 'Legal & Kepatuhan', version: '1.8.0', lifecycle: 'review', status: 'pending_review', risk: 'high',
      permissions: ['documents:read', 'policy:read'],
      inputSchema: schema('Draf kontrak dan profil kontra-pihak.', ['contract_text'], {
        contract_text: prop('string', 'Isi kontrak (teks atau hasil ekstraksi PDF).'),
        counterparty: prop('object', 'Profil pihak lawan: nama, yurisdiksi, nilai kontrak.'),
        playbook: prop('string', 'ID playbook kebijakan yang dipakai.')
      }),
      outputSchema: schema('Temuan risiko dan rekomendasi klausul.', ['findings', 'missing_clauses'], {
        findings: prop('array', 'Temuan: pasal, tingkat risiko, saran redaksi.'),
        missing_clauses: prop('array', 'Klausul wajib yang tidak ditemukan.')
      }),
      owner: 'Tim Legal', updated_at: '2026-11-02T16:45:00+07:00', usage_count: 312,
      testStatus: { status: 'passed', passed: 41, total: 43, lastRun: '2026-11-01T10:30:00+07:00' },
      reviewChecklist: { schemaValid: true, policySet: true, testsPassed: false, ownerAssigned: true },
      versions: [['1.8.0', '2026-11-02T16:45:00+07:00', 'sinta@kenari.co.id', 'Playbook v4: klausul force majeure.'],
                 ['1.7.2', '2026-09-14T09:10:00+07:00', 'sinta@kenari.co.id', 'Perbaikan false positive pada denda keterlambatan.']],
      changelog: ['1.8.0 — playbook v4, skor risiko per klausul.', '1.7.2 — kalibrasi ambang peringatan.'],
      policy: pol({ dataScope: 'Dokumen kontrak rahasia; enkripsi at-rest wajib; akses terbatas legal.', allowedDomains: ['legal'], auditLevel: 'full', retentionDays: 365, approverRole: 'legal_head' }),
      timeline: tl([['2026-03-10T08:00:00+07:00', 'Dibuat sebagai draft', 'sinta@kenari.co.id'],
                    ['2026-04-02T10:00:00+07:00', 'Published v1.0.0', 'legal_head'],
                    ['2026-11-02T16:45:00+07:00', 'Diajukan review v1.8.0', 'sinta@kenari.co.id']])
    }),
    mk({
      id: 'skill_invoice_reconcile', name: 'invoice-reconcile',
      description: 'Mencocokkan invoice masuk dengan PO, penerimaan barang, dan pembayaran; menandai selisih untuk ditindaklanjuti.',
      domain: 'Keuangan', version: '3.1.0', lifecycle: 'published', status: 'active', risk: 'medium',
      permissions: ['erp:read', 'invoices:read', 'payments:read'],
      inputSchema: schema('Invoice dan referensi PO/penerimaan.', ['invoice_id'], {
        invoice_id: prop('string', 'ID invoice di sistem keuangan.'),
        tolerance_pct: prop('number', 'Toleransi selisih harga (persen).'),
        po_reference: prop('string', 'Nomor PO terkait, opsional.')
      }),
      outputSchema: schema('Hasil rekonsiliasi dan daftar selisih.', ['status', 'discrepancies'], {
        status: prop('string', 'matched | mismatch | needs_review.'),
        discrepancies: prop('array', 'Selisih: field, nilai invoice, nilai PO.')
      }),
      owner: 'Tim Keuangan', updated_at: '2026-10-19T13:00:00+07:00', usage_count: 947,
      testStatus: { status: 'passed', passed: 58, total: 58, lastRun: '2026-10-18T08:30:00+07:00' },
      versions: [['3.1.0', '2026-10-19T13:00:00+07:00', 'dewi@kenari.co.id', 'Dukungan multi-mata uang.'],
                 ['3.0.1', '2026-08-25T15:20:00+07:00', 'dewi@kenari.co.id', 'Perbaikan pembulatan PPN.']],
      changelog: ['3.1.0 — konversi kurs otomatis per tanggal invoice.', '3.0.1 — pembulatan pajak sesuai aturan terbaru.'],
      policy: pol({ dataScope: 'Data keuangan tenant; baca saja; tanpa akses tulis ke pembayaran.', allowedDomains: ['finance'], auditLevel: 'standard', retentionDays: 180 }),
      timeline: tl([['2026-01-15T08:00:00+07:00', 'Dibuat sebagai draft', 'dewi@kenari.co.id'],
                    ['2026-02-10T09:00:00+07:00', 'Published v3.0.0', 'finance_lead'],
                    ['2026-10-19T13:00:00+07:00', 'Rilis v3.1.0', 'dewi@kenari.co.id']])
    }),
    mk({
      id: 'skill_policy_check', name: 'policy-check',
      description: 'Memeriksa dokumen/keputusan terhadap korpus kebijakan internal dan menandai pelanggaran beserta pasal rujukannya.',
      domain: 'Kepatuhan', version: '1.4.2', lifecycle: 'published', status: 'active', risk: 'medium',
      permissions: ['policy:read', 'documents:read'],
      inputSchema: schema('Dokumen yang diperiksa dan ruang lingkup kebijakan.', ['document_text'], {
        document_text: prop('string', 'Isi dokumen atau keputusan.'),
        policy_set: prop('string', 'ID set kebijakan, mis. "korporat-2026".'),
        strict: prop('boolean', 'Mode ketat: tandai juga ketidakpastian.')
      }),
      outputSchema: schema('Daftar pelanggaran dan pasal rujukan.', ['violations'], {
        violations: prop('array', 'Pasal, tingkat, kutipan bukti, rekomendasi.'),
        coverage: prop('number', 'Persentase korpus yang tercakup pemeriksaan.')
      }),
      owner: 'Tim GRC', updated_at: '2026-10-11T10:00:00+07:00', usage_count: 623,
      testStatus: { status: 'passed', passed: 47, total: 48, lastRun: '2026-10-10T16:00:00+07:00' },
      versions: [['1.4.2', '2026-10-11T10:00:00+07:00', 'yoga@kenari.co.id', 'Sinkron korpus kebijakan Q4-2026.'],
                 ['1.4.0', '2026-07-22T09:00:00+07:00', 'yoga@kenari.co.id', 'Skor keyakinan per temuan.']],
      changelog: ['1.4.2 — korpus kebijakan diperbarui.', '1.4.0 — confidence score per temuan.'],
      policy: pol({ dataScope: 'Dokumen internal tenant; hasil hanya untuk peran GRC.', allowedDomains: ['governance', 'compliance'], auditLevel: 'full', retentionDays: 365 }),
      timeline: tl([['2026-02-01T08:00:00+07:00', 'Dibuat sebagai draft', 'yoga@kenari.co.id'],
                    ['2026-03-05T09:00:00+07:00', 'Published v1.0.0', 'governance_lead'],
                    ['2026-10-11T10:00:00+07:00', 'Rilis v1.4.2', 'yoga@kenari.co.id']])
    }),
    mk({
      id: 'skill_audit_export', name: 'audit-export',
      description: 'Mengekspor jejak audit ke paket siap auditor (CSV/PDF) dengan tanda tangan integritas dan rentang waktu yang dipilih.',
      domain: 'Audit & Risiko', version: '1.2.0', lifecycle: 'published', status: 'active', risk: 'medium',
      permissions: ['audit:read', 'exports:write'],
      inputSchema: schema('Rentang waktu dan filter ekspor.', ['from', 'to'], {
        from: prop('string', 'ISO tanggal mulai.'),
        to: prop('string', 'ISO tanggal akhir.'),
        entity_types: prop('array', 'Jenis entitas yang diekspor.'),
        format: prop('string', 'csv | pdf.')
      }),
      outputSchema: schema('Referensi paket ekspor dan checksum.', ['export_id', 'checksum'], {
        export_id: prop('string', 'ID paket ekspor.'),
        checksum: prop('string', 'SHA-256 paket untuk verifikasi auditor.'),
        record_count: prop('number', 'Jumlah baris audit.')
      }),
      owner: 'Tim Audit Internal', updated_at: '2026-09-29T14:30:00+07:00', usage_count: 88,
      testStatus: { status: 'passed', passed: 22, total: 22, lastRun: '2026-09-28T09:00:00+07:00' },
      versions: [['1.2.0', '2026-09-29T14:30:00+07:00', 'lia@kenari.co.id', 'Format PDF dengan sampul auditor.'],
                 ['1.1.0', '2026-06-18T10:00:00+07:00', 'lia@kenari.co.id', 'Checksum SHA-256 per paket.']],
      changelog: ['1.2.0 — ekspor PDF.', '1.1.0 — integritas paket.'],
      policy: pol({ dataScope: 'Jejak audit tenant; akses terbatas auditor & GRC.', allowedDomains: ['audit'], auditLevel: 'full', retentionDays: 730, approverRole: 'audit_head' }),
      timeline: tl([['2026-04-11T08:00:00+07:00', 'Dibuat sebagai draft', 'lia@kenari.co.id'],
                    ['2026-05-06T09:00:00+07:00', 'Published v1.0.0', 'audit_head'],
                    ['2026-09-29T14:30:00+07:00', 'Rilis v1.2.0', 'lia@kenari.co.id']])
    }),
    mk({
      id: 'skill_calendar_scheduler', name: 'calendar-scheduler',
      description: 'Menjadwalkan rapat lintas peserta: mencari slot kosong, mengirim undangan, dan menangani konflik.',
      domain: 'Produktivitas', version: '2.0.4', lifecycle: 'published', status: 'active', risk: 'low',
      permissions: ['calendar:read', 'calendar:write', 'contacts:read'],
      inputSchema: schema('Peserta, durasi, dan preferensi slot.', ['attendees', 'duration_min'], {
        attendees: prop('array', 'Email peserta.'),
        duration_min: prop('number', 'Durasi dalam menit.'),
        preferred_window: prop('string', 'Jendela waktu preferensi, mis. "pagi".')
      }),
      outputSchema: schema('Slot terpilih dan status undangan.', ['slot', 'invite_status'], {
        slot: prop('string', 'ISO awal–akhir slot terpilih.'),
        invite_status: prop('string', 'sent | pending | conflict.')
      }),
      owner: 'Tim Operasional', updated_at: '2026-10-05T11:00:00+07:00', usage_count: 1530,
      testStatus: { status: 'passed', passed: 39, total: 39, lastRun: '2026-10-04T13:00:00+07:00' },
      versions: [['2.0.4', '2026-10-05T11:00:00+07:00', 'bimo@kenari.co.id', 'Perbaikan zona waktu lintas negara.'],
                 ['2.0.0', '2026-07-30T08:30:00+07:00', 'bimo@kenari.co.id', 'Negosiasi slot otomatis 2 putaran.']],
      changelog: ['2.0.4 — perbaikan DST.', '2.0.0 — negosiasi slot.'],
      policy: pol({ dataScope: 'Kalender peserta internal; tidak membaca isi undangan lampau.', allowedDomains: ['internal'], auditLevel: 'minimal', retentionDays: 30 }),
      timeline: tl([['2026-02-20T08:00:00+07:00', 'Dibuat sebagai draft', 'bimo@kenari.co.id'],
                    ['2026-03-18T09:00:00+07:00', 'Published v2.0.0', 'operations_manager'],
                    ['2026-10-05T11:00:00+07:00', 'Rilis v2.0.4', 'bimo@kenari.co.id']])
    }),
    mk({
      id: 'skill_email_drafter', name: 'email-drafter',
      description: 'Menyusun draf email bisnis dari poin singkat: nada, bahasa, dan struktur sesuai penerima.',
      domain: 'Komunikasi', version: '0.9.0', lifecycle: 'draft', status: 'draft', risk: 'low',
      permissions: ['mail:draft'],
      inputSchema: schema('Poin pesan dan profil penerima.', ['points'], {
        points: prop('array', 'Poin-poin yang harus tersampaikan.'),
        recipient_role: prop('string', 'Peran penerima, mis. "klien" atau "vendor".'),
        tone: prop('string', 'formal | netral | hangat.')
      }),
      outputSchema: schema('Draf email siap ditinjau.', ['subject', 'body'], {
        subject: prop('string', 'Subjek usulan.'),
        body: prop('string', 'Isi draf email.')
      }),
      owner: 'Tim Komunikasi', updated_at: '2026-10-30T15:10:00+07:00', usage_count: 0,
      testStatus: { status: 'never', passed: 0, total: 12, lastRun: null },
      versions: [['0.9.0', '2026-10-30T15:10:00+07:00', 'nabila@kenari.co.id', 'Draf awal untuk uji internal.']],
      changelog: ['0.9.0 — kerangka awal; belum diuji.'],
      policy: pol({ dataScope: 'Tidak mengirim email; hanya membuat draf lokal.', allowedDomains: ['internal'], auditLevel: 'minimal', retentionDays: 7, reviewRequired: true }),
      timeline: tl([['2026-10-30T15:10:00+07:00', 'Dibuat sebagai draft', 'nabila@kenari.co.id']])
    }),
    mk({
      id: 'skill_knowledge_search', name: 'knowledge-search',
      description: 'Mencari jawaban di basis pengetahuan internal dengan sitasi dokumen sumber.',
      domain: 'Pengetahuan', version: '1.6.0', lifecycle: 'published', status: 'active', risk: 'low',
      permissions: ['kb:read'],
      inputSchema: schema('Pertanyaan dan konteks opsional.', ['query'], {
        query: prop('string', 'Pertanyaan bahasa alami.'),
        space: prop('string', 'Ruang lingkup KB, opsional.'),
        top_k: prop('number', 'Jumlah sitasi maksimum.')
      }),
      outputSchema: schema('Jawaban ringkas dengan sitasi.', ['answer', 'citations'], {
        answer: prop('string', 'Jawaban ringkas.'),
        citations: prop('array', 'Dokumen sumber: judul, tautan internal, potongan.')
      }),
      owner: 'Tim Pengetahuan', updated_at: '2026-10-22T09:45:00+07:00', usage_count: 2102,
      testStatus: { status: 'passed', passed: 51, total: 52, lastRun: '2026-10-21T17:00:00+07:00' },
      versions: [['1.6.0', '2026-10-22T09:45:00+07:00', 'gilang@kenari.co.id', 'Reranker baru; sitasi lebih presisi.'],
                 ['1.5.1', '2026-08-08T10:00:00+07:00', 'gilang@kenari.co.id', 'Perbaikan chunking tabel.']],
      changelog: ['1.6.0 — reranker lintas-bahasa.', '1.5.1 — tabel tidak lagi terpotong.'],
      policy: pol({ dataScope: 'Basis pengetahuan internal; jawaban tidak boleh memuat dokumen restricted.', allowedDomains: ['internal'], auditLevel: 'standard', retentionDays: 60 }),
      timeline: tl([['2026-01-08T08:00:00+07:00', 'Dibuat sebagai draft', 'gilang@kenari.co.id'],
                    ['2026-02-02T09:00:00+07:00', 'Published v1.0.0', 'knowledge_lead'],
                    ['2026-10-22T09:45:00+07:00', 'Rilis v1.6.0', 'gilang@kenari.co.id']])
    }),
    mk({
      id: 'skill_risk_score', name: 'risk-score',
      description: 'Memberi skor risiko untuk permintaan/kontrak/vendor berdasarkan faktor standar dan histori insiden.',
      domain: 'Audit & Risiko', version: '0.7.0', lifecycle: 'review', status: 'pending_review', risk: 'high',
      permissions: ['risk:read', 'incidents:read', 'vendors:read'],
      inputSchema: schema('Objek yang dinilai dan konteks penilaian.', ['subject_type', 'subject_id'], {
        subject_type: prop('string', 'contract | vendor | request.'),
        subject_id: prop('string', 'ID objek.'),
        factors: prop('object', 'Faktor override opsional.')
      }),
      outputSchema: schema('Skor dan rincian faktor.', ['score', 'factors'], {
        score: prop('number', '0–100; makin tinggi makin berisiko.'),
        factors: prop('array', 'Faktor penyumbang: nama, bobot, bukti.'),
        band: prop('string', 'rendah | sedang | tinggi | kritis.')
      }),
      owner: 'Tim Manajemen Risiko', updated_at: '2026-11-03T08:15:00+07:00', usage_count: 47,
      testStatus: { status: 'failed', passed: 29, total: 33, lastRun: '2026-11-02T19:20:00+07:00' },
      reviewChecklist: { schemaValid: true, policySet: true, testsPassed: false, ownerAssigned: true },
      versions: [['0.7.0', '2026-11-03T08:15:00+07:00', 'tara@kenari.co.id', 'Model faktor v2; belum lolos uji.']],
      changelog: ['0.7.0 — faktor insiden 24 bulan; menunggu perbaikan 4 kasus uji.'],
      policy: pol({ dataScope: 'Data risiko & insiden tenant; hasil hanya untuk risk officer.', allowedDomains: ['risk'], auditLevel: 'full', retentionDays: 365, approverRole: 'risk_head' }),
      timeline: tl([['2026-09-01T08:00:00+07:00', 'Dibuat sebagai draft', 'tara@kenari.co.id'],
                    ['2026-11-03T08:15:00+07:00', 'Diajukan review v0.7.0', 'tara@kenari.co.id']])
    }),
    mk({
      id: 'skill_document_intake', name: 'document-intake',
      description: 'Menerima, mengklasifikasi, dan mengekstrak metadata dokumen masuk (faktur, kontrak, surat) ke antrean yang benar.',
      domain: 'Produktivitas', version: '1.1.0', lifecycle: 'published', status: 'active', risk: 'medium',
      permissions: ['documents:read', 'documents:write', 'ocr:invoke'],
      inputSchema: schema('Berkas dokumen dan sumber penerimaan.', ['file_ref'], {
        file_ref: prop('string', 'Referensi berkas di penyimpanan dokumen.'),
        source: prop('string', 'email | upload | scan.'),
        hint_type: prop('string', 'Petunjuk jenis dokumen, opsional.')
      }),
      outputSchema: schema('Klasifikasi dan metadata terekstrak.', ['doc_type', 'metadata'], {
        doc_type: prop('string', 'invoice | contract | letter | other.'),
        metadata: prop('object', 'Nomor, tanggal, pihak, nilai (bila ada).'),
        confidence: prop('number', '0–1.')
      }),
      owner: 'Tim Operasional Dokumen', updated_at: '2026-10-15T10:30:00+07:00', usage_count: 1891,
      testStatus: { status: 'passed', passed: 44, total: 45, lastRun: '2026-10-14T11:00:00+07:00' },
      versions: [['1.1.0', '2026-10-15T10:30:00+07:00', 'ayu@kenari.co.id', 'Ekstraksi tabel line-item.'],
                 ['1.0.0', '2026-05-19T09:00:00+07:00', 'ayu@kenari.co.id', 'Klasifikasi 4 jenis dokumen.']],
      changelog: ['1.1.0 — line-item extraction.', '1.0.0 — rilis awal.'],
      policy: pol({ dataScope: 'Dokumen masuk tenant; pemrosesan di dalam perimeter.', allowedDomains: ['internal', 'finance', 'legal'], auditLevel: 'standard', retentionDays: 180 }),
      timeline: tl([['2026-03-01T08:00:00+07:00', 'Dibuat sebagai draft', 'ayu@kenari.co.id'],
                    ['2026-04-14T09:00:00+07:00', 'Published v1.0.0', 'operations_manager'],
                    ['2026-10-15T10:30:00+07:00', 'Rilis v1.1.0', 'ayu@kenari.co.id']])
    }),
    mk({
      id: 'skill_approval_brief', name: 'approval-brief',
      description: 'Merangkum paket persetujuan (mandat, belanja, kontrak) menjadi ringkasan satu halaman untuk penyetuju.',
      domain: 'Eksekutif', version: '1.5.0', lifecycle: 'deprecated', status: 'deprecated', risk: 'medium',
      permissions: ['approvals:read', 'documents:read'],
      inputSchema: schema('ID paket persetujuan.', ['approval_id'], {
        approval_id: prop('string', 'ID paket di modul persetujuan.'),
        depth: prop('string', 'ringkas | lengkap.')
      }),
      outputSchema: schema('Ringkasan untuk penyetuju.', ['summary', 'risks'], {
        summary: prop('string', 'Ringkasan satu halaman.'),
        risks: prop('array', 'Risiko utama yang perlu diperhatikan.')
      }),
      owner: 'Tim PMO', updated_at: '2026-08-02T09:00:00+07:00', usage_count: 264,
      testStatus: { status: 'passed', passed: 18, total: 18, lastRun: '2026-07-30T10:00:00+07:00' },
      versions: [['1.5.0', '2026-08-02T09:00:00+07:00', 'hendra@kenari.co.id', 'Rilis terakhir sebelum deprecated.'],
                 ['1.4.0', '2026-05-11T10:00:00+07:00', 'hendra@kenari.co.id', 'Template ringkasan eksekutif.']],
      changelog: ['1.5.0 — rilis terakhir.', 'Deprecated 2026-10-01: fungsionalitas digantikan approval-brief v2 (belum tersedia).'],
      policy: pol({ dataScope: 'Paket persetujuan tenant; hanya untuk penyetuju.', allowedDomains: ['executive'], auditLevel: 'standard', retentionDays: 365 }),
      timeline: tl([['2025-11-10T08:00:00+07:00', 'Dibuat sebagai draft', 'hendra@kenari.co.id'],
                    ['2025-12-15T09:00:00+07:00', 'Published v1.0.0', 'pmo_lead'],
                    ['2026-10-01T09:00:00+07:00', 'Ditandai deprecated', 'governance_lead']])
    }),
    mk({
      id: 'skill_task_triage', name: 'task-triage',
      description: 'Mengklasifikasi dan memprioritaskan tiket/tugas masuk ke tim yang tepat dengan estimasi SLA.',
      domain: 'Produktivitas', version: '1.0.2', lifecycle: 'disabled', status: 'disabled', risk: 'low',
      permissions: ['tickets:read', 'tickets:write'],
      inputSchema: schema('Tiket masuk.', ['ticket_id'], {
        ticket_id: prop('string', 'ID tiket.'),
        channel: prop('string', 'email | chat | form.')
      }),
      outputSchema: schema('Klasifikasi dan routing.', ['queue', 'priority'], {
        queue: prop('string', 'Antrean tujuan.'),
        priority: prop('string', 'P1–P4.'),
        sla_hours: prop('number', 'Estimasi SLA jam.')
      }),
      owner: 'Tim Support', updated_at: '2026-09-12T13:30:00+07:00', usage_count: 731,
      testStatus: { status: 'passed', passed: 26, total: 26, lastRun: '2026-09-10T09:00:00+07:00' },
      versions: [['1.0.2', '2026-09-12T13:30:00+07:00', 'putri@kenari.co.id', 'Rilis terakhir sebelum dinonaktifkan.']],
      changelog: ['1.0.2 — perbaikan routing billing.', 'Disabled 2026-10-20: tumpang tindih dengan modul triage baru.'],
      policy: pol({ dataScope: 'Tiket support tenant.', allowedDomains: ['support'], auditLevel: 'minimal', retentionDays: 90 }),
      timeline: tl([['2026-02-15T08:00:00+07:00', 'Dibuat sebagai draft', 'putri@kenari.co.id'],
                    ['2026-03-20T09:00:00+07:00', 'Published v1.0.0', 'support_lead'],
                    ['2026-10-20T09:00:00+07:00', 'Dinonaktifkan', 'support_lead']])
    })
  ];

  window.DEXTRA_SKILLS_FIXTURES = {
    demo: true,
    generatedAt: '2026-11-04T00:00:00+07:00',
    source: 'fixture DEMO di peramban — bukan dari server, bukan registri skill nyata',
    skills: skills
  };
})();
