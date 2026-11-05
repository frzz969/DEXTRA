import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { callMcp, handleCommand, FORBIDDEN_TOOLS } from '../index.ts';

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
    assert.match(replies[0], /\/status/);
  });

  test('/start replies with greeting', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/start', reply: async (m) => { replies.push(m); } });
    assert.equal(replies.length, 1);
    assert.match(replies[0], /DEXTRA/);
  });

  test('/approve without arg asks for plan_id', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/approve', reply: async (m) => { replies.push(m); } });
    assert.match(replies[0], /Pakai: \/approve/);
  });

  test('/approve with arg points to dashboard, never executes', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/approve plan_123', reply: async (m) => { replies.push(m); } });
    assert.match(replies[0], /dashboard/);
  });

  test('unknown command replies help hint', async () => {
    const replies: string[] = [];
    await handleCommand({ chatId: 1, text: '/foo', reply: async (m) => { replies.push(m); } });
    assert.match(replies[0], /\/help/);
  });
});
