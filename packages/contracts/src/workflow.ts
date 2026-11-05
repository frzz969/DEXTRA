import { z } from 'zod';

/**
 * Workflow conductor — sumber kebenaran deklarasi langkah.
 *
 * Sebuah run adalah instansi dari sebuah workflow. Langkah-langkahnya
 * dideklarasikan statis (bukan oleh model) dan dieksekusi berurutan sesuai
 * `depends_on`. Langkah `code` dijalankan server-side (deterministik);
 * langkah `reasoning` mengembalikan prompt + skema hasil, lalu agen harus
 * memanggil `advance_run` dengan hasilnya.
 *
 * Ini adalah fondasi "subagent yang bisa dispawn" di dalam produk: urutan
 * ditegakkan server, bukan saran di prompt.
 */
export const StepTypeSchema = z.enum(['code', 'reasoning']);
export type StepType = z.infer<typeof StepTypeSchema>;

export const WorkflowStepSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    step_type: StepTypeSchema,
    depends_on: z.array(z.string()).default([]),
    /** Tool MCP yang dipanggil langkah ini (informasi, bukan eksekusi otomatis). */
    invokes: z.array(z.string()).default([]),
    /** Untuk step_type=code: nama fungsi deterministik yang dijalankan server. */
    callable: z.string().optional(),
    /** Pemetaan input dari hasil langkah sebelumnya: {param: stepId}. */
    input_map: z.record(z.string()).optional(),
    optional: z.boolean().default(false),
    /** Untuk step_type=reasoning: skema hasil yang wajib dikembalikan agen. */
    result_schema: z.record(z.unknown()).optional(),
  })
  .strict();
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowDefinitionSchema = z
  .object({
    workflow_name: z.string().min(1),
    workflow_id: z.string().min(1),
    description: z.string().min(1),
    execution: z.enum(['main', 'subagent']).default('main'),
    steps: z.array(WorkflowStepSchema).min(1),
  })
  .strict();
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

export const RunStatusSchema = z.enum(['queued', 'running', 'waiting_reasoning', 'completed', 'failed', 'cancelled']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunRecordSchema = z
  .object({
    run_id: z.string().min(1),
    workflow_name: z.string().min(1),
    status: RunStatusSchema,
    current_step: z.string().nullable(),
    results: z.record(z.unknown()).default({}),
    error: z.string().nullable().default(null),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
  })
  .strict();
export type RunRecord = z.infer<typeof RunRecordSchema>;
