import type { WorkflowDefinition, WorkflowStep, RunRecord } from '../../contracts/src/index.ts';

/** Registry of workflow definitions. Populated at startup by callers. */
const REGISTRY = new Map<string, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition): void {
  REGISTRY.set(def.workflow_name, def);
}

export function getWorkflow(name: string): WorkflowDefinition | undefined {
  return REGISTRY.get(name);
}

export function listWorkflows(): WorkflowDefinition[] {
  return [...REGISTRY.values()];
}

/**
 * Compute the set of steps whose dependencies are all satisfied given `done`.
 * Pure function — no side effects, no state.
 */
export function readySteps(def: WorkflowDefinition, done: Set<string>): WorkflowStep[] {
  return def.steps.filter(
    (s) => !done.has(s.id) && s.depends_on.every((d) => done.has(d)),
  );
}

/**
 * Validate a workflow definition: every depends_on refers to an existing step,
 * and there is at least one root step. Returns list of error messages (empty = ok).
 */
export function validateDefinition(def: WorkflowDefinition): string[] {
  const ids = new Set(def.steps.map((s) => s.id));
  const errors: string[] = [];
  for (const s of def.steps) {
    for (const d of s.depends_on) {
      if (!ids.has(d)) errors.push(`step ${s.id}: unknown dependency ${d}`);
    }
  }
  if (!def.steps.some((s) => s.depends_on.length === 0)) {
    errors.push('workflow has no root step (every step depends on another)');
  }
  return errors;
}

export type { WorkflowDefinition, WorkflowStep, RunRecord, RunStatus } from '../../contracts/src/index.ts';
