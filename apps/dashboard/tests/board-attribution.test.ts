/*
 * Papan tugas membaca nama dari data, bukan dari kebiasaan.
 *
 * Versi sebelumnya memberi setiap kartu live label "Workforce Dispatcher" —
 * nama yang tidak ada di Plan mana pun, ditampilkan seolah agen itu menangani
 * plan tersebut. Tes ini menjaga agar tidak kembali: kartu harus menyebut
 * `assignee_id`/`requester_id` yang benar-benar dikirim server, atau mengaku
 * tidak tahu.
 *
 * Tes ini membaca sumber, bukan menjalankan DOM. Yang dijaga adalah bentuk
 * datanya: satu-satunya sumber atribusi adalah field plan, bukan konstanta.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../assets/js/views/board.js', import.meta.url), 'utf8');

test('kartu live tidak diatribusikan ke agen yang tidak ada di data', () => {
  assert.ok(
    !/Workforce Dispatcher/.test(source),
    'board.js menyebut "Workforce Dispatcher": itu nama yang tidak pernah ada di Plan, jadi tidak boleh dipakai sebagai atribusi kartu.',
  );
});

test('atribusi kartu dibaca dari field plan yang dikirim server', () => {
  assert.match(source, /p\.assignee_id/, 'kartu harus membaca assignee_id dari plan');
  assert.match(source, /p\.requester_id/, 'kartu harus membaca requester_id dari plan');
});

test('filter papan memakai assignee, bukan field spesialis yang tidak ada', () => {
  assert.match(source, /assignee_id/, 'filter harus diturunkan dari assignee_id');
  assert.ok(
    !/p\.specialist/.test(source),
    'board.js membaca p.specialist, padahal Plan tidak punya field itu — filternya akan menyembunyikan semua kartu.',
  );
});

test('kartu tanpa penanggung jawab mengaku tidak tahu', () => {
  assert.match(
    source,
    /tanpa penugasan/,
    'kartu tanpa assignee/requester harus menyatakan "tanpa penugasan", bukan menebak nama.',
  );
});
