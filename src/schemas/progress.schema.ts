import { z } from 'zod';

export const markProgressSchema = z.object({
  lessonId: z.number().int().positive(),
  isCompleted: z.boolean().default(true),
});

export type MarkProgressInput = z.infer<typeof markProgressSchema>;
