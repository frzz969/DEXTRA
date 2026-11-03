import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillRegistry, validateSkillManifestSet, type SkillValidationCode } from '../src/index.ts';

const WORKERS = [
  { id: 'workforce-dispatcher', capabilities: ['route_task', 'read_workforce'] },
  { id: 'executive-assistant', capabilities: ['create_plan', 'read_calendar'] },
  { id: 'administrative-officer', capabilities: ['draft_document'] },
  { id: 'adversarial-reviewer', capabilities: ['review_plan'] },
];
const base = (overrides: Record<string, unknown> = {}) => ({
  manifest_version: '1.0.0',
  id: 'document-analysis',
  name: 'Document Analysis',
  version: '1.0.0',
  description: 'Extract facts and produce a cited analysis.',
  instructions: { path: 'instructions.md', sha256: `sha256:${'a'.repeat(64)}` },
  input_schema: { type: 'object', properties: { document_ref: { type: 'string', minLength: 1 } }, required: ['document_ref'], additionalProperties: false },
  output_schema: { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { claim: { type: 'string' } }, required: ['claim'] } } }, required: ['findings'] },
  required_capabilities: ['draft_document'],
  permission_requirements: [{ capability: 'create_request', resource_scope: 'assigned_work', approval: 'not_required' }],
  dependencies: [],
  compatible_workers: ['administrative-officer'],
  status: 'published',
  metadata: { category: 'analysis', tags: ['documents'] },
  ...overrides,
});
const validate = (manifests: unknown[]) => validateSkillManifestSet(manifests, { workers: WORKERS });
const hasCode = (report: ReturnType<typeof validate>, code: SkillValidationCode) => report.errors.some((error) => error.code === code);

test('valid skill manifest is accepted and metadata can be registered/discovered', () => {
  const manifest = base();
  const report = validate([manifest]);
  assert.equal(report.valid, true, JSON.stringify(report.errors));
  const registry = new SkillRegistry({ workers: WORKERS });
  assert.equal(registry.registerMany([manifest]).valid, true);
  assert.equal(registry.discover('administrative-officer').length, 1);
  assert.equal(registry.discover('executive-assistant').length, 0);
  assert.equal(registry.resolve('document-analysis', '1.0.0')?.name, 'Document Analysis');
});

test('unsupported manifest version and invalid SemVer receive stable error codes', () => {
  const report = validate([base({ manifest_version: '2.0.0', version: '1.0' })]);
  assert.equal(hasCode(report, 'UNSUPPORTED_MANIFEST_VERSION'), true);
  assert.equal(hasCode(report, 'INVALID_SEMVER'), true);
});

test('invalid and unsupported JSON Schema keywords are rejected', () => {
  const report = validate([base({
    input_schema: { type: 'object', properties: { x: { type: 'string', pattern: '[' } } },
    output_schema: { type: 'object', surprise: true },
  })]);
  assert.equal(hasCode(report, 'INVALID_JSON_SCHEMA'), true);
  assert.equal(hasCode(report, 'UNSUPPORTED_JSON_SCHEMA_KEYWORD'), true);
});

test('unknown worker capability and privileged permission requests are rejected', () => {
  const unknown = validate([base({ required_capabilities: ['made_up'] })]);
  assert.equal(hasCode(unknown, 'UNKNOWN_WORKER_CAPABILITY'), true);
  const privileged = validate([base({
    permission_requirements: [{ capability: 'execute', resource_scope: 'assigned_work', approval: 'human_mandate_required' }],
  })]);
  assert.equal(hasCode(privileged, 'PRIVILEGED_CAPABILITY_FORBIDDEN'), true);
});

test('permission requirements are separate from worker capabilities and enforce valid scopes', () => {
  const report = validate([base({
    permission_requirements: [{ capability: 'view_all', resource_scope: 'assigned_work', approval: 'not_required' }],
  })]);
  assert.equal(hasCode(report, 'PERMISSION_CONTRACT_MISMATCH'), true);
});

test('a skill cannot require a capability its compatible worker does not have', () => {
  const report = validate([base({ required_capabilities: ['read_calendar'] })]);
  assert.equal(hasCode(report, 'WORKER_CAPABILITY_MISMATCH'), true);
});

test('duplicate id and same version is rejected while separate versions are allowed', () => {
  const duplicate = validate([base(), base()]);
  assert.equal(hasCode(duplicate, 'DUPLICATE_SKILL_ID'), true);
  const versions = validate([base(), base({ version: '1.1.0' })]);
  assert.equal(versions.valid, true, JSON.stringify(versions.errors));
});

test('unavailable dependency and dependency version mismatch are rejected', () => {
  const missing = validate([base({ dependencies: [{ id: 'research', version: '1.0.0' }] })]);
  assert.equal(hasCode(missing, 'UNKNOWN_DEPENDENCY'), true);
  const mismatch = validate([base(), base({ id: 'report', dependencies: [{ id: 'document-analysis', version: '2.0.0' }] })]);
  assert.equal(hasCode(mismatch, 'DEPENDENCY_VERSION_NOT_FOUND'), true);
});

test('circular dependency is detected', () => {
  const a = base({ dependencies: [{ id: 'report', version: '1.0.0' }] });
  const b = base({ id: 'report', dependencies: [{ id: 'document-analysis', version: '1.0.0' }] });
  assert.equal(hasCode(validate([a, b]), 'DEPENDENCY_CYCLE'), true);
});

test('unknown worker and duplicate worker compatibility entries are rejected', () => {
  const unknown = validate([base({ compatible_workers: ['invented-worker'] })]);
  assert.equal(hasCode(unknown, 'UNKNOWN_WORKER'), true);
  const duplicate = validate([base({ compatible_workers: ['administrative-officer', 'administrative-officer'] })]);
  assert.equal(hasCode(duplicate, 'DUPLICATE_WORKER'), true);
});

test('instruction path traversal is rejected', () => {
  const report = validate([base({ instructions: { path: '../outside.md', sha256: `sha256:${'b'.repeat(64)}` } })]);
  assert.equal(hasCode(report, 'INVALID_INSTRUCTIONS_REF'), true);
});

test('registration is atomic and exact/latest version resolution is metadata-only', () => {
  const registry = new SkillRegistry({ workers: WORKERS });
  assert.equal(registry.registerMany([base()]).valid, true);
  const before = registry.discover().length;
  const invalid = registry.registerMany([base({ id: 'bad', version: 'v1', compatible_workers: ['missing'] })]);
  assert.equal(invalid.valid, false);
  assert.equal(registry.discover().length, before);
  assert.equal(registry.registerMany([base({ version: '1.2.0' })]).valid, true);
  assert.equal(registry.resolve('document-analysis')?.version, '1.2.0');
  assert.equal(registry.resolve('document-analysis', '1.0.0')?.version, '1.0.0');
  assert.deepEqual(registry.resolveDependencies('document-analysis', '1.2.0')?.map((entry) => entry.id), ['document-analysis']);
});

test('draft skills validate but are not discoverable or default-resolvable', () => {
  const registry = new SkillRegistry({ workers: WORKERS });
  assert.equal(registry.registerMany([base({ status: 'draft' })]).valid, true);
  assert.equal(registry.discover().length, 0);
  assert.equal(registry.resolve('document-analysis'), undefined);
});
