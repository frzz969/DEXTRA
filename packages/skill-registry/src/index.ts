import {
  isKnownCapability,
  SkillManifestSchema,
  SKILL_MANIFEST_VERSION,
  type Capability,
  type SkillManifest,
} from '../../contracts/src/index.ts';

export const SKILL_VALIDATION_CODES = [
  'INVALID_MANIFEST', 'UNSUPPORTED_MANIFEST_VERSION', 'INVALID_SEMVER',
  'INVALID_INSTRUCTIONS_REF', 'INVALID_JSON_SCHEMA', 'UNSUPPORTED_JSON_SCHEMA_KEYWORD',
  'UNKNOWN_CAPABILITY', 'UNKNOWN_WORKER_CAPABILITY', 'WORKER_CAPABILITY_MISMATCH',
  'PRIVILEGED_CAPABILITY_FORBIDDEN', 'PERMISSION_CONTRACT_MISMATCH',
  'UNKNOWN_DEPENDENCY', 'DEPENDENCY_VERSION_NOT_FOUND', 'DEPENDENCY_NOT_PUBLISHED', 'DUPLICATE_DEPENDENCY',
  'DEPENDENCY_CYCLE', 'DUPLICATE_SKILL_ID', 'UNKNOWN_WORKER', 'DUPLICATE_WORKER', 'INVALID_METADATA',
] as const;
export type SkillValidationCode = (typeof SKILL_VALIDATION_CODES)[number];
export interface SkillValidationIssue { code: SkillValidationCode; path: string; message: string; }
export interface SkillValidationReport { valid: boolean; errors: SkillValidationIssue[]; manifests: SkillManifest[]; }
export interface SkillWorkerDescriptor {
  id: string;
  /** Existing workforce capabilities such as `draft_document`, not MCP authorization capabilities. */
  capabilities: readonly string[];
}
export interface SkillValidationContext { workers: readonly SkillWorkerDescriptor[]; }

const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const RESERVED_CAPABILITIES = new Set<Capability>(['approve', 'issue_mandate', 'revoke_mandate', 'execute', 'edit_policy', 'manage_users', 'manage_integrations']);
const JSON_SCHEMA_KEYWORDS = new Set(['$schema', 'type', 'title', 'description', '$comment', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'default', 'examples', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minItems', 'maxItems', 'uniqueItems']);
const JSON_SCHEMA_TYPES = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const JSON_SCHEMA_FORMATS = new Set(['date-time', 'email', 'hostname', 'uri', 'uuid']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isJsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, ancestors))
    : isPlainObject(value) && Object.values(value).every((item) => isJsonValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function issue(errors: SkillValidationIssue[], code: SkillValidationCode, path: string, message: string): void {
  errors.push({ code, path, message });
}

function validSemver(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = SEMVER_RE.exec(value);
  if (!match) return false;
  return !match[4] || match[4].split('.').every((part) => !/^0\d+$/.test(part));
}

function safeInstructionPath(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\\')) return false;
  if (value.startsWith('/') || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function validateJsonSchema(input: unknown, path: string, errors: SkillValidationIssue[], ancestors = new Set<object>(), depth = 0): void {
  if (!isPlainObject(input)) { issue(errors, 'INVALID_JSON_SCHEMA', path, 'Schema node must be a JSON object.'); return; }
  if (depth > 24) { issue(errors, 'INVALID_JSON_SCHEMA', path, 'Schema nesting exceeds 24 levels.'); return; }
  if (ancestors.has(input)) { issue(errors, 'INVALID_JSON_SCHEMA', path, 'Schema contains a circular object reference.'); return; }
  ancestors.add(input);

  for (const keyword of Object.keys(input)) {
    if (!JSON_SCHEMA_KEYWORDS.has(keyword)) issue(errors, 'UNSUPPORTED_JSON_SCHEMA_KEYWORD', `${path}.${keyword}`, `Keyword ${keyword} is outside the supported manifest v1 subset.`);
  }
  if (typeof input.type !== 'string' || !JSON_SCHEMA_TYPES.has(input.type)) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.type`, 'A supported string type is required.');
  if (input.$schema !== undefined && input.$schema !== 'https://json-schema.org/draft/2020-12/schema') issue(errors, 'INVALID_JSON_SCHEMA', `${path}.$schema`, 'Only JSON Schema draft 2020-12 is supported.');
  for (const key of ['title', 'description', '$comment'] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'string') issue(errors, 'INVALID_JSON_SCHEMA', `${path}.${key}`, `${key} must be a string.`);
  }
  for (const key of ['default', 'examples', 'const', 'enum'] as const) {
    if (input[key] !== undefined && !isJsonValue(input[key])) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.${key}`, `${key} must contain JSON-safe values.`);
  }
  if (input.enum !== undefined && (!Array.isArray(input.enum) || input.enum.length === 0)) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.enum`, 'enum must be a non-empty array.');
  if (input.format !== undefined && (typeof input.format !== 'string' || !JSON_SCHEMA_FORMATS.has(input.format))) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.format`, 'format is not supported by manifest v1.');
  if (input.pattern !== undefined) {
    if (typeof input.pattern !== 'string') issue(errors, 'INVALID_JSON_SCHEMA', `${path}.pattern`, 'pattern must be a string.');
    else { try { new RegExp(input.pattern); } catch { issue(errors, 'INVALID_JSON_SCHEMA', `${path}.pattern`, 'pattern is not a valid regular expression.'); } }
  }
  for (const key of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum'] as const) {
    if (input[key] !== undefined && (typeof input[key] !== 'number' || !Number.isFinite(input[key]))) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.${key}`, `${key} must be a finite number.`);
  }
  if (typeof input.minimum === 'number' && typeof input.maximum === 'number' && input.minimum > input.maximum) issue(errors, 'INVALID_JSON_SCHEMA', path, 'minimum cannot exceed maximum.');
  for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems'] as const) {
    if (input[key] !== undefined && (typeof input[key] !== 'number' || !Number.isInteger(input[key]) || (input[key] as number) < 0)) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.${key}`, `${key} must be a non-negative integer.`);
  }
  if (typeof input.minLength === 'number' && typeof input.maxLength === 'number' && input.minLength > input.maxLength) issue(errors, 'INVALID_JSON_SCHEMA', path, 'minLength cannot exceed maxLength.');
  if (typeof input.minItems === 'number' && typeof input.maxItems === 'number' && input.minItems > input.maxItems) issue(errors, 'INVALID_JSON_SCHEMA', path, 'minItems cannot exceed maxItems.');
  if (input.uniqueItems !== undefined && typeof input.uniqueItems !== 'boolean') issue(errors, 'INVALID_JSON_SCHEMA', `${path}.uniqueItems`, 'uniqueItems must be boolean.');

  if (input.type === 'object') {
    const properties = input.properties;
    if (properties !== undefined) {
      if (!isPlainObject(properties)) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.properties`, 'properties must be an object of schemas.');
      else for (const [key, child] of Object.entries(properties)) validateJsonSchema(child, `${path}.properties.${key}`, errors, ancestors, depth + 1);
    }
    if (input.required !== undefined) {
      if (!Array.isArray(input.required) || input.required.some((key) => typeof key !== 'string') || new Set(input.required).size !== input.required.length) {
        issue(errors, 'INVALID_JSON_SCHEMA', `${path}.required`, 'required must be an array of unique strings.');
      } else if (input.required.length > 0 && !isPlainObject(properties)) {
        issue(errors, 'INVALID_JSON_SCHEMA', `${path}.required`, 'required keys need a properties object in manifest v1.');
      } else if (isPlainObject(properties) && input.required.some((key) => !Object.hasOwn(properties, key as string))) {
        issue(errors, 'INVALID_JSON_SCHEMA', `${path}.required`, 'Every required key must be declared in properties.');
      }
    }
    if (input.additionalProperties !== undefined && typeof input.additionalProperties !== 'boolean') validateJsonSchema(input.additionalProperties, `${path}.additionalProperties`, errors, ancestors, depth + 1);
  }
  if (input.type === 'array') {
    if (input.items === undefined) issue(errors, 'INVALID_JSON_SCHEMA', `${path}.items`, 'array schemas must declare items.');
    else validateJsonSchema(input.items, `${path}.items`, errors, ancestors, depth + 1);
  }
  ancestors.delete(input);
}

function semverParts(version: string): { core: number[]; prerelease: string[] } {
  const [withoutBuild] = version.split('+', 2);
  const [coreText, preText] = (withoutBuild ?? '').split('-', 2);
  return { core: (coreText ?? '').split('.').map(Number), prerelease: preText ? preText.split('.') : [] };
}

function compareSemver(leftVersion: string, rightVersion: string): number {
  const left = semverParts(leftVersion);
  const right = semverParts(rightVersion);
  for (let index = 0; index < 3; index += 1) {
    const delta = (left.core[index] ?? 0) - (right.core[index] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1;
  if (right.prerelease.length === 0 && left.prerelease.length > 0) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const l = left.prerelease[index]; const r = right.prerelease[index];
    if (l === undefined) return -1;
    if (r === undefined) return 1;
    if (l === r) continue;
    const lNum = /^\d+$/.test(l); const rNum = /^\d+$/.test(r);
    if (lNum && rNum) return Math.sign(Number(l) - Number(r));
    if (lNum !== rNum) return lNum ? -1 : 1;
    return l < r ? -1 : 1;
  }
  return 0;
}

function keyOf(id: string, version: string): string { return `${id}@${version}`; }

function validateSemanticRules(manifest: SkillManifest, index: number, workers: Map<string, Set<string>>, knownWorkerCapabilities: Set<string>, errors: SkillValidationIssue[]): void {
  const prefix = `manifests[${index}]`;
  if (!validSemver(manifest.version)) issue(errors, 'INVALID_SEMVER', `${prefix}.version`, 'version must be valid SemVer (major.minor.patch).');
  if (!safeInstructionPath(manifest.instructions.path)) issue(errors, 'INVALID_INSTRUCTIONS_REF', `${prefix}.instructions.path`, 'instructions.path must be a safe relative path without traversal.');

  const skillCapabilities = new Set(manifest.required_capabilities);
  if (skillCapabilities.size !== manifest.required_capabilities.length) issue(errors, 'PERMISSION_CONTRACT_MISMATCH', `${prefix}.required_capabilities`, 'required_capabilities contains duplicates.');
  for (const capability of manifest.required_capabilities) {
    if (!knownWorkerCapabilities.has(capability)) issue(errors, 'UNKNOWN_WORKER_CAPABILITY', `${prefix}.required_capabilities`, `Unknown DEXTRA worker capability ${capability}.`);
  }
  for (let item = 0; item < manifest.permission_requirements.length; item += 1) {
    const requirement = manifest.permission_requirements[item]!;
    const path = `${prefix}.permission_requirements[${item}]`;
    if (RESERVED_CAPABILITIES.has(requirement.capability)) issue(errors, 'PRIVILEGED_CAPABILITY_FORBIDDEN', path, `Skills cannot declare governance/execution capability ${requirement.capability}; use the approval and mandate services.`);
    const expectedScopes: Record<string, readonly string[]> = {
      view_own: ['own_records', 'assigned_work'],
      view_all: ['organization'],
      create_request: ['assigned_work', 'own_records'],
      view_audit: ['own_records', 'organization'],
    };
    const allowedScopes = expectedScopes[requirement.capability];
    if (!allowedScopes || !allowedScopes.includes(requirement.resource_scope)) issue(errors, 'PERMISSION_CONTRACT_MISMATCH', path, `resource_scope ${requirement.resource_scope} is not valid for ${requirement.capability}.`);
  }

  const seenWorkers = new Set<string>();
  for (const worker of manifest.compatible_workers) {
    if (seenWorkers.has(worker)) issue(errors, 'DUPLICATE_WORKER', `${prefix}.compatible_workers`, `Worker ${worker} is listed more than once.`);
    seenWorkers.add(worker);
    const workerCapabilities = workers.get(worker);
    if (!workerCapabilities) issue(errors, 'UNKNOWN_WORKER', `${prefix}.compatible_workers`, `Worker ${worker} is not in the supplied DEXTRA workforce catalog.`);
    else for (const capability of manifest.required_capabilities) {
      if (!workerCapabilities.has(capability)) issue(errors, 'WORKER_CAPABILITY_MISMATCH', `${prefix}.compatible_workers`, `Worker ${worker} does not have required worker capability ${capability}.`);
    }
  }
  if (!isJsonValue(manifest.metadata)) issue(errors, 'INVALID_METADATA', `${prefix}.metadata`, 'metadata must contain finite JSON-safe values and no cycles.');
  validateJsonSchema(manifest.input_schema, `${prefix}.input_schema`, errors);
  validateJsonSchema(manifest.output_schema, `${prefix}.output_schema`, errors);
}

/** Validate one catalog snapshot. Dependencies use exact id+SemVer pins. */
export function validateSkillManifestSet(input: readonly unknown[], context: SkillValidationContext): SkillValidationReport {
  const errors: SkillValidationIssue[] = [];
  const workers = new Map<string, Set<string>>();
  for (const worker of context.workers) {
    if (workers.has(worker.id)) issue(errors, 'DUPLICATE_WORKER', 'context.workers', `Worker ${worker.id} appears more than once.`);
    workers.set(worker.id, new Set(worker.capabilities));
  }
  const knownWorkerCapabilities = new Set([...workers.values()].flatMap((capabilities) => [...capabilities]));
  const manifests: SkillManifest[] = [];
  const firstAt = new Map<string, number>();

  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index];
    if (isPlainObject(raw)) {
      if (raw.manifest_version !== SKILL_MANIFEST_VERSION) issue(errors, 'UNSUPPORTED_MANIFEST_VERSION', `manifests[${index}].manifest_version`, `Supported manifest_version is ${SKILL_MANIFEST_VERSION}.`);
      if (typeof raw.version === 'string' && !validSemver(raw.version)) issue(errors, 'INVALID_SEMVER', `manifests[${index}].version`, 'version must be valid SemVer (major.minor.patch).');
      for (const capability of Array.isArray(raw.required_capabilities) ? raw.required_capabilities : []) {
        if (typeof capability === 'string' && !knownWorkerCapabilities.has(capability)) issue(errors, 'UNKNOWN_WORKER_CAPABILITY', `manifests[${index}].required_capabilities`, `Unknown DEXTRA worker capability ${capability}.`);
      }
      for (const requirement of Array.isArray(raw.permission_requirements) ? raw.permission_requirements : []) {
        if (isPlainObject(requirement) && typeof requirement.capability === 'string' && !isKnownCapability(requirement.capability)) issue(errors, 'UNKNOWN_CAPABILITY', `manifests[${index}].permission_requirements`, `Unknown DEXTRA capability ${requirement.capability}.`);
      }
    }
    const parsed = SkillManifestSchema.safeParse(raw);
    if (!parsed.success) {
      for (const problem of parsed.error.issues) issue(errors, 'INVALID_MANIFEST', `manifests[${index}]${problem.path.length ? `.${problem.path.join('.')}` : ''}`, problem.message);
      continue;
    }
    const manifest = parsed.data;
    manifests.push(manifest);
    const key = keyOf(manifest.id, manifest.version);
    const previous = firstAt.get(key);
    if (previous !== undefined) issue(errors, 'DUPLICATE_SKILL_ID', `manifests[${index}].id`, `Duplicate skill identity ${key} (first at index ${previous}). Different versions of one stable skill ID are allowed.`);
    else firstAt.set(key, index);
    validateSemanticRules(manifest, index, workers, knownWorkerCapabilities, errors);
  }

  const byKey = new Map(manifests.map((manifest) => [keyOf(manifest.id, manifest.version), manifest]));
  const graph = new Map<string, string[]>();
  for (let index = 0; index < manifests.length; index += 1) {
    const manifest = manifests[index]!; const currentKey = keyOf(manifest.id, manifest.version);
    const seen = new Set<string>(); const edges: string[] = [];
    for (let depIndex = 0; depIndex < manifest.dependencies.length; depIndex += 1) {
      const dependency = manifest.dependencies[depIndex]!; const depKey = keyOf(dependency.id, dependency.version);
      const path = `manifests[${index}].dependencies[${depIndex}]`;
      if (seen.has(depKey)) issue(errors, 'DUPLICATE_SKILL_ID', path, `Dependency ${depKey} is repeated.`);
      seen.add(depKey);
      const resolved = byKey.get(depKey);
      if (!resolved) {
        const idExists = manifests.some((candidate) => candidate.id === dependency.id);
        issue(errors, idExists ? 'DEPENDENCY_VERSION_NOT_FOUND' : 'UNKNOWN_DEPENDENCY', path, idExists ? `Skill ${dependency.id} exists, but pinned version ${dependency.version} is absent.` : `Dependency ${depKey} is not in this registry snapshot.`);
      } else if (resolved.status === 'draft') {
        issue(errors, 'DEPENDENCY_NOT_PUBLISHED', path, `Dependency ${depKey} is still a draft.`);
      } else edges.push(depKey);
    }
    graph.set(currentKey, edges);
  }

  const visiting = new Set<string>(); const visited = new Set<string>(); const reported = new Set<string>();
  const walk = (node: string, trail: string[]): void => {
    if (visiting.has(node)) {
      const start = trail.indexOf(node); const cycle = [...trail.slice(start < 0 ? 0 : start), node];
      const signature = [...new Set(cycle)].sort().join('|');
      if (!reported.has(signature)) { reported.add(signature); issue(errors, 'DEPENDENCY_CYCLE', node, `Dependency cycle: ${cycle.join(' -> ')}.`); }
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dependency of graph.get(node) ?? []) walk(dependency, [...trail, node]);
    visiting.delete(node); visited.add(node);
  };
  for (const node of graph.keys()) walk(node, []);
  return { valid: errors.length === 0, errors, manifests };
}

/** Metadata-only registry. Discovery and validation never load instructions or invoke tools. */
export class SkillRegistry {
  private entries = new Map<string, SkillManifest>();
  private readonly context: SkillValidationContext;

  constructor(context: SkillValidationContext) { this.context = { workers: context.workers.map((worker) => ({ id: worker.id, capabilities: [...worker.capabilities] })) }; }

  /** Atomic batch registration: an invalid batch leaves the existing registry unchanged. */
  registerMany(input: readonly unknown[]): SkillValidationReport {
    const report = validateSkillManifestSet([...this.entries.values(), ...input], this.context);
    if (report.valid) this.entries = new Map(report.manifests.map((manifest) => [keyOf(manifest.id, manifest.version), manifest]));
    return report;
  }

  discover(workerId?: string): SkillManifest[] {
    return [...this.entries.values()]
      .filter((manifest) => manifest.status === 'published')
      .filter((manifest) => workerId === undefined || manifest.compatible_workers.includes(workerId))
      .sort((a, b) => a.id.localeCompare(b.id) || compareSemver(a.version, b.version));
  }

  resolve(id: string, version?: string): SkillManifest | undefined {
    if (version !== undefined) {
      const exact = this.entries.get(keyOf(id, version));
      return exact && exact.status !== 'draft' ? exact : undefined;
    }
    return this.discover().filter((manifest) => manifest.id === id).sort((a, b) => compareSemver(b.version, a.version))[0];
  }

  /** Pinned dependencies first, root skill last. This only resolves metadata. */
  resolveDependencies(id: string, version: string): SkillManifest[] | undefined {
    const root = this.resolve(id, version);
    if (!root) return undefined;
    const ordered: SkillManifest[] = []; const visited = new Set<string>();
    const visit = (manifest: SkillManifest): void => {
      const key = keyOf(manifest.id, manifest.version);
      if (visited.has(key)) return;
      visited.add(key);
      for (const dependency of manifest.dependencies) {
        const resolved = this.resolve(dependency.id, dependency.version);
        if (!resolved) continue; // validated registries cannot reach this branch
        visit(resolved);
      }
      ordered.push(manifest);
    };
    visit(root);
    return ordered;
  }

  listVersions(id: string): string[] {
    return [...this.entries.values()]
      .filter((manifest) => manifest.id === id && manifest.status !== 'draft')
      .map((manifest) => manifest.version)
      .sort(compareSemver);
  }
}

export { SkillManifestSchema, SKILL_MANIFEST_VERSION } from '../../contracts/src/index.ts';
export type { SkillManifest, SkillStatus } from '../../contracts/src/index.ts';
