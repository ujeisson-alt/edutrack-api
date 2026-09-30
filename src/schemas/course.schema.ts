import { z } from 'zod';
import { paginationSchema } from './common.schema';

export const createCourseSchema = z
  .object({
    title: z.string().trim().min(5, 'El título debe tener al menos 5 caracteres').max(200),
    description: z.string().max(2000).optional(),
    categoryId: z.number().int().positive().optional(),
    price: z.number().min(0, 'El precio no puede ser negativo').max(99999999.99).default(0),
    maxStudents: z.number().int().min(1).max(500).default(30),
    isPublished: z.boolean().default(false),
    // Solo ADMIN: crear un curso a nombre de un docente
    teacherId: z.number().int().positive().optional(),
  })
  .strict();

export const updateCourseSchema = z
  .object({
    title: z.string().trim().min(5, 'El título debe tener al menos 5 caracteres').max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    price: z.number().min(0, 'El precio no puede ser negativo').max(99999999.99).optional(),
    maxStudents: z.number().int().min(1).max(500).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Debe enviar al menos un campo para actualizar' });

export const listCoursesQuerySchema = paginationSchema
  .extend({
    search: z.string().trim().min(1).max(100).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    teacherId: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['createdAt', 'price', 'title']).default('createdAt'),
    order: z.enum(['ASC', 'DESC', 'asc', 'desc']).default('DESC').transform((o) => o.toUpperCase() as 'ASC' | 'DESC'),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice no puede ser mayor que maxPrice',
    path: ['minPrice'],
  });

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type ListCoursesQuery = z.infer<typeof listCoursesQuerySchema>;
