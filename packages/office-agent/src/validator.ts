import type { Plan } from '../../contracts/src/index.ts';
import { computePlanHash } from '../../contracts/src/hash.ts';

import { openQuestions } from './clarify.ts';

import { looksLikeInstruction } from './document.ts';
import type {
  ClarificationSession,
  Decomposition,
  NormalizedDocument,
  OfficePolicyFinding,
  OfficeRequest,
  ResolvedAction,
  ValidationCheck,
  ValidationReport,
} from './types.ts';

/**
 * Validator independen, read-only.
 *
 * Ia membandingkan lima hal yang seharusnya saling konsisten: permintaan asli,
 * dokumen sumber, hasil dekomposisi, klarifikasi, dan plan akhir. Tidak ada
 * satu pun jalur di sini yang menulis, menyetujui, atau mengeksekusi — validasi
 * yang bisa mengubah keadaan bukan validasi.
 *
 * Bedanya dengan `validatePlan` di Policy Engine: engine memeriksa apakah plan
 * MELANGGAR aturan organisasi. Validator ini memeriksa apakah plan SETIA kepada
 * permintaan — termasuk apakah ada action yang lahir dari instruksi tertanam
 * atau dari kalimat yang tidak pernah diminta.
 */

export interface ValidateInput {
  request: OfficeRequest;
  document: NormalizedDocument | null;
  decomposition: Decomposition;
  session: ClarificationSession | null;
  plan: Plan | null;
  resolved: ResolvedAction[];
  policy_findings: ReadonlyArray<OfficePolicyFinding>;
}

function check(id: string, status: ValidationCheck['status'], detail: string): ValidationCheck {
  return { id, status, detail };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function validateOfficeOutput(input: ValidateInput): ValidationReport {
  const checks: ValidationCheck[] = [];
  const { request, document, decomposition, session, plan, resolved, policy_findings } = input;

  checks.push(
    request.request_id.trim() === '' || request.requester_principal_id.trim() === ''
      ? check('request.intake', 'fail', 'Permintaan tidak punya request_id atau principal.')
      : check('request.intake', 'pass', `Permintaan ${request.request_id} dari ${request.requester_principal_id}.`),
  );

  if (document !== null) {
    const blockIds = new Set(document.blocks.map((block) => block.block_id));
    const sources = decomposition.action_items.map((item) => item.source);
    const missingBlock = sources.find((source) => source.document_id === document.document_id && !blockIds.has(source.block_id));
    const wrongSha = sources.find((source) => source.document_id === document.document_id && source.document_sha256 !== document.source_sha256);
    checks.push(
      missingBlock !== undefined
        ? check('document.provenance', 'fail', `Sumber ${missingBlock.block_id} tidak ada di dokumen.`)
        : wrongSha !== undefined
          ? check('document.provenance', 'fail', 'Hash sumber tidak cocok dengan dokumen yang dinormalisasi.')
          : check('document.provenance', 'pass', `${sources.length} action merujuk blok yang ada di ${document.filename}.`),
    );
  } else {
    checks.push(check('document.provenance', 'pass', 'Tanpa dokumen; seluruh action berasal dari instruksi.'));
  }

  const resolvedIds = new Set(resolved.map((action) => action.item_id));
  const unresolvedItems = decomposition.action_items.filter((item) => !resolvedIds.has(item.item_id));
  checks.push(
    plan === null
      ? check('decomposition.completeness', 'warn', 'Belum ada plan; kelengkapan action belum bisa diperiksa.')
      : unresolvedItems.length > 0
        ? check('decomposition.completeness', 'fail', `${unresolvedItems.length} action item tidak terwakili di plan.`)
        : check('decomposition.completeness', 'pass', `${decomposition.action_items.length} action item terwakili.`),
  );

  if (plan !== null) {
    const mismatchedRecipient = resolved.find((action) => {
      const planAction = plan.actions.find((candidate) => candidate.target.contact_id === action.contact.contact_id);
      if (planAction === undefined) return true;
      return (
        planAction.target.display_name !== action.contact.display_name ||
        planAction.target.masked_address !== action.contact.masked_address
      );
    });
    checks.push(
      mismatchedRecipient !== undefined
        ? check('recipient.consistency', 'fail', `Penerima ${mismatchedRecipient.contact.contact_id} tidak konsisten dengan hasil resolusi.`)
        : check('recipient.consistency', 'pass', `${resolved.length} penerima konsisten dengan direktori.`),
    );

    const mismatchedSchedule = resolved.find((action) => {
      const planAction = plan.actions.find((candidate) => candidate.target.contact_id === action.contact.contact_id);
      if (planAction === undefined) return true;
      return (
        planAction.schedule.start_at !== action.schedule.start_at ||
        planAction.schedule.timezone !== action.schedule.timezone
      );
    });
    checks.push(
      mismatchedSchedule !== undefined
        ? check('schedule.consistency', 'fail', 'Jadwal di plan berbeda dari jadwal yang diperiksa policy.')
        : check('schedule.consistency', 'pass', 'Jadwal plan sama dengan jadwal yang diperiksa.'),
    );

    const planActions = plan.actions;
    const fidelityFailures = planActions.filter((action, index) => {
      const actionItem = decomposition.action_items[index];
      if (actionItem === undefined) return true;
      const quote = normalize(actionItem.source.quote).slice(0, 40);
      return quote.length > 0 && !normalize(action.content.body).includes(quote);
    });
    checks.push(
      fidelityFailures.length > 0
        ? check('fidelity.source', 'fail', `${fidelityFailures.length} isi action tidak dapat dilacak ke kalimat sumbernya.`)
        : check('fidelity.source', 'pass', 'Setiap isi action memuat kalimat sumbernya.'),
    );

    const instructionBlocks = new Set(document?.instruction_like_block_ids ?? []);
    const fromInstruction = decomposition.action_items.filter((item) => instructionBlocks.has(item.source.block_id));
    const broadcastTarget = planActions.find((action) => looksLikeInstruction(action.target.display_name) || /all staff|semua staf/i.test(action.target.display_name));
    checks.push(
      fromInstruction.length > 0
        ? check('embedded_instruction', 'fail', `${fromInstruction.length} action berasal dari blok yang menyerupai instruksi.`)
        : broadcastTarget !== undefined
          ? check('embedded_instruction', 'fail', 'Ada action yang menargetkan khalayak luas dari teks dokumen.')
          : check(
              'embedded_instruction',
              'pass',
              instructionBlocks.size === 0
                ? 'Tidak ada blok menyerupai instruksi.'
                : `${instructionBlocks.size} blok menyerupai instruksi diabaikan sebagai data.`,
            ),
    );

    const stillOpen = openQuestions(session);
    checks.push(
      stillOpen.length > 0
        ? check('clarification.resolved', 'fail', `${stillOpen.length} pertanyaan klarifikasi belum dijawab.`)
        : check('clarification.resolved', 'pass', session === null ? 'Tidak ada klarifikasi yang dibutuhkan.' : 'Semua klarifikasi terjawab.'),
    );

    const missingPolicy = policy_findings.filter(
      (entry) => entry.severity === 'blocking' && !plan.findings.some((finding) => finding.code === entry.code),
    );
    checks.push(
      missingPolicy.length > 0
        ? check('policy.compliance', 'fail', `Temuan blocking tidak masuk plan: ${missingPolicy.map((entry) => entry.code).join(', ')}.`)
        : check('policy.compliance', 'pass', 'Semua temuan office policy tercermin di plan.'),
    );

    const hashOk = computePlanHash(plan) === plan.plan_hash;
    const statusOk =
      plan.findings.some((finding) => finding.severity === 'blocking' && finding.code !== 'AMBIGUOUS_RECIPIENT')
        ? plan.status === 'BLOCKED'
        : plan.status !== 'BLOCKED';
    checks.push(
      !hashOk
        ? check('plan.integrity', 'fail', 'plan_hash tidak cocok dengan isi plan.')
        : !statusOk
          ? check('plan.integrity', 'fail', `Status ${plan.status} tidak konsisten dengan temuan.`)
          : check('plan.integrity', 'pass', `plan_hash sahih, status ${plan.status}.`),
    );
  } else {
    checks.push(check('recipient.consistency', 'warn', 'Belum ada plan; penerima belum bisa diperiksa.'));
    checks.push(check('schedule.consistency', 'warn', 'Belum ada plan; jadwal belum bisa diperiksa.'));
    checks.push(check('fidelity.source', 'warn', 'Belum ada plan; kesetiaan isi belum bisa diperiksa.'));
    checks.push(check('plan.integrity', 'warn', 'Belum ada plan untuk diperiksa.'));
  }

  const verdict: ValidationReport['verdict'] = checks.some((entry) => entry.status === 'fail')
    ? 'fail'
    : checks.some((entry) => entry.status === 'warn')
      ? 'warn'
      : 'pass';

  return { verdict, checks };
}
