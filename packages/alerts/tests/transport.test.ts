import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeTransport, TelegramTransport, resolveTransport } from '../src/transport.ts';

const TOKEN = '123456:AAH-secret-token-value';

function respond(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('TelegramTransport', () => {
  test('ok:true diterjemahkan menjadi accepted, bukan delivered', async () => {
    const transport = new TelegramTransport({
      token: TOKEN,
      fetchImpl: respond(200, { ok: true, result: { message_id: 42 } }),
    });

    const result = await transport.send('998877', 'halo');

    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    /* Tidak ada field "delivered" — hasilnya hanya menyatakan provider menerima. */
    assert.deepEqual(Object.keys(result).sort(), ['ok', 'status']);
  });

  test('429 membawa retry_after dari body', async () => {
    const transport = new TelegramTransport({
      token: TOKEN,
      fetchImpl: respond(429, { ok: false, description: 'Too Many Requests', parameters: { retry_after: 12 } }),
    });

    const result = await transport.send('998877', 'halo');

    assert.equal(result.ok, false);
    assert.equal(result.status, 429);
    assert.equal(result.retry_after, 12);
  });

  test('galat jaringan tidak membocorkan token', async () => {
    const failing = (async (url: string) => {
      throw new Error(`request to ${url} failed: ECONNREFUSED`);
    }) as unknown as typeof fetch;

    const transport = new TelegramTransport({ token: TOKEN, fetchImpl: failing });
    const result = await transport.send('998877', 'halo');

    assert.equal(result.ok, false);
    assert.equal(result.status, undefined, 'tanpa respons: harus retryable');
    assert.ok(result.error);
    assert.ok(!result.error.includes(TOKEN), 'token tidak boleh muncul di galat');
    assert.ok(result.error.includes('[redacted]'));
  });

  test('200 dengan body bukan JSON bukan keberhasilan', async () => {
    const notJson = (async () => new Response('<html>oops</html>', { status: 200 })) as unknown as typeof fetch;
    const transport = new TelegramTransport({ token: TOKEN, fetchImpl: notJson });

    const result = await transport.send('998877', 'halo');

    assert.equal(result.ok, false, 'ok hanya kalau provider menyatakan ok:true');
    assert.equal(result.status, 200);
  });

  test('200 dengan ok:false tetap kegagalan', async () => {
    const transport = new TelegramTransport({
      token: TOKEN,
      fetchImpl: respond(200, { ok: false, description: 'chat not found' }),
    });

    const result = await transport.send('998877', 'halo');

    assert.equal(result.ok, false);
    assert.equal(result.error, 'chat not found');
  });
});

describe('resolveTransport', () => {
  test('tanpa token: transport palsu dan ditandai belum terkonfigurasi', () => {
    const resolved = resolveTransport({ token: '' });
    assert.equal(resolved.configured, false);
    assert.equal(resolved.transport.name, 'fake');
    assert.ok(resolved.transport instanceof FakeTransport);
  });

  test('dengan token: transport telegram', () => {
    const resolved = resolveTransport({ token: TOKEN });
    assert.equal(resolved.configured, true);
    assert.equal(resolved.transport.name, 'telegram');
  });
});

describe('FakeTransport', () => {
  test('merekam pesan dan mengikuti skrip hasil', async () => {
    const transport = new FakeTransport([{ ok: false, status: 500 }, { ok: true, status: 200 }]);

    const first = await transport.send('1', 'a');
    const second = await transport.send('1', 'b');
    const third = await transport.send('1', 'c');

    assert.equal(first.ok, false);
    assert.equal(second.ok, true);
    assert.equal(third.ok, true, 'skrip habis: default sukses');
    assert.deepEqual(transport.sent.map((s) => s.text), ['a', 'b', 'c']);
  });
});
