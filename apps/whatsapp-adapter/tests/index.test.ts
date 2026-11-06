import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { callMcp, formatOfficeAgentReply, handleCommand, requestIdForChat, FORBIDDEN_TOOLS } from '../index.ts';

describe('whatsapp adapter', () => {
  test('forbidden tools set contains the mutating tools', () => {
    for (const t of ['execute_action', 'submit_approval', 'issue_mandate', 'revoke_mandate']) assert.ok(FORBIDDEN_TOOLS.has(t));
  });
  test('callMcp refuses to call a forbidden tool', async () => {
    await assert.rejects(() => callMcp('execute_action', {}), /mutasi/);
  });
  test('/help replies', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: '1', text: '/help', reply: async (m) => { replies.push(m); } });
    assert.equal(replies.length, 1);
    assert.match(replies[0] ?? '', /\/status/);
  });
  test('free text calls office_agent_run', async () => {
    const replies: string[] = [];
    const calls: any[] = [];
    await handleCommand({ chatId: '42', updateId: 100, text: 'Kirim laporan ke Budi besok jam 10', reply: async (m) => { replies.push(m); }, callTool: async (tool, args, token) => { calls.push({ tool, args, token }); return { ok: true, data: { status: 'plan_ready', plan: { plan_id: 'plan_wa01', plan_hash: 'hash_wa01' }, session: null } }; } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].tool, 'office_agent_run');
    assert.equal(calls[0].args.chat_id, '42');
    assert.equal(calls[0].args.instruction, 'Kirim laporan ke Budi besok jam 10');
    assert.match(String(calls[0].args.request_id), /^req_wa_/);
    assert.match(replies[0] ?? '', /plan_wa01/);
  });
  test('MCP error becomes human message', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: '7', updateId: 10, text: 'Kirim laporan ke Budi', reply: async (m) => { replies.push(m); }, callTool: async () => ({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'request_id is required.' } }) });
    assert.match(replies[0] ?? '', /Maaf/);
    assert.match(replies[0] ?? '', /INVALID_ARGUMENT/);
  });
  test('long replies truncated below 4096', () => {
    const text = formatOfficeAgentReply({ ok: true, data: { status: 'needs_clarification', plan: null, session: { questions: Array.from({ length: 200 }, () => ({ prompt: 'Pertanyaan yang sangat panjang '.repeat(4) })) } } });
    assert.ok(text.length < 4096);
    assert.ok(text.endsWith('...'));
  });
  test('request id unique', () => {
    assert.notEqual(requestIdForChat(42, 100), requestIdForChat(42, 101));
  });
});