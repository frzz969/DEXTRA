import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { validateDefinition, readySteps } from '../src/index.ts';
import type { WorkflowDefinition } from '../../contracts/src/index.ts';

const def: WorkflowDefinition = {
  workflow_name: 'demo',
  workflow_id: 'wf_demo',
  description: 'demo',
  execution: 'main',
  steps: [
    { id: 'a', name: 'A', step_type: 'code', depends_on: [], invokes: [], optional: false },
    { id: 'b', name: 'B', step_type: 'reasoning', depends_on: ['a'], invokes: [], optional: false },
  ],
};

describe('workflow package', () => {
  test('valid definition has no errors', () => {
    assert.deepEqual(validateDefinition(def), []);
  });
  test('readySteps returns root first', () => {
    const r = readySteps(def, new Set());
    assert.equal(r.length, 1);
    assert.equal(r[0]!.id, 'a');
  });
  test('readySteps returns dependent after root done', () => {
    const r = readySteps(def, new Set(['a']));
    assert.equal(r.length, 1);
    assert.equal(r[0]!.id, 'b');
  });
  test('invalid dependency is reported', () => {
    const bad: WorkflowDefinition = { ...def, steps: [{ id: 'x', name: 'X', step_type: 'code', depends_on: ['nope'], invokes: [], optional: false }] };
    assert.ok(validateDefinition(bad).length > 0);
  });
});
