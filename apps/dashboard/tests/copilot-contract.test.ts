/* Contract test — the Copilot must never offer a chip that cannot be honoured.
 *
 * Three things can silently rot here, and each one would be invisible until a
 * judge clicks it:
 *   1. an intent names a tool the MCP server does not implement;
 *   2. an intent names a compute function that was never written;
 *   3. an intent points at a route that is not registered.
 *
 * There is a fourth check that is not about rot at all but about the product:
 * the assistant must never be able to reach a mutating tool. Approval, mandate
 * issuance, execution and revocation belong to humans; if one of those ever
 * shows up as `tool:` in sources.js, the assistant has quietly become a way to
 * bypass the governance model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const sourcesSrc = read('apps/dashboard/assets/js/sources.js');
const copilotSrc = read('apps/dashboard/assets/js/copilot.js');
const shellSrc = read('apps/dashboard/assets/js/shell.js');
const handlersSrc = read('apps/mcp-server/src/handlers.ts');

/* Load the real sources.js instead of re-typing its contents here: a test that
   copies the data it checks can only ever agree with itself. */
const win: any = { DEXTRA: {} };
new Function('window', sourcesSrc)(win);
const sources = win.DEXTRA.sources;

const implementedTools = new Set(
  Array.from(handlersSrc.matchAll(/case '([a-z_]+)':/g)).map((m) => m[1])
);

const implementedComputes = new Set(
  Array.from(copilotSrc.matchAll(/computes\.([A-Za-z]+)\s*=/g)).map((m) => m[1])
);

const registeredPaths = new Set(
  Array.from(shellSrc.matchAll(/path:\s*'([^']+)'/g)).map((m) => m[1])
);

const MUTATING = ['submit_approval', 'issue_mandate', 'execute_action', 'revoke_mandate'];

test('every declared route is registered in the shell', () => {
  for (const r of sources.routes) {
    assert.ok(
      registeredPaths.has(r.route),
      `route ${r.route} is declared in sources.js but not registered in shell.js`
    );
  }
});

test('every tool a route claims to use exists in the MCP server', () => {
  for (const r of sources.routes) {
    for (const t of r.tools) {
      assert.ok(implementedTools.has(t), `route ${r.route} claims tool ${t}, which handlers.ts does not implement`);
    }
  }
});

test('every intent has a known kind', () => {
  const kinds = new Set(['answer', 'tool', 'go', 'handoff']);
  for (const { route, intent } of sources.allIntents()) {
    assert.ok(kinds.has(intent.kind), `${route} · ${intent.id} has unknown kind ${intent.kind}`);
  }
});

test('every tool intent points at an implemented tool', () => {
  for (const { route, intent } of sources.allIntents()) {
    if (intent.kind !== 'tool') continue;
    assert.ok(implementedTools.has(intent.tool), `${route} · ${intent.id} calls ${intent.tool}, which does not exist`);
  }
});

test('every answer intent has an implemented compute', () => {
  for (const { route, intent } of sources.allIntents()) {
    if (intent.kind !== 'answer') continue;
    assert.ok(
      implementedComputes.has(intent.compute),
      `${route} · ${intent.id} uses compute ${intent.compute}, which copilot.js does not implement`
    );
  }
});

test('every navigation intent points at a registered route', () => {
  for (const { route, intent } of sources.allIntents()) {
    if (intent.kind !== 'go' && intent.kind !== 'handoff') continue;
    assert.ok(registeredPaths.has(intent.path), `${route} · ${intent.id} navigates to ${intent.path}, which is not a route`);
  }
});

test('handoff intents explain why a human is required', () => {
  for (const { route, intent } of sources.allIntents()) {
    if (intent.kind !== 'handoff') continue;
    assert.ok(
      typeof intent.why === 'string' && intent.why.length > 30,
      `${route} · ${intent.id} is a handoff without a reason; a refusal must explain itself`
    );
  }
});

test('the assistant can never reach a mutating tool', () => {
  for (const { route, intent } of sources.allIntents()) {
    if (intent.kind !== 'tool') continue;
    assert.ok(
      !MUTATING.includes(intent.tool),
      `${route} · ${intent.id} exposes mutating tool ${intent.tool} to the assistant`
    );
  }
  /* The panel must not call them directly either — the only allowed route to
     those tools is the page that a human is looking at. */
  for (const t of MUTATING) {
    assert.ok(
      !new RegExp(`api\\.call\\(\\s*'${t}'`).test(copilotSrc),
      `copilot.js calls ${t} directly`
    );
  }
});

test('intent ids are unique within a route', () => {
  for (const r of sources.routes) {
    const ids = (r.intents || []).map((i: any) => i.id);
    assert.equal(new Set(ids).size, ids.length, `duplicate intent id on ${r.route}`);
  }
});

test('every data route offers at least one intent', () => {
  for (const r of sources.routes) {
    if (r.state === 'none') continue;
    assert.ok(
      (r.intents || []).length > 0,
      `${r.route} is a data route with no intents, so the assistant has nothing to offer there`
    );
  }
});

test('every workspace-wide question is offered on every route', () => {
  /* Matched by label rather than id: a route may answer the same question with
     its own wording, and intentsFor() de-duplicates by label so the chip is not
     repeated. What must hold is that the question is reachable from every
     screen, not that one particular id survives. */
  for (const g of sources.globalIntents) {
    for (const r of sources.routes) {
      const offered = sources.intentsFor(r.route).map((i: any) => String(i.label).toLowerCase());
      assert.ok(
        offered.includes(String(g.label).toLowerCase()),
        `${r.route} does not offer the global question "${g.label}"`
      );
    }
  }
});

test('no route shows the same chip label twice', () => {
  for (const r of sources.routes) {
    const labels = sources.intentsFor(r.route).map((i: any) => String(i.label).toLowerCase());
    assert.equal(new Set(labels).size, labels.length, `duplicate chip label on ${r.route}`);
  }
});
