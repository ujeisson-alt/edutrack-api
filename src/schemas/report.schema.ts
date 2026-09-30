import { z } from 'zod';

export const reportQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, { message: '"from" no puede ser posterior a "to"', path: ['from'] });

export type ReportQuery = z.infer<typeof reportQuerySchema>;
