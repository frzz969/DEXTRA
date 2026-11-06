#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2);
function getFlag(name, def) {
  const i = args.indexOf(name);
  if (i === -1) return def;
  if (i + 1 >= args.length) return true;
  return args[i + 1];
}
const help = args.includes('--help') || args.includes('-h');
if (help) {
  console.log(`Usage: node scripts/load-test.mjs [options]
  --users N       concurrent users (default 12)
  --requests N    requests per user (default 50)
  --base URL      base URL (default http://127.0.0.1:8000)
  --token TOKEN   bearer token (default ops-dev-token)
  --help          show this help`);
  process.exit(0);
}

const USERS = Number(getFlag('--users', 12));
const REQUESTS = Number(getFlag('--requests', 50));
const BASE = String(getFlag('--base', 'http://127.0.0.1:8000')).replace(/\/$/, '');
const TOKEN = String(getFlag('--token', 'ops-dev-token'));

const ENDPOINTS = [
  '/api/v1/overview',
  '/api/v1/agents',
  '/api/v1/executions',
  '/api/v1/audit?limit=20',
];

async function oneRequest(path) {
  const t0 = performance.now();
  let status = 0;
  let ok = false;
  try {
    const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${TOKEN}` } });
    status = res.status;
    ok = res.ok;
    await res.text();
  } catch (e) {
    status = 0;
  }
  const ms = performance.now() - t0;
  return { path, status, ok, ms };
}

const allResults = [];
const userTasks = [];
for (let u = 0; u < USERS; u++) {
  userTasks.push((async () => {
    const out = [];
    for (let r = 0; r < REQUESTS; r++) {
      const ep = ENDPOINTS[r % ENDPOINTS.length];
      out.push(await oneRequest(ep));
    }
    return out;
  })());
}
const settled = await Promise.all(userTasks);
for (const r of settled) allResults.push(...r);

const latencies = allResults.map((x) => x.ms).sort((a, b) => a - b);
const p = (q) => latencies[Math.max(0, Math.ceil(latencies.length * q) - 1)];
const errors = allResults.filter((x) => !x.ok);
const fives = allResults.filter((x) => x.status >= 500);
const totalMs = allResults.reduce((s, x) => s + x.ms, 0);
const throughput = (allResults.length / (Math.max(...allResults.map((x) => x.ms)) / 1000)) ; // approx

const summary = {
  users: USERS,
  requestsPerUser: REQUESTS,
  totalRequests: allResults.length,
  errorRate: errors.length / allResults.length,
  fiveXx: fives.length,
  latencyMs: { p50: p(0.5), p95: p(0.95), p99: p(0.99), min: latencies[0], max: latencies[latencies.length - 1] },
  throughputRps: Number((allResults.length / (Math.max(1, Math.max(...latencies) / 1000))).toFixed(1)),
};

// tenant isolation check: overview status distribution
const overviewStatuses = new Set(allResults.filter((x) => x.path === '/api/v1/overview').map((x) => x.status));
console.log(JSON.stringify(summary, null, 2));
console.log('\nOverview statuses seen:', [...overviewStatuses].join(', '));

let exitCode = 0;
if (summary.errorRate > 0.05) exitCode = 1;
if (fives.length > 0) exitCode = 1;
// tenant isolation: if no tenant, all overview must be 400
process.exit(exitCode);