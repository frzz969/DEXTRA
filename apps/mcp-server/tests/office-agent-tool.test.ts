import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';

const dataDir = await mkdtemp(join(tmpdir(), 'dextra-office-tool-'));
process.env.DEXTRA_DATA_DIR = dataDir;
process.env.DEXTRA_AGENT_PRINCIPAL = 'usr_nadia';

const { seed } = await import('../../../packages/store/src/index.ts');
const { handleTool } = await import('../src/handlers.ts');
const { getChatRequest } = await import('../../../packages/office-agent/src/state.ts');

after(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

const INSTRUCTION = 'Kirim laporan keuangan ke Budi bagian Keuangan hari Senin pukul 10.00';

test('office_agent_run produces a plan from free text and records the chat binding', async () => {
  await seed();

  const first = await handleTool(
    'office_agent_run',
    { request_id: 'req_tgchat_first', chat_id: 'chat_42', instruction: INSTRUCTION },
    'agent',
  );
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.data.status, 'plan_ready', JSON.stringify(first.data.validation));
  assert.ok(first.data.plan?.plan_id, 'plan must be persisted by the pipeline');
  assert.equal(await getChatRequest('chat_42'), 'req_tgchat_first');

  /* Pesan susulan mengajukan request_id berbeda (per update), tetapi chat yang
     sama harus tetap memakai request kanonik yang pertama. */
  const second = await handleTool(
    'office_agent_run',
    { request_id: 'req_tgchat_second', chat_id: 'chat_42', instruction: INSTRUCTION },
    'agent',
  );
  assert.equal(second.ok, true, JSON.stringify(second));
  assert.equal(second.data.plan?.plan_id, first.data.plan?.plan_id, 'no second plan for the same chat');
  assert.equal(await getChatRequest('chat_42'), 'req_tgchat_first');
});

test('office_agent_run refuses a call with no bound principal', async () => {
  const previous = process.env.DEXTRA_AGENT_PRINCIPAL;
  process.env.DEXTRA_AGENT_PRINCIPAL = '';
  try {
    const result = await handleTool(
      'office_agent_run',
      { request_id: 'req_tgchat_noprincipal', chat_id: 'chat_99', instruction: INSTRUCTION },
      'agent',
    );
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UNAUTHORIZED');
  } finally {
    process.env.DEXTRA_AGENT_PRINCIPAL = previous ?? 'usr_nadia';
  }
});
