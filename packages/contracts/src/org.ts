import { z } from 'zod';
import { OrgIdSchema } from './ids.ts';

const HhMmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const YyyyMmDdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const OfficeHoursSchema = z
  .object({
    start: HhMmSchema,
    end: HhMmSchema,
  })
  .strict();
export type OfficeHours = z.infer<typeof OfficeHoursSchema>;

export const PrayerWindowSchema = z
  .object({
    start: HhMmSchema,
    end: HhMmSchema,
  })
  .strict();
export type PrayerWindow = z.infer<typeof PrayerWindowSchema>;

export const OrgSchema = z
  .object({
    org_id: OrgIdSchema,
    timezones: z.array(z.string().min(1)).min(1),
    office_hours: OfficeHoursSchema,
    friday_prayer: PrayerWindowSchema.nullable(),
    holidays: z.array(YyyyMmDdSchema),
    approval_matrix_version: z.string().min(1),
    contract_version: z.string().min(1),
  })
  .strict();
export type Org = z.infer<typeof OrgSchema>;
