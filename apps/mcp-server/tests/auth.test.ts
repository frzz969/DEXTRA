import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveScope, isAllowed, AGENT_TOOLS, OPS_TOOLS, callerContext } from '../src/auth.ts';
import {
  TOOL_NAMES,
  SCOPE_CAPABILITIES,
  UNBACKED_CAPABILITIES,
  scopeAllowsTool,
  toolsForScope,
  isKnownCapability,
} from '../../../packages/contracts/src/authorization.ts';

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
    assert.doesNotThrow(() => resolveScope('short'));
    assert.doesNotThrow(() => resolveScope('a'.repeat(1000)));
  });

  test('agent scope cannot see execute/issue/submit/revoke/audit tools', () => {
    for (const t of ['execute_action', 'issue_mandate', 'submit_approval', 'revoke_mandate', 'get_audit_log']) {
      assert.equal(isAllowed('agent', t), false, `${t} should not be allowed for agent`);
    }
  });

  test('the allowlist is derived from the capability contract, not hand-written', () => {
    // If these ever diverge, someone has re-introduced a second source of truth.
    assert.deepEqual([...AGENT_TOOLS].sort(), [...toolsForScope('agent')].sort());
    assert.deepEqual([...OPS_TOOLS].sort(), [...toolsForScope('ops')].sort());
    /*
     * Angka ini sengaja tetap harfiah: tujuannya menangkap perubahan izin yang
     * tidak disengaja. `list_alerts` menambah satu tool ops (view_audit) pada
     * 2026-11-03; agent tidak mendapatkannya, karena membaca riwayat alert
     * adalah pandangan seluruh organisasi, bukan pandangan sendiri.
     */
    assert.equal(OPS_TOOLS.size, 18);
    assert.equal(AGENT_TOOLS.size, 12);
  });

  test('every tool in the contract appears in at least one scope', () => {
    const union = new Set([...AGENT_TOOLS, ...OPS_TOOLS]);
    for (const tool of TOOL_NAMES) {
      assert.equal(union.has(tool), true, `${tool} is declared but granted to no scope`);
    }
  });

  test('agent scope is a strict subset of ops scope', () => {
    for (const tool of AGENT_TOOLS) {
      assert.equal(OPS_TOOLS.has(tool), true, `${tool} should also be available to ops`);
    }
  });

  test('unknown tool names are denied for every scope', () => {
    for (const scope of ['agent', 'ops'] as const) {
      assert.equal(isAllowed(scope, 'drop_database'), false);
      assert.equal(isAllowed(scope, ''), false);
      assert.equal(scopeAllowsTool(scope, 'drop_database'), false);
    }
  });
});

describe('capability contract', () => {
  test('admin capabilities are unbacked, not denied', () => {
    // The distinction matters: "denied" means a decision was made; "unbacked"
    // means the server implements no such authorization at all.
    for (const cap of ['manage_users', 'manage_integrations', 'edit_policy']) {
      assert.equal(isKnownCapability(cap), true);
      assert.equal(
        UNBACKED_CAPABILITIES.includes(cap as never),
        true,
        `${cap} must be reported as unbacked, not silently granted`,
      );
    }
  });

  test('no scope grants an unbacked capability', () => {
    for (const scope of ['agent', 'ops'] as const) {
      for (const cap of UNBACKED_CAPABILITIES) {
        assert.equal(
          SCOPE_CAPABILITIES[scope].includes(cap),
          false,
          `${scope} must not grant unbacked capability ${cap}`,
        );
      }
    }
  });

  test('unknown capability names are not recognised', () => {
    assert.equal(isKnownCapability('become_root'), false);
    assert.equal(isKnownCapability(''), false);
  });

  test('caller context reports principal honestly (null when no roster binding)', async () => {
    const ctx = await callerContext('ops');
    assert.equal(ctx.scope, 'ops');
    // principal may be null (no roster) or a roster entry — never fabricated.
    assert.ok(ctx.principal === null || (ctx.principal && typeof ctx.principal.principal_id === 'string'));
    assert.equal(ctx.tools.length, OPS_TOOLS.size);
    assert.deepEqual(ctx.capabilities, [...SCOPE_CAPABILITIES.ops]);
  });
});
