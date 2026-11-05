import { z } from 'zod';
import { ContactIdSchema } from './ids.ts';

export const ResolutionSchema = z.enum(['unique', 'ambiguous', 'none']);
export type Resolution = z.infer<typeof ResolutionSchema>;

export const PrecedentCandidateSchema = z
  .object({
    contact_id: ContactIdSchema,
    score: z.number().min(0).max(1),
    evidence: z.array(z.string()),
    last_used_days_ago: z.number().int().nonnegative(),
    disputed: z.boolean(),
    /*
     * Display fields, so a caller can act on the result without a second lookup.
     * They come from the same contact projection as the search tool — the
     * address stays masked; the raw e-mail never leaves the store.
     */
    display_name: z.string().min(1).optional(),
    department: z.string().optional(),
    masked_address: z.string().optional(),
  })
  .strict();
export type PrecedentCandidate = z.infer<typeof PrecedentCandidateSchema>;

export const PrecedentResultSchema = z
  .object({
    candidates: z.array(PrecedentCandidateSchema),
    resolution: ResolutionSchema,
  })
  .strict();
export type PrecedentResult = z.infer<typeof PrecedentResultSchema>;
