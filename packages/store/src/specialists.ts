import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { getRepoRoot } from './paths.ts';

/**
 * The specialist roster, read from `workbuddy/agents/*.md`.
 *
 * Why parse Markdown instead of a JSON file: those four files ARE the agent
 * definitions the WorkBuddy runtime loads. A second copy in JSON would be a
 * roster that can disagree with the agents actually running — and a roster that
 * can lie about its own agents is worse than no roster.
 *
 * The parser is deliberately literal. It returns only what the files state:
 *   `# Name`            -> name
 *   `## Peran`          -> role
 *   `## Batas` bullets  -> limits
 *   `## Tools` list     -> tools
 * Anything else (version numbers, "status: active", workload counters) is NOT
 * produced here, because the files do not contain it. The dashboard used to
 * show those fields from demo data; it no longer shows them at all.
 */
export interface SpecialistRecord {
  /** File name without extension — stable, and what audit events refer to. */
  id: string;
  name: string;
  role: string;
  limits: string[];
  tools: string[];
}

function section(lines: string[], heading: string): string[] {
  const start = lines.findIndex((l) => /^##\s+/.test(l) && l.slice(3).trim().toLowerCase().startsWith(heading));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^##\s+/.test(line)) break;
    out.push(line);
  }
  return out;
}

function parseAgent(id: string, source: string): SpecialistRecord {
  const lines = source.split(/\r?\n/);
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const name = titleLine ? titleLine.replace(/^#\s+/, '').trim() : id;

  const role = section(lines, 'peran')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const limits = section(lines, 'batas')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);

  /* The Tools block is a comma-separated line under a `## Tools …` heading.
   * The list is a prose sentence, so the final entry carries the full stop
   * ("…, get_status."). Strip punctuation from each entry: a tool name with a
   * trailing period would never match TOOL_CAPABILITY and would make the
   * roster claim a tool the server does not have. */
  const tools = section(lines, 'tools')
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .split(',')
    .map((t) => t.trim().replace(/[.;]+$/, ''))
    .filter(Boolean);

  return { id, name, role, limits, tools };
}

export async function listSpecialists(): Promise<SpecialistRecord[]> {
  const dir = join(getRepoRoot(), 'workbuddy', 'agents');
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.endsWith('.md')).sort();
  const rows = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(join(dir, file), 'utf8');
      return parseAgent(file.replace(/\.md$/, ''), source);
    })
  );
  return rows;
}
