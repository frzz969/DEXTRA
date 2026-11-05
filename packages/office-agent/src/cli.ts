#!/usr/bin/env node
/**
 * Jalur CLI untuk satu vertical slice.
 *
 *   node --experimental-strip-types packages/office-agent/src/cli.ts \
 *     --principal usr_nadia --request "Tindak lanjuti notulen rapat" \
 *     --doc data/documents/notulen-rapat.md --assume-time 09:00
 *
 * Gunanya bukan demo: tanpa CLI, satu-satunya cara menguji alur ini adalah
 * lewat MCP yang belum terdaftar. Dengan CLI, alurnya bisa dijalankan hari ini
 * dan hasilnya diperiksa mata sendiri.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getRepoRoot } from '../../store/src/index.ts';

import { runOfficeAgent } from './run.ts';

interface CliArgs {
  principal: string | null;
  requestId: string;
  instruction: string;
  doc: string | null;
  assumeTime: string | null;
  duration: number | null;
  answers: Array<{ question_id: string; value: string }>;
  json: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    principal: null,
    requestId: `req_cli_${Date.now()}`,
    instruction: '',
    doc: null,
    assumeTime: null,
    duration: null,
    answers: [],
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const next = argv[index + 1];
    switch (flag) {
      case '--principal':
        args.principal = next ?? null;
        index += 1;
        break;
      case '--request-id':
        args.requestId = next ?? args.requestId;
        index += 1;
        break;
      case '--request':
        args.instruction = next ?? '';
        index += 1;
        break;
      case '--doc':
        args.doc = next ?? null;
        index += 1;
        break;
      case '--assume-time':
        args.assumeTime = next ?? null;
        index += 1;
        break;
      case '--duration':
        args.duration = next === undefined ? null : Number(next);
        index += 1;
        break;
      case '--answer': {
        const pair = (next ?? '').split('=');
        if (pair.length === 2) args.answers.push({ question_id: pair[0] as string, value: pair[1] as string });
        index += 1;
        break;
      }
      case '--json':
        args.json = true;
        break;
      default:
        break;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.principal === null) {
    console.error('--principal wajib: permintaan kantor harus bisa diatribusikan.');
    process.exitCode = 2;
    return;
  }

  const document =
    args.doc === null
      ? undefined
      : { filename: args.doc.split(/[\\/]/).pop() ?? 'dokumen.txt', content: await readFile(resolve(getRepoRoot(), args.doc), 'utf8') };

  const result = await runOfficeAgent(
    {
      request_id: args.requestId,
      instruction: args.instruction,
      requester_principal_id: args.principal,
      ...(document === undefined ? {} : { document }),
    },
    {
      ...(args.assumeTime === null ? {} : { assumptions: { time_of_day: args.assumeTime, ...(args.duration === null ? {} : { duration_minutes: args.duration }) } }),
      ...(args.answers.length === 0 ? {} : { answers: args.answers }),
    },
  );

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`status        : ${result.status}`);
  if (result.error) console.log(`error         : ${result.error.code} — ${result.error.message}`);
  console.log(`tujuan        : ${result.decomposition.goal}`);
  console.log(`keputusan     : ${result.decomposition.decisions.length}`);
  console.log(`action items  : ${result.decomposition.action_items.length}`);
  for (const item of result.decomposition.action_items) {
    console.log(`  - ${item.item_id} ${item.action_type} :: ${item.description}`);
  }
  if (result.assumptions.length > 0) {
    console.log('asumsi        :');
    for (const note of result.assumptions) console.log(`  - ${note}`);
  }
  if (result.session !== null) {
    console.log(`klarifikasi   : ${result.session.status} (${result.session.questions.length} pertanyaan)`);
    for (const question of result.session.questions) {
      const answered = result.session.answers.find((answer) => answer.question_id === question.question_id);
      console.log(`  - ${question.question_id}: ${question.prompt}`);
      for (const option of question.options) console.log(`      [${option.value}] ${option.label}${option.detail ? ` — ${option.detail}` : ''}`);
      if (answered) console.log(`      jawaban: ${answered.value} oleh ${answered.answered_by_principal_id}`);
    }
  }
  if (result.plan !== null) {
    console.log(`plan          : ${result.plan.plan_id} (${result.plan.status})`);
    console.log(`plan_hash     : ${result.plan.plan_hash}`);
    for (const action of result.plan.actions) {
      console.log(`  - ${action.action_id} ${action.action_type} → ${action.target.display_name} @ ${action.schedule.start_at} (${action.schedule.timezone})`);
    }
    console.log(`temuan plan   : ${result.plan.findings.map((finding) => `${finding.code}:${finding.severity}`).join(', ') || 'tidak ada'}`);
  }
  console.log(`validasi      : ${result.validation.verdict}`);
  for (const entry of result.validation.checks) console.log(`  - ${entry.id}: ${entry.status} — ${entry.detail}`);
  console.log(`audit         : ${result.audit_event_ids.join(', ') || 'tidak ada'}`);
}

await main();
