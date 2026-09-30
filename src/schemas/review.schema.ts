import { z } from 'zod';
import { paginationSchema } from './common.schema';

export const createReviewSchema = z
  .object({
    courseId: z.number().int().positive(),
    rating: z.number().int().min(1, 'El rating mínimo es 1').max(5, 'El rating máximo es 5'),
    comment: z.string().trim().max(1500).optional(),
  })
  .strict();

export const listReviewsQuerySchema = paginationSchema;

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
