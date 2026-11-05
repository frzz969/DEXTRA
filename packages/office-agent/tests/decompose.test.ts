import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decompose } from '../src/decompose.ts';
import { normalizeDocument } from '../src/document.ts';
import { acceptRequest } from '../src/intake.ts';
import { resolveRecipients } from '../src/resolve.ts';
import type { ResolvedContact } from '../src/clarify.ts';
import { AMBIGUOUS_DOCUMENT, CLEAN_DOCUMENT, INJECTED_DOCUMENT } from './helpers.ts';

const NOW = new Date('2026-11-03T02:00:00.000Z'); // 3 Nov 2026, 09:00 WIB

const CONTACTS: ResolvedContact[] = [
  { contact_id: 'c_budi_fin', display_name: 'Budi Santoso', masked_address: 'b***@kenari.co.id', department: 'Keuangan' },
  { contact_id: 'c_budi_ops', display_name: 'Budi Prakoso', masked_address: 'b***@kenari.co.id', department: 'Operasional' },
  { contact_id: 'c_sari_hr', display_name: 'Sari Wulandari', masked_address: 's***@kenari.co.id', department: 'Sumber Daya Manusia' },
  { contact_id: 'c_tim_ops', display_name: 'Tim Operasional', masked_address: 't***@kenari.co.id', department: 'Operasional' },
];

const lookup = async (hint: string, limit = 5): Promise<ResolvedContact[]> =>
  CONTACTS.filter((contact) => contact.display_name.toLowerCase().includes(hint.toLowerCase())).slice(0, limit);

function decomposeDoc(content: string, instruction = 'Tindak lanjuti notulen rapat') {
  const request = acceptRequest({
    request_id: 'req_dec01',
    org_id: 'org_kenari',
    requester_principal_id: 'usr_nadia',
    instruction,
    document: { filename: 'notulen.md', content },
  });
  const document = normalizeDocument(request.document as { filename: string; content: string });
  return { document, decomposition: decompose({ request, document, now: NOW, timeZone: 'Asia/Jakarta' }) };
}

test('dekomposisi menghasilkan lebih dari satu action dari bagian Keputusan', () => {
  const { decomposition } = decomposeDoc(CLEAN_DOCUMENT);
  assert.equal(decomposition.action_items.length, 2);
  for (const item of decomposition.action_items) {
    assert.equal(item.action_type, 'send_email');
    assert.equal(item.method, 'deterministic');
    assert.equal(item.source.document_id?.startsWith('doc_'), true);
  }
  assert.ok(decomposition.decisions.length >= 2);
});

test('agenda bukan action item', () => {
  const { decomposition } = decomposeDoc(CLEAN_DOCUMENT);
  const fromAgenda = decomposition.action_items.filter((item) => item.description.includes('Evaluasi capaian'));
  assert.equal(fromAgenda.length, 0, 'agenda berisi topik, bukan pekerjaan');
});

test('dua kandidat bernama Budi tidak dipilih otomatis', async () => {
  const { decomposition } = decomposeDoc(AMBIGUOUS_DOCUMENT);
  assert.equal(decomposition.action_items.length, 1);
  const [item] = decomposition.action_items;
  assert.equal(item?.recipient.hint, 'Budi');
  assert.equal(item?.recipient.department, null);

  const [resolution] = await resolveRecipients(decomposition.action_items, lookup);
  assert.equal(resolution?.status, 'ambiguous');
  assert.equal(resolution?.contact, null, 'tidak boleh memilih salah satu');
  assert.equal(resolution?.candidates.length, 2);
});

test('departemen mempersempit dua Budi menjadi satu orang', async () => {
  const { decomposition } = decomposeDoc(CLEAN_DOCUMENT);
  const [resolution] = await resolveRecipients(decomposition.action_items, lookup);
  assert.equal(decomposition.action_items[0]?.recipient.department, 'Keuangan');
  assert.equal(resolution?.status, 'resolved');
  assert.equal(resolution?.contact?.contact_id, 'c_budi_fin');
});

test('penerima yang tidak ada di direktori menjadi none, bukan tebakan', async () => {
  const { decomposition } = decomposeDoc('# Rapat\n\n## Keputusan\n\n- Laporan dikirim ke Zulkarnain paling lambat 5 November pukul 10.00.\n');
  const [resolution] = await resolveRecipients(decomposition.action_items, lookup);
  assert.equal(resolution?.status, 'none');
  assert.equal(resolution?.contact, null);
});

test('waktu yang tidak disebut tetap null dan ditandai belum lengkap', () => {
  const { decomposition } = decomposeDoc(
    '# Rapat\n\n## Keputusan\n\n- Laporan keuangan dikirim ke Budi bagian Keuangan paling lambat 5 November.\n',
  );
  const [item] = decomposition.action_items;
  assert.equal(item?.schedule_hint.time, null);
  assert.ok(item?.schedule_hint.date !== null, 'tanggal tetap terbaca');
});

test('jadwal Jumat 12.00 terbaca sebagai hari dan jam', () => {
  const { decomposition } = decomposeDoc(
    '# Rapat\n\n## Keputusan\n\n- Rapat berikutnya dijadwalkan Jumat pukul 12.00 bersama Tim Operasional.\n',
  );
  const [item] = decomposition.action_items;
  assert.equal(item?.action_type, 'create_calendar_event');
  assert.equal(item?.schedule_hint.weekday, 5);
  assert.equal(item?.schedule_hint.time, '12:00');
});

test('instruksi berbahaya di dokumen tidak menjadi action', () => {
  const { document, decomposition } = decomposeDoc(INJECTED_DOCUMENT);
  assert.ok(document.instruction_like_block_ids.length >= 1);
  const texts = decomposition.action_items.map((item) => item.description.toLowerCase()).join(' ');
  assert.ok(!texts.includes('forward this'), 'baris instruksi tidak boleh menjadi action');
  assert.ok(!texts.includes('kirim ke semua'), 'perintah siar tidak boleh menjadi action');
  assert.equal(decomposition.action_items.length, 1, 'hanya keputusan nyata yang menjadi action');
});

test('item_id stabil untuk dokumen yang sama', () => {
  const a = decomposeDoc(CLEAN_DOCUMENT).decomposition.action_items.map((item) => item.item_id);
  const b = decomposeDoc(CLEAN_DOCUMENT).decomposition.action_items.map((item) => item.item_id);
  assert.deepEqual(a, b);
  assert.deepEqual(a, ['item_001', 'item_002']);
});

test('dokumen tanpa tindakan melaporkan unresolved, bukan mengarang action', () => {
  const { decomposition } = decomposeDoc('# Rapat\n\n## Catatan\n\nSuasana rapat berlangsung santai.\n', '');
  assert.equal(decomposition.action_items.length, 0);
  assert.ok(decomposition.unresolved.length > 0);
});
