import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña no puede superar 72 caracteres') // límite de bcrypt
  .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
  .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
  .regex(/[0-9]/, 'Debe incluir al menos un número');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(150),
    email: z.string().trim().toLowerCase().email('Email inválido').max(200),
    password: passwordSchema,
    // ADMIN no se puede auto-registrar: solo STUDENT o TEACHER
    role: z.enum(['STUDENT', 'TEACHER']).default('STUDENT'),
    bio: z.string().max(1000).optional(),
  })
  .strict();

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
