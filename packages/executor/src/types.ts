import type { ActionId, ActionResult, ErrorCode, Mandate, MandateId, Plan } from '../../contracts/src/index.ts';

export type { ActionId, ActionResult, ErrorCode, Mandate, MandateId, Plan };
export { ActionResultSchema } from '../../contracts/src/index.ts';

export interface ExecuteInput {
  mandate_id: MandateId;
  action_id: ActionId;
  execution_key: string;
  now?: string;
}

export type ExecuteResult = ActionResult;
