import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env';

/** Login / register: 10 intentos cada 15 minutos por IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => isTest,
  message: { success: false, message: 'Demasiados intentos. Intentá en 15 minutos.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

/** Límite general: 100 requests por minuto por IP */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  skip: () => isTest,
  message: { success: false, message: 'Demasiadas solicitudes. Intentá en un minuto.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
