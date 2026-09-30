import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * Validación de variables de entorno al arrancar (fail fast).
 * Si falta algo crítico, la app no levanta y muestra qué variable falta.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),

    DATABASE_URL: z.preprocess((v) => (v === '' ? undefined : v), z.string().url().optional()),
    PG_HOST: z.string().default('localhost'),
    PG_PORT: z.coerce.number().int().positive().default(5432),
    PG_USER: z.string().default('postgres'),
    PG_PASSWORD: z.string().default(''),
    PG_DATABASE: z.string().default('edutrack_db'),
    PG_SSL: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatoria'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
    JWT_EXPIRES_IN: z.string().default('24h'),

    FRONTEND_URL: z.string().default('*'),
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`❌ Variables de entorno inválidas:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
