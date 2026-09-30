import { z } from 'zod';
import { ENROLLMENT_STATUSES, PAYMENT_STATUSES } from '../types';

export const createEnrollmentSchema = z.object({
  courseId: z.number().int().positive('El courseId debe ser un entero positivo'),
});

export const updateEnrollmentStatusSchema = z
  .object({
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  })
  .strict()
  .refine((d) => d.status !== undefined || d.paymentStatus !== undefined, {
    message: 'Debe enviar status y/o paymentStatus',
  });

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentStatusInput = z.infer<typeof updateEnrollmentStatusSchema>;
