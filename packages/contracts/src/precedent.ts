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
