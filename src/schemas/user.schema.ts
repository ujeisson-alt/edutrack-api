import { z } from 'zod';
import { USER_ROLES } from '../types';
import { paginationSchema } from './common.schema';
import { passwordSchema } from './auth.schema';

const booleanString = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listUsersQuerySchema = paginationSchema.extend({
  role: z.enum(USER_ROLES).optional(),
  isActive: booleanString.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    email: z.string().trim().toLowerCase().email('Email inválido').max(200).optional(),
    bio: z.string().max(1000).nullable().optional(),
    avatarUrl: z.string().url('avatarUrl debe ser una URL válida').max(500).nullable().optional(),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
    // Solo ADMIN puede modificar estos campos (se controla en el controller)
    role: z.enum(USER_ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'Debe enviar al menos un campo para actualizar' })
  .refine((d) => !d.newPassword || !!d.currentPassword, {
    message: 'currentPassword es obligatorio para cambiar la contraseña',
    path: ['currentPassword'],
  });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
