import { z } from 'zod';

export const idSchema = z.coerce.number().int('Debe ser un entero').positive('Debe ser un entero positivo');

export const idParamSchema = z.object({ id: idSchema });
export const courseLessonParamsSchema = z.object({ id: idSchema, lessonId: idSchema });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type IdParam = z.infer<typeof idParamSchema>;
export type CourseLessonParams = z.infer<typeof courseLessonParamsSchema>;
