import { NextFunction, Request, Response } from 'express';
import { createError } from './errorHandler';
import { UserRole } from '../types';
import { verifyToken } from '../utils/jwt';

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.split(' ')[1] ?? null;
};

/** Exige un JWT válido. Deja el usuario en req.user */
export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (!token) {
    next(createError('Token no proporcionado', 401));
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(createError('Token inválido o expirado', 401));
  }
};

/**
 * Autenticación opcional: si viene un token válido se usa,
 * si no viene (o es inválido) la ruta sigue como pública.
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = extractToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = undefined;
    }
  }
  next();
};

/** Acepta uno o varios roles permitidos */
export const requireRoles =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Token no proporcionado', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(createError(`Acceso restringido a: ${roles.join(', ')}`, 403));
      return;
    }
    next();
  };
