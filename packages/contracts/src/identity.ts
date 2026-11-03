import { z } from 'zod';

/**
 * Principal — identitas manusia yang terikat pada token secara server-side.
 *
 * Token (agent/ops) menentukan scope (kapabilitas). Principal menentukan siapa
 * orangnya. Binding dilakukan server-side melalui roster `data/principals.json`,
 * BUKAN dari input klien — kalau tidak ada binding, principal null dan field
 * kepemilikan pada Plan tidak diisi (jangan mengarang state).
 */
export const PrincipalSchema = z
  .object({
    principal_id: z.string().min(1),
    display_name: z.string().min(1),
    org_id: z.string().min(1),
    role: z.string().min(1),
  })
  .strict();

export type Principal = z.infer<typeof PrincipalSchema>;
export const PrincipalIdSchema = z.string().min(1);
