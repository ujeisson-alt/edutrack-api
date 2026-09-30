import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  ForeignKeyConstraintError,
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
  DatabaseError,
} from 'sequelize';
import { isProduction } from '../config/env';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export const createError = (message: string, statusCode: number, details?: unknown): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  if (details !== undefined) error.details = details;
  return error;
};

interface MongoDuplicateKeyError extends Error {
  code: number;
}

const isMongoDuplicate = (err: unknown): err is MongoDuplicateKeyError =>
  err instanceof Error && (err as Partial<MongoDuplicateKeyError>).code === 11000;

/**
 * Traduce errores conocidos (Zod, Sequelize, Mongo, JSON mal formado)
 * a respuestas HTTP coherentes. Todo pasa por aquí.
 */
const normalize = (err: unknown): AppError => {
  if (err instanceof ZodError) {
    return createError(
      'Datos de entrada inválidos',
      400,
      err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    );
  }
  if (err instanceof UniqueConstraintError) {
    return createError(
      'El recurso ya existe (valor duplicado)',
      409,
      err.errors.map((e) => ({ field: e.path, message: e.message })),
    );
  }
  if (err instanceof ForeignKeyConstraintError) {
    return createError('Referencia inválida o recurso relacionado en uso', 409);
  }
  if (err instanceof SequelizeValidationError) {
    return createError(
      'Error de validación en base de datos',
      400,
      err.errors.map((e) => ({ field: e.path, message: e.message })),
    );
  }
  if (isMongoDuplicate(err)) {
    return createError('El recurso ya existe (valor duplicado)', 409);
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return createError('JSON mal formado en el body', 400);
  }
  if (err instanceof DatabaseError) {
    logger.error('DatabaseError', err.message);
    return createError('Error de base de datos', 500);
  }
  if (err instanceof Error) return err as AppError;
  return createError('Error interno del servidor', 500);
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const error = normalize(err);
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) logger.error(error.message, error.stack);

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && isProduction ? 'Error interno del servidor' : error.message,
    ...(error.details !== undefined && { errors: error.details }),
    ...(!isProduction && statusCode >= 500 && { stack: error.stack }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};
