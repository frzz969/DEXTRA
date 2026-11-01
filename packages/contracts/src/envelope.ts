import { z } from 'zod';
import { ERROR_CODES } from './errors.ts';
import { RequestIdSchema } from './ids.ts';

export const CallerSchema = z.enum(['agent', 'dashboard', 'executor', 'service']);
export type Caller = z.infer<typeof CallerSchema>;

export const ToolRequestSchema = z
  .object({
    request_id: RequestIdSchema,
    tool: z.string().min(1),
    args: z.record(z.string(), z.unknown()),
    caller: CallerSchema,
  })
  .strict();
export type ToolRequest = z.infer<typeof ToolRequestSchema>;

export const ToolSuccessSchema = z
  .object({
    ok: z.literal(true),
    data: z.unknown(),
    request_id: RequestIdSchema,
  })
  .strict();
export type ToolSuccess = z.infer<typeof ToolSuccessSchema>;

export const ToolFailureSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: ERROR_CODES,
        message: z.string(),
      })
      .strict(),
    request_id: RequestIdSchema,
  })
  .strict();
export type ToolFailure = z.infer<typeof ToolFailureSchema>;

export const ToolResponseSchema = z.discriminatedUnion('ok', [ToolSuccessSchema, ToolFailureSchema]);
export type ToolResponse = z.infer<typeof ToolResponseSchema>;
