import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Envuelve controllers async para enviar cualquier error al errorHandler */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
