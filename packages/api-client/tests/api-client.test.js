const test = require('node:test');
const assert = require('node:assert');
const { unwrap, envelope, create } = require('../src/api-client.js');

test('envelope membungkus tools/call dengan nama tool dan argumen', () => {
  const env = envelope('get_status', { verbose: true }, 42);
  assert.equal(env.jsonrpc, '2.0');
  assert.equal(env.id, 42);
  assert.equal(env.method, 'tools/call');
  assert.deepEqual(env.params, { name: 'get_status', arguments: { verbose: true } });
});

test('envelope memakai objek kosong saat argumen tidak diberikan', () => {
  assert.deepEqual(envelope('get_status', undefined, 1).params.arguments, {});
});

test('unwrap mengembalikan data saat tool sukses', () => {
  const json = {
    result: { content: [{ type: 'text', text: JSON.stringify({ ok: true, data: { scope: 'ops' } }) }] }
  };
  assert.deepEqual(unwrap(json), { scope: 'ops' });
});

test('unwrap melempar pesan JSON-RPC saat ada error', () => {
  assert.throws(() => unwrap({ error: { code: -32001, message: 'Unauthorized' } }), /Unauthorized/);
});

test('unwrap melempar saat tool menolak permintaan', () => {
  const json = {
    result: { content: [{ text: JSON.stringify({ ok: false, error: { message: 'ACTION_NOT_ALLOWED' } }) }] }
  };
  assert.throws(() => unwrap(json), /ACTION_NOT_ALLOWED/);
});

test('unwrap mengembalikan objek kosong saat respons tanpa konten', () => {
  assert.deepEqual(unwrap({ result: {} }), {});
});

test('call mengirim header Authorization dari token yang tersimpan', async () => {
  const seen = [];
  const fakeFetch = (url, init) => {
    seen.push({ url, init });
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ result: { content: [{ text: JSON.stringify({ ok: true, data: { n: 1 } }) }] } })
    });
  };
  const api = create({ baseUrl: 'http://x', tokenKey: 'k', fetch: fakeFetch });
  // token() membaca Web Storage; di node tidak ada, jadi hasilnya string kosong
  const data = await api.call('get_status', {});
  assert.deepEqual(data, { n: 1 });
  assert.equal(seen[0].url, 'http://x/');
  assert.match(seen[0].init.headers.Authorization, /^Bearer /);
});

test('call melempar saat HTTP gagal', async () => {
  const fakeFetch = () => Promise.resolve({ ok: false, status: 403 });
  const api = create({ baseUrl: 'http://x', fetch: fakeFetch });
  await assert.rejects(() => api.call('execute_action', {}), /HTTP 403/);
});
