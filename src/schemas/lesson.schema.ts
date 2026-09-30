import { z } from 'zod';

export const createLessonSchema = z
  .object({
    title: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres').max(200),
    content: z.string().max(50000).optional(),
    orderIndex: z.number().int().min(0).optional(), // si no se envía, va al final
    durationMinutes: z.number().int().positive().max(1440).optional(),
  })
  .strict();

export const updateLessonSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    content: z.string().max(50000).nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
    durationMinutes: z.number().int().positive().max(1440).nullable().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Debe enviar al menos un campo para actualizar' });

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
