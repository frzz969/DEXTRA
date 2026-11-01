import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveScope, isAllowed, AGENT_TOOLS, OPS_TOOLS } from '../src/auth.ts';

describe('auth scoping', () => {
  test('agent token resolves to agent scope', () => {
    process.env.DEXTRA_AGENT_TOKEN = 'agent-dev-token';
    process.env.DEXTRA_OPS_TOKEN = 'ops-dev-token';
    assert.equal(resolveScope('agent-dev-token'), 'agent');
    assert.equal(resolveScope('ops-dev-token'), 'ops');
    assert.equal(resolveScope('wrong'), null);
    assert.equal(resolveScope(''), null);
    assert.equal(resolveScope(undefined), null);
  });

  test('timingSafeEqual does not throw on length mismatch', () => {
    process.env.DEXTRA_AGENT_TOKEN = 'agent-dev-token';
    process.env.DEXTRA_OPS_TOKEN = 'ops-dev-token';
    assert.doesNotThrow(() => resolveScope('short'));
    assert.doesNotThrow(() => resolveScope('a'.repeat(1000)));
  });

  test('agent scope cannot see execute/issue/submit/revoke/audit tools', () => {
    for (const t of ['execute_action', 'issue_mandate', 'submit_approval', 'revoke_mandate', 'get_audit_log']) {
      assert.equal(isAllowed('agent', t), false, `${t} should not be allowed for agent`);
    }
  });

  test('ops scope sees all 12 tools', () => {
    assert.equal(OPS_TOOLS.size, 12);
    for (const t of OPS_TOOLS) assert.equal(isAllowed('ops', t), true);
  });

  test('agent scope sees exactly 7 tools', () => {
    assert.equal(AGENT_TOOLS.size, 7);
  });
});
