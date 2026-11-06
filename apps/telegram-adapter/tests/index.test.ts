import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  callMcp,
  formatOfficeAgentReply,
  handleCommand,
  requestIdForChat,
  FORBIDDEN_TOOLS,
} from '../index.ts';

describe('telegram adapter', () => {
  test('forbidden tools set contains the mutating tools', () => {
    for (const t of ['execute_action', 'submit_approval', 'issue_mandate', 'revoke_mandate']) {
      assert.ok(FORBIDDEN_TOOLS.has(t));
    }
  });

  test('callMcp refuses to call a forbidden tool', async () => {
    await assert.rejects(() => callMcp('execute_action', {}), /mutasi/);
  });

  test('/help replies with command list', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/help', reply: async (m) => { replies.push(m); } });
    assert.equal(replies.length, 1);
    assert.match(replies[0] ?? '', /\/status/);
  });

  test('/start replies with greeting', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/start', reply: async (m) => { replies.push(m); } });
    assert.equal(replies.length, 1);
    assert.match(replies[0] ?? '', /DEXTRA/);
  });

  test('/approve without arg asks for plan_id', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/approve', reply: async (m) => { replies.push(m); } });
    assert.match(replies[0] ?? '', /Pakai: \/approve/);
  });

  test('/approve with arg points to dashboard, never executes', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/approve plan_123', reply: async (m) => { replies.push(m); } });
    assert.match(replies[0] ?? '', /dashboard/);
  });

  test('unknown command replies help hint', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/foo', reply: async (m) => { replies.push(m); } });
    assert.match(replies[0] ?? '', /\/help/);
  });

  test('request id stabil per chat, unik per pesan', () => {
    assert.notEqual(requestIdForChat(42, 100), requestIdForChat(42, 101));
    assert.notEqual(requestIdForChat(42, 100), requestIdForChat(43, 100));
    assert.match(requestIdForChat(-100123, 7), /^req_tg_[a-z0-9]+_[a-z0-9]+$/);
  });

  test('free text calls office_agent_run with normalized intent', async () => {
    const replies: string[] = [];
    const calls: Array<{ tool: string; args: any; token?: string }> = [];
    await handleCommand({
      chatId: 42,
      updateId: 100,
      text: 'Kirim laporan ke Budi besok jam 10',
      reply: async (m) => { replies.push(m); },
      callTool: async (tool, args, token) => {
        calls.push({ tool, args, token });
        return {
          ok: true,
          data: {
            status: 'plan_ready',
            plan: { plan_id: 'plan_tg01', plan_hash: 'hash_tg01' },
            session: null,
          },
        };
      },
    });

    assert.equal(calls.length, 1, 'free text harus memanggil satu tool');
    const call = calls[0];
    assert.equal(call?.tool, 'office_agent_run');
    assert.equal(call?.args.chat_id, '42');
    assert.equal(call?.args.instruction, 'Kirim laporan ke Budi besok jam 10');
    assert.equal(call?.args.assumptions.time_of_day, '10:00');
    assert.match(String(call?.args.request_id), /^req_tg_/);
    assert.match(replies[0] ?? '', /plan_ready/);
    assert.match(replies[0] ?? '', /plan_tg01/);
    assert.match(replies[0] ?? '', /hash_tg01/);
    assert.match(replies[0] ?? '', /Dashboard:/);
  });

  test('clarification reply lists the question prompts', async () => {
    const replies: string[] = [];
    await handleCommand({
      chatId: 7,
      updateId: 9,
      text: 'Kirim laporan ke Budi',
      reply: async (m) => { replies.push(m); },
      callTool: async () => ({
        ok: true,
        data: {
          status: 'needs_clarification',
          plan: null,
          session: { questions: [{ prompt: 'Jam berapa?' }, { prompt: 'Penerima yang mana?' }] },
        },
      }),
    });
    assert.match(replies[0] ?? '', /klarifikasi/);
    assert.match(replies[0] ?? '', /Jam berapa\?/);
    assert.match(replies[0] ?? '', /Penerima yang mana\?/);
  });

  test('MCP error becomes a human message, not a crash', async () => {
    const replies: string[] = [];
    await handleCommand({
      chatId: 7,
      updateId: 10,
      text: 'Kirim laporan ke Budi',
      reply: async (m) => { replies.push(m); },
      callTool: async () => ({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'request_id is required.' } }),
    });
    assert.match(replies[0] ?? '', /Maaf/);
    assert.match(replies[0] ?? '', /INVALID_ARGUMENT/);
  });

  test('long replies are truncated below Telegram limit', () => {
    const text = formatOfficeAgentReply({
      ok: true,
      data: {
        status: 'needs_clarification',
        plan: null,
        session: { questions: Array.from({ length: 200 }, () => ({ prompt: 'Pertanyaan yang sangat panjang '.repeat(4) })) },
      },
    });
    assert.ok(text.length < 4096);
    assert.ok(text.endsWith('...'));
  });
});
