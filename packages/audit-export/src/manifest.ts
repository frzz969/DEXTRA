import { z } from 'zod';

/**
 * Version of the export format, not of the audit format.
 *
 * Bump it whenever the event schema, the manifest shape, or the canonical hash
 * rule changes. The verifier refuses a manifest whose version it does not
 * implement instead of guessing: an export that "probably still works" is the
 * kind of claim this project keeps having to remove.
 */
export const EXPORT_FORMAT_VERSION = '1.0.0';

const EventRefSchema = z
  .object({
    event_id: z.string().min(1),
    at: z.string().min(1),
    hash: z.string().nullable(),
  })
  .strict();

/**
 * The verdict as it stood at export time.
 *
 * Deliberately the same shape the live endpoint returns, including the fields
 * that make a partial answer honest: `unchained` (old events, never verified),
 * `broken_at` (first bad link), `malformed_at` (first unparseable line).
 */
const IntegritySchema = z
  .object({
    verified: z.number().int().min(0),
    unchained: z.number().int().min(0),
    broken_at: z.string().nullable(),
    broken_index: z.number().int().min(0).nullable(),
    malformed_at: z.number().int().min(0).nullable(),
    checkpoint_status: z.enum(['matches', 'missing', 'truncated', 'ahead', 'head_mismatch']),
    ok: z.boolean(),
  })
  .strict();

const CheckpointSchema = z
  .object({
    event_count: z.number().int().min(0),
    head_hash: z.string(),
    at: z.string(),
  })
  .strict();

const ArtifactSchema = z
  .object({
    file: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().min(0),
    lines: z.number().int().min(0),
  })
  .strict();

export const AuditExportManifestSchema = z
  .object({
    format_version: z.literal(EXPORT_FORMAT_VERSION),
    export_id: z.string().regex(/^exp_[a-f0-9]{12}$/),
    /** ISO 8601 with offset. Always UTC in practice; the offset is what makes it unambiguous. */
    exported_at: z.string().datetime({ offset: true }),
    /** Principal id, or `scope:<name>` when the token has no bound principal. */
    exported_by: z.string().min(1),
    /**
     * Basename only. An absolute path would leak the exporter's directory
     * layout into an artifact that is meant to be shared and inspected.
     */
    source: z.object({ file: z.string().min(1) }).strict(),
    event_count: z.number().int().min(0),
    range: z
      .object({
        first: EventRefSchema.nullable(),
        last: EventRefSchema.nullable(),
      })
      .strict(),
    integrity: IntegritySchema,
    checkpoint: CheckpointSchema.nullable(),
    artifact: ArtifactSchema,
  })
  .strict();

export type AuditExportManifest = z.infer<typeof AuditExportManifestSchema>;
