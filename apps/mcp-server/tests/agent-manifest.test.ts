import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AGENT_TOOLS } from '../src/auth.ts';
import { getRepoRoot } from '../../../packages/store/src/index.ts';

/*
 * The WorkBuddy manifest is a client-side allowlist. If it drifts from
 * AGENT_TOOLS the agent silently loses access to tools the server would allow,
 * or claims access it does not have. This test keeps the two in step.
 */

async function manifestTools(): Promise<string[]> {
  const raw = await readFile(join(getRepoRoot(), 'workbuddy', 'mcp.json'), 'utf8');
  const config = JSON.parse(raw);
  return config.mcpServers.dextra.allowedTools as string[];
}

test('workbuddy/mcp.json lists exactly the agent-scoped tools', async () => {
  const allowed = await manifestTools();
  assert.deepEqual(
    [...allowed].sort(),
    [...AGENT_TOOLS].sort(),
    'manifest and AGENT_TOOLS must match; update workbuddy/mcp.json when tools change',
  );
});

test('the agent manifest never exposes an ops-only tool', async () => {
  const allowed = await manifestTools();
  for (const tool of ['execute_action', 'submit_approval', 'issue_mandate', 'revoke_mandate']) {
    assert.equal(allowed.includes(tool), false, `${tool} must not be given to the agent`);
    assert.equal(AGENT_TOOLS.has(tool), false, `${tool} must not be in AGENT_TOOLS`);
  }
});
