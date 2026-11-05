#!/usr/bin/env node
/**
 * Independent verifier for a DEXTRA audit export.
 *
 *   node --experimental-strip-types packages/audit-export/src/cli.ts <path>
 *
 * `<path>` may be the `.jsonl` artifact, the `.manifest.json`, or the directory
 * containing one export. The point of this command is that it runs without the
 * MCP server, without the dashboard, and without `data/` — the artifact and its
 * manifest are the only inputs.
 *
 * Exit codes:
 *   0  every check passed (or was honestly reported unverifiable)
 *   1  at least one check failed
 *   2  the export could not be read at all
 */
import { readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { verifyExport } from './verify.ts';

function usage(message: string): never {
  process.stderr.write(`${message}\n\nusage: cli.ts <export.jsonl | export.manifest.json | directory>\n`);
  process.exit(2);
}

async function resolvePair(input: string): Promise<{ jsonl: string; manifest: string }> {
  if (input.endsWith('.manifest.json')) {
    return { manifest: input, jsonl: join(dirname(input), basename(input, '.manifest.json') + '.jsonl') };
  }
  if (input.endsWith('.jsonl')) {
    return { jsonl: input, manifest: join(dirname(input), basename(input, '.jsonl') + '.manifest.json') };
  }
  /* A directory: exactly one export must live in it, otherwise the caller says which. */
  let entries: string[];
  try {
    entries = await readdir(input);
  } catch {
    usage(`not a file or directory: ${input}`);
  }
  const manifests = entries.filter((name) => name.endsWith('.manifest.json'));
  if (manifests.length === 0) usage(`no *.manifest.json in ${input}`);
  if (manifests.length > 1) usage(`${manifests.length} manifests in ${input}; name the one you mean`);
  const manifest = join(input, manifests[0]!);
  return { manifest, jsonl: join(input, manifests[0]!.replace(/\.manifest\.json$/, '.jsonl')) };
}

const input = process.argv[2];
if (input === undefined) usage('no export given');

const pair = await resolvePair(input);
const result = await verifyExport(pair.jsonl, pair.manifest);

const symbol = { pass: 'PASS', fail: 'FAIL', unverifiable: 'N/A ' } as const;
for (const check of result.checks) {
  process.stdout.write(`${symbol[check.status]}  ${check.id.padEnd(24)} ${check.detail}\n`);
}

if (result.integrity) {
  const i = result.integrity;
  process.stdout.write(
    `\nverified=${i.verified} unchained=${i.unchained} broken_at=${i.broken_at ?? 'none'} ` +
      `malformed_at=${i.malformed_at ?? 'none'} checkpoint=${i.checkpoint_status} ok=${i.ok}\n`,
  );
}

if (result.ok) {
  process.stdout.write(`\nVERIFIED — ${pair.jsonl}\n`);
  process.exit(0);
}
process.stdout.write(`\nNOT VERIFIED — ${result.failures.join(', ')}\n`);
process.exit(1);
