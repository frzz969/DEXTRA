import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DASHBOARD_PORT,
  InvalidOriginConfigurationError,
  defaultAllowedOrigins,
  evaluateRequest,
  parseAllowedOrigins,
  parseStrictOrigin,
} from '../src/origin-policy.ts';
import { startServer } from '../src/server.ts';

const SERVER_PORT = 8765;
const DASHBOARD_ORIGIN = `http://127.0.0.1:${DASHBOARD_PORT}`;
const defaults = new Set(defaultAllowedOrigins(SERVER_PORT));
const policy = { port: SERVER_PORT, allowedOrigins: parseAllowedOrigins(undefined, SERVER_PORT) };
const validHost = `127.0.0.1:${SERVER_PORT}`;

describe('D01-F01 environment allowlist can only narrow', () => {
  test('an external origin in DEXTRA_ALLOWED_ORIGINS fails closed', () => {
    assert.throws(
      () => parseAllowedOrigins('https://evil.example', SERVER_PORT),
      InvalidOriginConfigurationError,
    );
    assert.throws(
      () => parseAllowedOrigins('http://evil.example:3000', SERVER_PORT),
      InvalidOriginConfigurationError,
    );
    assert.throws(
      () => parseAllowedOrigins(`${DASHBOARD_ORIGIN},https://evil.example`, SERVER_PORT),
      InvalidOriginConfigurationError,
    );
  });

  test('a wildcard entry fails closed', () => {
    for (const value of ['*', 'http://*', `${DASHBOARD_ORIGIN},*`, 'http://127.0.0.1:*']) {
      assert.throws(() => parseAllowedOrigins(value, SERVER_PORT), InvalidOriginConfigurationError, value);
    }
  });

  test('malformed entries fail closed instead of being repaired', () => {
    const malformed = [
      `${DASHBOARD_ORIGIN}/`,
      `${DASHBOARD_ORIGIN}//`,
      `${DASHBOARD_ORIGIN}/path`,
      'https://127.0.0.1:3000',
      'http://127.0.0.1',
      'http://127.0.0.1:03000',
      'http://127.0.0.1:99999',
      'http://user:pass@127.0.0.1:3000',
      'localhost:3000',
      'null',
    ];
    for (const value of malformed) {
      assert.throws(() => parseAllowedOrigins(value, SERVER_PORT), InvalidOriginConfigurationError, value);
    }
  });

  test('a list with no usable entry fails closed', () => {
    for (const value of [',', ',,', ' , , ']) {
      assert.throws(() => parseAllowedOrigins(value, SERVER_PORT), InvalidOriginConfigurationError, value);
    }
  });

  test('whitespace-only segments are ignored, not turned into trust', () => {
    const parsed = parseAllowedOrigins(`${DASHBOARD_ORIGIN}, ,`, SERVER_PORT);
    assert.deepEqual([...parsed], [DASHBOARD_ORIGIN]);
  });

  test('duplicate entries collapse to a single origin', () => {
    const parsed = parseAllowedOrigins(`${DASHBOARD_ORIGIN},${DASHBOARD_ORIGIN}`, SERVER_PORT);
    assert.equal(parsed.size, 1);
    assert.ok(parsed.has(DASHBOARD_ORIGIN));
  });

  test('a valid origin that belongs to the defaults is accepted', () => {
    const parsed = parseAllowedOrigins(DASHBOARD_ORIGIN, SERVER_PORT);
    assert.deepEqual([...parsed], [DASHBOARD_ORIGIN]);
    assert.ok(defaults.has(DASHBOARD_ORIGIN));
  });

  test('the configured result is never a superset of the defaults', () => {
    const configurations = [
      undefined,
      '',
      DASHBOARD_ORIGIN,
      `${DASHBOARD_ORIGIN},http://localhost:3000`,
      `http://127.0.0.1:${SERVER_PORT}`,
    ];
    for (const configuration of configurations) {
      const configured = parseAllowedOrigins(configuration, SERVER_PORT);
      for (const origin of configured) {
        assert.ok(defaults.has(origin), `${origin} must exist in the default allowlist`);
      }
    }
  });

  test('the default allowlist covers the dashboard origin on the documented port', () => {
    assert.ok(policy.allowedOrigins.has('http://127.0.0.1:3000'));
    assert.ok(policy.allowedOrigins.has('http://localhost:3000'));
    assert.ok(!policy.allowedOrigins.has('https://127.0.0.1:3000'));
  });

  test('startServer refuses to start when the environment would widen the allowlist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dextra-env-'));
    const previousDataDir = process.env.DEXTRA_DATA_DIR;
    const previousAllowed = process.env.DEXTRA_ALLOWED_ORIGINS;
    process.env.DEXTRA_DATA_DIR = dir;
    process.env.DEXTRA_ALLOWED_ORIGINS = 'https://evil.example';
    try {
      assert.throws(() => startServer({ port: 0 }), InvalidOriginConfigurationError);
    } finally {
      if (previousDataDir === undefined) delete process.env.DEXTRA_DATA_DIR;
      else process.env.DEXTRA_DATA_DIR = previousDataDir;
      if (previousAllowed === undefined) delete process.env.DEXTRA_ALLOWED_ORIGINS;
      else process.env.DEXTRA_ALLOWED_ORIGINS = previousAllowed;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          await rm(dir, { recursive: true, force: true });
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }
  });
});

describe('D01-U06 strict origin parsing', () => {
  test('accepts only exact http loopback origins', () => {
    assert.equal(parseStrictOrigin('http://127.0.0.1:3000'), 'http://127.0.0.1:3000');
    assert.equal(parseStrictOrigin('HTTP://127.0.0.1:3000'), 'http://127.0.0.1:3000');
    assert.equal(parseStrictOrigin('http://localhost:3000'), 'http://localhost:3000');
    assert.equal(parseStrictOrigin('http://[::1]:3000'), 'http://[::1]:3000');
  });

  test('rejects trailing slashes, paths, schemes, hosts, and ambiguous ports', () => {
    const invalid = [
      'null',
      '',
      '  http://127.0.0.1:3000',
      'http://127.0.0.1:3000 ',
      'http://127.0.0.1:3000/',
      'http://127.0.0.1:3000///',
      'http://127.0.0.1:3000/a',
      'http://127.0.0.1:3000?x=1',
      'http://127.0.0.1:3000#f',
      'https://127.0.0.1:3000',
      'http://evil.example:3000',
      'http://127.0.0.1:03000',
      'http://127.0.0.1:70000',
      'http://127.0.0.1:abc',
      'http://user:pass@127.0.0.1:3000',
      'http://127.0.0.1',
    ];
    for (const value of invalid) {
      assert.equal(parseStrictOrigin(value), null, `${value} must not parse`);
    }
  });

  test('trailing-slash variants do not become a trusted origin', () => {
    for (const origin of ['http://127.0.0.1:3000/', 'http://127.0.0.1:3000//', 'http://127.0.0.1:3000///']) {
      const decision = evaluateRequest({ method: 'POST', origin, host: validHost }, policy);
      assert.equal(decision.action, 'reject', origin);
    }
  });

  test('a present but empty Origin is malformed, not treated as absent', () => {
    for (const origin of ['', '   ']) {
      const decision = evaluateRequest({ method: 'POST', origin, host: validHost }, policy);
      assert.equal(decision.action, 'reject', JSON.stringify(origin));
      if (decision.action === 'reject') assert.equal(decision.code, 'FORBIDDEN_ORIGIN');
    }
  });
});

describe('D01-F02 host handling is fail-closed', () => {
  test('a missing or blank Host is refused', () => {
    assert.deepEqual(
      evaluateRequest({ method: 'GET', origin: DASHBOARD_ORIGIN }, policy),
      { action: 'reject', status: 400, code: 'MISSING_HOST' },
    );
    assert.deepEqual(
      evaluateRequest({ method: 'GET', origin: DASHBOARD_ORIGIN, host: '' }, policy),
      { action: 'reject', status: 400, code: 'MISSING_HOST' },
    );
    assert.deepEqual(
      evaluateRequest({ method: 'GET', origin: DASHBOARD_ORIGIN, host: '   ' }, policy),
      { action: 'reject', status: 400, code: 'MISSING_HOST' },
    );
  });

  test('a Host without a port is refused as ambiguous', () => {
    assert.deepEqual(
      evaluateRequest({ method: 'GET', host: '127.0.0.1' }, policy),
      { action: 'reject', status: 403, code: 'FORBIDDEN_HOST' },
    );
    assert.deepEqual(
      evaluateRequest({ method: 'GET', host: 'localhost' }, policy),
      { action: 'reject', status: 403, code: 'FORBIDDEN_HOST' },
    );
  });

  test('hosts with whitespace, wrong ports, external names, or ambiguity are refused', () => {
    for (const host of [
      'evil.example:8765',
      '127.0.0.1:9999',
      '127.0.0.1:8765:80',
      'bad host:8765',
      ' 127.0.0.1:8765',
      '127.0.0.1:8765 ',
      '[::1]:9999',
      // Junk ports must not be coerced into the bound port by Number().
      '127.0.0.1:8765.',
      '127.0.0.1:08765',
      '127.0.0.1:+8765',
      '127.0.0.1:0',
      '127.0.0.1:999999999999',
    ]) {
      const decision = evaluateRequest({ method: 'GET', origin: DASHBOARD_ORIGIN, host }, policy);
      assert.equal(decision.action, 'reject', host);
    }
  });
});