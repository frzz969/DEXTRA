import { z } from 'zod';

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const BlastRadiusSchema = z.enum(['single_recipient', 'internal_group', 'external_group']);
export type BlastRadius = z.infer<typeof BlastRadiusSchema>;
