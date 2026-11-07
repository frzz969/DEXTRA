#!/usr/bin/env node
/* Serve the dashboard with no build step and no dependencies.
 *
 * `python -m http.server` worked, but it was a second runtime to explain on a
 * machine that may not have Python on PATH. This does the same job with the
 * Node that is already required by the rest of the repo.
 *
 * Binds 127.0.0.1 only: the dashboard talks to a local MCP server and has no
 * business being reachable from the network.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'dashboard');
const port = Number(process.env.DEXTRA_DASHBOARD_PORT ?? 8899);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';

    /* Resolve inside the dashboard root and reject anything that escapes it. */
    const target = normalize(join(root, rel));
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(target);
    if (info.isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`DEXTRA dashboard  ->  http://127.0.0.1:${port}/index.html`);
  console.log('Tanpa server MCP, dashboard berjalan dalam mode demo dan menyatakan itu di layar.');
  console.log('Untuk data nyata: pnpm run demo:seed  lalu  pnpm run dev:mcp  (terminal lain)');
});
