import { z } from 'zod';
import { CapabilitySchema } from './authorization.ts';

/** Metadata only: instructions are a separately referenced artifact and never executed by this contract. */
export const SKILL_MANIFEST_VERSION = '1.0.0' as const;

const SkillIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
const SkillVersionSchema = z.string().min(1);

export const SkillStatusSchema = z.enum(['draft', 'published', 'deprecated']);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

export const SkillInstructionRefSchema = z.object({
  /** Relative path within the skill bundle; consumers must enforce the bundle root. */
  path: z.string().min(1),
  /** Integrity pin for the separate instruction artifact. */
  sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
export type SkillInstructionRef = z.infer<typeof SkillInstructionRefSchema>;

export const SkillDependencySchema = z.object({
  id: SkillIdSchema,
  /** Exact SemVer pin; ranges are intentionally unsupported in manifest v1. */
  version: SkillVersionSchema,
}).strict();
export type SkillDependency = z.infer<typeof SkillDependencySchema>;

export const SkillPermissionRequirementSchema = z.object({
  capability: CapabilitySchema,
  resource_scope: z.enum(['assigned_work', 'own_records', 'organization']),
  /** A declaration of need, not a permission grant. */
  approval: z.enum(['not_required', 'human_mandate_required']),
}).strict();
export type SkillPermissionRequirement = z.infer<typeof SkillPermissionRequirementSchema>;

const MetadataValueSchema = z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(),
  z.array(z.union([z.string(), z.number().finite(), z.boolean(), z.null()])),
]);

export const SkillManifestSchema = z.object({
  manifest_version: z.string().min(1),
  id: SkillIdSchema,
  name: z.string().trim().min(1).max(120),
  /** Strict SemVer is checked by the registry validator. */
  version: SkillVersionSchema,
  description: z.string().trim().min(1).max(1000),
  /** Pointer + digest, never prompt text. */
  instructions: SkillInstructionRefSchema,
  /** JSON Schema subset validated statically by @dextra/skill-registry. */
  input_schema: z.record(z.unknown()),
  output_schema: z.record(z.unknown()),
  /** Worker skill competencies (e.g. route_task); distinct from MCP authorization capabilities. */
  required_capabilities: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
  permission_requirements: z.array(SkillPermissionRequirementSchema),
  dependencies: z.array(SkillDependencySchema),
  compatible_workers: z.array(z.string().min(1)).min(1),
  status: SkillStatusSchema,
  metadata: z.record(MetadataValueSchema),
}).strict();
export type SkillManifest = z.infer<typeof SkillManifestSchema>;
export type SkillManifestInput = z.input<typeof SkillManifestSchema>;
